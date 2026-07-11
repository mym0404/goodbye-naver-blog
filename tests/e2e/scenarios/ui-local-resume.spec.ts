import { rm } from "node:fs/promises"
import path from "node:path"

import { NaverBlog } from "@exitpress/blog-naver/parsing/naver-blog/NaverBlog.js"
import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "@exitpress/domain/export-options/ExportOptions.js"
import { createHttpServer } from "@exitpress/server/http/HttpServer.js"
import { test } from "@playwright/test"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobPollingConfig } from "@exitpress/domain/export-job/schema/ExportJobPollingConfig.js"
import type {
  ExportJobItem,
  ExportJobState,
} from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportResumeSummary } from "@exitpress/domain/export-job/schema/ExportManifest.js"
import type {
  UploadRewriteStatus,
  UploadStatus,
} from "@exitpress/domain/export-job/schema/UploadState.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { UploadProviderCatalogResponse } from "@exitpress/domain/upload/schema/UploadProvider.js"
import type { WizardStep } from "@exitpress/web/features/common/shell/WizardFlow.js"
import type { UploadRowStatus } from "@exitpress/web/features/job-results/JobResultsHelpers.js"
import type { Browser } from "playwright"

import { createTestTempDir } from "../../support/test-paths.js"

const desktopViewport = {
  width: 1440,
  height: 1200,
} as const

const responseTimeoutMs = 30_000
const localFast = process.env.EXITPRESS_LOCAL_FAST !== "0"
const resumeDialogSettledWaitMs = localFast ? 75 : 300
const localJobPolling: ExportJobPollingConfig | undefined = localFast
  ? {
      defaultPollMs: 100,
      fastPollMs: 50,
      uploadBurstPollMs: 25,
      uploadBurstAttempts: 8,
    }
  : undefined
const allResumeUploadStatuses = [
  "upload-ready",
  "uploading",
  "upload-failed",
  "upload-completed",
] as const satisfies readonly UploadStatus[]
type ResumeUploadStatus = (typeof allResumeUploadStatuses)[number]
const allResumeScenarioSteps = [
  "blog-input",
  "running",
  "upload",
  "result",
] as const satisfies readonly WizardStep[]
type ResumeScenarioStep = (typeof allResumeScenarioSteps)[number]
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
      description: "리포지토리에 이미지를 커밋해 URL로 씁니다.",
      fields: [
        {
          key: "repo",
          label: "Repository",
          description: "업로드할 GitHub 저장소 경로입니다.",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "owner/repo",
        },
        {
          key: "branch",
          label: "Branch",
          description: "업로드 대상 브랜치입니다.",
          inputType: "text",
          required: false,
          defaultValue: "main",
          placeholder: "",
        },
        {
          key: "path",
          label: "Path",
          description: "업로드할 저장소 내부 경로입니다.",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "images/posts",
        },
        {
          key: "token",
          label: "Token",
          description: "서비스 API 접근용 토큰입니다.",
          inputType: "password",
          required: true,
          defaultValue: null,
          placeholder: "ghp_xxx",
        },
      ],
    },
  ],
}

const blockTemplateDefinitions = new NaverBlog().getBlockTemplateDefinitions()

