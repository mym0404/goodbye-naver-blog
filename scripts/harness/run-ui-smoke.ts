import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdir } from "node:fs/promises"

import { chromium } from "playwright"

import { createHttpServer } from "../../src/server/http-server.js"
import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "../../src/shared/export-options.js"
import type {
  ExportJobPollingConfig,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../../src/shared/types.js"

const responseTimeoutMs = 90_000
const smokeFast = process.env.FAREWELL_SMOKE_FAST !== "0"
const smokeDebug = process.env.FAREWELL_SMOKE_DEBUG === "1"
const debugLog = (...args: unknown[]) => {
  if (!smokeDebug) {
    return
  }

  console.log("[run-ui-smoke]", ...args)
}
const smokeJobPolling: ExportJobPollingConfig | undefined = smokeFast
  ? {
      defaultPollMs: 100,
      fastPollMs: 50,
      uploadBurstPollMs: 25,
      uploadBurstAttempts: 8,
    }
  : undefined
const smokeStatusPollMs = smokeFast ? 100 : 1000
const smokeJobFetchLimits = smokeFast
  ? {
      exportRunningMax: 2,
      uploadPartialMax: 3,
      rewritePendingMax: 4,
    }
  : {
      exportRunningMax: 8,
      uploadPartialMax: 12,
      rewritePendingMax: 20,
    }
const resolveBrowserMode = () => {
  if (process.argv.includes("--headed")) {
    return {
      headless: false,
      slowMo: 200,
    }
  }

  if (process.argv.includes("--headless")) {
    return {
      headless: true,
      slowMo: 0,
    }
  }

  return {
    headless: true,
    slowMo: 0,
  }
}
const desktopViewport = {
  width: 1440,
  height: 1200,
} as const
const mobileViewport = {
  width: 375,
  height: 812,
} as const
const fallbackSmokeOutputDir = path.join(tmpdir(), `farewell-naver-blog-smoke-fixture-${process.pid}`, "output")

const getCaptureDir = () => {
  const index = process.argv.indexOf("--capture-dir")

  if (index < 0) {
    return null
  }

  return process.argv[index + 1] ?? null
}

const buildJsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
})

const waitForExportSettingsSave = ({
  page,
  baseUrl,
  expectedThemePreference,
}: {
  page: import("playwright").Page
  baseUrl: string
  expectedThemePreference: "dark" | "light"
}) =>
  page.waitForRequest(
    (request) => {
      if (request.url() !== `${baseUrl}/api/export-settings` || request.method() !== "POST") {
        return false
      }

      const body = request.postDataJSON() as {
        themePreference?: string
      }

      return body.themePreference === expectedThemePreference
    },
    { timeout: responseTimeoutMs },
  )

const uploadProviderCatalog: UploadProviderCatalogResponse = {
  defaultProviderKey: "github",
  providers: [
    {
      key: "github",
      label: "GitHub",
      fields: [
        {
          key: "repo",
          label: "Repository",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "owner/repo",
        },
        {
          key: "branch",
          label: "Branch",
          inputType: "text",
          required: false,
          defaultValue: "main",
          placeholder: "",
        },
        {
          key: "path",
          label: "Path",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "images/posts",
        },
        {
          key: "token",
          label: "Token",
          inputType: "password",
          required: true,
          defaultValue: null,
          placeholder: "ghp_xxx",
        },
      ],
    },
  ],
}

const smokeImageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9Wn6kAAAAASUVORK5CYII=",
  "base64",
)

const scanResult = {
  blogId: "mym0404",
  totalPostCount: 1,
  categories: [
    {
      id: 101,
      name: "NestJS",
      parentId: null,
      postCount: 1,
      isDivider: false,
      isOpen: true,
      path: ["NestJS"],
      depth: 1,
    },
  ],
  posts: [
    {
      blogId: "mym0404",
      logNo: "223034929697",
      title: "NestJS 업로드 플로우 점검",
      publishedAt: "2026-04-11T04:00:00.000Z",
      categoryId: 101,
      categoryName: "NestJS",
      source: "https://blog.naver.com/mym0404/223034929697",
      editorVersion: 4,
      thumbnailUrl: "https://example.com/thumb.png",
    },
  ],
}

const createUploadFlowOptions = () => {
  const options = defaultExportOptions()

  options.scope.categoryIds = [101]
  options.frontmatter.aliases.title = "postTitle"
  options.assets.imageHandlingMode = "download-and-upload"
  options.assets.downloadImages = true
  options.assets.downloadThumbnails = true

  return options
}

const uploadTargetCount = 18
const uploadCandidatesPerPost = 3
const uploadTimelineTimestamps = {
  createdAt: "2026-04-11T04:00:00.000Z",
  startedAt: "2026-04-11T04:00:01.000Z",
  runningAt: "2026-04-11T04:00:02.000Z",
  partialAt: "2026-04-11T04:00:03.000Z",
  rewriteAt: "2026-04-11T04:00:04.000Z",
  finishedAt: "2026-04-11T04:00:05.000Z",
} as const

const uploadCounts = Array.from({ length: uploadTargetCount }, (_, index) => ({
  pending: 0,
  partial: index === 0 ? uploadCandidatesPerPost : index === 1 ? 1 : 0,
  rewrite: uploadCandidatesPerPost,
  completed: uploadCandidatesPerPost,
}))

const buildLocalAssetPath = (index: number, assetIndex: number) =>
  `NestJS/2026-04-11-223034929${String(700 + index).padStart(3, "0")}/image-${String(assetIndex + 1).padStart(2, "0")}.png`

