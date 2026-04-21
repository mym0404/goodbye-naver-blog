import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ViteDevServer } from "vite"

import { NaverBlogFetcher } from "../modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../modules/exporter/naver-blog-exporter.js"
import {
  rewriteImageUploadPost,
  writeImageUploadManifestSnapshot,
} from "../modules/exporter/image-upload-rewriter.js"
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
import type { ExportJobItem, ExportRequest, ExportManifest, ScanResult, UploadProviderValue } from "../shared/types.js"
import { extractBlogId, toErrorMessage } from "../shared/utils.js"
import { JobStore } from "./job-store.js"
import {
  createImageUploadProviderSource,
  type UploadProviderSource,
} from "./image-upload-provider-source.js"

const builtClientRoot = path.resolve(process.cwd(), "dist/client")
const devIndexPath = path.resolve(process.cwd(), "index.html")
const defaultScanCachePath = path.resolve(process.cwd(), "outputs/scan-cache.json")
const defaultSettingsPath = path.resolve(process.cwd(), "export-ui-settings.json")

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const fileExists = async (filePath: string) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString("utf8")
}

const sendJson = ({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse
  statusCode: number
  body: unknown
}) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  response.end(JSON.stringify(body))
}

const sendText = ({
  response,
  statusCode,
  body,
}: {
  response: ServerResponse
  statusCode: number
  body: string
}) => {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  })
  response.end(body)
}

const sendFile = async ({
  response,
  filePath,
}: {
  response: ServerResponse
  filePath: string
}) => {
  const extension = path.extname(filePath)
  const content = await readFile(filePath)

  response.writeHead(200, {
    "content-type": contentTypes[extension] ?? "text/plain; charset=utf-8",
  })
  response.end(content)
}

const parseJsonBody = async <T>(request: IncomingMessage) => JSON.parse(await readBody(request)) as T

const hasJsonContentType = (request: IncomingMessage) =>
  request.headers["content-type"]?.toLowerCase().startsWith("application/json") ?? false

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const isSameOriginUploadRequest = (request: IncomingMessage) => {
  if (request.headers["x-requested-with"] !== "XMLHttpRequest") {
    return false
  }

  const originHeader = request.headers.origin
  const hostHeader = request.headers.host

  if (!originHeader || !hostHeader) {
    return false
  }

  try {
    return new URL(originHeader).host === hostHeader
  } catch {
    return false
  }
}

const readScanCacheFile = async (scanCachePath: string) => {
  try {
    const raw = await readFile(scanCachePath, "utf8")
    const parsed = JSON.parse(raw) as {
      scans?: Record<string, ScanResult>
    }

    return parsed.scans && typeof parsed.scans === "object" ? parsed.scans : {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {}
    }

    throw error
  }
}

const writeScanCacheFile = async ({
  scanCachePath,
  scans,
}: {
  scanCachePath: string
  scans: Record<string, ScanResult>
}) => {
  await mkdir(path.dirname(scanCachePath), { recursive: true })
  await writeFile(
    scanCachePath,
    JSON.stringify(
      {
        scans,
      },
      null,
      2,
    ),
    "utf8",
  )
}

const readPersistedExportOptions = async (settingsPath: string) => {
  try {
    const raw = await readFile(settingsPath, "utf8")
    const parsed = JSON.parse(raw) as {
      options?: PartialExportOptions
    }

    return cloneExportOptions(
      sanitizePersistedExportOptions(
        isPlainObject(parsed) && isPlainObject(parsed.options)
          ? (parsed.options as PartialExportOptions)
          : undefined,
      ),
    )
  } catch (error) {
    if (error instanceof Error && error.name === "SyntaxError") {
      return defaultExportOptions()
    }

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultExportOptions()
    }

    return defaultExportOptions()
  }
}

