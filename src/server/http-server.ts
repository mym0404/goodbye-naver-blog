import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http"
import { access, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ViteDevServer } from "vite"

import { NaverBlogFetcher } from "../modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../modules/exporter/naver-blog-exporter.js"
import {
  rewriteImageUploadPost,
  writeImageUploadManifestSnapshot,
} from "../modules/exporter/image-upload-rewriter.js"
import { buildMarkdownViewerShareUrl } from "../modules/exporter/markdown-viewer-share-url.js"
import {
  ImageUploadPhaseError,
  runImageUploadPhase,
  type ImageUploadResult,
} from "../modules/exporter/image-upload-phase.js"
import { dedupeUploadCandidatesByLocalPath } from "../modules/exporter/upload-candidate-utils.js"
import {
  cloneExportOptions,
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  sanitizePersistedExportOptions,
  type PartialExportOptions,
} from "../shared/export-options.js"
import type {
  ExportJobItem,
  ExportJobState,
  ExportManifest,
  ExportManifestScanResult,
  ExportRequest,
  ScanResult,
  ThemePreference,
  UploadProviderValue,
} from "../shared/types.js"
import {
  extractBlogId,
  isAbortOperationError,
  recreateDir,
  resolveRepoPath,
  throwIfAborted,
  toErrorMessage,
} from "../shared/utils.js"
import {
  buildResumableExportManifest,
  readExportManifest,
  writeExportManifest,
} from "./export-job-manifest.js"
import { createCoalescedTaskRunner } from "./coalesced-task-runner.js"
import {
  hasJsonContentType,
  isPlainObject,
  parseJsonBody,
  readBody,
  sendFile,
  sendJson,
  sendText,
} from "./http-response.js"
import { JobStore } from "./job-store.js"
import {
  createImageUploadProviderSource,
  type UploadProviderSource,
} from "./image-upload-provider-source.js"
import {
  isPathInsideRoot,
  isSameOriginUploadRequest,
  isTemporaryResumeOutputDir,
  openLocalPathWithSystem,
  resolveLocalOutputTargetPath,
} from "./local-file-service.js"
import {
  readPersistedUiState,
  readScanCacheFile,
  writePersistedUiState,
  writeScanCacheFile,
} from "./local-state-repository.js"

const builtClientRoot = resolveRepoPath("dist/client")
const devIndexPath = resolveRepoPath("index.html")
const cacheRoot = resolveRepoPath(".cache")
const legacyOutputsRoot = resolveRepoPath("outputs")
const defaultScanCachePath = path.join(cacheRoot, "scan-cache.json")
const legacyScanCachePath = path.join(legacyOutputsRoot, "scan-cache.json")
const defaultSettingsPath = path.join(cacheRoot, "export-ui-settings.json")
const legacySettingsPath = resolveRepoPath("export-ui-settings.json")
const defaultOutputDir = "./output"
const defaultThemePreference: ThemePreference = "dark"

const fileExists = async (filePath: string) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

const getJobActivityTimestamp = (job: ExportJobState) =>
  Math.max(
    toTimestamp(job.createdAt),
    toTimestamp(job.startedAt),
    toTimestamp(job.finishedAt),
    toTimestamp(job.manifest?.job?.updatedAt),
    ...job.logs.map((entry) => toTimestamp(entry.timestamp)),
    ...job.items.map((item) => toTimestamp(item.updatedAt)),
  )


const normalizeUploaderConfig = ({
  uploaderKey,
  providerFields,
}: {
  uploaderKey: string
  providerFields: Record<string, UploadProviderValue>
}) =>
  Object.fromEntries(
    Object.entries(providerFields).flatMap(([key, value]) => {
      if (uploaderKey === "github" && key === "path" && typeof value === "string") {
        const normalizedPath = value
          .split("/")
          .map((segment) => segment.trim())
          .filter(Boolean)
          .join("/")

        return normalizedPath ? [[key, normalizedPath]] : []
      }

      return [[key, value]]
    }),
  )

const sanitizeUploadError = ({
  error,
  providerFields,
}: {
  error: unknown
  providerFields: Record<string, UploadProviderValue>
}) => {
  const rawMessage = toErrorMessage(error).replace(/\s+/g, " ").trim()

  if (!rawMessage) {
    return "Image upload failed."
  }

  const redacted = Object.values(providerFields)
    .flatMap((value) => (typeof value === "string" ? [value] : []))
    .filter((value) => value.length >= 3)
    .sort((left, right) => right.length - left.length)
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), rawMessage)

  return redacted.slice(0, 240)
}

const sanitizeUploadProviderCatalogError = (error: unknown) => {
  const rawMessage = toErrorMessage(error).replace(/\s+/g, " ").trim()

  if (!rawMessage) {
    return "업로드 설정을 불러오지 못했습니다."
  }

  return "업로드 설정을 불러오지 못했습니다."
}