const buildRemoteAssetPath = (index: number, assetIndex: number) =>
  `https://cdn.example.com/${buildLocalAssetPath(index, assetIndex)}`

const buildUploadCandidates = (index: number) =>
  Array.from({ length: uploadCandidatesPerPost }, (_, assetIndex) => ({
    kind: assetIndex === 0 ? "thumbnail" : "image",
    sourceUrl: `https://example.com/image-${index + 1}-${assetIndex + 1}.png`,
    localPath: buildLocalAssetPath(index, assetIndex),
    markdownReference: `image-${String(assetIndex + 1).padStart(2, "0")}.png`,
  }))

const buildUploadItem = ({
  index,
  uploadedCount,
  assetPaths,
  updatedAt,
  rewriteStatus,
  rewrittenAt,
}: {
  index: number
  uploadedCount: number
  assetPaths: string[]
  updatedAt: string
  rewriteStatus: "pending" | "completed" | "failed"
  rewrittenAt: string | null
}) => {
  const logNo = `223034929${String(700 + index).padStart(3, "0")}`
  const title = `NestJS 업로드 플로우 점검 ${index + 1}`
  const outputPath = `NestJS/2026-04-11-${logNo}/index.md`
  const candidates = buildUploadCandidates(index)
  const uploadedUrls =
    rewriteStatus === "completed"
      ? candidates.map((_, assetIndex) => buildRemoteAssetPath(index, assetIndex))
      : []
  const externalPreviewUrl =
    rewriteStatus === "completed" ? `https://markdownviewer.pages.dev/#share=smoke-${logNo}` : null

  return {
    id: outputPath,
    logNo,
    title,
    source: `https://blog.naver.com/mym0404/${logNo}`,
    category: {
      id: 101,
      name: "NestJS",
      path: ["NestJS"],
    },
    status: "success" as const,
    outputPath,
    assetPaths,
    upload: {
      eligible: true,
      candidateCount: uploadCandidatesPerPost,
      uploadedCount,
      failedCount: 0,
      candidates,
      uploadedUrls,
      rewriteStatus,
      rewrittenAt,
    },
    warnings: [],
    warningCount: 0,
    error: null,
    externalPreviewUrl,
    updatedAt,
  }
}

const createBaseJob = () => ({
  id: "job-smoke",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir: fallbackSmokeOutputDir,
    profile: "gfm",
    options: createUploadFlowOptions(),
  },
  logs: [
    {
      timestamp: uploadTimelineTimestamps.createdAt,
      message: "작업을 큐에 등록했습니다.",
    },
  ],
  createdAt: uploadTimelineTimestamps.createdAt,
  startedAt: uploadTimelineTimestamps.startedAt,
  progress: {
    total: uploadTargetCount,
    completed: uploadTargetCount,
    failed: 0,
    warnings: 0,
  },
  error: null,
})

const buildUploadJob = ({
  jobStatus,
  uploadStatus,
  perItemUploadedCounts,
  progress,
  finishedAt,
  error,
  logs,
  perItemRewriteStatuses,
}: {
  jobStatus: "running" | "upload-ready" | "uploading" | "upload-failed" | "upload-completed"
  uploadStatus: "not-requested" | "upload-ready" | "uploading" | "upload-failed" | "upload-completed"
  perItemUploadedCounts: number[]
  progress: {
    total: number
    completed: number
    failed: number
    warnings: number
  }
  finishedAt: string | null
  error: string | null
  logs: Array<{
    timestamp: string
    message: string
  }>
  perItemRewriteStatuses?: Array<"pending" | "completed" | "failed">
}) => {
  const items = perItemUploadedCounts.map((uploadedCount, index) => {
    const rewriteStatus =
      perItemRewriteStatuses?.[index] ??
      (jobStatus === "upload-completed"
        ? "completed"
        : uploadStatus === "upload-failed"
          ? "failed"
          : "pending")
    const rewrittenAt = rewriteStatus === "completed" ? uploadTimelineTimestamps.rewriteAt : null

    return buildUploadItem({
      index,
      uploadedCount,
      assetPaths:
        rewriteStatus === "completed"
          ? buildUploadCandidates(index).map((_, assetIndex) => buildRemoteAssetPath(index, assetIndex))
          : buildUploadCandidates(index).map((candidate) => candidate.localPath),
      updatedAt: finishedAt ?? logs.at(-1)?.timestamp ?? uploadTimelineTimestamps.startedAt,
      rewriteStatus,
      rewrittenAt,
    })
  })
  const uploadedCount = perItemUploadedCounts.reduce((sum, value) => sum + value, 0)
  const manifestPosts = items.map(({ updatedAt: _updatedAt, ...item }) => item)

  return {
    ...createBaseJob(),
    status: jobStatus,
    finishedAt,
    logs,
    progress,
    upload: {
      status: uploadStatus,
      eligiblePostCount: uploadTargetCount,
      candidateCount: uploadTargetCount * uploadCandidatesPerPost,
      uploadedCount,
      failedCount:
        uploadStatus === "upload-failed"
          ? uploadTargetCount * uploadCandidatesPerPost - uploadedCount
          : 0,
      terminalReason: uploadStatus === "upload-failed" ? "provider-failed" : null,
    },
    items,
    manifest: {
      generatedAt: finishedAt ?? logs.at(-1)?.timestamp ?? uploadTimelineTimestamps.startedAt,
      blogId: "mym0404",
      profile: "gfm",
      options: createUploadFlowOptions(),
      selectedCategoryIds: [101],
      startedAt: uploadTimelineTimestamps.startedAt,
      finishedAt,
      outputDir: fallbackSmokeOutputDir,
      totalPosts: uploadTargetCount,
      successCount: uploadTargetCount,
      failureCount: 0,
      warningCount: 0,
      upload: {
        status: uploadStatus,
        eligiblePostCount: uploadTargetCount,
        candidateCount: uploadTargetCount * uploadCandidatesPerPost,
        uploadedCount,
        failedCount:
          uploadStatus === "upload-failed"
            ? uploadTargetCount * uploadCandidatesPerPost - uploadedCount
            : 0,
        terminalReason: uploadStatus === "upload-failed" ? "provider-failed" : null,
      },
      categories: scanResult.categories,
      posts: manifestPosts,
    },
    error,
  }
}

