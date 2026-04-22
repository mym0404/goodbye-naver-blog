import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium } from "playwright"

import { createHttpServer } from "../../src/server/http-server.js"
import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "../../src/shared/export-options.js"
import { mapConcurrent } from "../../src/shared/utils.js"
import type {
  ExportJobPollingConfig,
  ExportJobItem,
  ExportJobState,
  ExportResumeSummary,
  ScanResult,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../../src/shared/types.js"

const desktopViewport = {
  width: 1440,
  height: 1200,
} as const

const responseTimeoutMs = 30_000
const smokeFast = process.env.FAREWELL_SMOKE_FAST !== "0"
const resumeScenarioConcurrency = Math.max(
  1,
  Number.parseInt(process.env.FAREWELL_RESUME_SMOKE_CONCURRENCY ?? "3", 10) || 3,
)
const resumeDialogSettledWaitMs = smokeFast ? 75 : 300
const smokeJobPolling: ExportJobPollingConfig | undefined = smokeFast
  ? {
      defaultPollMs: 100,
      fastPollMs: 50,
      uploadBurstPollMs: 25,
      uploadBurstAttempts: 8,
    }
  : undefined

const buildJsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
})

const uploadProviderCatalog: UploadProviderCatalogResponse = {
  defaultProviderKey: "github",
  providers: [
    {
      key: "github",
      label: "GitHub",
      description: "리포지토리에 이미지를 커밋하고 URL로 사용합니다.",
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

const resumedScanResult: ScanResult = {
  blogId: "mym0404",
  totalPostCount: 5,
  categories: [
    {
      id: 101,
      name: "NestJS",
      parentId: null,
      postCount: 5,
      isDivider: false,
      isOpen: true,
      path: ["NestJS"],
      depth: 1,
    },
  ],
  posts: [
    {
      blogId: "mym0404",
      logNo: "223034929700",
      title: "NestJS 복구 테스트 1",
      publishedAt: "2026-04-11T04:00:00.000Z",
      categoryId: 101,
      categoryName: "NestJS",
      source: "https://blog.naver.com/mym0404/223034929700",
      editorVersion: 4,
      thumbnailUrl: null,
    },
  ],
}

const buildUploadOptions = () => {
  const options = defaultExportOptions()
  options.scope.categoryIds = [101]
  options.assets.imageHandlingMode = "download-and-upload"
  options.assets.downloadImages = true
  options.assets.downloadThumbnails = true
  return options
}

const timestamps = {
  createdAt: "2026-04-11T04:00:00.000Z",
  startedAt: "2026-04-11T04:00:01.000Z",
  updatedAt: "2026-04-11T04:00:02.000Z",
  finishedAt: "2026-04-11T04:00:03.000Z",
} as const

const buildUploadCandidates = (logNo: string) => [
  {
    kind: "thumbnail" as const,
    sourceUrl: `https://example.com/${logNo}/thumb.png`,
    localPath: `NestJS/2026-04-11-${logNo}/thumb.png`,
    markdownReference: "thumb.png",
  },
  {
    kind: "image" as const,
    sourceUrl: `https://example.com/${logNo}/image.png`,
    localPath: `NestJS/2026-04-11-${logNo}/image.png`,
    markdownReference: "image.png",
  },
]

const buildUploadItem = ({
  logNo,
  uploadedCount,
  rewriteStatus,
  updatedAt,
}: {
  logNo: string
  uploadedCount: number
  rewriteStatus: "pending" | "completed" | "failed"
  updatedAt: string
}): ExportJobItem => {
  const candidates = buildUploadCandidates(logNo)
  const uploadedUrls =
    rewriteStatus === "completed"
      ? candidates.map((candidate) => `https://cdn.example.com/${candidate.localPath}`)
      : []

  return {
    id: `NestJS/2026-04-11-${logNo}/index.md`,
    logNo,
    title: `NestJS 복구 테스트 ${logNo.slice(-1)}`,
    source: `https://blog.naver.com/mym0404/${logNo}`,
    category: {
      id: 101,
      name: "NestJS",
      path: ["NestJS"],
    },
    status: "success",
    outputPath: `NestJS/2026-04-11-${logNo}/index.md`,
    assetPaths:
      rewriteStatus === "completed"
        ? uploadedUrls
        : candidates.map((candidate) => candidate.localPath),
    upload: {
      eligible: true,
      candidateCount: candidates.length,
      uploadedCount,
      failedCount: rewriteStatus === "failed" ? candidates.length - uploadedCount : 0,
      candidates,
      uploadedUrls,
      rewriteStatus,
      rewrittenAt: rewriteStatus === "completed" ? updatedAt : null,
    },
    warnings: [],
    warningCount: 0,
    error: null,
    externalPreviewUrl: rewriteStatus === "completed" ? `https://preview.example.com/${logNo}` : null,
    updatedAt,
  }
}

const buildExportRunningJob = ({
  outputDir,
  resumeAvailable,
}: {
  outputDir: string
  resumeAvailable: boolean
}): ExportJobState => ({
  id: "job-running",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir,
    profile: "gfm",
    options: buildUploadOptions(),
  },
  status: "running",
  resumeAvailable,
  logs: [
    {
      timestamp: timestamps.createdAt,
      message: "작업을 큐에 등록했습니다.",
    },
    {
      timestamp: timestamps.updatedAt,
      message: "이전 진행 상태를 복구했습니다.",
    },
  ],
  createdAt: timestamps.createdAt,
  startedAt: timestamps.startedAt,
  finishedAt: null,
  progress: {
    total: 5,
    completed: 2,
    failed: 1,
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
  items: [
    {
      ...buildUploadItem({
        logNo: "223034929700",
        uploadedCount: 0,
        rewriteStatus: "pending",
        updatedAt: timestamps.updatedAt,
      }),
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
        uploadedUrls: [],
        rewriteStatus: "pending",
        rewrittenAt: null,
      },
      assetPaths: [],
    },
  ],
  manifest: null,
  error: null,
})

const buildUploadJob = ({
  jobId,
  status,
  resumeAvailable,
  outputDir,
  uploadedCounts,
  rewriteStatuses,
  error,
  finishedAt,
}: {
  jobId: string
  status: "upload-ready" | "uploading" | "upload-failed" | "upload-completed"
  resumeAvailable: boolean
  outputDir: string
  uploadedCounts: [number, number, number]
  rewriteStatuses: ["pending" | "completed" | "failed", "pending" | "completed" | "failed", "pending" | "completed" | "failed"]
  error: string | null
  finishedAt: string | null
}): ExportJobState => {
  const items = [
    buildUploadItem({
      logNo: "223034929700",
      uploadedCount: uploadedCounts[0],
      rewriteStatus: rewriteStatuses[0],
      updatedAt: finishedAt ?? timestamps.updatedAt,
    }),
    buildUploadItem({
      logNo: "223034929701",
      uploadedCount: uploadedCounts[1],
      rewriteStatus: rewriteStatuses[1],
      updatedAt: finishedAt ?? timestamps.updatedAt,
    }),
    buildUploadItem({
      logNo: "223034929702",
      uploadedCount: uploadedCounts[2],
      rewriteStatus: rewriteStatuses[2],
      updatedAt: finishedAt ?? timestamps.updatedAt,
    }),
  ]
  const uploadedCount = uploadedCounts.reduce((sum, value) => sum + value, 0)
  const failedCount = items.reduce((sum, item) => sum + item.upload.failedCount, 0)

  return {
    id: jobId,
    request: {
      blogIdOrUrl: "mym0404",
      outputDir,
      profile: "gfm",
      options: buildUploadOptions(),
    },
    status,
    resumeAvailable,
    logs: [
      {
        timestamp: timestamps.createdAt,
        message: "작업을 큐에 등록했습니다.",
      },
      {
        timestamp: timestamps.updatedAt,
        message:
          status === "upload-ready"
            ? "내보내기를 완료했고 이미지 업로드 대기 상태입니다."
            : status === "uploading"
              ? "이전 업로드 상태를 복구했습니다."
              : status === "upload-failed"
                ? "Image upload failed."
                : "Image Upload와 결과 치환이 완료되었습니다.",
      },
    ],
    createdAt: timestamps.createdAt,
    startedAt: timestamps.startedAt,
    finishedAt,
    progress: {
      total: 3,
      completed: 3,
      failed: 0,
      warnings: 0,
    },
    upload: {
      status,
      eligiblePostCount: 3,
      candidateCount: 6,
      uploadedCount,
      failedCount,
      terminalReason: status === "upload-failed" ? "provider-failed" : null,
    },
    items,
    manifest: null,
    error,
  }
}

const buildCompletedJob = ({
  outputDir,
}: {
  outputDir: string
}): ExportJobState => ({
  id: "job-completed",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir,
    profile: "gfm",
    options: defaultExportOptions(),
  },
  status: "completed",
  resumeAvailable: false,
  logs: [
    {
      timestamp: timestamps.finishedAt,
      message: "내보내기가 완료되었습니다.",
    },
  ],
  createdAt: timestamps.createdAt,
  startedAt: timestamps.startedAt,
  finishedAt: timestamps.finishedAt,
  progress: {
    total: 3,
    completed: 3,
    failed: 0,
    warnings: 1,
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
})

const buildFailedJob = ({
  outputDir,
}: {
  outputDir: string
}): ExportJobState => ({
  id: "job-failed",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir,
    profile: "gfm",
    options: defaultExportOptions(),
  },
  status: "failed",
  resumeAvailable: false,
  logs: [
    {
      timestamp: timestamps.updatedAt,
      message: "내보내기 작업이 실패했습니다.",
    },
  ],
  createdAt: timestamps.createdAt,
  startedAt: timestamps.startedAt,
  finishedAt: timestamps.updatedAt,
  progress: {
    total: 3,
    completed: 1,
    failed: 1,
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
  error: "Export failed.",
})

const buildResumeSummary = (job: ExportJobState): ExportResumeSummary => ({
  status: job.status,
  outputDir: job.request.outputDir,
  totalPosts: job.progress.total,
  completedCount: job.progress.completed,
  failedCount: job.progress.failed,
  uploadCandidateCount: job.upload.candidateCount,
  uploadedCount: job.upload.uploadedCount,
})

type ResumeScenario = {
  id: string
  step: "blog-input" | "running" | "upload" | "result"
  bootstrap: {
    profile: "gfm"
    options: ReturnType<typeof defaultExportOptions>
    lastOutputDir: string
    themePreference: "dark" | "light"
    resumedJob: ExportJobState | null
    resumeSummary: ExportResumeSummary | null
    resumedScanResult: ScanResult | null
    frontmatterFieldOrder: typeof frontmatterFieldOrder
    frontmatterFieldMeta: typeof frontmatterFieldMeta
    optionDescriptions: typeof optionDescriptions
  }
  handleRequest?: (input: {
    pathname: string
    method: string
    body: unknown
    state: {
      resumeRequestCount: number
      uploadRequestCount: number
    }
  }) => ReturnType<typeof buildJsonResponse> | null
  assert: (input: {
    page: import("playwright").Page
    state: {
      resumeRequestCount: number
      uploadRequestCount: number
    }
  }) => Promise<void>
}

const waitForStepView = async ({
  page,
  step,
}: {
  page: import("playwright").Page
  step: ResumeScenario["step"]
}) => {
  await page.waitForFunction(
    (nextStep) => document.querySelector(`[data-step-view="${nextStep}"]`) instanceof HTMLElement,
    step,
    { timeout: responseTimeoutMs },
  )
}

const waitForDialog = async ({
  page,
  summary,
}: {
  page: import("playwright").Page
  summary: ExportResumeSummary
}) => {
  const dialog = page.getByRole("dialog")
  await dialog.waitFor({
    state: "visible",
    timeout: responseTimeoutMs,
  })
  const text = ((await dialog.textContent()) ?? "").replace(/\s+/g, " ").trim()

  if (!text.includes(`상태 ${summary.status}`) || !text.includes(`출력 경로 ${summary.outputDir}`)) {
    throw new Error(`unexpected resume dialog text: ${text}`)
  }
}

const closeDialog = async (page: import("playwright").Page) => {
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "닫기" }).first().click()
  await dialog.waitFor({ state: "hidden", timeout: responseTimeoutMs })
}

