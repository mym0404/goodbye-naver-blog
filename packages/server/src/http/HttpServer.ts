import { createServer } from "node:http"

import { createNaverBlog } from "@exitpress/blog-naver/NaverBlog.js"
import { createTistoryBlog } from "@exitpress/blog-tistory/TistoryBlog.js"
import { allExportProfiles } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import { createBlogRegistry } from "@exitpress/engine/blog/BlogRegistry.js"
import { runImageUploadPhase } from "@exitpress/engine/exporting/upload/ImageUploadPhase.js"
import {
  rewriteImageUploadPost,
  writeImageUploadManifestSnapshot,
} from "@exitpress/engine/exporting/upload/ImageUploadRewriter.js"
import { toErrorMessage } from "@exitpress/engine/shared/error/util/toErrorMessage.js"

import type { Server as NodeHttpServer } from "node:http"

import type { UploadProviderSource } from "../upload/ImageUploadProviderSource.js"

import { createBlockScanJobRunner } from "../jobs/BlockScanJobRunner.js"
import { BlockScanJobStore } from "../jobs/BlockScanJobStore.js"
import { createHttpExportJobRunner } from "../jobs/HttpExportJobRunner.js"
import { JobStore } from "../jobs/JobStore.js"
import { createApiRoutes } from "../routes/ApiRoutes.js"
import { openLocalPathWithSystem } from "../routes/LocalFileService.js"
import { createHttpServerState } from "../state/HttpServerState.js"
import { createPostHtmlCache } from "../state/PostHtmlCache.js"
import { createBrowserAppResponder } from "../static/BrowserApp.js"
import { createImageUploadProviderSource } from "../upload/ImageUploadProviderSource.js"

import { sendJson } from "./HttpResponse.js"
import {
  defaultOutputDir,
  defaultPostHtmlCacheDir,
  defaultScanCachePath,
  defaultSettingsPath,
  defaultThemePreference,
} from "./ServerPaths.js"

// Builds the local HTTP server with injectable stores and side-effect runners for tests.
export const createHttpServer = ({
  jobStore = new JobStore(),
  uploadPhaseRunner = runImageUploadPhase,
  postUploadRewriter = rewriteImageUploadPost,
  manifestSnapshotWriter = writeImageUploadManifestSnapshot,
  scanCachePath = defaultScanCachePath,
  postHtmlCacheDir = defaultPostHtmlCacheDir,
  settingsPath = defaultSettingsPath,
  uploadProviderSource = createImageUploadProviderSource(),
  openLocalPath = openLocalPathWithSystem,
}: {
  jobStore?: JobStore
  uploadPhaseRunner?: typeof runImageUploadPhase
  postUploadRewriter?: typeof rewriteImageUploadPost
  manifestSnapshotWriter?: typeof writeImageUploadManifestSnapshot
  scanCachePath?: string
  postHtmlCacheDir?: string
  settingsPath?: string
  uploadProviderSource?: UploadProviderSource
  openLocalPath?: (targetPath: string) => Promise<void> | void
} = {}) => {
  let httpServer: NodeHttpServer
  const blogRegistry = createBlogRegistry([createNaverBlog(), createTistoryBlog()])
  const blockTemplateDefinitions = blogRegistry.list().flatMap((blog) =>
    blog.getBlockTemplateDefinitions().map((definition) => ({
      ...definition,
      outputTemplates: Object.fromEntries(
        allExportProfiles.flatMap((profile) => {
          const template = blog.getOutputBlockTemplates?.(profile)[definition.key]

          return template === undefined ? [] : [[profile, template]]
        }),
      ),
    })),
  )
  const state = createHttpServerState({
    jobStore,
    scanCachePath,
    settingsPath,
    defaultOutputDir,
    defaultThemePreference,
    blockTemplateDefinitions,
    blogs: blogRegistry.list().map(({ key, label }) => ({ key, label })),
  })
  const postHtmlCache = createPostHtmlCache({
    cacheDir: postHtmlCacheDir,
  })
  const blockScanJobRunner = createBlockScanJobRunner({
    jobStore: new BlockScanJobStore(),
    blogRegistry,
    blockTemplateDefinitions,
    postHtmlCache,
  })
  const exportJobRunner = createHttpExportJobRunner({
    jobStore,
    blogRegistry,
    jobScanResults: state.jobScanResults,
    postHtmlCache,
    uploadPhaseRunner,
    postUploadRewriter,
    manifestSnapshotWriter,
  })
  const browserApp = createBrowserAppResponder({
    httpServerRef: () => httpServer,
  })
  const apiRoutes = createApiRoutes({
    jobStore,
    state,
    blogRegistry,
    blockScanJobRunner,
    exportJobRunner,
    postHtmlCache,
    uploadPhaseRunner,
    uploadProviderSource,
    openLocalPath,
  })

  httpServer = createServer(async (request, response) => {
    const method = request.method ?? "GET"
    const url = new URL(request.url ?? "/", "http://localhost")

    try {
      if (method === "GET" && !url.pathname.startsWith("/api/")) {
        await browserApp.sendBrowserApp({
          request,
          response,
          pathname: url.pathname,
        })
        return
      }

      if (
        await apiRoutes.handleRequest({
          request,
          response,
          method,
          url,
        })
      ) {
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
    browserApp.close()
  })

  return httpServer
}