const resolveResumedScanResult = ({
  manifestBlogId,
  manifestCategories,
  manifestTotalPosts,
  manifestScanResult,
  cachedScans,
}: {
  manifestBlogId: string
  manifestCategories: ScanResult["categories"]
  manifestTotalPosts: number
  manifestScanResult: ExportManifestScanResult | null
  cachedScans: Record<string, ScanResult>
}) => {
  const blogId = manifestScanResult?.blogId ?? manifestBlogId
  const totalPostCount = manifestScanResult?.totalPostCount || manifestTotalPosts
  const minimalScanResult: ScanResult = {
    blogId,
    totalPostCount,
    categories: manifestCategories,
  }

  const cachedScanResult = cachedScans[blogId]

  if (!cachedScanResult) {
    return minimalScanResult
  }

  return {
    ...cachedScanResult,
    blogId,
    totalPostCount: totalPostCount || cachedScanResult.totalPostCount,
    categories: cachedScanResult.categories.length > 0 ? cachedScanResult.categories : manifestCategories,
  } satisfies ScanResult
}

const getJobItemId = ({
  outputPath,
  logNo,
}: {
  outputPath: string | null
  logNo: string
}) => outputPath ?? `failed:${logNo}`

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

const syncManifestUploadProgress = ({
  manifest,
  items,
  uploadedLocalPaths,
}: {
  manifest: ExportManifest
  items: ExportJobItem[]
  uploadedLocalPaths: Set<string>
}) => {
  const itemById = new Map(items.map((item) => [getJobItemId(item), item]))

  manifest.upload = {
    ...manifest.upload,
    status: "uploading",
    uploadedCount: uploadedLocalPaths.size,
    failedCount: 0,
    terminalReason: null,
  }
  manifest.posts = manifest.posts.map((post) => {
    const item = itemById.get(getJobItemId(post))

    if (!item) {
      return post
    }

    return {
      ...post,
      assetPaths: item.assetPaths,
      upload: {
        ...post.upload,
        ...item.upload,
        uploadedCount: countUploadedCandidates({
          item,
          uploadedLocalPaths,
        }),
      },
    }
  })
}

const syncJobUploadProgress = ({
  jobStore,
  jobId,
  uploadedLocalPaths,
}: {
  jobStore: JobStore
  jobId: string
  uploadedLocalPaths: Set<string>
}) => {
  const job = jobStore.get(jobId)

  if (!job) {
    return
  }

  const updatedAt = new Date().toISOString()
  const nextItems = job.items.map((item) => {
    if (!item.upload.eligible) {
      return item
    }

    const uploadedCount = countUploadedCandidates({
      item,
      uploadedLocalPaths,
    })

    if (uploadedCount === item.upload.uploadedCount && item.upload.failedCount === 0) {
      return item
    }

    return {
      ...item,
      upload: {
        ...item.upload,
        uploadedCount,
        failedCount: 0,
      },
      updatedAt,
    }
  })

  job.items = nextItems

  jobStore.updateUpload(jobId, {
    ...job.upload,
    status: "uploading",
    uploadedCount: uploadedLocalPaths.size,
    failedCount: 0,
    terminalReason: null,
  })

  if (job.manifest) {
    syncManifestUploadProgress({
      manifest: job.manifest,
      items: nextItems,
      uploadedLocalPaths,
    })
  }
}

