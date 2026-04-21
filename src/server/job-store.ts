import { randomUUID } from "node:crypto"

import type {
  ExportJobItem,
  ExportJobState,
  ExportManifest,
  ExportRequest,
} from "../shared/types.js"

export class JobStore {
  readonly jobs = new Map<string, ExportJobState>()

  create(request: ExportRequest) {
    const id = randomUUID()
    const state: ExportJobState = {
      id,
      request,
      status: "queued",
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

  get(id: string) {
    return this.jobs.get(id) ?? null
  }

  start(id: string) {
    const job = this.mustGet(id)
    job.status = "running"
    job.startedAt = new Date().toISOString()
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
    job.progress = {
      total: manifest.totalPosts,
      completed: manifest.successCount,
      failed: manifest.failureCount,
      warnings: manifest.warningCount,
    }
    job.upload = manifest.upload
    job.items = job.items.length > 0 ? job.items : manifest.posts.map((post) => ({
      id: post.outputPath ?? `failed:${post.logNo}`,
      logNo: post.logNo,
      title: post.title,
      source: post.source,
      category: post.category,
      status: post.status,
      outputPath: post.outputPath,
      assetPaths: post.assetPaths,
      upload: post.upload,
      warnings: post.warnings,
      warningCount: post.warningCount,
      error: post.error,
      externalPreviewUrl: post.externalPreviewUrl ?? null,
      updatedAt: new Date().toISOString(),
    }))

    if (manifest.upload.status === "upload-ready") {
      job.status = "upload-ready"
      job.finishedAt = null
      return
    }

    job.status = "completed"
    job.finishedAt = new Date().toISOString()
  }

  startUpload(id: string) {
    const job = this.mustGet(id)
    const updatedAt = new Date().toISOString()

    job.status = "uploading"
    job.error = null
    job.upload = {
      ...job.upload,
      status: "uploading",
      uploadedCount: 0,
      failedCount: 0,
      terminalReason: null,
    }
    job.finishedAt = null
    job.items = job.items.map((item) =>
      item.upload.eligible
        ? {
            ...item,
            upload: {
              ...item.upload,
              uploadedCount: 0,
              failedCount: 0,
            },
            updatedAt,
          }
        : item,
    )
  }

  updateUpload(id: string, upload: ExportJobState["upload"]) {
    const job = this.mustGet(id)
    job.upload = upload
  }

  completeUpload(id: string, input: { manifest: ExportManifest; items: ExportJobItem[] }) {
    const job = this.mustGet(id)

    job.status = "upload-completed"
    job.finishedAt = new Date().toISOString()
    job.manifest = input.manifest
    job.items = input.items
    job.upload = input.manifest.upload
  }

  failUpload(id: string, error: string) {
    const job = this.mustGet(id)

    job.status = "upload-failed"
    job.finishedAt = new Date().toISOString()
    job.error = error
    job.upload = {
      ...job.upload,
      status: "upload-failed",
      failedCount: job.upload.candidateCount - job.upload.uploadedCount,
      terminalReason: null,
    }
  }

  fail(id: string, error: string) {
    const job = this.mustGet(id)
    job.status = "failed"
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