const resumedScanResult: ScanResult = {
  blogKey: "naver",
  sourceId: "mym0404",
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
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "223034929700",
      title: "NestJS 복구 테스트 1",
      publishedAt: "2026-04-11T04:00:00.000Z",
      categoryId: 101,
      categoryName: "NestJS",
      source: "https://blog.naver.com/mym0404/223034929700",
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

const buildUploadCandidates = (postId: string) => [
  {
    kind: "thumbnail" as const,
    sourceUrl: `https://example.com/${postId}/thumb.png`,
    localPath: `NestJS/2026-04-11-${postId}/thumb.png`,
    markdownReference: "thumb.png",
  },
  {
    kind: "image" as const,
    sourceUrl: `https://example.com/${postId}/image.png`,
    localPath: `NestJS/2026-04-11-${postId}/image.png`,
    markdownReference: "image.png",
  },
]

const buildUploadItem = ({
  postId,
  uploadedCount,
  rewriteStatus,
  updatedAt,
}: {
  postId: string
  uploadedCount: number
  rewriteStatus: UploadRewriteStatus
  updatedAt: string
}): ExportJobItem => {
  const candidates = buildUploadCandidates(postId)
  const uploadedUrls =
    rewriteStatus === "completed"
      ? candidates.map((candidate) => `https://cdn.example.com/${candidate.localPath}`)
      : []

  return {
    id: `NestJS/2026-04-11-${postId}/index.md`,
    blogKey: "naver",
    sourceId: "mym0404",
    postId,
    title: `NestJS 복구 테스트 ${postId.slice(-1)}`,
    source: `https://blog.naver.com/mym0404/${postId}`,
    category: {
      id: 101,
      name: "NestJS",
      path: ["NestJS"],
    },
    status: "success",
    outputPath: `NestJS/2026-04-11-${postId}/index.md`,
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
    error: null,
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
    blogKey: "naver",
    sourceInput: "mym0404",
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
        postId: "223034929700",
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
  status: ResumeUploadStatus
  resumeAvailable: boolean
  outputDir: string
  uploadedCounts: [number, number, number]
  rewriteStatuses: [UploadRewriteStatus, UploadRewriteStatus, UploadRewriteStatus]
  error: string | null
  finishedAt: string | null
}): ExportJobState => {
  const items = [
    buildUploadItem({
      postId: "223034929700",
      uploadedCount: uploadedCounts[0],
      rewriteStatus: rewriteStatuses[0],
      updatedAt: finishedAt ?? timestamps.updatedAt,
    }),
    buildUploadItem({
      postId: "223034929701",
      uploadedCount: uploadedCounts[1],
      rewriteStatus: rewriteStatuses[1],
      updatedAt: finishedAt ?? timestamps.updatedAt,
    }),
    buildUploadItem({
      postId: "223034929702",
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
      blogKey: "naver",
      sourceInput: "mym0404",
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
                ? "이미지 업로드에 실패했습니다."
                : "이미지 업로드와 결과 치환이 완료되었습니다.",
      },
    ],
    createdAt: timestamps.createdAt,
    startedAt: timestamps.startedAt,
    finishedAt,
    progress: {
      total: 3,
      completed: 3,
      failed: 0,
    },
    upload: {
      status,
      eligiblePostCount: 3,
      candidateCount: 6,
      uploadedCount,
      failedCount,
      terminalReason: null,
    },
    items,
    manifest: null,
    error,
  }
}

const buildCompletedJob = ({ outputDir }: { outputDir: string }): ExportJobState => ({
  id: "job-completed",
  request: {
    blogKey: "naver",
    sourceInput: "mym0404",
    outputDir,
    profile: "gfm",
    options: defaultExportOptions(),
  },
  status: "completed",
  resumeAvailable: false,
  logs: [
    {
      timestamp: timestamps.finishedAt,
      message: "내보내기가 끝났습니다.",
    },
  ],
  createdAt: timestamps.createdAt,
  startedAt: timestamps.startedAt,
  finishedAt: timestamps.finishedAt,
  progress: {
    total: 3,
    completed: 3,
    failed: 0,
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

const buildFailedJob = ({ outputDir }: { outputDir: string }): ExportJobState => ({
  id: "job-failed",
  request: {
    blogKey: "naver",
    sourceInput: "mym0404",
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
  step: ResumeScenarioStep
  bootstrap: {
    profile: "gfm"
    options: ReturnType<typeof defaultExportOptions>
    lastOutputDir: string
    themePreference: ThemePreference
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
  const dialog = page.getByRole("alertdialog")
  await dialog.waitFor({
    state: "visible",
    timeout: responseTimeoutMs,
  })
  const text = ((await dialog.textContent()) ?? "").replace(/\s+/g, " ").trim()

  if (
    !text.includes(`상태 ${summary.status}`) ||
    !text.includes(`출력 경로 ${summary.outputDir}`)
  ) {
    throw new Error(`unexpected resume dialog text: ${text}`)
  }
}

const closeDialog = async (page: import("playwright").Page) => {
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "불러오기" }).first().click()
  await dialog.waitFor({ state: "hidden", timeout: responseTimeoutMs })
}

const assertNoDialog = async (page: import("playwright").Page) => {
  await page.waitForTimeout(resumeDialogSettledWaitMs)
  if (await page.getByRole("alertdialog").count()) {
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
  expectedStatus: UploadRowStatus
}) => {
  const status = await page
    .locator(`[data-upload-row-id="${rowId}"]`)
    .getAttribute("data-upload-row-status")

  if (status !== expectedStatus) {
    throw new Error(`unexpected upload row status for ${rowId}: ${status}`)
  }
}

const assertHeaderStatus = async ({
  page,
  expectedStatus,
  message,
}: {
  page: import("playwright").Page
  expectedStatus: string
  message: string
}) => {
  const status = await page.locator("#status-text").getAttribute("data-status")

  if (status !== expectedStatus) {
    throw new Error(`${message}: ${status ?? "null"}`)
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
  blogs: [{ key: "naver", label: "Naver" }],
  options: defaultExportOptions(),
  lastOutputDir,
  themePreference: "dark" as const,
  jobPolling: localJobPolling,
  resumedJob,
  resumeSummary: resumedJob ? buildResumeSummary(resumedJob) : null,
  resumedScanResult: resumedJob ? resumedScanResult : null,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
  blockTemplateDefinitions,
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
  const state: {
    resumeRequestCount: number
    uploadRequestCount: number
  } = {
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
          error: `Unhandled local resume route: ${scenario.id} ${method} ${pathname}`,
        },
        404,
      ),
    )
  })

  try {
    await page.goto(baseUrl)
    await waitForStepView({
      page,
      step: scenario.step,
    })
    await scenario.assert({
      page,
      state,
    })
  } finally {
    await context.close()
  }
}

const createLocalResumeHarness = async () => {
  const tempRoot = await createTestTempDir("exitpress-local-resume-")
  const server = createHttpServer({
    settingsPath: path.join(tempRoot, "export-ui-settings.json"),
    scanCachePath: path.join(tempRoot, "scan-cache.json"),
    postHtmlCacheDir: path.join(tempRoot, "post-html"),
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a numeric port")
  }

  const baseUrl = `http://127.0.0.1:${address.port}`
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
  const runningActiveJob: ExportJobState = {
    ...buildExportRunningJob({
      outputDir: runningOutputDir,
      resumeAvailable: false,
    }),
    logs: [
      ...runningResumableJob.logs,
      {
        timestamp: timestamps.finishedAt,
        message: "남은 글 처리를 다시 시작했습니다.",
      },
    ],
    progress: {
      ...runningResumableJob.progress,
      completed: 3,
    },
  }
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
    error: "이미지 업로드에 실패했습니다.",
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
      id: "running-resume-manual-continue-refreshes-progress-without-reload",
      step: "running",
      bootstrap: createBootstrap({
        lastOutputDir: runningOutputDir,
        resumedJob: runningResumableJob,
      }),
      handleRequest: ({ pathname, method, state }) => {
        if (pathname === "/api/export/job-running" && method === "GET") {
          return buildJsonResponse(
            state.resumeRequestCount === 0 ? runningResumableJob : runningActiveJob,
          )
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
        await page.waitForFunction(
          () => {
            const statusPanelText =
              document.querySelector("#status-panel")?.textContent?.replace(/\s+/g, " ").trim() ??
              ""
            const logsText =
              document.querySelector("#logs")?.textContent?.replace(/\s+/g, " ").trim() ?? ""

            return (
              statusPanelText.includes("3 / 5") &&
              logsText.includes("남은 글 처리를 다시 시작했습니다.")
            )
          },
          undefined,
          { timeout: responseTimeoutMs },
        )

        if (Number(state.resumeRequestCount) !== 1) {
          throw new Error(`expected one manual resume request, got ${state.resumeRequestCount}`)
        }
      },
    },
    {
      id: "upload-ready-restores-upload-step-without-manual-start",
      step: "upload",
      bootstrap: createBootstrap({
        lastOutputDir: uploadReadyOutputDir,
        resumedJob: uploadReadyJob,
      }),
      handleRequest: ({ pathname, method }) => {
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
        await page.waitForSelector("#job-file-tree table", {
          timeout: responseTimeoutMs,
        })
        await assertUploadRowStatus({
          page,
          rowId: "NestJS/2026-04-11-223034929700/index.md",
          expectedStatus: "pending",
        })

        if ((await page.locator("#upload-providerKey").count()) !== 0) {
          throw new Error("upload-ready restore should not expose upload credentials")
        }

        if (Number(state.uploadRequestCount) !== 0) {
          throw new Error(`upload-ready restore sent upload requests: ${state.uploadRequestCount}`)
        }
      },
    },
    {
      id: "uploading-resume-restores-progress-without-manual-continue",
      step: "upload",
      bootstrap: createBootstrap({
        lastOutputDir: uploadingOutputDir,
        resumedJob: uploadingResumableJob,
      }),
      handleRequest: ({ pathname, method, state }) => {
        if (pathname === "/api/export/job-uploading" && method === "GET") {
          return buildJsonResponse(
            state.uploadRequestCount === 0 ? uploadingResumableJob : uploadingActiveJob,
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
        await page.waitForSelector("#job-file-tree table", {
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

        if ((await page.locator("#upload-providerKey").count()) !== 0) {
          throw new Error("uploading restore should not expose upload credentials")
        }

        if (Number(state.uploadRequestCount) !== 0) {
          throw new Error(`uploading restore sent upload requests: ${state.uploadRequestCount}`)
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
        await page.waitForSelector("#job-file-tree table", {
          timeout: responseTimeoutMs,
        })
        await page.waitForSelector("text=이미지 업로드에 실패했습니다.", {
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

        if ((await page.locator("#upload-providerKey").count()) !== 0) {
          throw new Error("upload-failed restore should not expose upload credentials")
        }

        if (Number(state.uploadRequestCount) !== 0) {
          throw new Error(`upload-failed restore sent upload requests: ${state.uploadRequestCount}`)
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

        await assertHeaderStatus({
          page,
          expectedStatus: "completed",
          message: "completed result step not restored",
        })

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

        await assertHeaderStatus({
          page,
          expectedStatus: "upload-completed",
          message: "upload-completed result step not restored",
        })

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

        await assertHeaderStatus({
          page,
          expectedStatus: "failed",
          message: "failed result step not restored",
        })

        if (state.resumeRequestCount !== 0 || state.uploadRequestCount !== 0) {
          throw new Error("failed restore should not trigger requests")
        }
      },
    },
  ]

  return {
    baseUrl,
    scenarios,
    server,
    tempRoot,
  }
}

const runUiLocalResumeScenario = async ({
  browser,
  scenarioId,
}: {
  browser: Browser
  scenarioId: string
}) => {
  const { baseUrl, scenarios, server, tempRoot } = await createLocalResumeHarness()
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId)

  if (!scenario) {
    throw new Error(`local resume scenario not found: ${scenarioId}`)
  }

  try {
    await runScenario({
      browser,
      baseUrl,
      scenario,
    })
  } catch (error) {
    throw new Error(
      `local resume failed: ${scenario.id}: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    server.close()
    await rm(tempRoot, {
      recursive: true,
      force: true,
    })
  }
}

test.describe("local", () => {
  test("starts from blog input when output has no resumable job", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "empty-output-starts-from-blog-input",
    })
  })

  test("continues a running resumable export only after manual action", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "running-resume-manual-continue-refreshes-progress-without-reload",
    })
  })

  test("restores upload-ready progress without starting upload", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "upload-ready-restores-upload-step-without-manual-start",
    })
  })

  test("restores uploading progress without continuing automatically", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "uploading-resume-restores-progress-without-manual-continue",
    })
  })

  test("restores upload failure rows without retrying upload", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "upload-failed-restores-upload-step-with-preserved-rows",
    })
  })

  test("restores completed export results", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "completed-restores-result-step",
    })
  })

  test("restores completed upload results", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "upload-completed-restores-result-step",
    })
  })

  test("restores failed export results with the error message", async ({ browser }) => {
    await runUiLocalResumeScenario({
      browser,
      scenarioId: "failed-restores-result-step-with-error",
    })
  })
})