const writePersistedExportOptions = async ({
  settingsPath,
  options,
}: {
  settingsPath: string
  options: PartialExportOptions
}) => {
  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        options: sanitizePersistedExportOptions(options),
      },
      null,
      2,
    ),
    "utf8",
  )
}

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
      externalPreviewUrl: item.externalPreviewUrl,
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
}: {
  jobStore?: JobStore
  uploadPhaseRunner?: typeof runImageUploadPhase
  postUploadRewriter?: typeof rewriteImageUploadPost
  manifestSnapshotWriter?: typeof writeImageUploadManifestSnapshot
  scanCachePath?: string
  settingsPath?: string
  uploadProviderSource?: UploadProviderSource
} = {}) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  let httpServer: HttpServer
  let viteDevServerPromise: Promise<ViteDevServer> | null = null
  let scanCachePromise: Promise<Record<string, ScanResult>> | null = null

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
      scanCachePromise = readScanCacheFile(scanCachePath)
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
  }: {
    jobId: string
    request: ExportRequest
    cachedScanResult?: ScanResult | null
  }) => {
    jobStore.start(jobId)

    try {
      const exporter = new NaverBlogExporter({
        request,
        cachedScanResult,
        onLog: (message) => jobStore.appendLog(jobId, message),
        onProgress: (progress) => jobStore.updateProgress(jobId, progress),
        onItem: (item) => jobStore.appendItem(jobId, item),
      })
      const manifest = await exporter.run()

      jobStore.completeExport(jobId, manifest)
    } catch (error) {
      const message = toErrorMessage(error)
      jobStore.appendLog(jobId, message)
      jobStore.fail(jobId, message)
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
  }: {
    jobId: string
    uploadedLocalPaths: Set<string>
    uploadResults: ImageUploadResult[]
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
      jobStore.appendLog(jobId, `문서 치환 시작: ${post.outputPath}`)

      try {
        const rewrittenEntry = await postUploadRewriter({
          outputDir: job.request.outputDir,
          post,
          item,
          uploadResults,
          rewrittenAt,
        })

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
        jobStore.appendLog(jobId, `문서 치환 완료: ${post.outputPath}`)
      } catch (error) {
        throw new Error(`Document rewrite failed for ${post.outputPath}: ${toErrorMessage(error)}`)
      }
    }
  }

  const runUploadForJob = async ({
    jobId,
    uploaderKey,
    uploaderConfig,
  }: {
    jobId: string
    uploaderKey: string
    uploaderConfig: Record<string, unknown>
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

    try {
      await rewriteReadyPosts({
        jobId,
        uploadedLocalPaths,
        uploadResults,
      })

      const phaseResults = await uploadPhaseRunner({
        outputDir: job.request.outputDir,
        candidates,
        uploaderKey,
        uploaderConfig,
        onProgress: ({ lastCompletedLocalPath }) => {
          if (lastCompletedLocalPath) {
            uploadedLocalPaths.add(lastCompletedLocalPath)
          }

          syncJobUploadProgress({
            jobStore,
            jobId,
            uploadedLocalPaths,
          })
        },
        onAssetStart: (candidate) => {
          jobStore.appendLog(jobId, `이미지 업로드 시작: ${candidate.localPath}`)
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
          await rewriteReadyPosts({
            jobId,
            uploadedLocalPaths,
            uploadResults,
          })
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
      await rewriteReadyPosts({
        jobId,
        uploadedLocalPaths,
        uploadResults,
      })

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
      jobStore.completeUpload(jobId, {
        manifest: completedManifest,
        items: completedJob.items,
      })
      jobStore.appendLog(jobId, "Image Upload와 결과 치환이 완료되었습니다.")
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
      }

      const message = sanitizeUploadError({
        error,
        providerFields: Object.fromEntries(
          Object.entries(uploaderConfig).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        ),
      })

      jobStore.appendLog(jobId, message)
      jobStore.failUpload(jobId, message)
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
        const persistedOptions = await readPersistedExportOptions(settingsPath)

        sendJson({
          response,
          statusCode: 200,
          body: {
            profile: "gfm",
            options: persistedOptions,
            frontmatterFieldOrder,
            frontmatterFieldMeta,
            optionDescriptions,
          },
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
        }>(request)

        if (!isPlainObject(payload) || !isPlainObject(payload.options)) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "options 객체는 필수입니다.",
            },
          })
          return
        }

        try {
          const sanitizedOptions = sanitizePersistedExportOptions(payload.options as PartialExportOptions)

          cloneExportOptions(sanitizedOptions)
          await writePersistedExportOptions({
            settingsPath,
            options: sanitizedOptions,
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

        const job = jobStore.create(exportRequest)

        jobStore.appendLog(job.id, "작업을 큐에 등록했습니다.")
        void runExport({
          jobId: job.id,
          request: exportRequest,
          cachedScanResult: payload.scanResult ?? null,
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

        if (job.status !== "upload-ready" && job.status !== "upload-failed") {
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

        void runUploadForJob({
          jobId: job.id,
          uploaderKey: providerKey,
          uploaderConfig,
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
