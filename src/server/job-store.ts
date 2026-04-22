import { randomUUID } from "node:crypto"

import type {
  ExportJobItem,
  ExportJobState,
  ExportManifest,
  ExportRequest,
} from "../shared/types.js"

const getJobItemId = ({
  outputPath,
  logNo,
}: {
  outputPath: string | null
  logNo: string
}) => outputPath ?? `failed:${logNo}`

const buildJobItemFromPost = (
  post: ExportManifest["posts"][number],
  updatedAt: string,
): ExportJobItem => ({
  id: getJobItemId(post),
  logNo: post.logNo,
  title: post.title,
  source: post.source,
  category: post.category,
  editorVersion: post.editorVersion,
  status: post.status,
  outputPath: post.outputPath,
  assetPaths: post.assetPaths,
  upload: post.upload,
  warnings: post.warnings,
  warningCount: post.warningCount,
  error: post.error,
  updatedAt,
})

const countUploadedCandidates = ({
  item,
  uploadedLocalPaths,
}: {
  item: ExportJobItem
  uploadedLocalPaths: Set<string>
}) =>
  item.upload.candidates.reduce(
    (count, candidate) => count + (uploadedLocalPaths.has(candidate.localPath) ? 1 : 0),
    0,
  )

const syncManifestPostsFromItems = ({
  manifest,
  items,
}: {
  manifest: ExportManifest
  items: ExportJobItem[]
}) => {
  const itemById = new Map(items.map((item) => [getJobItemId(item), item]))

  manifest.posts = manifest.posts.map((post) => {
    const item = itemById.get(getJobItemId(post))

    if (!item) {
      return post
    }

    return {
      ...post,
      assetPaths: item.assetPaths,
      upload: item.upload,
    }
  })
}

export class JobStore {
  readonly jobs = new Map<string, ExportJobState>()

  create(request: ExportRequest) {
    const id = randomUUID()
    const state: ExportJobState = {
      id,
      request,
      status: "queued",
      resumeAvailable: false,
      logs: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        warnings: 0,
      },
      upload: {
        status: "not-requested",
        eligiblePostCount: 0,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      items: [],
      manifest: null,
      error: null,
    }

    this.jobs.set(id, state)

    return state
  }

  hydrate(manifest: ExportManifest) {
    if (!manifest.job) {
      throw new Error("manifest job snapshot is missing")
    }

    const state: ExportJobState = {
      id: manifest.job.id,
      request: manifest.job.request,
      status: manifest.job.status,
      resumeAvailable: manifest.job.status === "running" || manifest.job.status === "uploading",
      logs: [],
      createdAt: manifest.job.createdAt,
      startedAt: manifest.job.startedAt,
      finishedAt: manifest.job.finishedAt,
      progress: manifest.job.progress,
      upload: manifest.job.upload,
      items: manifest.posts.map((post) => buildJobItemFromPost(post, manifest.job!.updatedAt)),
      manifest,
      error: manifest.job.error,
    }

    this.jobs.set(state.id, state)

    return state
  }

  get(id: string) {
    return this.jobs.get(id) ?? null
  }

  delete(id: string) {
    this.jobs.delete(id)
  }

  start(id: string) {
    const job = this.mustGet(id)
    job.status = "running"
    job.resumeAvailable = false
    job.startedAt = new Date().toISOString()
  }

  resume(id: string) {
    const job = this.mustGet(id)
    job.resumeAvailable = false
    job.finishedAt = null
    job.error = null
  }

  appendLog(id: string, message: string) {
    const job = this.mustGet(id)

    job.logs.push({
      timestamp: new Date().toISOString(),
      message,
    })
  }

  updateProgress(
    id: string,
    progress: {
      total: number
      completed: number
      failed: number
      warnings: number
    },
  ) {
    const job = this.mustGet(id)
    job.progress = progress
  }

  appendItem(id: string, item: ExportJobItem) {
    const job = this.mustGet(id)
    const existingItemIndex = job.items.findIndex((existing) => existing.id === item.id)

    if (existingItemIndex >= 0) {
      job.items[existingItemIndex] = item
      return
    }

    job.items.push(item)
  }