const createRunningJob = () =>
  buildUploadJob({
    jobStatus: "running",
    uploadStatus: "not-requested",
    perItemUploadedCounts: uploadCounts.map((count) => count.pending),
    progress: {
      total: uploadTargetCount,
      completed: 7,
      failed: 0,
      warnings: 0,
    },
    finishedAt: null,
    error: null,
    logs: [
      {
        timestamp: uploadTimelineTimestamps.createdAt,
        message: "작업을 큐에 등록했습니다.",
      },
      {
        timestamp: uploadTimelineTimestamps.runningAt,
        message: "수집 진행률을 갱신했습니다.",
      },
    ],
  })

const createUploadReadyJob = () =>
  buildUploadJob({
    jobStatus: "upload-ready",
    uploadStatus: "upload-ready",
    perItemUploadedCounts: uploadCounts.map((count) => count.pending),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
      warnings: 0,
    },
    finishedAt: null,
    error: null,
    logs: [
      {
        timestamp: uploadTimelineTimestamps.createdAt,
        message: "작업을 큐에 등록했습니다.",
      },
      {
        timestamp: uploadTimelineTimestamps.startedAt,
        message: "내보내기를 완료했고 이미지 업로드 대기 상태입니다.",
      },
    ],
  })

const createPartialUploadingJob = () =>
  buildUploadJob({
    jobStatus: "uploading",
    uploadStatus: "uploading",
    perItemUploadedCounts: uploadCounts.map((count) => count.partial),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
      warnings: 0,
    },
    finishedAt: null,
    error: null,
    logs: [
      {
        timestamp: uploadTimelineTimestamps.partialAt,
        message: "이미지 업로드 진행률을 갱신했습니다.",
      },
    ],
    perItemRewriteStatuses: uploadCounts.map((count, index) =>
      index === 0 && count.partial === uploadCandidatesPerPost ? "completed" : "pending",
    ),
  })

const createRewritePendingJob = () =>
  buildUploadJob({
    jobStatus: "uploading",
    uploadStatus: "uploading",
    perItemUploadedCounts: uploadCounts.map((count) => count.rewrite),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
      warnings: 0,
    },
    finishedAt: null,
    error: null,
    logs: [
      {
        timestamp: uploadTimelineTimestamps.rewriteAt,
        message: "문서 치환 시작: NestJS/2026-04-11-223034929700/index.md",
      },
    ],
  })

const createUploadFailedJob = () =>
  buildUploadJob({
    jobStatus: "upload-failed",
    uploadStatus: "upload-failed",
    perItemUploadedCounts: uploadCounts.map((count) => count.partial),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
      warnings: 0,
    },
    finishedAt: null,
    error: "Image upload failed.",
    logs: [
      {
        timestamp: uploadTimelineTimestamps.partialAt,
        message: "이미지 업로드 진행률을 갱신했습니다.",
      },
      {
        timestamp: uploadTimelineTimestamps.rewriteAt,
        message: "Image upload failed.",
      },
    ],
    perItemRewriteStatuses: uploadCounts.map((count, index) =>
      index === 0 && count.partial === uploadCandidatesPerPost ? "completed" : "failed",
    ),
  })

const createUploadCompletedJob = () =>
  buildUploadJob({
    jobStatus: "upload-completed",
    uploadStatus: "upload-completed",
    perItemUploadedCounts: uploadCounts.map((count) => count.completed),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
      warnings: 0,
    },
    finishedAt: uploadTimelineTimestamps.finishedAt,
    error: null,
    logs: [
      {
        timestamp: uploadTimelineTimestamps.rewriteAt,
        message: "문서 치환 완료: NestJS/2026-04-11-223034929700/index.md",
      },
      {
        timestamp: uploadTimelineTimestamps.finishedAt,
        message: "Image Upload와 결과 치환이 완료되었습니다.",
      },
    ],
  })

const applyCurrentOutputDir = <T extends {
  request: { outputDir: string }
  manifest: { outputDir: string }
}>(job: T, outputDir: string) => {
  job.request.outputDir = outputDir
  job.manifest.outputDir = outputDir
  return job
}

const captureReviewScreens = async ({
  page,
  captureDir,
}: {
  page: import("playwright").Page
  captureDir: string
}) => {
  await mkdir(captureDir, {
    recursive: true,
  })

  await page.setViewportSize(desktopViewport)
  await page.screenshot({
    path: path.join(captureDir, "desktop-overview.png"),
    fullPage: true,
  })
  await page.screenshot({
    path: path.join(captureDir, "desktop-status.png"),
    fullPage: true,
  })
  await page.setViewportSize(mobileViewport)
  await page.screenshot({
    path: path.join(captureDir, "mobile-overview.png"),
    fullPage: true,
  })
}