const assertNoDialog = async (page: import("playwright").Page) => {
  await page.waitForTimeout(resumeDialogSettledWaitMs)
  if (await page.getByRole("dialog").count()) {
    throw new Error("unexpected resume dialog")
  }
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
  const status = await page.locator(`[data-upload-row-id="${rowId}"]`).getAttribute("data-upload-row-status")

  if (status !== expectedStatus) {
    throw new Error(`unexpected upload row status for ${rowId}: ${status}`)
  }
}

const createBootstrap = ({
  lastOutputDir,
  resumedJob,
}: {
  lastOutputDir: string
  resumedJob: ExportJobState | null
}) => ({
  profile: "gfm" as const,
  options: defaultExportOptions(),
  lastOutputDir,
  themePreference: "dark" as const,
  jobPolling: smokeJobPolling,
  resumedJob,
  resumeSummary: resumedJob ? buildResumeSummary(resumedJob) : null,
  resumedScanResult: resumedJob ? resumedScanResult : null,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
})

const runScenario = async ({
  browser,
  baseUrl,
  scenario,
}: {
  browser: import("playwright").Browser
  baseUrl: string
  scenario: ResumeScenario
}) => {
  const context = await browser.newContext({
    viewport: desktopViewport,
  })
  const page = await context.newPage()
  const state = {
    resumeRequestCount: 0,
    uploadRequestCount: 0,
  }

  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[${scenario.id}] browser console error: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    console.error(`[${scenario.id}] page error: ${error.message}`)
  })

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()
    const body = request.postDataJSON?.()

    if (pathname === "/api/export-defaults" && method === "GET") {
      await route.fulfill(buildJsonResponse(scenario.bootstrap))
      return
    }

    if (pathname === "/api/upload-providers" && method === "GET") {
      await route.fulfill(buildJsonResponse(uploadProviderCatalog))
      return
    }

    if (pathname === "/api/export-settings" && method === "POST") {
      await route.fulfill({
        status: 204,
        body: "",
      })
      return
    }

    if (pathname.endsWith("/resume") && method === "POST") {
      state.resumeRequestCount += 1
    }

    if (pathname.endsWith("/upload") && method === "POST") {
      state.uploadRequestCount += 1
    }

    const scenarioResponse = scenario.handleRequest?.({
      pathname,
      method,
      body,
      state,
    })

    if (scenarioResponse) {
      await route.fulfill(scenarioResponse)
      return
    }

    await route.fulfill(
      buildJsonResponse(
        {
          error: `Unhandled resume smoke route: ${scenario.id} ${method} ${pathname}`,
        },
        404,
      ),
    )
  })

  try {
    console.log(`resume smoke start: ${scenario.id}`)
    await page.goto(baseUrl)
    await waitForStepView({
      page,
      step: scenario.step,
    })
    await scenario.assert({
      page,
      state,
    })
    console.log(`resume smoke passed: ${scenario.id}`)
  } finally {
    await context.close()
  }
}

