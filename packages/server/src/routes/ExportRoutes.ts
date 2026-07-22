import { readdir } from "node:fs/promises"

import { getScanCacheKey } from "@exitpress/domain/blog/schema/BlogScan.js"
import { JOB_STATUSES } from "@exitpress/domain/export-job/ExportJobState.js"
import { isExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import { filterPostsByScope } from "@exitpress/domain/export-scope/ExportScope.js"
import { assertUniquePostOutputPaths } from "@exitpress/engine/exporting/paths/ExportPaths.js"
import { getOutputAdapter } from "@exitpress/engine/exporting/profiles/OutputAdapters.js"
import { recreateDir, resolveRepoPath } from "@exitpress/engine/infra/node/FilePaths.js"
import { toErrorMessage } from "@exitpress/engine/shared/error/util/toErrorMessage.js"

import type { BlogScanResult } from "@exitpress/domain/blog/schema/Blog.js"
import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type {
  ExportRequest,
  ExportUploadProviderRequest,
} from "@exitpress/domain/export-job/schema/ExportRequest.js"
import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import type { ApiRouteContext, ApiRouteRequest } from "./ApiRouteContext.js"

import { readBody, sendJson } from "../http/HttpResponse.js"
import { readExportManifest } from "../jobs/ExportJobManifest.js"

const parseJsonPayload = async <T>(request: ApiRouteRequest["request"]) => {
  return JSON.parse(await readBody(request)) as T
}

const uploadProviderRequiredError =
  "다운로드 후 업로드 모드에서는 업로드 provider 설정이 필요합니다."
const uploadProviderModeError =
  "uploadProvider는 download-and-upload 모드에서만 사용할 수 있습니다."
const uploadProviderValidationError = "업로드 provider 설정을 확인하지 못했습니다."
const unownedOutputDirectoryError =
  "비어 있지 않은 폴더에는 내보낼 수 없습니다. Exitpress 출력 폴더를 선택하세요."

const assertOutputDirectoryCanBeRecreated = async (outputDir: string) => {
  const resolvedOutputDir = resolveRepoPath(outputDir)

  try {
    if ((await readdir(resolvedOutputDir)).length === 0) {
      return
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return
    }

    throw error
  }

  try {
    const manifest = await readExportManifest(outputDir)

    if (
      manifest &&
      typeof manifest.blogKey === "string" &&
      typeof manifest.sourceId === "string" &&
      isExportProfile(manifest.profile)
    ) {
      return
    }
  } catch {
    throw new Error(unownedOutputDirectoryError)
  }

  throw new Error(unownedOutputDirectoryError)
}

const toScanResult = (scan: BlogScanResult): ScanResult => ({
  blogKey: scan.source.blogKey,
  sourceId: scan.source.sourceId,
  totalPostCount: scan.totalPostCount,
  categories: scan.categories.map((category) => ({
    id: category.id,
    name: category.name,
    parentId: category.parentId ?? null,
    postCount: category.postCount,
    isDivider: false,
    isOpen: true,
    path: category.path,
    depth: category.depth,
  })),
  posts: scan.posts.map((post) => ({
    blogKey: post.blogKey,
    sourceId: post.sourceId,
    postId: post.postId,
    title: post.title,
    publishedAt: post.publishedAt,
    categoryId: post.categoryId,
    categoryName: post.categoryName,
    source: post.sourceUrl,
    thumbnailUrl: post.thumbnailUrl ?? null,
  })),
})

export const handleExportRoutes =
  ({
    jobStore,
    state,
    blogRegistry,
    blockScanJobRunner,
    exportJobRunner,
    postHtmlCache,
    uploadProviderSource,
  }: ApiRouteContext) =>
  async ({ request, response, method, url }: ApiRouteRequest) => {
    if (method === "POST" && url.pathname === "/api/scan") {
      const payload = await parseJsonPayload<{
        blogKey?: string
        sourceInput?: string
        forceRefresh?: boolean
      }>(request)

      const blogKey = payload.blogKey?.trim() ?? ""

      if (!blogKey || !payload.sourceInput?.trim()) {
        sendJson({
          response,
          statusCode: 400,
          body: { error: "blogKey와 sourceInput는 필수입니다." },
        })
        return true
      }

      const blog = blogRegistry.require(blogKey)
      const source = blog.parseSource(payload.sourceInput)
      const cacheKey = getScanCacheKey(source)
      const cachedScans = await state.ensureScanCache()

      if (!payload.forceRefresh && cachedScans[cacheKey]) {
        sendJson({ response, statusCode: 200, body: cachedScans[cacheKey] })
        return true
      }

      const scanResult = toScanResult(await blog.scan(source, { cache: postHtmlCache }))
      await state.updateScanCache({ scanResult })
      sendJson({ response, statusCode: 200, body: scanResult })
      return true
    }

    if (method === "POST" && url.pathname === "/api/scan-blocks/jobs") {
      const payload = await parseJsonPayload<{
        blogKey?: string
        sourceInput?: string
        scanResult?: ScanResult
        options?: PartialExportOptions
      }>(request)

      const blogKey = payload.blogKey?.trim() ?? ""

      if (!blogKey || !payload.sourceInput?.trim() || !payload.scanResult?.posts) {
        sendJson({
          response,
          statusCode: 400,
          body: { error: "blogKey, sourceInput, scanResult.posts는 필수입니다." },
        })
        return true
      }

      const source = blogRegistry.require(blogKey).parseSource(payload.sourceInput)

      if (
        payload.scanResult.blogKey !== blogKey ||
        payload.scanResult.sourceId !== source.sourceId
      ) {
        sendJson({
          response,
          statusCode: 400,
          body: { error: "scanResult가 요청 블로그와 일치하지 않습니다." },
        })
        return true
      }

      let options: ReturnType<typeof state.cloneOptions>

      try {
        options = state.cloneOptions(payload.options)
      } catch (error) {
        sendJson({ response, statusCode: 400, body: { error: toErrorMessage(error) } })
        return true
      }

      const job = blockScanJobRunner.startJob({
        source,
        scanResult: payload.scanResult as ScanResult & {
          posts: NonNullable<ScanResult["posts"]>
        },
        options,
      })

      sendJson({
        response,
        statusCode: 202,
        body: {
          jobId: job.id,
        },
      })
      return true
    }

    const scanJobMatch = url.pathname.match(/^\/api\/scan-blocks\/jobs\/([^/]+)$/)

    if (method === "GET" && scanJobMatch?.[1]) {
      const job = blockScanJobRunner.getJob(scanJobMatch[1])

      if (!job) {
        sendJson({ response, statusCode: 404, body: { error: "job not found" } })
        return true
      }

      sendJson({ response, statusCode: 200, body: job })
      return true
    }

    if (method === "POST" && url.pathname === "/api/export") {
      const payload = await parseJsonPayload<{
        blogKey?: string
        sourceInput?: string
        outputDir?: string
        profile?: ExportProfile
        options?: PartialExportOptions
        scanResult?: ScanResult
        uploadProvider?: {
          providerKey?: string
          providerFields?: unknown
        }
      }>(request)

      const blogKey = payload.blogKey?.trim() ?? ""
      const profile = payload.profile ?? "gfm"

      if (!blogKey || !payload.sourceInput?.trim() || !payload.outputDir?.trim()) {
        sendJson({
          response,
          statusCode: 400,
          body: { error: "blogKey, sourceInput, outputDir는 필수입니다." },
        })
        return true
      }

      if (!isExportProfile(profile)) {
        sendJson({ response, statusCode: 400, body: { error: "지원하지 않는 출력 형식입니다." } })
        return true
      }

      const source = blogRegistry.require(blogKey).parseSource(payload.sourceInput)

      if (
        payload.scanResult &&
        (payload.scanResult.blogKey !== blogKey || payload.scanResult.sourceId !== source.sourceId)
      ) {
        sendJson({
          response,
          statusCode: 400,
          body: { error: "scanResult가 요청 블로그와 일치하지 않습니다." },
        })
        return true
      }

      let options: ReturnType<typeof state.cloneOptions>

      try {
        options = state.cloneOptions(payload.options)
      } catch (error) {
        sendJson({ response, statusCode: 400, body: { error: toErrorMessage(error) } })
        return true
      }

      const imageHandlingMode = options.assets.imageHandlingMode
      let uploadProvider: ExportUploadProviderRequest | undefined

      if (imageHandlingMode === "download-and-upload") {
        const providerKey =
          typeof payload.uploadProvider?.providerKey === "string"
            ? payload.uploadProvider.providerKey.trim()
            : ""

        if (!providerKey) {
          sendJson({ response, statusCode: 400, body: { error: uploadProviderRequiredError } })
          return true
        }

        try {
          const providerFields = await uploadProviderSource.normalizeProviderFields(
            providerKey,
            payload.uploadProvider?.providerFields,
          )

          if (!providerFields) {
            sendJson({ response, statusCode: 400, body: { error: uploadProviderRequiredError } })
            return true
          }

          uploadProvider = {
            providerKey,
            providerFields,
          }
        } catch {
          sendJson({ response, statusCode: 400, body: { error: uploadProviderValidationError } })
          return true
        }
      } else if (payload.uploadProvider !== undefined) {
        sendJson({ response, statusCode: 400, body: { error: uploadProviderModeError } })
        return true
      }

      const exportRequest: ExportRequest = {
        blogKey,
        sourceInput: payload.sourceInput.trim(),
        outputDir: payload.outputDir.trim(),
        profile,
        options,
      }
      const runnerRequest = uploadProvider ? { ...exportRequest, uploadProvider } : exportRequest

      try {
        if (payload.scanResult?.posts) {
          assertUniquePostOutputPaths({
            outputDir: resolveRepoPath(exportRequest.outputDir),
            posts: filterPostsByScope({
              posts: payload.scanResult.posts,
              categories: payload.scanResult.categories,
              options,
            }),
            categories: payload.scanResult.categories,
            options,
            adapter: getOutputAdapter(profile),
          })
        }

        await assertOutputDirectoryCanBeRecreated(exportRequest.outputDir)
      } catch (error) {
        sendJson({ response, statusCode: 409, body: { error: toErrorMessage(error) } })
        return true
      }

      await recreateDir(resolveRepoPath(exportRequest.outputDir))
      await state.writeLastOutputDir(exportRequest.outputDir)

      const job = jobStore.create(exportRequest)
      state.jobScanResults.set(job.id, payload.scanResult ?? null)
      jobStore.appendLog(job.id, "작업을 큐에 등록했습니다.")

      void exportJobRunner.startTrackedJobTask({
        jobId: job.id,
        run: (signal) =>
          exportJobRunner.runExport({
            jobId: job.id,
            request: runnerRequest,
            cachedScanResult: payload.scanResult ?? null,
            signal,
          }),
      })

      sendJson({ response, statusCode: 202, body: { jobId: job.id } })
      return true
    }

    const resumeMatch = url.pathname.match(/^\/api\/export\/([^/]+)\/resume$/)

    if (method !== "POST" || !resumeMatch?.[1]) {
      return false
    }

    const job = jobStore.get(resumeMatch[1])

    if (!job) {
      sendJson({ response, statusCode: 404, body: { error: "job not found" } })
      return true
    }

    if (job.status !== JOB_STATUSES.RUNNING || !job.resumeAvailable) {
      sendJson({
        response,
        statusCode: 409,
        body: { error: "재개 가능한 export 작업이 아닙니다." },
      })
      return true
    }

    void exportJobRunner.startTrackedJobTask({
      jobId: job.id,
      run: (signal) =>
        exportJobRunner.runExport({
          jobId: job.id,
          request: job.request,
          cachedScanResult: state.jobScanResults.get(job.id) ?? null,
          resume: true,
          signal,
        }),
    })

    sendJson({ response, statusCode: 202, body: { jobId: job.id, status: JOB_STATUSES.RUNNING } })
    return true
  }