const waitForJobStatus = async ({
  page,
  timeoutMs,
  accept,
  failureStatuses,
  timeoutLabel,
}: {
  page: import("playwright").Page
  timeoutMs: number
  accept: (status: string | null) => boolean
  failureStatuses?: string[]
  timeoutLabel: string
}) => {
  const startTime = Date.now()
  const failures = new Set(failureStatuses ?? ["failed", "upload-failed"])

  while (Date.now() - startTime < timeoutMs) {
    const status = (await page.locator("#status-text").textContent())?.trim() ?? null

    if (accept(status)) {
      return
    }

    if (status && failures.has(status)) {
      throw new Error(`${timeoutLabel} failed with status ${status}`)
    }

    await page.waitForTimeout(smokeStatusPollMs)
  }

  throw new Error(`${timeoutLabel} timed out`)
}

const readProgressValue = async ({
  page,
  selector,
}: {
  page: import("playwright").Page
  selector: string
}) => {
  const value = await page.locator(selector).getAttribute("aria-valuenow")

  return Number(value ?? "0")
}

const selectTriggerValue = async ({
  page,
  selector,
}: {
  page: import("playwright").Page
  selector: string
}) => (await page.locator(selector).getAttribute("data-value")) ?? ""

const chooseSelectOption = async ({
  page,
  trigger,
  value,
}: {
  page: import("playwright").Page
  trigger: string
  value: string
}) => {
  await page.click(trigger)
  await page.locator(`[data-slot="select-item"][data-value="${value}"]`).click()
}

const assertUploadRowStatus = async ({
  page,
  rowId,
  expectedStatus,
}: {
  page: import("playwright").Page
  rowId: string
  expectedStatus: "pending" | "partial" | "complete" | "failed"
}) => {
  const status = await page
    .locator(`[data-upload-row-id="${rowId}"]`)
    .getAttribute("data-upload-row-status")

  if (status !== expectedStatus) {
    throw new Error(`unexpected upload row status for ${rowId}: ${status}`)
  }
}

const assertStickyTop = async ({
  page,
  selector,
  label,
}: {
  page: import("playwright").Page
  selector: string
  label: string
}) => {
  const currentScroll = await page.evaluate(() => window.scrollY)
  const before = await page.locator(selector).evaluate((element) => element.getBoundingClientRect().top)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }))
  await page.waitForTimeout(150)
  const after = await page.locator(selector).evaluate((element) => element.getBoundingClientRect().top)
  await page.evaluate((nextScroll) => window.scrollTo({ top: nextScroll }), currentScroll)

  if (Math.abs(before - after) > 1.5) {
    throw new Error(`${label} did not stay sticky`)
  }
}

const assertFrameFlush = async ({
  page,
  selector,
  label,
}: {
  page: import("playwright").Page
  selector: string
  label: string
}) => {
  const rect = await page.locator(selector).evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: bounds.left,
      top: bounds.top,
    }
  })

  if (Math.abs(rect.left) > 1.5 || Math.abs(rect.top) > 1.5) {
    throw new Error(`${label} was not flush with the viewport`)
  }
}

const waitForStepView = async ({
  page,
  step,
}: {
  page: import("playwright").Page
  step: string
}) => {
  await page.waitForFunction(
    (nextStep) => document.querySelector(`[data-step-view="${nextStep}"]`) instanceof HTMLElement,
    step,
  )
}