const run = async () => {
  const server = createHttpServer()
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a numeric port")
  }

  const baseUrl = `http://127.0.0.1:${address.port}`
  const browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    slowMo: process.argv.includes("--headed") ? 200 : 0,
  })
  const tempRoot = await mkdtemp(path.join(tmpdir(), "farewell-naver-blog-resume-smoke-"))

  const emptyOutputDir = path.join(tempRoot, "empty-output")
  const runningOutputDir = path.join(tempRoot, "running-output")
  const uploadReadyOutputDir = path.join(tempRoot, "upload-ready-output")
  const uploadingOutputDir = path.join(tempRoot, "uploading-output")
  const uploadFailedOutputDir = path.join(tempRoot, "upload-failed-output")
  const completedOutputDir = path.join(tempRoot, "completed-output")
  const uploadCompletedOutputDir = path.join(tempRoot, "upload-completed-output")
  const failedOutputDir = path.join(tempRoot, "failed-output")

  const runningResumableJob = buildExportRunningJob({
    outputDir: runningOutputDir,
    resumeAvailable: true,
  })
  const runningActiveJob = buildExportRunningJob({
    outputDir: runningOutputDir,
    resumeAvailable: false,
  })
  const uploadReadyJob = buildUploadJob({
    jobId: "job-upload-ready",
    status: "upload-ready",
    resumeAvailable: false,
    outputDir: uploadReadyOutputDir,
    uploadedCounts: [0, 0, 0],
    rewriteStatuses: ["pending", "pending", "pending"],
    error: null,
    finishedAt: null,
  })
  const uploadingResumableJob = buildUploadJob({
    jobId: "job-uploading",
    status: "uploading",
    resumeAvailable: true,
    outputDir: uploadingOutputDir,
    uploadedCounts: [2, 1, 0],
    rewriteStatuses: ["completed", "pending", "pending"],
    error: null,
    finishedAt: null,
  })
  const uploadingActiveJob = buildUploadJob({
    jobId: "job-uploading",
    status: "uploading",
    resumeAvailable: false,
    outputDir: uploadingOutputDir,
    uploadedCounts: [2, 1, 0],
    rewriteStatuses: ["completed", "pending", "pending"],
    error: null,
    finishedAt: null,
  })
  const uploadFailedJob = buildUploadJob({
    jobId: "job-upload-failed",
    status: "upload-failed",
    resumeAvailable: false,
    outputDir: uploadFailedOutputDir,
    uploadedCounts: [2, 1, 1],
    rewriteStatuses: ["completed", "failed", "failed"],
    error: "Image upload failed.",
    finishedAt: null,
  })
  const uploadFailedRetryJob = buildUploadJob({
    jobId: "job-upload-failed",
    status: "uploading",
    resumeAvailable: false,
    outputDir: uploadFailedOutputDir,
    uploadedCounts: [2, 1, 1],
    rewriteStatuses: ["completed", "pending", "pending"],
    error: null,
    finishedAt: null,
  })
  const completedJob = buildCompletedJob({
    outputDir: completedOutputDir,
  })
  const uploadCompletedJob = buildUploadJob({
    jobId: "job-upload-completed",
    status: "upload-completed",
    resumeAvailable: false,
    outputDir: uploadCompletedOutputDir,
    uploadedCounts: [2, 2, 2],
    rewriteStatuses: ["completed", "completed", "completed"],
    error: null,
    finishedAt: timestamps.finishedAt,
  })
  const failedJob = buildFailedJob({
    outputDir: failedOutputDir,
  })

  const scenarios: ResumeScenario[] = [
    {
      id: "empty-output-starts-from-blog-input",
      step: "blog-input",
      bootstrap: createBootstrap({
        lastOutputDir: emptyOutputDir,
        resumedJob: null,
      }),
      assert: async ({ page, state }) => {
        await assertNoDialog(page)

        if (state.resumeRequestCount !== 0 || state.uploadRequestCount !== 0) {
          throw new Error("initial empty state should not trigger resume or upload requests")
        }
      },
    },
    {
      id: "running-resume-restores-running-step-and-waits-for-manual-resume",
      step: "running",
      bootstrap: createBootstrap({
        lastOutputDir: runningOutputDir,
        resumedJob: runningResumableJob,
      }),
      handleRequest: ({ pathname, method, state }) => {
        if (pathname === "/api/export/job-running" && method === "GET") {
          return buildJsonResponse(state.resumeRequestCount === 0 ? runningResumableJob : runningActiveJob)
        }

        if (pathname === "/api/export/job-running/resume" && method === "POST") {
          return buildJsonResponse(
            {
              jobId: "job-running",
              status: "running",
            },
            202,
          )
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(runningResumableJob),
        })

        if (state.resumeRequestCount !== 0) {
          throw new Error("running resume should not start automatically")
        }

        await closeDialog(page)
        await page.getByRole("button", { name: "남은 작업 계속" }).click()
        await page.locator("#resume-export-submit").waitFor({
          state: "hidden",
          timeout: responseTimeoutMs,
        })

        if (state.resumeRequestCount !== 1) {
          throw new Error(`expected one manual resume request, got ${state.resumeRequestCount}`)
        }
      },
    },
    {
      id: "upload-ready-restores-upload-step-without-auto-start",
      step: "upload",
      bootstrap: createBootstrap({
        lastOutputDir: uploadReadyOutputDir,
        resumedJob: uploadReadyJob,
      }),
      handleRequest: ({ pathname, method }) => {
        if (pathname === "/api/export/job-upload-ready/upload" && method === "POST") {
          return buildJsonResponse(
            {
              jobId: "job-upload-ready",
              status: "uploading",
            },
            202,
          )
        }

        if (pathname === "/api/export/job-upload-ready" && method === "GET") {
          return buildJsonResponse(uploadReadyJob)
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(uploadReadyJob),
        })

        if (state.uploadRequestCount !== 0) {
          throw new Error("upload-ready should not start upload automatically")
        }

        await closeDialog(page)
        await page.waitForSelector("#upload-providerKey", {
          timeout: responseTimeoutMs,
        })
        await assertUploadRowStatus({
          page,
          rowId: "NestJS/2026-04-11-223034929700/index.md",
          expectedStatus: "pending",
        })

        const uploadButtonText = await page.locator("#upload-submit").textContent()

        if (!uploadButtonText?.includes("업로드 시작")) {
          throw new Error(`unexpected upload-ready button text: ${uploadButtonText ?? "null"}`)
        }

        await page.fill("#upload-providerField-repo", "owner/repo")
        await page.fill("#upload-providerField-token", "token-value")
        await page.click("#upload-submit")

        if (state.uploadRequestCount !== 1) {
          throw new Error(`expected one upload request from upload-ready, got ${state.uploadRequestCount}`)
        }
      },
    },
    {
      id: "uploading-resume-restores-progress-and-manual-continue",
      step: "upload",
      bootstrap: createBootstrap({
        lastOutputDir: uploadingOutputDir,
        resumedJob: uploadingResumableJob,
      }),
      handleRequest: ({ pathname, method, state }) => {
        if (pathname === "/api/export/job-uploading" && method === "GET") {
          return buildJsonResponse(state.uploadRequestCount === 0 ? uploadingResumableJob : uploadingActiveJob)
        }

        if (pathname === "/api/export/job-uploading/upload" && method === "POST") {
          return buildJsonResponse(
            {
              jobId: "job-uploading",
              status: "uploading",
            },
            202,
          )
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(uploadingResumableJob),
        })

        if (state.uploadRequestCount !== 0) {
          throw new Error("uploading resume should not continue automatically")
        }

        await closeDialog(page)
        await page.waitForSelector("#upload-providerKey", {
          timeout: responseTimeoutMs,
        })
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

        const uploadButtonText = await page.locator("#upload-submit").textContent()

        if (!uploadButtonText?.includes("남은 업로드 계속")) {
          throw new Error(`unexpected uploading resume button text: ${uploadButtonText ?? "null"}`)
        }

        await page.fill("#upload-providerField-repo", "owner/repo")
        await page.fill("#upload-providerField-token", "token-value")
        await page.click("#upload-submit")
        await page.locator("#upload-providerKey").waitFor({
          state: "hidden",
          timeout: responseTimeoutMs,
        })

        if (state.uploadRequestCount !== 1) {
          throw new Error(`expected one manual upload continue request, got ${state.uploadRequestCount}`)
        }
      },
    },
    {
      id: "upload-failed-restores-upload-step-with-preserved-rows",
      step: "upload",
      bootstrap: createBootstrap({
        lastOutputDir: uploadFailedOutputDir,
        resumedJob: uploadFailedJob,
      }),
      handleRequest: ({ pathname, method }) => {
        if (pathname === "/api/export/job-upload-failed" && method === "GET") {
          return buildJsonResponse(uploadFailedJob)
        }

        if (pathname === "/api/export/job-upload-failed/upload" && method === "POST") {
          return buildJsonResponse(
            {
              jobId: "job-upload-failed",
              status: "uploading",
            },
            202,
          )
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(uploadFailedJob),
        })

        if (state.uploadRequestCount !== 0) {
          throw new Error("upload-failed should not retry automatically")
        }

        await closeDialog(page)
        await page.waitForSelector("#upload-providerKey", {
          timeout: responseTimeoutMs,
        })
        await page.waitForSelector("text=Image upload failed.", {
          timeout: responseTimeoutMs,
        })
        await assertUploadRowStatus({
          page,
          rowId: "NestJS/2026-04-11-223034929700/index.md",
          expectedStatus: "complete",
        })
        await assertUploadRowStatus({
          page,
          rowId: "NestJS/2026-04-11-223034929701/index.md",
          expectedStatus: "failed",
        })
        await assertUploadRowStatus({
          page,
          rowId: "NestJS/2026-04-11-223034929702/index.md",
          expectedStatus: "failed",
        })

        await page.fill("#upload-providerField-repo", "owner/repo")
        await page.fill("#upload-providerField-token", "token-value")
        await page.click("#upload-submit")

        if (state.uploadRequestCount !== 1) {
          throw new Error(`expected one retry upload request, got ${state.uploadRequestCount}`)
        }
      },
    },
    {
      id: "completed-restores-result-step",
      step: "result",
      bootstrap: createBootstrap({
        lastOutputDir: completedOutputDir,
        resumedJob: completedJob,
      }),
      handleRequest: ({ pathname, method }) => {
        if (pathname === "/api/export/job-completed" && method === "GET") {
          return buildJsonResponse(completedJob)
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(completedJob),
        })
        await closeDialog(page)

        const statusText = await page.locator("#status-text").textContent()

        if (statusText?.trim() !== "completed") {
          throw new Error(`completed result step not restored: ${statusText ?? "null"}`)
        }

        if (state.resumeRequestCount !== 0 || state.uploadRequestCount !== 0) {
          throw new Error("completed restore should not trigger requests")
        }
      },
    },
    {
      id: "upload-completed-restores-result-step",
      step: "result",
      bootstrap: createBootstrap({
        lastOutputDir: uploadCompletedOutputDir,
        resumedJob: uploadCompletedJob,
      }),
      handleRequest: ({ pathname, method }) => {
        if (pathname === "/api/export/job-upload-completed" && method === "GET") {
          return buildJsonResponse(uploadCompletedJob)
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(uploadCompletedJob),
        })
        await closeDialog(page)
        await page.waitForSelector('[data-upload-row-status="complete"]', {
          timeout: responseTimeoutMs,
        })

        const statusText = await page.locator("#status-text").textContent()

        if (statusText?.trim() !== "upload-completed") {
          throw new Error(`upload-completed result step not restored: ${statusText ?? "null"}`)
        }

        if (state.resumeRequestCount !== 0 || state.uploadRequestCount !== 0) {
          throw new Error("upload-completed restore should not trigger requests")
        }
      },
    },
    {
      id: "failed-restores-result-step-with-error",
      step: "result",
      bootstrap: createBootstrap({
        lastOutputDir: failedOutputDir,
        resumedJob: failedJob,
      }),
      handleRequest: ({ pathname, method }) => {
        if (pathname === "/api/export/job-failed" && method === "GET") {
          return buildJsonResponse(failedJob)
        }

        return null
      },
      assert: async ({ page, state }) => {
        await waitForDialog({
          page,
          summary: buildResumeSummary(failedJob),
        })
        await closeDialog(page)
        await page.waitForSelector("text=Export failed.", {
          timeout: responseTimeoutMs,
        })

        const statusText = await page.locator("#status-text").textContent()

        if (statusText?.trim() !== "failed") {
          throw new Error(`failed result step not restored: ${statusText ?? "null"}`)
        }

        if (state.resumeRequestCount !== 0 || state.uploadRequestCount !== 0) {
          throw new Error("failed restore should not trigger requests")
        }
      },
    },
  ]

  try {
    await mapConcurrent({
      items: scenarios,
      concurrency: resumeScenarioConcurrency,
      mapper: async (scenario) => {
        try {
          await runScenario({
            browser,
            baseUrl,
            scenario,
          })
        } catch (error) {
          throw new Error(
            `resume smoke failed: ${scenario.id}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    })

    console.log(`resume smoke passed (${scenarios.length} scenarios, concurrency=${resumeScenarioConcurrency})`)
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
