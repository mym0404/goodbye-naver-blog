import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  ExportJobItem,
  ExportJobState,
  ExportManifest,
  ExportResumePhase,
  PostManifestEntry,
  ScanResult,
} from "../shared/types.js"
import { extractBlogId, resolveRepoPath } from "../shared/utils.js"

const manifestFileName = "manifest.json"

const getJobItemId = ({
  outputPath,
  logNo,
}: {
  outputPath: string | null
  logNo: string
}) => outputPath ?? `failed:${logNo}`

const buildPostManifestEntryFromItem = (item: ExportJobItem): PostManifestEntry => ({
  logNo: item.logNo,
  title: item.title,
  source: item.source,
  category: item.category,
  editorVersion: item.editorVersion ?? null,
  status: item.status,
  outputPath: item.outputPath,
  assetPaths: item.assetPaths,
  upload: item.upload,
  warnings: item.warnings,
  warningCount: item.warningCount,
  error: item.error,
  externalPreviewUrl: item.externalPreviewUrl ?? null,
})

const buildPersistedJobItem = (item: ExportJobItem): ExportJobItem => ({
  ...item,
  warnings: [],
  externalPreviewUrl: null,
})

const buildPersistedScanResult = (scanResult: ScanResult | null) => {
  if (!scanResult) {
    return null
  }

  const { posts: _posts, ...scanResultWithoutPosts } = scanResult

  return scanResultWithoutPosts
}

const mergeManifestPosts = ({
  manifest,
  items,
}: {
  manifest: ExportManifest
  items: ExportJobItem[]
}) => {
  if (items.length === 0) {
    return manifest.posts
  }

  const postById = new Map(manifest.posts.map((post) => [getJobItemId(post), post]))

  return items.map((item) => {
    const existingPost = postById.get(item.id)

    return {
      ...existingPost,
      ...buildPostManifestEntryFromItem(item),
      editorVersion: item.editorVersion ?? existingPost?.editorVersion ?? null,
    } satisfies PostManifestEntry
  })
}

const resolveExportResumePhase = (status: ExportJobState["status"]): ExportResumePhase => {
  if (status === "upload-ready") {
    return "upload-ready"
  }

  if (status === "uploading") {
    return "uploading"
  }

  if (
    status === "completed" ||
    status === "upload-completed" ||
    status === "upload-failed" ||
    status === "failed"
  ) {
    return "result"
  }

  return "export"
}

const buildFallbackManifest = ({
  job,
  scanResult,
}: {
  job: ExportJobState
  scanResult: ScanResult | null
}): ExportManifest => ({
  blogId: scanResult?.blogId ?? extractBlogId(job.request.blogIdOrUrl) ?? job.request.blogIdOrUrl,
  profile: job.request.profile,
  options: job.request.options,
  selectedCategoryIds: job.request.options.scope.categoryIds,
  startedAt: job.startedAt ?? job.createdAt,
  finishedAt: job.finishedAt,
  totalPosts: job.progress.total,
  successCount: job.progress.completed,
  failureCount: job.progress.failed,
  warningCount: job.progress.warnings,
  upload: job.upload,
  categories: scanResult?.categories ?? [],
  posts: job.items.map((item) => buildPostManifestEntryFromItem(item)),
})

export const getExportManifestPath = (outputDir: string) =>
  path.join(resolveRepoPath(outputDir), manifestFileName)

export const readExportManifest = async (outputDir: string) => {
  try {
    const raw = await readFile(getExportManifestPath(outputDir), "utf8")

    return JSON.parse(raw) as ExportManifest
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

export const buildResumableExportManifest = ({
  job,
  scanResult,
}: {
  job: ExportJobState
  scanResult: ScanResult | null
}): ExportManifest => {
  const baseManifest = job.manifest ?? buildFallbackManifest({
    job,
    scanResult,
  })
  const persistedJobItems = job.items.map((item) => buildPersistedJobItem(item))
  const persistedScanResult = buildPersistedScanResult(scanResult)
  const mergedPosts = mergeManifestPosts({
    manifest: baseManifest,
    items: job.items,
  })

  return {
    ...baseManifest,
    blogId: scanResult?.blogId ?? baseManifest.blogId,
    profile: job.request.profile,
    options: job.request.options,
    selectedCategoryIds: job.request.options.scope.categoryIds,
    startedAt: job.startedAt ?? baseManifest.startedAt ?? job.createdAt,
    finishedAt: job.finishedAt,
    totalPosts: job.progress.total || baseManifest.totalPosts,
    successCount: job.progress.completed,
    failureCount: job.progress.failed,
    warningCount: job.progress.warnings,
    upload: job.upload,
    categories: scanResult?.categories ?? baseManifest.categories,
    posts: mergedPosts,
    job: {
      id: job.id,
      phase: resolveExportResumePhase(job.status),
      request: job.request,
      status: job.status,
      logs: job.logs,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      updatedAt: new Date().toISOString(),
      progress: job.progress,
      upload: job.upload,
      items: persistedJobItems,
      error: job.error,
      scanResult: persistedScanResult,
      summary: {
        status: job.status,
        outputDir: job.request.outputDir,
        totalPosts: job.progress.total,
        completedCount: job.progress.completed,
        failedCount: job.progress.failed,
        uploadCandidateCount: job.upload.candidateCount,
        uploadedCount: job.upload.uploadedCount,
      },
    },
  }
}

export const writeExportManifest = async ({
  outputDir,
  manifest,
}: {
  outputDir: string
  manifest: ExportManifest
}) => {
  const manifestPath = getExportManifestPath(outputDir)
  const tempPath = `${manifestPath}.${randomUUID()}.tmp`

  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf8")

  try {
    await rename(tempPath, manifestPath)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}
