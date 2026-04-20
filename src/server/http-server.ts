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
import { rewriteUploadedAssets } from "../modules/exporter/picgo-upload-rewriter.js"
import { PicGoUploadPhaseError, runPicGoUploadPhase } from "../modules/exporter/picgo-upload-phase.js"
import { dedupeUploadCandidatesByLocalPath } from "../modules/exporter/upload-candidate-utils.js"
import {
  cloneExportOptions,
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  type PartialExportOptions,
} from "../shared/export-options.js"
import type { ExportRequest, ScanResult } from "../shared/types.js"
import { extractBlogId, toErrorMessage } from "../shared/utils.js"
import { JobStore } from "./job-store.js"

const builtClientRoot = path.resolve(process.cwd(), "dist/client")
const devIndexPath = path.resolve(process.cwd(), "index.html")
const defaultScanCachePath = path.resolve(process.cwd(), "outputs/scan-cache.json")

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

type ProviderFields = Record<string, string>

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

const normalizeProviderFields = (value: unknown): ProviderFields | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const normalized = Object.entries(value).reduce<ProviderFields>((result, [key, fieldValue]) => {
    if (typeof fieldValue !== "string") {
      return result
    }

    const trimmed = fieldValue.trim()

    if (!trimmed) {
      return result
    }

    result[key] = trimmed
    return result
  }, {})

  return Object.keys(normalized).length > 0 ? normalized : null
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

const normalizeUploaderConfig = ({
  uploaderKey,
  providerFields,
}: {
  uploaderKey: string
  providerFields: ProviderFields
}) =>
  Object.fromEntries(
    Object.entries(providerFields).flatMap(([key, value]) => {
      if (uploaderKey === "github" && key === "path") {
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
  providerFields: ProviderFields
}) => {
  const rawMessage = toErrorMessage(error).replace(/\s+/g, " ").trim()

  if (!rawMessage) {
    return "PicGo upload failed."
  }

  const redacted = Object.values(providerFields)
    .filter((value) => value.length >= 3)
    .sort((left, right) => right.length - left.length)
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), rawMessage)

  return redacted.slice(0, 240)
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

  jobStore.updateUpload(jobId, {
    ...job.upload,
    status: "uploading",
    uploadedCount: uploadedLocalPaths.size,
    failedCount: 0,
    terminalReason: null,
  })

  for (const item of job.items) {
    if (!item.upload.eligible) {
      continue
    }

    const uploadedCount = item.upload.candidates.reduce(
      (count, candidate) => count + (uploadedLocalPaths.has(candidate.localPath) ? 1 : 0),
      0,
    )

    if (uploadedCount === item.upload.uploadedCount && item.upload.failedCount === 0) {
      continue
    }

    jobStore.appendItem(jobId, {
      ...item,
      upload: {
        ...item.upload,
        uploadedCount,
        failedCount: 0,
      },
      updatedAt,
    })
  }
}

export const createHttpServer = ({
  jobStore = new JobStore(),
  uploadPhaseRunner = runPicGoUploadPhase,
  uploadRewriter = rewriteUploadedAssets,
  scanCachePath = defaultScanCachePath,
}: {
  jobStore?: JobStore
  uploadPhaseRunner?: typeof runPicGoUploadPhase
  uploadRewriter?: typeof rewriteUploadedAssets
  scanCachePath?: string
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

    const candidates = dedupeUploadCandidatesByLocalPath(
      job.items.flatMap((item) => item.upload.candidates),
    )

    jobStore.startUpload(jobId)
    jobStore.appendLog(jobId, "PicGo 업로드를 시작했습니다.")

    try {
      const uploadedLocalPaths = new Set<string>()
      const uploadResults = await uploadPhaseRunner({
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
      })

      syncJobUploadProgress({
        jobStore,
        jobId,
        uploadedLocalPaths: new Set(uploadResults.map((result) => result.candidate.localPath)),
      })
      jobStore.appendLog(jobId, "PicGo 업로드가 끝났고 결과 치환을 진행합니다.")

      const rewritten = await uploadRewriter({
        outputDir: job.request.outputDir,
        manifest: job.manifest,
        items: job.items,
        uploadResults,
      })

      jobStore.completeUpload(jobId, rewritten)
      jobStore.appendLog(jobId, "PicGo 업로드와 결과 치환이 완료되었습니다.")
    } catch (error) {
      if (error instanceof PicGoUploadPhaseError) {
        syncJobUploadProgress({
          jobStore,
          jobId,
          uploadedLocalPaths: new Set(error.uploadedResults.map((result) => result.candidate.localPath)),
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
        sendJson({
          response,
          statusCode: 200,
          body: {
            profile: "gfm",
            options: defaultExportOptions(),
            frontmatterFieldOrder,
            frontmatterFieldMeta,
            optionDescriptions,
          },
        })
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
        const providerFields = normalizeProviderFields(payload.providerFields)

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