const run = async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "farewell-naver-blog-smoke-"))
  const outputDir = path.join(tempRoot, "output")
  const server = createHttpServer({
    settingsPath: path.join(tempRoot, "export-ui-settings.json"),
    scanCachePath: path.join(tempRoot, "scan-cache.json"),
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a numeric port")
  }

  const baseUrl = `http://127.0.0.1:${address.port}`
  const browserMode = resolveBrowserMode()
  const browser = await chromium.launch(browserMode)
  const context = await browser.newContext({
    viewport: desktopViewport,
  })
  const page = await context.newPage()
  const captureDir = getCaptureDir()

  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`browser console error: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    console.error(`page error: ${error.message}`)
  })
  if (smokeDebug) {
    page.on("request", (request) => {
      if (request.url().includes("/api/")) {
        debugLog("request", request.method(), request.url())
      }
    })
    page.on("response", (response) => {
      if (response.url().includes("/api/")) {
        debugLog("response", response.status(), response.request().method(), response.url())
      }
    })
  }

  const mockState: {
    scanRequestCount: number
    uploadAttempt: 0 | 1 | 2
    jobFetchCount: number
    themePreference: "dark" | "light"
    uploadPayload: null | {
      providerKey: string
      providerFields: Record<string, UploadProviderValue>
    }
  } = {
    scanRequestCount: 0,
    uploadAttempt: 0,
    jobFetchCount: 0,
    themePreference: "dark",
    uploadPayload: null,
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (pathname === "/api/export-defaults") {
      await route.fulfill(
        buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: outputDir,
          themePreference: mockState.themePreference,
          jobPolling: smokeJobPolling,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        }),
      )
      return
    }

    if (pathname === "/api/export-settings" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        themePreference?: "dark" | "light"
      }

      if (body.themePreference === "dark" || body.themePreference === "light") {
        mockState.themePreference = body.themePreference
      }

      await route.fulfill({
        status: 204,
        body: "",
      })
      return
    }

    if (pathname === "/api/upload-providers") {
      await route.fulfill(buildJsonResponse(uploadProviderCatalog))
      return
    }

    if (pathname === "/api/export-resume/lookup" && request.method() === "POST") {
      await route.fulfill(
        buildJsonResponse({
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
        }),
      )
      return
    }

    if (pathname === "/api/scan" && request.method() === "POST") {
      mockState.scanRequestCount += 1
      await route.fulfill(buildJsonResponse(scanResult))
      return
    }

    if (pathname === "/api/export" && request.method() === "POST") {
      mockState.uploadAttempt = 0
      mockState.jobFetchCount = 0
      mockState.uploadPayload = null
      await route.fulfill(
        buildJsonResponse(
          {
            jobId: "job-smoke",
          },
          202,
        ),
      )
      return
    }

    if (pathname === "/api/export/job-smoke" && request.method() === "GET") {
      mockState.jobFetchCount += 1

      if (mockState.uploadAttempt === 0) {
        const nextJob =
          mockState.jobFetchCount <= smokeJobFetchLimits.exportRunningMax ? createRunningJob() : createUploadReadyJob()

        await route.fulfill(buildJsonResponse(applyCurrentOutputDir(nextJob, outputDir)))
        return
      }

      const nextJob =
        mockState.uploadAttempt === 1
          ? applyCurrentOutputDir(
              mockState.jobFetchCount <= smokeJobFetchLimits.uploadPartialMax
                ? createPartialUploadingJob()
                : createUploadFailedJob(),
              outputDir,
            )
          : applyCurrentOutputDir(
              mockState.jobFetchCount <= smokeJobFetchLimits.rewritePendingMax
                ? createRewritePendingJob()
                : createUploadCompletedJob(),
              outputDir,
            )

      await route.fulfill(buildJsonResponse(nextJob))
      return
    }

    if (pathname === "/api/export/job-smoke/upload" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        providerKey?: string
        providerFields?: Record<string, UploadProviderValue>
      }

      if (!body.providerKey || !body.providerFields) {
        await route.fulfill(
          buildJsonResponse(
            {
              error: "providerKey와 providerFields는 필수입니다.",
            },
            400,
          ),
        )
        return
      }

      mockState.uploadAttempt = mockState.uploadAttempt === 0 ? 1 : 2
      mockState.jobFetchCount = 0
      mockState.uploadPayload = {
        providerKey: body.providerKey,
        providerFields: body.providerFields,
      }

      await route.fulfill(
        buildJsonResponse(
          {
            jobId: "job-smoke",
            status: "uploading",
          },
          202,
        ),
      )
      return
    }

    if (pathname === "/api/export/job-smoke/manifest" && request.method() === "GET") {
      const manifest =
        mockState.uploadAttempt === 2
          ? applyCurrentOutputDir(createUploadCompletedJob(), outputDir).manifest
          : applyCurrentOutputDir(createUploadReadyJob(), outputDir).manifest

      await route.fulfill(buildJsonResponse(manifest))
      return
    }

    await route.fulfill(
      buildJsonResponse(
        {
          error: `Unhandled smoke route: ${pathname}`,
        },
        404,
      ),
    )
  })

  await page.route("https://cdn.example.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: smokeImageBytes,
    })
  })

  try {
    await page.goto(baseUrl)
    await waitForStepView({
      page,
      step: "blog-input",
    })
    const darkThemeButton = page.getByRole("button", { name: "다크" })
    const lightThemeButton = page.getByRole("button", { name: "라이트" })

    if ((await darkThemeButton.getAttribute("data-state")) !== "on") {
      throw new Error("expected dark theme button to be selected by default")
    }

    debugLog("waitForRequest", "themePersistPromise", "light")
    const themePersistPromise = waitForExportSettingsSave({
      page,
      baseUrl,
      expectedThemePreference: "light",
    })

    await lightThemeButton.click()
    await themePersistPromise

    if ((await lightThemeButton.getAttribute("data-state")) !== "on" || mockState.themePreference !== "light") {
      throw new Error(`expected theme toggle to persist light mode, got state=${mockState.themePreference}`)
    }

    await page.fill("#blogIdOrUrl", "mym0404")

    debugLog("waitForResponse", "scanResponsePromise")
    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.fill("#outputDir", outputDir)
    await page.click("#scan-button")
    await scanResponsePromise
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (mockState.scanRequestCount !== 1) {
      throw new Error(`expected first scan request count to be 1, got ${mockState.scanRequestCount}`)
    }

    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "blog-input",
    })
    await page.click("#scan-button")
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (mockState.scanRequestCount !== 1) {
      throw new Error("scan should have been reused when the blog input did not change")
    }

    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "blog-input",
    })

    const forceScanTooltip = await page.locator("#force-scan-button").getAttribute("title")

    if (forceScanTooltip !== "캐시 무효화") {
      throw new Error(`expected force scan tooltip to be cache invalidation, got ${forceScanTooltip ?? "null"}`)
    }

    debugLog("waitForResponse", "forcedScanResponsePromise")
    const forcedScanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#force-scan-button")
    await forcedScanResponsePromise
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (mockState.scanRequestCount !== 2) {
      throw new Error(`expected forced scan request count to be 2, got ${mockState.scanRequestCount}`)
    }

    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "blog-input",
    })
    await page.fill("#blogIdOrUrl", "another-blog")

    debugLog("waitForResponse", "secondScanResponsePromise")
    const secondScanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#scan-button")
    await secondScanResponsePromise
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (mockState.scanRequestCount !== 3) {
      throw new Error(`expected changed blog input to trigger a third scan, got ${mockState.scanRequestCount}`)
    }

    await chooseSelectOption({
      page,
      trigger: "#scope-categoryMode",
      value: "exact-selected",
    })
    await page.fill("#scope-dateFrom", "2024-01-01")
    await page.fill("#scope-dateTo", "2024-12-31")
    await page.fill("#category-search", "NestJS")
    await page.click("#clear-all-categories")
    await page.waitForSelector(".category-item")
    await page.click('.category-item [data-slot="checkbox"]')
    await page.click('button:has-text("구조 설정")')
    await waitForStepView({
      page,
      step: "structure-options",
    })

    await page.click("#structure-groupByCategory")
    await page.click('button:has-text("Frontmatter 설정")')
    await waitForStepView({
      page,
      step: "frontmatter-options",
    })

    const frontmatterDescription = await page
      .locator('[data-frontmatter-field="title"] .frontmatter-description')
      .textContent()

    if (!frontmatterDescription?.includes("글 제목")) {
      throw new Error("frontmatter description missing")
    }

    await page.fill('[data-frontmatter-field="title"] input[data-alias-input="true"]', "shared")
    await page.fill('[data-frontmatter-field="source"] input[data-alias-input="true"]', "shared")

    const frontmatterStatusText = await page.locator("#frontmatter-status").textContent()

    if (!frontmatterStatusText?.includes('title와 source가 같은 alias "shared"')) {
      throw new Error("frontmatter alias collision was not shown")
    }

    debugLog("waitForRequest", "darkThemePersistPromise", "dark")
    const darkThemePersistPromise = waitForExportSettingsSave({
      page,
      baseUrl,
      expectedThemePreference: "dark",
    })

    await page.getByRole("button", { name: "다크" }).click()
    await darkThemePersistPromise

    debugLog("waitForRequest", "restoreLightThemePromise", "light")
    const restoreLightThemePromise = waitForExportSettingsSave({
      page,
      baseUrl,
      expectedThemePreference: "light",
    })

    await page.getByRole("button", { name: "라이트" }).click()
    await restoreLightThemePromise

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should not appear before the assets step")
    }

    await page.click('button:has-text("Markdown 설정")')
    await waitForStepView({
      page,
      step: "markdown-options",
    })

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should stay hidden until the diagnostics step")
    }

    if (await page.locator("#markdown-linkCardStyle").count()) {
      throw new Error("removed markdown link card controls reappeared")
    }

    if (!(await page.locator('[data-block-output-card="formula"]').count())) {
      throw new Error("block output cards should appear in the markdown step")
    }

    await chooseSelectOption({
      page,
      trigger: "#markdown-linkStyle",
      value: "referenced",
    })
    await page.fill("#blockOutputs-defaults-formula-inlineWrapper", "\\(...\\)")
    await page.click('button:has-text("Assets 설정")')
    await waitForStepView({
      page,
      step: "assets-options",
    })

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should stay hidden inside the Assets tab")
    }

    await page.click('button:has-text("Link 처리")')
    await waitForStepView({
      page,
      step: "links-options",
    })

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should stay hidden inside the Link 처리 step")
    }

    await page.click('button:has-text("진단 설정")')
    await waitForStepView({
      page,
      step: "diagnostics-options",
    })

    const exportDisabledWithCollision = await page.locator("#export-button").isDisabled()

    if (!exportDisabledWithCollision) {
      throw new Error("export button should be disabled when aliases collide")
    }

    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "links-options",
    })
    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "assets-options",
    })
    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "markdown-options",
    })
    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "frontmatter-options",
    })
    await page.fill('[data-frontmatter-field="source"] input[data-alias-input="true"]', "")
    await page.fill('[data-frontmatter-field="title"] input[data-alias-input="true"]', "postTitle")
    await page.click('button:has-text("Markdown 설정")')
    await waitForStepView({
      page,
      step: "markdown-options",
    })
    await page.click('button:has-text("Assets 설정")')
    await waitForStepView({
      page,
      step: "assets-options",
    })

    await page.waitForSelector("#assets-imageHandlingMode")
    await chooseSelectOption({
      page,
      trigger: "#assets-imageHandlingMode",
      value: "remote",
    })
    await page.waitForFunction(() => {
      const imageHandlingMode = document.querySelector<HTMLElement>("#assets-imageHandlingMode")
      const compression = document.querySelector<HTMLElement>("#assets-compressionEnabled")
      const downloadImages = document.querySelector<HTMLElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLElement>("#assets-downloadThumbnails")

      return (
        imageHandlingMode?.getAttribute("data-value") === "remote" &&
        compression?.matches(":disabled") === true &&
        downloadImages?.matches(":disabled") === true &&
        downloadThumbnails?.matches(":disabled") === true
      )
    })

    const remoteModeState = await page.evaluate(() => {
      const imageHandlingMode = document.querySelector<HTMLElement>("#assets-imageHandlingMode")
      const compression = document.querySelector<HTMLElement>("#assets-compressionEnabled")
      const downloadImages = document.querySelector<HTMLElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLElement>("#assets-downloadThumbnails")

      return {
        imageHandlingMode: imageHandlingMode?.getAttribute("data-value") ?? null,
        compressionDisabled: compression?.matches(":disabled") ?? null,
        downloadImagesDisabled: downloadImages?.matches(":disabled") ?? null,
        downloadThumbnailsDisabled: downloadThumbnails?.matches(":disabled") ?? null,
      }
    })

    if (
      remoteModeState.imageHandlingMode !== "remote" ||
      !remoteModeState.compressionDisabled ||
      !remoteModeState.downloadImagesDisabled ||
      !remoteModeState.downloadThumbnailsDisabled
    ) {
      throw new Error("remote image mode controls regressed")
    }

    await chooseSelectOption({
      page,
      trigger: "#assets-imageHandlingMode",
      value: "download-and-upload",
    })
    await page.waitForFunction(() => {
      const imageHandlingMode = document.querySelector<HTMLElement>("#assets-imageHandlingMode")
      const downloadImages = document.querySelector<HTMLElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLElement>("#assets-downloadThumbnails")

      return (
        imageHandlingMode?.getAttribute("data-value") === "download-and-upload" &&
        downloadImages?.getAttribute("data-state") === "checked" &&
        downloadThumbnails?.getAttribute("data-state") === "checked"
      )
    })

    const uploadModeState = await page.evaluate(() => {
      const imageHandlingMode = document.querySelector<HTMLElement>("#assets-imageHandlingMode")
      const downloadImages = document.querySelector<HTMLElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLElement>("#assets-downloadThumbnails")

      return {
        imageHandlingMode: imageHandlingMode?.getAttribute("data-value") ?? null,
        downloadImagesChecked: downloadImages?.getAttribute("data-state") === "checked",
        downloadThumbnailsChecked: downloadThumbnails?.getAttribute("data-state") === "checked",
      }
    })

    if (
      uploadModeState.imageHandlingMode !== "download-and-upload" ||
      !uploadModeState.downloadImagesChecked ||
      !uploadModeState.downloadThumbnailsChecked
    ) {
      throw new Error("download-and-upload mode did not lock local download coverage")
    }

    if (await page.locator("#upload-providerKey").count()) {
      throw new Error("upload form should not appear inside the Assets tab")
    }

    await page.click('button:has-text("Link 처리")')
    await waitForStepView({
      page,
      step: "links-options",
    })

    await page.waitForSelector("#links-sameBlogPostMode-custom-url")
    await page.click("#links-sameBlogPostMode-custom-url")
    await page.fill("#links-sameBlogPostCustomUrlTemplate", "https://myblog/{slug}")

    const livePreview = page.locator("#links-sameBlogPostCustomUrlPreview")

    if (!(await livePreview.textContent())?.includes("https://myblog/")) {
      throw new Error("custom link template preview did not update")
    }

    await page.click('button:has-text("진단 설정")')
    await waitForStepView({
      page,
      step: "diagnostics-options",
    })

    debugLog("waitForResponse", "exportResponsePromise")
    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#export-button")

    const exportResponse = await exportResponsePromise
    const { jobId } = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForStepView({
      page,
      step: "running",
    })
    await waitForJobStatus({
      page,
      timeoutMs: 10_000,
      accept: (status) => status === "running",
      timeoutLabel: "UI running state",
    })

    if ((await readProgressValue({ page, selector: "#running-progress" })) !== 39) {
      throw new Error("running progress bar did not reflect completed/total posts")
    }

    await waitForStepView({
      page,
      step: "upload",
    })
    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "upload-ready",
      timeoutLabel: "UI upload-ready state",
    })

    const setupPanelsHidden = await page.evaluate(() => {
      return !document.querySelector("#category-panel") && !document.querySelector("#export-panel")
    })

    if (!setupPanelsHidden) {
      throw new Error("post-submit flow reopened setup panels")
    }

    await page.waitForSelector("#job-file-tree table")
    await page.waitForSelector("#upload-providerKey")
    await page.waitForSelector("#upload-providerField-repo")
    await page.waitForSelector("#upload-providerField-token")

    const uploadSectionText = await page.locator("#status-panel").textContent()

    if (!uploadSectionText?.includes("업로드 시작")) {
      throw new Error("upload-ready panel did not expose the upload action")
    }

    const uploadTargetRow = await page.locator("#job-file-tree tbody tr").first().textContent()

    if (!uploadTargetRow?.includes("NestJS 업로드 플로우 점검")) {
      throw new Error("upload target table did not render the expected post")
    }

    if ((await readProgressValue({ page, selector: "#upload-progress" })) !== 0) {
      throw new Error("upload-ready state did not start from zero progress")
    }

    await assertUploadRowStatus({
      page,
      rowId: "NestJS/2026-04-11-223034929700/index.md",
      expectedStatus: "pending",
    })
    const providerValue = await selectTriggerValue({
      page,
      selector: "#upload-providerKey",
    })

    if (providerValue !== "github") {
      throw new Error("upload provider default did not stay on github")
    }

    await page.fill("#upload-providerField-repo", "owner/name")
    await page.fill("#upload-providerField-token", "placeholder-invalid-token")

    debugLog("waitForResponse", "uploadResponsePromise")
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export/${jobId}/upload` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#upload-submit")
    await uploadResponsePromise

    if (
      mockState.uploadPayload?.providerKey !== "github" ||
      mockState.uploadPayload.providerFields.repo !== "owner/name" ||
      mockState.uploadPayload.providerFields.token !== "placeholder-invalid-token"
    ) {
      throw new Error("upload request did not submit the structured placeholder provider payload")
    }

    await waitForJobStatus({
      page,
      timeoutMs: 10_000,
      accept: (status) => status === "uploading",
      timeoutLabel: "UI uploading state",
    })

    if ((await page.locator("#upload-providerKey").count()) !== 0) {
      throw new Error("uploading state should hide the upload form")
    }

    await assertUploadRowStatus({
      page,
      rowId: "NestJS/2026-04-11-223034929700/index.md",
      expectedStatus: "complete",
    })
    await assertUploadRowStatus({
      page,
      rowId: "NestJS/2026-04-11-223034929701/index.md",
      expectedStatus: "partial",
    })
    await assertUploadRowStatus({
      page,
      rowId: "NestJS/2026-04-11-223034929702/index.md",
      expectedStatus: "pending",
    })

    const partialProgressValue = await readProgressValue({
      page,
      selector: "#upload-progress",
    })

    if (partialProgressValue <= 0 || partialProgressValue >= 100) {
      throw new Error("partial uploading state did not expose intermediate progress")
    }

    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "upload-failed",
      timeoutLabel: "UI upload-failed state",
    })

    await page.waitForSelector("#upload-providerKey")
    await page.waitForSelector("#upload-providerField-repo")
    await page.waitForSelector("#upload-providerField-token")

    const failedUploadMessage = await page.locator("#status-panel").textContent()

    if (!failedUploadMessage?.includes("Image upload failed.")) {
      throw new Error("upload-failed state did not keep the retry message visible")
    }

    const failedRows = await page.locator('[data-upload-row-status="failed"]').count()
    const completedRows = await page.locator('[data-upload-row-status="complete"]').count()

    if (failedRows !== uploadTargetCount - 1 || completedRows !== 1) {
      throw new Error("upload-failed state did not preserve completed rows")
    }

    const retainedRepo = await page.locator("#upload-providerField-repo").inputValue()
    const retainedToken = await page.locator("#upload-providerField-token").inputValue()

    if (retainedRepo !== "owner/name" || retainedToken !== "placeholder-invalid-token") {
      throw new Error("upload-failed retry form did not preserve the previous provider values")
    }

    await page.setViewportSize(mobileViewport)
    await page.waitForTimeout(150)
    await page.setViewportSize(desktopViewport)
    await page.waitForTimeout(150)
    await page.fill("#upload-providerField-token", "placeholder-fixed-token")

    debugLog("waitForResponse", "retryUploadResponsePromise")
    const retryUploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export/${jobId}/upload` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#upload-submit")
    await retryUploadResponsePromise

    if (
      mockState.uploadPayload?.providerKey !== "github" ||
      mockState.uploadPayload.providerFields.repo !== "owner/name" ||
      mockState.uploadPayload.providerFields.token !== "placeholder-fixed-token"
    ) {
      throw new Error("upload retry did not submit the corrected placeholder provider payload")
    }

    await page.waitForFunction(
      () => document.querySelector("#status-text")?.textContent?.trim() === "uploading",
      undefined,
      { timeout: 10_000 },
    )
    await page.waitForFunction(() => {
      const progress = Number(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow") ?? "0")

      return progress >= 95
    })

    const rewritePendingProgress = await readProgressValue({
      page,
      selector: "#upload-progress",
    })

    if (rewritePendingProgress < 95) {
      throw new Error("rewrite-pending state did not keep a full upload bar")
    }

    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "upload-completed",
      timeoutLabel: "UI upload-completed state",
    })
    await waitForStepView({
      page,
      step: "result",
    })

    const manifest = await page.evaluate(async () => {
      const response = await fetch("/api/export/job-smoke/manifest")

      if (!response.ok) {
        throw new Error(`manifest request failed: ${response.status}`)
      }

      return response.json()
    }) as {
      totalPosts: number
      successCount: number
      failureCount: number
      upload: {
        status: string
        uploadedCount: number
      }
      posts: Array<{
        outputPath: string | null
      }>
    }
    const summaryText = await page.locator("#summary").textContent()

    if (!summaryText?.includes("완료") || !summaryText?.includes("1")) {
      throw new Error("UI summary did not show completed state")
    }

    if (manifest.totalPosts < 1 || manifest.successCount < 1) {
      throw new Error("manifest did not contain successful exports")
    }

    if (manifest.totalPosts !== manifest.successCount + manifest.failureCount) {
      throw new Error("manifest totalPosts invariant failed")
    }

    if (
      manifest.upload.status !== "upload-completed" ||
      manifest.upload.uploadedCount !== uploadTargetCount * uploadCandidatesPerPost
    ) {
      throw new Error("manifest did not reflect upload completion")
    }

    const finalStatusText = await page.locator("#status-panel").textContent()

    if (finalStatusText?.includes("owner/name")) {
      throw new Error("upload placeholder config leaked into the visible UI")
    }

    if (await page.locator("#upload-providerKey").count()) {
      throw new Error("result step should not expose upload credentials")
    }

    await page.waitForSelector("#job-file-tree [data-job-item-id]")
    await page.click('[data-job-filter="errors"]')
    await page.waitForTimeout(200)

    await page.click('[data-job-filter="all"]')

    await assertStickyTop({
      page,
      selector: "#dashboard-backdrop",
      label: "background backdrop",
    })

    if (captureDir) {
      await captureReviewScreens({
        page,
        captureDir,
      })
    }

    const firstOutputPath = manifest.posts.find((post) => post.outputPath)?.outputPath

    if (!firstOutputPath) {
      throw new Error("manifest outputPath missing")
    }

    if (firstOutputPath !== "NestJS/2026-04-11-223034929700/index.md") {
      throw new Error("per-post index.md output path regressed")
    }

    console.log(`smoke:ui passed (${jobId})`)
  } finally {
    await browser.close()
    server.close()
    await rm(tempRoot, {
      recursive: true,
      force: true,
    })
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
