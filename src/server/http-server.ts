import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { access, readFile } from "node:fs/promises"
import path from "node:path"

import { NaverBlogFetcher } from "../modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../modules/exporter/naver-blog-exporter.js"
import { rewriteUploadedAssets } from "../modules/exporter/picgo-upload-rewriter.js"
import { runPicGoUploadPhase } from "../modules/exporter/picgo-upload-phase.js"
import {
  cloneExportOptions,
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  type PartialExportOptions,
} from "../shared/export-options.js"
import type { ExportRequest } from "../shared/types.js"
import { extractBlogId, toErrorMessage } from "../shared/utils.js"
import { JobStore } from "./job-store.js"

const builtClientRoot = path.resolve(process.cwd(), "dist/client")

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

const isSameOriginUploadRequest = (request: IncomingMessage) => {
  if (request.headers["x-requested-with"] !== "XMLHttpRequest") {
    return false
  }

  const originHeader = request.headers.origin
  const hostHeader = request.headers.host

  if (!originHeader || !hostHeader) {
    return true
  }

  try {
    return new URL(originHeader).host === hostHeader
  } catch {
    return false
  }
}

const sanitizeUploadError = () => "PicGo upload failed."

export const createHttpServer = ({
  jobStore = new JobStore(),
  uploadPhaseRunner = runPicGoUploadPhase,
  uploadRewriter = rewriteUploadedAssets,
}: {
  jobStore?: JobStore
  uploadPhaseRunner?: typeof runPicGoUploadPhase
  uploadRewriter?: typeof rewriteUploadedAssets
} = {}) => {

  const sendBrowserApp = async ({
    response,
    pathname,
  }: {
    response: ServerResponse
    pathname: string
  }) => {
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
  }: {
    jobId: string
    request: ExportRequest
  }) => {
    jobStore.start(jobId)

    try {
      const exporter = new NaverBlogExporter({
        request,
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

    const candidates = job.items.flatMap((item) => item.upload.candidates)

    jobStore.startUpload(jobId)
    jobStore.appendLog(jobId, "PicGo 업로드를 시작했습니다.")

    try {
      const uploadResults = await uploadPhaseRunner({
        outputDir: job.request.outputDir,
        candidates,
        uploaderKey,
        uploaderConfig,
      })

      jobStore.updateUpload(jobId, {
        ...jobStore.get(jobId)!.upload,
        status: "uploading",
        uploadedCount: uploadResults.length,
        failedCount: 0,
      })

      const rewritten = await uploadRewriter({
        outputDir: job.request.outputDir,
        manifest: job.manifest,
        items: job.items,
        uploadResults,
      })

      jobStore.completeUpload(jobId, rewritten)
      jobStore.appendLog(jobId, "PicGo 업로드와 결과 치환이 완료되었습니다.")
    } catch {
      const message = sanitizeUploadError()

      jobStore.appendLog(jobId, message)
      jobStore.failUpload(jobId, message)
    }
  }

  return createServer(async (request, response) => {
    const method = request.method ?? "GET"
    const url = new URL(request.url ?? "/", "http://localhost")

    try {
      if (method === "GET" && !url.pathname.startsWith("/api/")) {
        await sendBrowserApp({
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
        const fetcher = new NaverBlogFetcher({
          blogId,
        })
        const scanResult = await fetcher.scanBlog({
          includePosts: true,
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

        if (job.status !== "upload-ready") {
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
          uploaderKey?: string
          uploaderConfigJson?: string
        }>(request)

        if (!payload.uploaderKey?.trim() || !payload.uploaderConfigJson?.trim()) {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "uploaderKey와 uploaderConfigJson는 필수입니다.",
            },
          })
          return
        }

        let uploaderConfig: Record<string, unknown>

        try {
          const parsed = JSON.parse(payload.uploaderConfigJson) as unknown

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("uploaderConfigJson must be a JSON object.")
          }

          uploaderConfig = parsed as Record<string, unknown>
        } catch {
          sendJson({
            response,
            statusCode: 400,
            body: {
              error: "uploaderConfigJson는 JSON object 문자열이어야 합니다.",
            },
          })
          return
        }

        void runUploadForJob({
          jobId: job.id,
          uploaderKey: payload.uploaderKey.trim(),
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
}