export const createHttpServer = ({
  jobStore = new JobStore(),
  uploadPhaseRunner = runImageUploadPhase,
  postUploadRewriter = rewriteImageUploadPost,
  manifestSnapshotWriter = writeImageUploadManifestSnapshot,
  scanCachePath = defaultScanCachePath,
  settingsPath = defaultSettingsPath,
  uploadProviderSource = createImageUploadProviderSource(),
  openLocalPath = openLocalPathWithSystem,
}: {
  jobStore?: JobStore
  uploadPhaseRunner?: typeof runImageUploadPhase
  postUploadRewriter?: typeof rewriteImageUploadPost
  manifestSnapshotWriter?: typeof writeImageUploadManifestSnapshot
  scanCachePath?: string
  settingsPath?: string
  uploadProviderSource?: UploadProviderSource
  openLocalPath?: (targetPath: string) => Promise<void> | void
} = {}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  let httpServer: HttpServer
  let viteDevServerPromise: Promise<ViteDevServer> | null = null
  let scanCachePromise: Promise<Record<string, ScanResult>> | null = null
  const jobScanResults = new Map<string, ScanResult | null>()
  const activeJobTasks = new Map<
    string,
    {
      controller: AbortController
      promise: Promise<void>
    }
  >()

  const ensureViteDevServer = () => {
    if (!viteDevServerPromise) {
      viteDevServerPromise = import("vite").then(({ createServer: createViteServer }) =>
        createViteServer({
          appType: "custom",
          server: {
            middlewareMode: true,
            hmr: {
              server: httpServer,
            },
          },
        }),
      )
    }

    return viteDevServerPromise
  }

  const ensureScanCache = () => {
    if (!scanCachePromise) {
      scanCachePromise = readScanCacheFile({
        scanCachePath,
        legacyScanCachePath: scanCachePath === defaultScanCachePath ? legacyScanCachePath : undefined,
      })
    }

    return scanCachePromise
  }

  const updateScanCache = async ({
    blogId,
    scanResult,
  }: {
    blogId: string
    scanResult: ScanResult
  }) => {
    const current = await ensureScanCache()
    const next = {
      ...current,
      [blogId]: scanResult,
    }

    await writeScanCacheFile({
      scanCachePath,
      scans: next,
    })
    scanCachePromise = Promise.resolve(next)
  }

  const startTrackedJobTask = ({
    jobId,
    run,
  }: {
    jobId: string
    run: (signal: AbortSignal) => Promise<void>
  }) => {
    const controller = new AbortController()
    const promise = run(controller.signal).finally(() => {
      if (activeJobTasks.get(jobId)?.controller === controller) {
        activeJobTasks.delete(jobId)
      }
    })

    activeJobTasks.set(jobId, {
      controller,
      promise,
    })

    return promise
  }

  const abortActiveJobTask = async (jobId: string) => {
    const activeTask = activeJobTasks.get(jobId)

    if (!activeTask) {
      return
    }

    activeTask.controller.abort()

    try {
      await activeTask.promise
    } catch {}
  }

  const hydrateJobFromManifest = ({
    manifest,
    scanResult,
  }: {
    manifest: ExportManifest
    scanResult: ScanResult | null
  }) => {
    if (!manifest.job) {
      return null
    }

    const existingJob = jobStore.get(manifest.job.id)

    if (existingJob && getJobActivityTimestamp(existingJob) >= toTimestamp(manifest.job.updatedAt)) {
      return existingJob
    }

    jobScanResults.set(manifest.job.id, scanResult)
    return jobStore.hydrate(manifest)
  }

  const persistJobManifest = async (jobId: string) => {
    const job = jobStore.get(jobId)

    if (!job) {
      return
    }

    const manifest = buildResumableExportManifest({
      job,
      scanResult: jobScanResults.get(jobId) ?? null,
    })

    job.manifest = manifest

    await writeExportManifest({
      outputDir: job.request.outputDir,
      manifest,
    })
  }

  const manifestPersistRunner = createCoalescedTaskRunner({
    run: persistJobManifest,
  })

  const scheduleJobManifestPersist = (jobId: string) => {
    void manifestPersistRunner.schedule(jobId).catch((error) => {
      console.error(`failed to persist manifest for ${jobId}:`, error)
    })
  }

  const loadResumedJob = async ({
    outputDir,
    cachedScans,
  }: {
    outputDir: string
    cachedScans: Record<string, ScanResult>
  }) => {
    if (isTemporaryResumeOutputDir(outputDir)) {
      return null
    }

    const manifest = await readExportManifest(outputDir)

    if (!manifest?.job) {
      return null
    }

    const resumedScanResult = resolveResumedScanResult({
      manifestBlogId: manifest.blogId,
      manifestCategories: manifest.categories,
      manifestTotalPosts: manifest.totalPosts,
      manifestScanResult: manifest.job.scanResult,
      cachedScans,
    })
    const resumedJob = hydrateJobFromManifest({
      manifest,
      scanResult: resumedScanResult,
    })

    if (!resumedJob) {
      return null
    }

    return {
      job: resumedJob,
      summary: manifest.job.summary,
      scanResult: resumedScanResult,
    }
  }

  const buildBootstrapResponse = async () => {
    const persistedUiState = await readPersistedUiState({
      settingsPath,
      legacySettingsPath: settingsPath === defaultSettingsPath ? legacySettingsPath : undefined,
      defaultOutputDir,
      defaultThemePreference,
    })
    const cachedScans = await ensureScanCache()
    const resumed = await loadResumedJob({
      outputDir: persistedUiState.lastOutputDir,
      cachedScans,
    })

    return {
      profile: "gfm" as const,
      options: persistedUiState.options,
      lastOutputDir: persistedUiState.lastOutputDir,
      themePreference: persistedUiState.themePreference,
      resumedJob: resumed?.job ?? null,
      resumeSummary: resumed?.summary ?? null,
      resumedScanResult: resumed?.scanResult ?? null,
      frontmatterFieldOrder,
      frontmatterFieldMeta,
      optionDescriptions,
    }
  }

  const buildResumeLookupResponse = async ({
    outputDir,
    persistLastOutputDir = false,
  }: {
    outputDir: string
    persistLastOutputDir?: boolean
  }) => {
    const cachedScans = await ensureScanCache()
    const resumed = await loadResumedJob({
      outputDir,
      cachedScans,
    })

    if (persistLastOutputDir && resumed?.job) {
      await writePersistedUiState({
        settingsPath,
        input: {
          lastOutputDir: outputDir,
        },
        legacySettingsPath: settingsPath === defaultSettingsPath ? legacySettingsPath : undefined,
        defaultOutputDir,
        defaultThemePreference,
      })
    }

    return {
      resumedJob: resumed?.job ?? null,
      resumeSummary: resumed?.summary ?? null,
      resumedScanResult: resumed?.scanResult ?? null,
    }
  }

  const sendBrowserApp = async ({
    request,
    response,
    pathname,
  }: {
    request: IncomingMessage
    response: ServerResponse
    pathname: string
  }) => {
    if (isDevelopment) {
      const viteDevServer = await ensureViteDevServer()

      await new Promise<void>((resolve, reject) => {
        viteDevServer.middlewares(request, response, (error?: Error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })

      if (response.writableEnded) {
        return
      }

      if (path.extname(pathname)) {
        sendText({
          response,
          statusCode: 404,
          body: `Not found: ${pathname}`,
        })
        return
      }

      const template = await readFile(devIndexPath, "utf8")
      const transformedIndex = await viteDevServer.transformIndexHtml(pathname, template)

      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      })
      response.end(transformedIndex)
      return
    }

    const builtIndexPath = path.join(builtClientRoot, "index.html")

    if (!(await fileExists(builtIndexPath))) {
      sendText({
        response,
        statusCode: 503,
        body: "React client build is missing. Run `pnpm build:ui` before starting the server.",
      })
      return
    }

    const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
    const builtFilePath = path.join(builtClientRoot, requestedPath)

    if (
      (pathname === "/" || pathname.startsWith("/assets/") || path.extname(pathname)) &&
      (await fileExists(builtFilePath))
    ) {
      await sendFile({
        response,
        filePath: builtFilePath,
      })
      return
    }

    await sendFile({
      response,
      filePath: builtIndexPath,
    })
  }

  const runExport = async ({
    jobId,
    request,
    cachedScanResult,
    resume,
    signal,
  }: {
    jobId: string
    request: ExportRequest
    cachedScanResult?: ScanResult | null
    resume?: boolean
    signal?: AbortSignal
  }) => {
    if (resume) {
      jobStore.resume(jobId)
    } else {
      jobStore.start(jobId)
    }
    await manifestPersistRunner.flush(jobId)

    try {
      const exporter = new NaverBlogExporter({
        request,
        cachedScanResult,
        resumeState: resume
          ? {
              items: jobStore.get(jobId)?.items ?? [],
              manifest: jobStore.get(jobId)?.manifest ?? null,
            }
          : null,
        writeManifestFile: false,
        abortSignal: signal,
        onLog: (message) => {
          jobStore.appendLog(jobId, message)
          scheduleJobManifestPersist(jobId)
        },
        onProgress: (progress) => {
          jobStore.updateProgress(jobId, progress)
          scheduleJobManifestPersist(jobId)
        },
        onItem: (item) => {
          jobStore.appendItem(jobId, item)
          scheduleJobManifestPersist(jobId)
        },
      })
      const manifest = await exporter.run()
      throwIfAborted(signal)

      jobStore.completeExport(jobId, manifest)
      await manifestPersistRunner.flush(jobId)
    } catch (error) {
      const message = isAbortOperationError(error)
        ? "작업이 초기화되어 중단되었습니다."
        : toErrorMessage(error)
      jobStore.appendLog(jobId, message)
      jobStore.fail(jobId, message)
      await manifestPersistRunner.flush(jobId)
    }
  }

  const buildSeededUploadResults = (items: ExportJobItem[]) =>
    items.flatMap((item) => {
      if (item.upload.rewriteStatus !== "completed") {
        return []
      }

      return item.upload.candidates.flatMap((candidate, index) => {
        const uploadedUrl = item.upload.uploadedUrls[index]

        return uploadedUrl
          ? [
              {
                candidate,
                uploadedUrl,
              } satisfies ImageUploadResult,
            ]
          : []
      })
    })

  const buildSeededUploadedLocalPaths = (items: ExportJobItem[]) =>
    new Set(
      items.flatMap((item) =>
        item.upload.rewriteStatus === "completed"
          ? item.upload.candidates.map((candidate) => candidate.localPath)
          : [],
      ),
    )

  const rewriteReadyPosts = async ({
    jobId,
    uploadedLocalPaths,
    uploadResults,
    signal,
  }: {
    jobId: string
    uploadedLocalPaths: Set<string>
    uploadResults: ImageUploadResult[]
    signal?: AbortSignal
  }) => {
    const job = jobStore.get(jobId)

    if (!job?.manifest) {
      return
    }

    const itemById = new Map(job.items.map((item) => [getJobItemId(item), item]))
    const readyPosts = job.manifest.posts.flatMap((post) => {
      const item = itemById.get(getJobItemId(post))

      if (
        !item ||
        !post.outputPath ||
        !item.outputPath ||
        !item.upload.eligible ||
        item.upload.rewriteStatus !== "pending"
      ) {
        return []
      }

      return item.upload.candidates.every((candidate) => uploadedLocalPaths.has(candidate.localPath))
        ? [{ post, item }]
        : []
    })

    if (readyPosts.length === 0) {
      return
    }

    const rewrittenAt = new Date().toISOString()

    for (const { post, item } of readyPosts) {
      throwIfAborted(signal)
      jobStore.appendLog(jobId, `문서 치환 시작: ${post.outputPath}`)

      try {
        const rewrittenEntry = await postUploadRewriter({
          outputDir: job.request.outputDir,
          post,
          item,
          uploadResults,
          rewrittenAt,
        })
        throwIfAborted(signal)

        job.items = job.items.map((currentItem) =>
          currentItem.outputPath === rewrittenEntry.item.outputPath ? rewrittenEntry.item : currentItem,
        )
        job.manifest = {
          ...job.manifest,
          upload: {
            ...job.manifest.upload,
            status: "uploading",
            uploadedCount: uploadedLocalPaths.size,
            failedCount: 0,
            terminalReason: null,
          },
          posts: job.manifest.posts.map((currentPost) =>
            currentPost.outputPath === rewrittenEntry.post.outputPath ? rewrittenEntry.post : currentPost,
          ),
        }

        await manifestSnapshotWriter({
          outputDir: job.request.outputDir,
          manifest: job.manifest,
        })
        throwIfAborted(signal)
        jobStore.appendLog(jobId, `문서 치환 완료: ${post.outputPath}`)
      } catch (error) {
        if (isAbortOperationError(error)) {
          throw error
        }

        throw new Error(`Document rewrite failed for ${post.outputPath}: ${toErrorMessage(error)}`)
      }
    }
  }

  const runUploadForJob = async ({
    jobId,
    uploaderKey,
    uploaderConfig,
    signal,
  }: {
    jobId: string
    uploaderKey: string
    uploaderConfig: Record<string, unknown>
    signal?: AbortSignal
  }) => {
    const job = jobStore.get(jobId)

    if (!job?.manifest) {
      return
    }

    const uploadedLocalPaths = buildSeededUploadedLocalPaths(job.items)
    const uploadResults = buildSeededUploadResults(job.items)
    const candidates = dedupeUploadCandidatesByLocalPath(
      job.items
        .filter((item) => item.upload.eligible && item.upload.rewriteStatus !== "completed")
        .flatMap((item) => item.upload.candidates),
    )

    jobStore.startUpload(jobId, uploadedLocalPaths)
    jobStore.appendLog(jobId, "Image Upload를 시작했습니다.")
    await manifestPersistRunner.flush(jobId)

    try {
      await rewriteReadyPosts({
        jobId,
        uploadedLocalPaths,
        uploadResults,
        signal,
      })

      const phaseResults = await uploadPhaseRunner({
        outputDir: job.request.outputDir,
        candidates,
        uploaderKey,
        uploaderConfig,
        abortSignal: signal,
        onProgress: ({ lastCompletedLocalPath }) => {
          if (lastCompletedLocalPath) {
            uploadedLocalPaths.add(lastCompletedLocalPath)
          }

          syncJobUploadProgress({
            jobStore,
            jobId,
            uploadedLocalPaths,
          })
          scheduleJobManifestPersist(jobId)
        },
        onAssetStart: (candidate) => {
          jobStore.appendLog(jobId, `이미지 업로드 시작: ${candidate.localPath}`)
          scheduleJobManifestPersist(jobId)
        },
        onAssetUploaded: async ({ result }) => {
          uploadedLocalPaths.add(result.candidate.localPath)
          uploadResults.push(result)
          jobStore.appendLog(jobId, `이미지 업로드 완료: ${result.candidate.localPath}`)

          syncJobUploadProgress({
            jobStore,
            jobId,
            uploadedLocalPaths,
          })
          await manifestPersistRunner.flush(jobId)
          await rewriteReadyPosts({
            jobId,
            uploadedLocalPaths,
            uploadResults,
            signal,
          })
          await manifestPersistRunner.flush(jobId)
        },
      })

      for (const result of phaseResults) {
        if (uploadResults.some((existing) => existing.candidate.localPath === result.candidate.localPath)) {
          continue
        }

        uploadResults.push(result)
        uploadedLocalPaths.add(result.candidate.localPath)
      }

      syncJobUploadProgress({
        jobStore,
        jobId,
        uploadedLocalPaths,
      })
      await manifestPersistRunner.flush(jobId)
      await rewriteReadyPosts({
        jobId,
        uploadedLocalPaths,
        uploadResults,
        signal,
      })
      await manifestPersistRunner.flush(jobId)
      throwIfAborted(signal)

      const completedJob = jobStore.get(jobId)

      if (!completedJob?.manifest) {
        return
      }

      const completedManifest = {
        ...completedJob.manifest,
        upload: {
          ...completedJob.manifest.upload,
          status: "upload-completed" as const,
          uploadedCount: completedJob.manifest.upload.candidateCount,
          failedCount: 0,
          terminalReason: null,
        },
      }

      await manifestSnapshotWriter({
        outputDir: completedJob.request.outputDir,
        manifest: completedManifest,
      })
      throwIfAborted(signal)
      jobStore.completeUpload(jobId, {
        manifest: completedManifest,
        items: completedJob.items,
      })
      jobStore.appendLog(jobId, "Image Upload와 결과 치환이 완료되었습니다.")
      await manifestPersistRunner.flush(jobId)
    } catch (error) {
      if (error instanceof ImageUploadPhaseError) {
        syncJobUploadProgress({
          jobStore,
          jobId,
          uploadedLocalPaths: new Set([
            ...uploadedLocalPaths,
            ...error.uploadedResults.map((result) => result.candidate.localPath),
          ]),
        })
        await manifestPersistRunner.flush(jobId)
      }

      const message = isAbortOperationError(error)
        ? "작업이 초기화되어 중단되었습니다."
        : sanitizeUploadError({
            error,
            providerFields: Object.fromEntries(
              Object.entries(uploaderConfig).flatMap(([key, value]) =>
                typeof value === "string" ? [[key, value]] : [],
              ),
            ),
          })

      jobStore.appendLog(jobId, message)
      jobStore.failUpload(jobId, message)
      await manifestPersistRunner.flush(jobId)
    }
  }

  httpServer = createServer(async (request, response) => {
    const method = request.method ?? "GET"
    const url = new URL(request.url ?? "/", "http://localhost")

    try {
      if (method === "GET" && !url.pathname.startsWith("/api/")) {
        await sendBrowserApp({
          request,
          response,
          pathname: url.pathname,
        })
        return
      }

      if (method === "GET" && url.pathname === "/api/export-defaults") {
        sendJson({
          response,
          statusCode: 200,
          body: await buildBootstrapResponse(),
        })
        return
      }

      if (method === "POST" && url.pathname === "/api/export-settings") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          options?: unknown
          themePreference?: unknown
        }>(request)

        if (
          !isPlainObject(payload) ||
          !isPlainObject(payload.options) ||
          (payload.themePreference !== undefined &&
            payload.themePreference !== "dark" &&
            payload.themePreference !== "light")
        ) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "options 객체와 themePreference 값이 올바른지 확인하세요.",
            },
          })
          return
        }

        try {
          const sanitizedOptions = sanitizePersistedExportOptions(payload.options as PartialExportOptions)

          cloneExportOptions(sanitizedOptions)
          await writePersistedUiState({
            settingsPath,
            input: {
              options: sanitizedOptions,
              themePreference:
                payload.themePreference === "dark" || payload.themePreference === "light"
                  ? payload.themePreference
                  : undefined,
            },
            legacySettingsPath: settingsPath === defaultSettingsPath ? legacySettingsPath : undefined,
            defaultOutputDir,
            defaultThemePreference,
          })
        } catch (error) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: toErrorMessage(error),
            },
          })
          return
        }

        response.writeHead(204)
        response.end()
        return
      }

      if (method === "POST" && url.pathname === "/api/export-reset") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          outputDir?: unknown
          jobId?: unknown
        }>(request)

        if (!isPlainObject(payload) || typeof payload.outputDir !== "string" || !payload.outputDir.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "outputDir는 필수입니다.",
            },
          })
          return
        }

        const outputDir = payload.outputDir.trim()
        const jobId = typeof payload.jobId === "string" && payload.jobId.trim() ? payload.jobId.trim() : null

        if (jobId) {
          await abortActiveJobTask(jobId)
        }

        await rm(resolveRepoPath(outputDir), { recursive: true, force: true })

        if (jobId) {
          jobStore.delete(jobId)
          jobScanResults.delete(jobId)
        }

        await writePersistedUiState({
          settingsPath,
          input: {
            lastOutputDir: defaultOutputDir,
          },
          legacySettingsPath: settingsPath === defaultSettingsPath ? legacySettingsPath : undefined,
          defaultOutputDir,
          defaultThemePreference,
        })

        sendJson({
          response,
          statusCode: 200,
          body: await buildBootstrapResponse(),
        })
        return
      }

      if (method === "POST" && url.pathname === "/api/export-resume/lookup") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          outputDir?: unknown
        }>(request)

        if (!isPlainObject(payload) || typeof payload.outputDir !== "string" || !payload.outputDir.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "outputDir는 필수입니다.",
            },
          })
          return
        }

        sendJson({
          response,
          statusCode: 200,
          body: await buildResumeLookupResponse({
            outputDir: payload.outputDir.trim(),
          }),
        })
        return
      }

      if (method === "POST" && url.pathname === "/api/export-resume/restore") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          outputDir?: unknown
        }>(request)

        if (!isPlainObject(payload) || typeof payload.outputDir !== "string" || !payload.outputDir.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "outputDir는 필수입니다.",
            },
          })
          return
        }

        const resumed = await buildResumeLookupResponse({
          outputDir: payload.outputDir.trim(),
          persistLastOutputDir: true,
        })

        if (!resumed.resumedJob || !resumed.resumeSummary) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "불러올 수 있는 작업 상태를 찾지 못했습니다.",
            },
          })
          return
        }

        sendJson({
          response,
          statusCode: 200,
          body: resumed,
        })
        return
      }

      if (method === "POST" && url.pathname === "/api/local-file/open") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        if (!isSameOriginUploadRequest(request)) {
          sendJson({
            response,
            statusCode: 403,
            body: {
              error: "same-origin XHR 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          outputDir?: unknown
          outputPath?: unknown
        }>(request)

        if (
          !isPlainObject(payload) ||
          typeof payload.outputDir !== "string" ||
          !payload.outputDir.trim() ||
          typeof payload.outputPath !== "string" ||
          !payload.outputPath.trim()
        ) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "outputDir와 outputPath는 필수입니다.",
            },
          })
          return
        }

        const { outputRoot, targetPath } = resolveLocalOutputTargetPath({
          outputDir: payload.outputDir,
          outputPath: payload.outputPath,
        })

        if (!isPathInsideRoot({ rootPath: outputRoot, targetPath })) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "허용되지 않은 파일 경로입니다.",
            },
          })
          return
        }

        if (!(await fileExists(targetPath))) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "파일을 찾을 수 없습니다.",
            },
          })
          return
        }

        await openLocalPath(targetPath)

        response.writeHead(204)
        response.end()
        return
      }

      if (method === "POST" && url.pathname === "/api/local-file/preview-link") {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        if (!isSameOriginUploadRequest(request)) {
          sendJson({
            response,
            statusCode: 403,
            body: {
              error: "same-origin XHR 요청만 허용합니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          outputDir?: unknown
          outputPath?: unknown
        }>(request)

        if (
          !isPlainObject(payload) ||
          typeof payload.outputDir !== "string" ||
          !payload.outputDir.trim() ||
          typeof payload.outputPath !== "string" ||
          !payload.outputPath.trim()
        ) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "outputDir와 outputPath는 필수입니다.",
            },
          })
          return
        }

        const { outputRoot, targetPath } = resolveLocalOutputTargetPath({
          outputDir: payload.outputDir,
          outputPath: payload.outputPath,
        })

        if (!isPathInsideRoot({ rootPath: outputRoot, targetPath })) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "허용되지 않은 파일 경로입니다.",
            },
          })
          return
        }

        if (!(await fileExists(targetPath))) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "파일을 찾을 수 없습니다.",
            },
          })
          return
        }

        const markdown = await readFile(targetPath, "utf8")
        const previewUrl = buildMarkdownViewerShareUrl(markdown)

        if (!previewUrl) {
          sendJson({
            response,
            statusCode: 422,
            body: {
              error: "미리보기 링크를 만들 수 없습니다.",
            },
          })
          return
        }

        sendJson({
          response,
          statusCode: 200,
          body: {
            previewUrl,
          },
        })
        return
      }

      if (method === "GET" && url.pathname === "/api/upload-providers") {
        try {
          const catalog = await uploadProviderSource.getCatalog()

          sendJson({
            response,
            statusCode: 200,
            body: catalog,
          })
        } catch (error) {
          sendJson({
            response,
            statusCode: 503,
            body: {
              error: sanitizeUploadProviderCatalogError(error),
            },
          })
        }
        return
      }

      if (method === "POST" && url.pathname === "/api/scan") {
        const rawBody = await readBody(request)
        const payload = JSON.parse(rawBody) as {
          blogIdOrUrl?: string
          forceRefresh?: boolean
        }

        if (!payload.blogIdOrUrl?.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "blogIdOrUrl는 필수입니다.",
            },
          })
          return
        }

        const blogId = extractBlogId(payload.blogIdOrUrl)
        const cachedScans = await ensureScanCache()

        if (!payload.forceRefresh && cachedScans[blogId]) {
          sendJson({
            response,
            statusCode: 200,
            body: cachedScans[blogId],
          })
          return
        }

        const fetcher = new NaverBlogFetcher({
          blogId,
        })
        const scanResult = await fetcher.scanBlog({
          includePosts: true,
        })
        await updateScanCache({
          blogId,
          scanResult,
        })

        sendJson({
          response,
          statusCode: 200,
          body: scanResult,
        })
        return
      }

      if (method === "POST" && url.pathname === "/api/export") {
        const rawBody = await readBody(request)
        const payload = JSON.parse(rawBody) as {
          blogIdOrUrl?: string
          outputDir?: string
          options?: PartialExportOptions
          scanResult?: ScanResult
        }

        if (!payload.blogIdOrUrl?.trim() || !payload.outputDir?.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "blogIdOrUrl와 outputDir는 필수입니다.",
            },
          })
          return
        }

        let exportRequest: ExportRequest

        try {
          exportRequest = {
            blogIdOrUrl: payload.blogIdOrUrl.trim(),
            outputDir: payload.outputDir.trim(),
            profile: "gfm",
            options: cloneExportOptions(payload.options),
          }
        } catch (error) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: toErrorMessage(error),
            },
          })
          return
        }

        await recreateDir(resolveRepoPath(exportRequest.outputDir))
        await writePersistedUiState({
          settingsPath,
          input: {
            lastOutputDir: exportRequest.outputDir,
          },
          legacySettingsPath: settingsPath === defaultSettingsPath ? legacySettingsPath : undefined,
          defaultOutputDir,
          defaultThemePreference,
        })

        const job = jobStore.create(exportRequest)
        jobScanResults.set(job.id, payload.scanResult ?? null)

        jobStore.appendLog(job.id, "작업을 큐에 등록했습니다.")
        void startTrackedJobTask({
          jobId: job.id,
          run: (signal) =>
            runExport({
              jobId: job.id,
              request: exportRequest,
              cachedScanResult: payload.scanResult ?? null,
              signal,
            }),
        })

        sendJson({
          response,
          statusCode: 202,
          body: {
            jobId: job.id,
          },
        })
        return
      }

      const resumeMatch = url.pathname.match(/^\/api\/export\/([^/]+)\/resume$/)

      if (method === "POST" && resumeMatch?.[1]) {
        const job = jobStore.get(resumeMatch[1])

        if (!job) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "job not found",
            },
          })
          return
        }

        if (job.status !== "running" || !job.resumeAvailable) {
          sendJson({
            response,
            statusCode: 409,
            body: {
              error: "재개 가능한 export 작업이 아닙니다.",
            },
          })
          return
        }

        void startTrackedJobTask({
          jobId: job.id,
          run: (signal) =>
            runExport({
              jobId: job.id,
              request: job.request,
              cachedScanResult: jobScanResults.get(job.id) ?? null,
              resume: true,
              signal,
            }),
        })

        sendJson({
          response,
          statusCode: 202,
          body: {
            jobId: job.id,
            status: "running",
          },
        })
        return
      }

      const uploadMatch = url.pathname.match(/^\/api\/export\/([^/]+)\/upload$/)

      if (method === "POST" && uploadMatch?.[1]) {
        if (!hasJsonContentType(request)) {
          sendJson({
            response,
            statusCode: 415,
            body: {
              error: "application/json 요청만 허용합니다.",
            },
          })
          return
        }

        if (!isSameOriginUploadRequest(request)) {
          sendJson({
            response,
            statusCode: 403,
            body: {
              error: "same-origin XHR 요청만 허용합니다.",
            },
          })
          return
        }

        const job = jobStore.get(uploadMatch[1])

        if (!job?.manifest) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "job not found",
            },
          })
          return
        }

        if (
          job.status !== "upload-ready" &&
          job.status !== "upload-failed" &&
          !(job.status === "uploading" && job.resumeAvailable)
        ) {
          sendJson({
            response,
            statusCode: 409,
            body: {
              error: "업로드 가능한 상태의 작업이 아닙니다.",
            },
          })
          return
        }

        if (
          job.request.options.assets.imageHandlingMode !== "download-and-upload" ||
          job.upload.candidateCount === 0
        ) {
          sendJson({
            response,
            statusCode: 409,
            body: {
              error: "업로드 대상이 없는 작업입니다.",
            },
          })
          return
        }

        const payload = await parseJsonBody<{
          providerKey?: string
          providerFields?: unknown
        }>(request)

        const providerKey = payload.providerKey?.trim()
        const providerFields =
          providerKey
            ? await uploadProviderSource.normalizeProviderFields(providerKey, payload.providerFields)
            : null

        if (!providerKey || !providerFields) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "providerKey와 providerFields는 필수입니다.",
            },
          })
          return
        }

        const uploaderConfig = normalizeUploaderConfig({
          uploaderKey: providerKey,
          providerFields,
        })

        void startTrackedJobTask({
          jobId: job.id,
          run: (signal) =>
            runUploadForJob({
              jobId: job.id,
              uploaderKey: providerKey,
              uploaderConfig,
              signal,
            }),
        })

        sendJson({
          response,
          statusCode: 202,
          body: {
            jobId: job.id,
            status: "uploading",
          },
        })
        return
      }

      const statusMatch = url.pathname.match(/^\/api\/export\/([^/]+)$/)

      if (method === "GET" && statusMatch?.[1]) {
        const job = jobStore.get(statusMatch[1])

        if (!job) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "job not found",
            },
          })
          return
        }

        sendJson({
          response,
          statusCode: 200,
          body: job,
        })
        return
      }

      const manifestMatch = url.pathname.match(/^\/api\/export\/([^/]+)\/manifest$/)

      if (method === "GET" && manifestMatch?.[1]) {
        const job = jobStore.get(manifestMatch[1])

        if (!job?.manifest) {
          sendJson({
            response,
            statusCode: 404,
            body: {
              error: "manifest not found",
            },
          })
          return
        }

        sendJson({
          response,
          statusCode: 200,
          body: job.manifest,
        })
        return
      }

      sendJson({
        response,
        statusCode: 404,
        body: {
          error: "not found",
        },
      })
    } catch (error) {
      sendJson({
        response,
        statusCode: 500,
        body: {
          error: toErrorMessage(error),
        },
      })
    }
  })

  httpServer.once("close", () => {
    if (!viteDevServerPromise) {
      return
    }

    void viteDevServerPromise
      .then((viteDevServer) => viteDevServer.close())
      .catch(() => undefined)
  })

  return httpServer
}