  completeExport(id: string, manifest: ExportManifest) {
    const job = this.mustGet(id)
    job.manifest = manifest
    job.resumeAvailable = false
    job.progress = {
      total: manifest.totalPosts,
      completed: manifest.successCount,
      failed: manifest.failureCount,
      warnings: manifest.warningCount,
    }
    job.upload = manifest.upload
    job.items = job.items.length > 0 ? job.items : manifest.posts.map((post) => buildJobItemFromPost(post, new Date().toISOString()))

    if (manifest.upload.status === "upload-ready") {
      job.status = "upload-ready"
      job.finishedAt = null
      return
    }

    job.status = "completed"
    job.finishedAt = new Date().toISOString()
  }

  startUpload(id: string, initialUploadedLocalPaths: Set<string> = new Set()) {
    const job = this.mustGet(id)
    const updatedAt = new Date().toISOString()

    job.status = "uploading"
    job.resumeAvailable = false
    job.error = null
    job.upload = {
      ...job.upload,
      status: "uploading",
      uploadedCount: initialUploadedLocalPaths.size,
      failedCount: 0,
      terminalReason: null,
    }
    job.finishedAt = null
    job.items = job.items.map((item) =>
      item.upload.eligible
        ? item.upload.rewriteStatus === "completed"
          ? item
          : {
              ...item,
              upload: {
                ...item.upload,
                uploadedCount: countUploadedCandidates({
                  item,
                  uploadedLocalPaths: initialUploadedLocalPaths,
                }),
                failedCount: 0,
                uploadedUrls: [],
                rewriteStatus: "pending",
                rewrittenAt: null,
              },
              updatedAt,
            }
        : item,
    )

    if (job.manifest) {
      job.manifest.upload = {
        ...job.manifest.upload,
        status: "uploading",
        uploadedCount: initialUploadedLocalPaths.size,
        failedCount: 0,
        terminalReason: null,
      }
      syncManifestPostsFromItems({
        manifest: job.manifest,
        items: job.items,
      })
    }
  }

  updateUpload(id: string, upload: ExportJobState["upload"]) {
    const job = this.mustGet(id)
    job.upload = upload
  }

  completeUpload(id: string, input: { manifest: ExportManifest; items: ExportJobItem[] }) {
    const job = this.mustGet(id)

    job.status = "upload-completed"
    job.resumeAvailable = false
    job.finishedAt = new Date().toISOString()
    job.manifest = input.manifest
    job.items = input.items
    job.upload = input.manifest.upload
  }

  failUpload(id: string, error: string) {
    const job = this.mustGet(id)
    const updatedAt = new Date().toISOString()

    job.status = "upload-failed"
    job.resumeAvailable = false
    job.finishedAt = new Date().toISOString()
    job.error = error
    job.upload = {
      ...job.upload,
      status: "upload-failed",
      failedCount: job.upload.candidateCount - job.upload.uploadedCount,
      terminalReason: null,
    }
    job.items = job.items.map((item) =>
      item.upload.eligible && item.upload.rewriteStatus !== "completed"
        ? {
            ...item,
            upload: {
              ...item.upload,
              failedCount: Math.max(item.upload.candidateCount - item.upload.uploadedCount, 0),
              rewriteStatus: "failed",
            },
            updatedAt,
          }
        : item,
    )

    if (job.manifest) {
      job.manifest.upload = {
        ...job.manifest.upload,
        status: "upload-failed",
        uploadedCount: job.upload.uploadedCount,
        failedCount: job.upload.failedCount,
        terminalReason: null,
      }
      syncManifestPostsFromItems({
        manifest: job.manifest,
        items: job.items,
      })
    }
  }

  fail(id: string, error: string) {
    const job = this.mustGet(id)
    job.status = "failed"
    job.resumeAvailable = false
    job.finishedAt = new Date().toISOString()
    job.error = error
  }

  private mustGet(id: string) {
    const job = this.jobs.get(id)

    if (!job) {
      throw new Error(`job not found: ${id}`)
    }

    return job
  }
}
