import { mkdir, rm } from "node:fs/promises"
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

import type { ExportJobPollingConfig } from "@exitpress/domain/export-job/schema/ExportJobPollingConfig.js"
import type { JobStatus } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type {
  UploadRewriteStatus,
  UploadStatus,
} from "@exitpress/domain/export-job/schema/UploadState.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type {
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "@exitpress/domain/upload/schema/UploadProvider.js"
import type { UploadRowStatus } from "@exitpress/web/features/job-results/JobResultsHelpers.js"
import type { Browser } from "playwright"

import { createTestPath, createTestTempDir } from "../../support/test-paths.js"

const responseTimeoutMs = 90_000
const blockTemplateDefinitions = new NaverBlog().getBlockTemplateDefinitions()
const localFast = process.env.EXITPRESS_LOCAL_FAST !== "0"
const localJobPolling: ExportJobPollingConfig | undefined = localFast
  ? {
      defaultPollMs: 100,
      fastPollMs: 50,
      uploadBurstPollMs: 25,
      uploadBurstAttempts: 8,
    }
  : undefined
const localStatusPollMs = localFast ? 100 : 1000
const localJobFetchLimits = localFast
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
const desktopViewport = {
  width: 1440,
  height: 1200,
} as const
const mobileViewport = {
  width: 375,
  height: 812,
} as const
const fallbackLocalOutputDir = createTestPath("ui-local-export-fixture", "output")

const getCaptureDir = () => {
  return process.env.EXITPRESS_CAPTURE_DIR ?? null
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
  expectedThemePreference: ThemePreference
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

const waitForBlockTemplateSettingsSave = ({
  page,
  baseUrl,
}: {
  page: import("playwright").Page
  baseUrl: string
}) =>
  page.waitForRequest(
    (request) => {
      if (request.url() !== `${baseUrl}/api/export-settings` || request.method() !== "POST") {
        return false
      }

      const body = request.postDataJSON() as {
        options?: ExportOptions
      }
      const templates = body.options?.blockOutputs.templates.gfm ?? {}

      return typeof templates["naver-se4:image"] === "string"
    },
    { timeout: responseTimeoutMs },
  )

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

const localImageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9Wn6kAAAAASUVORK5CYII=",
  "base64",
)

const scanResult = {
  blogKey: "naver",
  sourceId: "mym0404",
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
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "223034929697",
      title: "NestJS 업로드 플로우 점검",
      publishedAt: "2026-04-11T04:00:00.000Z",
      categoryId: 101,
      categoryName: "NestJS",
      source: "https://blog.naver.com/mym0404/223034929697",
      thumbnailUrl: "https://example.com/thumb.png",
    },
  ],
}

const createScanResult = (sourceId: string) => ({
  ...scanResult,
  sourceId,
  posts: scanResult.posts.map((post) => ({
    ...post,
    sourceId,
    source: `https://blog.naver.com/${sourceId}/${post.postId}`,
  })),
})

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
  rewriteStatus: UploadRewriteStatus
  rewrittenAt: string | null
}) => {
  const postId = `223034929${String(700 + index).padStart(3, "0")}`
  const title = `NestJS 업로드 플로우 점검 ${index + 1}`
  const outputPath = `NestJS/2026-04-11-${postId}/index.md`
  const candidates = buildUploadCandidates(index)
  const uploadedUrls =
    rewriteStatus === "completed"
      ? candidates.map((_, assetIndex) => buildRemoteAssetPath(index, assetIndex))
      : []
  const externalPreviewUrl =
    rewriteStatus === "completed" ? `https://markdownviewer.pages.dev/#share=local-${postId}` : null

  return {
    id: outputPath,
    blogKey: "naver",
    sourceId: "mym0404",
    postId,
    title,
    source: `https://blog.naver.com/mym0404/${postId}`,
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
    error: null,
    externalPreviewUrl,
    updatedAt,
  }
}

const createBaseJob = () => ({
  id: "job-local",
  request: {
    sourceInput: "mym0404",
    outputDir: fallbackLocalOutputDir,
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
  jobStatus: JobStatus
  uploadStatus: UploadStatus
  perItemUploadedCounts: number[]
  progress: {
    total: number
    completed: number
    failed: number
  }
  finishedAt: string | null
  error: string | null
  logs: Array<{
    timestamp: string
    message: string
  }>
  perItemRewriteStatuses?: UploadRewriteStatus[]
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
          ? buildUploadCandidates(index).map((_, assetIndex) =>
              buildRemoteAssetPath(index, assetIndex),
            )
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
      sourceId: "mym0404",
      profile: "gfm",
      options: createUploadFlowOptions(),
      selectedCategoryIds: [101],
      startedAt: uploadTimelineTimestamps.startedAt,
      finishedAt,
      outputDir: fallbackLocalOutputDir,
      totalPosts: uploadTargetCount,
      successCount: uploadTargetCount,
      failureCount: 0,
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

const createPartialUploadingJob = () =>
  buildUploadJob({
    jobStatus: "uploading",
    uploadStatus: "uploading",
    perItemUploadedCounts: uploadCounts.map((count) => count.partial),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
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

const createUploadCompletedJob = () =>
  buildUploadJob({
    jobStatus: "upload-completed",
    uploadStatus: "upload-completed",
    perItemUploadedCounts: uploadCounts.map((count) => count.completed),
    progress: {
      total: uploadTargetCount,
      completed: uploadTargetCount,
      failed: 0,
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
        message: "이미지 업로드와 결과 치환이 완료되었습니다.",
      },
    ],
  })

const applyCurrentOutputDir = <
  T extends {
    request: { outputDir: string }
    manifest: { outputDir: string }
  },
>(
  job: T,
  outputDir: string,
) => {
  job.request.outputDir = outputDir
  job.manifest.outputDir = outputDir
  return job
}

const applyCurrentExportOptions = <
  T extends {
    request: { options: ExportOptions }
    manifest: { options: ExportOptions }
  },
>(
  job: T,
  options: ExportOptions | null,
) => {
  if (!options) {
    return job
  }

  job.request.options = options
  job.manifest.options = options
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

const assertPrimerWorkflowShell = async (page: import("playwright").Page) => {
  const shell = page.locator("[data-workflow-shell]")
  const actions = page.locator("[data-step-actions]")
  const summary = page.locator("#summary")

  await shell.waitFor({ timeout: 5000 })
  await actions.waitFor({ timeout: 5000 })
  await summary.waitFor({ timeout: 5000 })

  const navigationCount = await page.locator("[data-workflow-nav]").count()

  if (navigationCount !== 0) {
    throw new Error("workflow steps should not render as a decorative sidebar navigation")
  }

  const progressCount = await page.locator("[data-workflow-progress]").count()

  if (progressCount !== 0) {
    throw new Error("workflow header should not render step progress")
  }

  const summaryText = await summary.textContent()

  if (
    !summaryText?.includes("대상 글") ||
    !summaryText.includes("카테고리") ||
    !summaryText.includes("선택")
  ) {
    throw new Error(`workflow summary should render metadata labels, got ${summaryText}`)
  }

  const summaryLabelCount = await summary.locator("[data-size][data-variant]").count()

  if (summaryLabelCount < 3) {
    throw new Error("workflow summary should use Primer labels for metadata")
  }

  const actionLayout = await actions.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const appSurface = document.querySelector("[data-app-surface]")
    const appSurfaceStyle = appSurface ? getComputedStyle(appSurface) : undefined
    const htmlStyle = getComputedStyle(document.documentElement)
    const bodyStyle = getComputedStyle(document.body)

    return {
      position: style.position,
      bottom: style.bottom,
      width: Math.round(rect.width),
      viewportWidth: window.innerWidth,
      appSurfaceBackground: appSurfaceStyle?.backgroundColor,
      htmlBackground: htmlStyle.backgroundColor,
      bodyBackground: bodyStyle.backgroundColor,
    }
  })

  if (actionLayout.position === "fixed" || actionLayout.position === "sticky") {
    throw new Error(`setup actions should be in content flow, got ${actionLayout.position}`)
  }

  if (actionLayout.bottom !== "auto") {
    throw new Error(`setup actions should not reserve viewport bottom, got ${actionLayout.bottom}`)
  }

  if (actionLayout.width >= actionLayout.viewportWidth - 16) {
    throw new Error("setup actions should not render as a floating full-width dock")
  }

  if (
    !actionLayout.appSurfaceBackground ||
    actionLayout.appSurfaceBackground === "rgba(0, 0, 0, 0)"
  ) {
    throw new Error("app surface should use the active Primer canvas background")
  }

  if (
    actionLayout.htmlBackground !== actionLayout.appSurfaceBackground ||
    actionLayout.bodyBackground !== actionLayout.appSurfaceBackground
  ) {
    throw new Error(
      `root backgrounds should match app surface, got html=${actionLayout.htmlBackground}, body=${actionLayout.bodyBackground}, app=${actionLayout.appSurfaceBackground}`,
    )
  }
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
    const status = await page.locator("#status-text").getAttribute("data-status")

    if (accept(status)) {
      return
    }

    if (status && failures.has(status)) {
      throw new Error(`${timeoutLabel} failed with status ${status}`)
    }

    await page.waitForTimeout(localStatusPollMs)
  }

  throw new Error(`${timeoutLabel} timed out`)
}

const selectTriggerValue = async ({
  page,
  selector,
}: {
  page: import("playwright").Page
  selector: string
}) =>
  await page.locator(selector).evaluate((element) => {
    const select = element instanceof HTMLSelectElement ? element : element.querySelector("select")

    if (select instanceof HTMLSelectElement) {
      return select.value
    }

    return element.getAttribute("data-value") ?? ""
  })

const chooseSelectOption = async ({
  page,
  trigger,
  value,
}: {
  page: import("playwright").Page
  trigger: string
  value: string
}) => {
  const target = page.locator(trigger).first()
  const tagName = await target.evaluate((element) => element.tagName.toLowerCase())

  if (tagName === "select") {
    await target.selectOption(value)
    return
  }

  const childSelect = target.locator("select")

  if ((await childSelect.count()) > 0) {
    await childSelect.selectOption(value)
    return
  }

  const isExpanded = (await target.getAttribute("aria-expanded")) === "true"

  if (!isExpanded) {
    await target.click()
  }

  await page.locator(`[data-slot="select-item"][data-value="${value}"]:visible`).click()
  await page.waitForFunction(
    ({ selector, expectedValue }) =>
      document.querySelector(selector)?.getAttribute("data-value") === expectedValue,
    { selector: trigger, expectedValue: value },
  )

  if ((await target.getAttribute("aria-expanded")) === "true") {
    await page.keyboard.press("Escape")
  }
}

const fillCodeMirror = async ({
  page,
  editor,
  value,
}: {
  page: import("playwright").Page
  editor: string
  value: string
}) => {
  await page.locator(`${editor} [contenteditable="true"]`).fill(value)
}

const assertTemplateEditorRuntime = async ({
  page,
  editor,
}: {
  page: import("playwright").Page
  editor: string
}) => {
  const state = await page.evaluate((editor) => {
    const root = document.querySelector(editor)
    const cmEditor = root?.querySelector(".cm-editor")
    const content = root?.querySelector(".cm-content")
    const scroller = root?.querySelector(".cm-scroller")
    const gutters = root?.querySelector(".cm-gutters")

    if (!cmEditor || !content || !scroller) {
      return null
    }

    const editorStyle = getComputedStyle(cmEditor)
    const contentStyle = getComputedStyle(content)
    const scrollerStyle = getComputedStyle(scroller)

    return {
      background: editorStyle.backgroundColor,
      contentMinHeight: contentStyle.minHeight,
      hasGutters: gutters !== null,
      scrollerMinHeight: scrollerStyle.minHeight,
      theme: document.documentElement.classList.contains("light") ? "light" : "dark",
      text: content.textContent,
    }
  }, editor)

  if (!state) {
    throw new Error("template code editor did not render")
  }

  const expectedBackground = state.theme === "light" ? "rgb(255, 255, 255)" : "rgb(13, 17, 23)"

  if (state.background !== expectedBackground) {
    throw new Error(
      `template code editor should use GitHub ${state.theme}, got ${state.background}`,
    )
  }

  if (state.contentMinHeight === "0px" || state.scrollerMinHeight === "0px") {
    throw new Error("template code editor min height did not apply")
  }

  if (state.hasGutters) {
    throw new Error("template code editor should not render line number gutters")
  }

  const clickTarget = await page.evaluate((editor) => {
    const content = document.querySelector(`${editor} .cm-content`)

    if (!content) {
      return null
    }

    const rect = content.getBoundingClientRect()

    return {
      x: rect.left + Math.min(rect.width / 2, 80),
      y: rect.top + Math.min(rect.height - 4, 48),
    }
  }, editor)

  if (!clickTarget) {
    throw new Error("template code editor content did not render")
  }

  const scrollBeforeClick = await page.evaluate(() => window.scrollY)
  await page.mouse.click(clickTarget.x, clickTarget.y)
  await page.waitForFunction(
    (editor) => {
      const content = document.querySelector(`${editor} .cm-content`)
      const cmEditor = document.querySelector(`${editor} .cm-editor`)

      return (
        document.activeElement === content ||
        cmEditor?.contains(document.activeElement) === true ||
        cmEditor?.classList.contains("cm-focused") === true
      )
    },
    editor,
    { timeout: 1000 },
  )
  await page.waitForTimeout(250)
  const clickState = await page.evaluate((editor) => {
    const content = document.querySelector(`${editor} .cm-content`)
    const cmEditor = document.querySelector(`${editor} .cm-editor`)

    return {
      activeIsEditor:
        document.activeElement === content ||
        cmEditor?.contains(document.activeElement) === true ||
        cmEditor?.classList.contains("cm-focused") === true,
      hasActiveLine: document.querySelector(`${editor} .cm-activeLine`) !== null,
      scrollY: window.scrollY,
    }
  }, editor)

  if (!clickState.activeIsEditor) {
    throw new Error("template code editor did not focus after click")
  }

  if (clickState.hasActiveLine) {
    throw new Error("template code editor should not highlight the active line")
  }

  if (Math.abs(clickState.scrollY - scrollBeforeClick) > 5) {
    throw new Error(
      `template code editor click changed page scroll: before=${scrollBeforeClick}, after=${clickState.scrollY}`,
    )
  }
}

const assertNoTemplateEcho = async ({
  page,
  editor,
  value,
}: {
  page: import("playwright").Page
  editor: string
  value: string
}) => {
  const currentTemplateLabelCount = await page.getByText("현재 템플릿", { exact: true }).count()

  if (currentTemplateLabelCount > 0) {
    throw new Error("template value should not be repeated with a current-template label")
  }

  const hasEchoedCode = await page.evaluate(
    ({ editor, value }) => {
      const root = document.querySelector(editor)
      const isVisible = (element: Element) => {
        const style = getComputedStyle(element)

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        )
      }

      return Array.from(document.querySelectorAll("code")).some(
        (element) =>
          !root?.contains(element) && isVisible(element) && element.textContent?.trim() === value,
      )
    },
    { editor, value },
  )

  if (hasEchoedCode) {
    throw new Error("template value should not be echoed in a code block outside the editor")
  }
}

const assertTemplateAutocompletePanel = async ({
  page,
  editor,
}: {
  page: import("playwright").Page
  editor: string
}) => {
  await page.locator(`${editor} [contenteditable="true"]`).click()
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A")
  await page.keyboard.type("{{ s")
  await page.waitForSelector(".cm-tooltip-autocomplete")

  const panel = await page.evaluate(() => {
    const tooltip = document.querySelector(".cm-tooltip-autocomplete")
    const selected = tooltip?.querySelector("li[aria-selected]")
    const icon = tooltip?.querySelector(".cm-completionIcon")

    if (!tooltip || !selected) {
      return null
    }

    const tooltipStyle = getComputedStyle(tooltip)
    const selectedStyle = getComputedStyle(selected)
    const iconStyle = icon ? getComputedStyle(icon) : undefined

    return {
      background: tooltipStyle.backgroundColor,
      borderRadius: tooltipStyle.borderRadius,
      iconDisplay: iconStyle?.display ?? "none",
      labelText: tooltip.querySelector(".cm-completionLabel")?.textContent,
      selectedBackground: selectedStyle.backgroundColor,
      theme: document.documentElement.classList.contains("light") ? "light" : "dark",
    }
  })

  if (!panel) {
    throw new Error("template autocomplete panel did not render")
  }

  const expectedPanelBackground = panel.theme === "light" ? "rgb(255, 255, 255)" : "rgb(22, 27, 34)"
  const expectedSelectedBackground =
    panel.theme === "light" ? "rgba(129, 139, 152, 0.1)" : "rgb(38, 48, 65)"

  if (panel.background !== expectedPanelBackground) {
    throw new Error(
      `template autocomplete background should match ${panel.theme}, got ${panel.background}`,
    )
  }

  if (panel.selectedBackground !== expectedSelectedBackground) {
    throw new Error(
      `template autocomplete selected row should match ${panel.theme}, got ${panel.selectedBackground}`,
    )
  }

  if (panel.borderRadius === "0px") {
    throw new Error("template autocomplete panel should have rounded corners")
  }

  if (panel.iconDisplay !== "none") {
    throw new Error("template autocomplete should hide rough default completion icons")
  }

  if (panel.labelText !== "slug") {
    throw new Error(`template autocomplete should suggest matching props, got ${panel.labelText}`)
  }

  await page.keyboard.press("Escape")
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

const waitForHtmlThemeClass = async ({
  page,
  theme,
}: {
  page: import("playwright").Page
  theme: ThemePreference
}) => {
  await page.waitForFunction(
    (expectedTheme) => document.documentElement.classList.contains(expectedTheme),
    theme,
    { timeout: responseTimeoutMs },
  )
}

const fillFrontmatterAlias = async ({
  page,
  fieldName,
  value,
}: {
  page: import("playwright").Page
  fieldName: string
  value: string
}) => {
  const input = page.locator(
    `[data-frontmatter-field="${fieldName}"] input[data-alias-input="true"]`,
  )

  await input.click()
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A")

  if (value) {
    await page.keyboard.type(value)
  } else {
    await page.keyboard.press("Backspace")
  }

  await input.evaluate((element, expectedValue) => {
    if (!(element instanceof HTMLInputElement) || element.value !== expectedValue) {
      throw new Error(`frontmatter alias input did not update to ${expectedValue}`)
    }
  }, value)
}

const runUiLocalExport = async ({ browser }: { browser: Browser }) => {
  const tempRoot = await createTestTempDir("exitpress-local-export-")
  const outputDir = path.join(tempRoot, "output")
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
  const mockState: {
    scanRequestCount: number
    jobFetchCount: number
    manualUploadRequestCount: number
    themePreference: ThemePreference
    exportOptions: ExportOptions | null
    testUploadPayload: null | {
      providerKey: string
      providerFields: Record<string, UploadProviderValue>
    }
    exportUploadProvider: null | {
      providerKey: string
      providerFields: Record<string, UploadProviderValue>
    }
    lastScanSourceInput: string | null
  } = {
    scanRequestCount: 0,
    jobFetchCount: 0,
    manualUploadRequestCount: 0,
    themePreference: "dark",
    exportOptions: null,
    testUploadPayload: null,
    exportUploadProvider: null,
    lastScanSourceInput: null,
  }

  const manualUploadRoutePattern = /\/api\/export\/[^/]+\/upload$/

  page.on("request", (request) => {
    const url = new URL(request.url())

    if (request.method() === "POST" && manualUploadRoutePattern.test(url.pathname)) {
      mockState.manualUploadRequestCount += 1
    }
  })

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (pathname === "/api/export-defaults") {
      await route.fulfill(
        buildJsonResponse({
          profile: "gfm",
          blogs: [{ key: "naver", label: "Naver" }],
          options: defaultExportOptions(),
          lastOutputDir: outputDir,
          themePreference: mockState.themePreference,
          jobPolling: localJobPolling,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
          blockTemplateDefinitions,
        }),
      )
      return
    }

    if (pathname === "/api/export-settings" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        themePreference?: ThemePreference
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

    if (pathname === "/api/upload-providers/test" && request.method() === "POST") {
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

      mockState.testUploadPayload = {
        providerKey: body.providerKey,
        providerFields: body.providerFields,
      }

      await route.fulfill(
        buildJsonResponse({
          uploadedUrl: "https://cdn.example.com/test-upload.png",
        }),
      )
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
      const body = request.postDataJSON() as {
        sourceInput?: string
      }
      mockState.lastScanSourceInput = body.sourceInput ?? null
      mockState.scanRequestCount += 1
      await route.fulfill(buildJsonResponse(createScanResult(body.sourceInput ?? "mym0404")))
      return
    }

    if (pathname === "/api/scan-blocks/jobs" && request.method() === "POST") {
      await route.fulfill(buildJsonResponse({ jobId: "block-scan-local" }, 202))
      return
    }

    if (pathname === "/api/scan-blocks/jobs/block-scan-local" && request.method() === "GET") {
      await route.fulfill(
        buildJsonResponse({
          id: "block-scan-local",
          status: "completed",
          total: 5,
          completed: 5,
          failed: 0,
          detectedBlockTemplateKeys: ["naver-se4:image"],
          error: null,
        }),
      )
      return
    }

    if (pathname === "/api/export" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        blogKey?: string
        sourceInput?: string
        options?: ExportOptions
        uploadProvider?: {
          providerKey?: string
          providerFields?: Record<string, UploadProviderValue>
        }
      }
      const templates = body.options?.blockOutputs.templates.gfm ?? {}

      if (
        body.blogKey !== "naver" ||
        body.sourceInput !== (mockState.lastScanSourceInput ?? "mym0404")
      ) {
        throw new Error("export payload did not include the selected blog identity")
      }

      if (typeof templates["naver-se4:image"] !== "string") {
        throw new Error("export payload did not include the saved naver-se4 image template")
      }

      if (Object.hasOwn(templates, "formula")) {
        throw new Error("export payload included old block-type-only output option key")
      }

      const uploadProvider = body.uploadProvider
      const providerFields = uploadProvider?.providerFields

      if (
        !uploadProvider ||
        !providerFields ||
        uploadProvider.providerKey !== "github" ||
        providerFields.repo !== "owner/name" ||
        providerFields.token !== "placeholder-token"
      ) {
        throw new Error("export request did not submit the structured upload provider payload")
      }

      mockState.jobFetchCount = 0
      mockState.exportOptions = body.options ?? null
      mockState.exportUploadProvider = {
        providerKey: uploadProvider.providerKey,
        providerFields,
      }
      await route.fulfill(
        buildJsonResponse(
          {
            jobId: "job-local",
          },
          202,
        ),
      )
      return
    }

    if (pathname === "/api/export/job-local" && request.method() === "GET") {
      mockState.jobFetchCount += 1

      const uploadingStartFetch = localJobFetchLimits.exportRunningMax
      const rewriteStartFetch = uploadingStartFetch + localJobFetchLimits.uploadPartialMax
      const completedStartFetch = rewriteStartFetch + localJobFetchLimits.rewritePendingMax
      const nextJob =
        mockState.jobFetchCount <= uploadingStartFetch
          ? createRunningJob()
          : mockState.jobFetchCount <= rewriteStartFetch
            ? createPartialUploadingJob()
            : mockState.jobFetchCount <= completedStartFetch
              ? createRewritePendingJob()
              : createUploadCompletedJob()

      await route.fulfill(
        buildJsonResponse(
          applyCurrentExportOptions(
            applyCurrentOutputDir(nextJob, outputDir),
            mockState.exportOptions,
          ),
        ),
      )
      return
    }

    if (pathname === "/api/export/job-local/manifest" && request.method() === "GET") {
      const manifest = applyCurrentExportOptions(
        applyCurrentOutputDir(createUploadCompletedJob(), outputDir),
        mockState.exportOptions,
      ).manifest

      await route.fulfill(buildJsonResponse(manifest))
      return
    }

    await route.fulfill(
      buildJsonResponse(
        {
          error: `Unhandled local route: ${pathname}`,
        },
        404,
      ),
    )
  })

  await page.route("https://cdn.example.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: localImageBytes,
    })
  })

  try {
    await page.goto(baseUrl)
    await waitForStepView({
      page,
      step: "blog-input",
    })
    await assertPrimerWorkflowShell(page)
    const lightThemeButton = page.getByRole("button", { name: "라이트" })

    await waitForHtmlThemeClass({ page, theme: "dark" })

    const themePersistPromise = waitForExportSettingsSave({
      page,
      baseUrl,
      expectedThemePreference: "light",
    })

    await lightThemeButton.click()
    await themePersistPromise
    await waitForHtmlThemeClass({ page, theme: "light" })

    if (mockState.themePreference !== "light") {
      throw new Error(
        `expected theme toggle to persist light mode, got state=${mockState.themePreference}`,
      )
    }

    await page.fill("#sourceInput", "mym0404")

    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` && response.request().method() === "POST",
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
      throw new Error(
        `expected first scan request count to be 1, got ${mockState.scanRequestCount}`,
      )
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

    if (forceScanTooltip !== "캐시 비우기") {
      throw new Error(
        `expected force scan tooltip to be cache clearing, got ${forceScanTooltip ?? "null"}`,
      )
    }

    const forcedScanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` && response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#force-scan-button")
    await forcedScanResponsePromise
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (Number(mockState.scanRequestCount) !== 2) {
      throw new Error(
        `expected forced scan request count to be 2, got ${mockState.scanRequestCount}`,
      )
    }

    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "blog-input",
    })
    await page.fill("#sourceInput", "another-blog")

    const secondScanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` && response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#scan-button")
    await secondScanResponsePromise
    await waitForStepView({
      page,
      step: "category-selection",
    })

    if (Number(mockState.scanRequestCount) !== 3) {
      throw new Error(
        `expected changed blog input to trigger a third scan, got ${mockState.scanRequestCount}`,
      )
    }

    await chooseSelectOption({
      page,
      trigger: "#scope-categoryMode",
      value: "exact-selected",
    })
    await page.fill("#scope-dateFrom", "2026-01-01")
    await page.fill("#scope-dateTo", "2026-12-31")
    await page.fill("#category-search", "NestJS")
    await page.click('[data-category-bulk-selection="true"]')
    await page.waitForSelector(".category-item")
    await page.getByRole("checkbox", { name: "NestJS" }).click()
    await page.click('button:has-text("구조 설정")')
    await waitForStepView({
      page,
      step: "structure-options",
    })

    await page.click("#structure-groupByCategory")
    await fillCodeMirror({
      page,
      editor: "#structure-postFolderNameTemplate",
      value: "{{ date }}-{{ slug }}",
    })
    await assertTemplateEditorRuntime({
      page,
      editor: "#structure-postFolderNameTemplate",
    })
    await assertTemplateAutocompletePanel({
      page,
      editor: "#structure-postFolderNameTemplate",
    })
    await page.getByRole("button", { name: "템플릿 문법 도움말" }).click()

    const templateSyntaxDialog = page.getByRole("dialog", { name: "템플릿 문법" })
    const templateSyntaxHelpText = await templateSyntaxDialog.textContent()

    if (!templateSyntaxHelpText?.includes("사용할 수 있는 prop을 자동완성합니다.")) {
      throw new Error("template syntax dialog should explain that prop autocomplete is available")
    }

    if (
      templateSyntaxHelpText.includes("slug: string") ||
      templateSyntaxHelpText.includes("date: string")
    ) {
      throw new Error("template syntax dialog should not list every autocomplete prop")
    }

    await page.keyboard.press("Escape")
    await fillCodeMirror({
      page,
      editor: "#structure-postFolderNameTemplate",
      value: "{{ date }}-{{ slug }}",
    })
    await assertNoTemplateEcho({
      page,
      editor: "#structure-postFolderNameTemplate",
      value: "{{ date }}-{{ slug }}",
    })

    const folderNamePreview = page.locator("#structure-postFolderNameTemplatePreview")

    if (!(await folderNamePreview.textContent())?.includes("2026-04-11-")) {
      throw new Error("custom folder template preview did not update")
    }

    await fillCodeMirror({
      page,
      editor: "#structure-postFolderNameTemplate",
      value: "{{",
    })

    if (!(await page.locator("#structure-file-tree-preview").isVisible())) {
      throw new Error("custom folder template preview crashed on incomplete expression")
    }

    if (
      !(await folderNamePreview.textContent())?.includes(
        "템플릿 오류: unterminated template expression",
      )
    ) {
      throw new Error("custom folder template preview did not show syntax error")
    }

    await fillCodeMirror({
      page,
      editor: "#structure-postFolderNameTemplate",
      value: "{{ date }}-{{ slug }}",
    })

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

    const frontmatterAliasLayout = await page
      .locator('[data-frontmatter-field="title"]')
      .evaluate((element) => {
        const aliasRow = element.querySelector('[data-frontmatter-alias-row="true"]')
        const label = aliasRow?.querySelector("label")
        const input = aliasRow?.querySelector('input[data-alias-input="true"]')
        const example = element.querySelector('[data-frontmatter-example="true"]')

        if (!aliasRow || !label || !(input instanceof HTMLInputElement) || !example) {
          throw new Error("frontmatter alias layout is missing expected elements")
        }

        const labelRect = label.getBoundingClientRect()
        const inputRect = input.getBoundingClientRect()
        const exampleStyle = getComputedStyle(example)

        return {
          labelText: label.textContent?.trim(),
          exampleText: example.textContent?.trim(),
          exampleFontSize: exampleStyle.fontSize,
          inputIsBelowLabel: inputRect.top >= labelRect.bottom,
          sameColumn: Math.abs(inputRect.left - labelRect.left) < 8,
        }
      })

    if (frontmatterAliasLayout.labelText !== "내보낼 이름") {
      throw new Error(
        `frontmatter alias label should be 내보낼 이름, got ${frontmatterAliasLayout.labelText}`,
      )
    }

    if (!frontmatterAliasLayout.inputIsBelowLabel || !frontmatterAliasLayout.sameColumn) {
      throw new Error("frontmatter alias input should render below its label in one column")
    }

    if (
      frontmatterAliasLayout.exampleFontSize !== "12px" ||
      !frontmatterAliasLayout.exampleText?.startsWith("예: title:")
    ) {
      throw new Error(
        `frontmatter field example should render compact key output, got ${frontmatterAliasLayout.exampleText} at ${frontmatterAliasLayout.exampleFontSize}`,
      )
    }

    await fillFrontmatterAlias({ page, fieldName: "title", value: "shared" })
    await fillFrontmatterAlias({ page, fieldName: "source", value: "shared" })

    const frontmatterStatusText = await page.locator("#frontmatter-status").textContent()

    if (!frontmatterStatusText?.includes('title와 source가 같은 alias "shared"')) {
      throw new Error("frontmatter alias collision was not shown")
    }

    const darkThemePersistPromise = waitForExportSettingsSave({
      page,
      baseUrl,
      expectedThemePreference: "dark",
    })

    await page.getByRole("button", { name: "다크" }).click()
    await darkThemePersistPromise

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

    await page.click('button:has-text("자산 설정")')
    await waitForStepView({
      page,
      step: "assets-options",
    })

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should stay hidden inside the Assets tab")
    }

    await page.click('button:has-text("다음")')
    await waitForStepView({
      page,
      step: "upload-provider-options",
    })

    await page.waitForSelector("#upload-providerKey")
    await page.waitForSelector("#upload-providerField-repo")
    await page.waitForSelector("#upload-providerField-token")

    const providerValue = await selectTriggerValue({
      page,
      selector: "#upload-providerKey",
    })

    if (providerValue !== "github") {
      throw new Error("upload provider default did not stay on github")
    }

    const uploadProviderFormChrome = await page
      .locator("#upload-provider-form form")
      .evaluate((form) => {
        const style = getComputedStyle(form)

        return {
          borderBottomWidth: style.borderBottomWidth,
          borderTopWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
        }
      })

    if (
      uploadProviderFormChrome.borderBottomWidth !== "0px" ||
      uploadProviderFormChrome.borderTopWidth !== "0px" ||
      uploadProviderFormChrome.borderRadius !== "0px"
    ) {
      throw new Error("upload provider form should not use an outer card border")
    }

    const uploadCdnCheckboxGroup = await page
      .getByRole("group", { name: "jsDelivr CDN 사용" })
      .evaluate((group) => {
        const style = getComputedStyle(group)

        return {
          ariaLabelledby: group.getAttribute("aria-labelledby"),
          backgroundColor: style.backgroundColor,
          borderBottomWidth: style.borderBottomWidth,
          borderTopWidth: style.borderTopWidth,
          role: group.getAttribute("role"),
        }
      })

    if (
      uploadCdnCheckboxGroup.role !== "group" ||
      uploadCdnCheckboxGroup.ariaLabelledby !== "upload-github-use-jsdelivr-label"
    ) {
      throw new Error("GitHub CDN option should use Primer CheckboxGroup semantics")
    }

    if (
      uploadCdnCheckboxGroup.borderBottomWidth !== "0px" ||
      uploadCdnCheckboxGroup.borderTopWidth !== "0px" ||
      uploadCdnCheckboxGroup.backgroundColor !== "rgba(0, 0, 0, 0)"
    ) {
      throw new Error("GitHub CDN option should not render as a custom checkbox row")
    }

    const repositoryFieldLayout = await page
      .locator("#upload-providerField-repo")
      .evaluate((input) => {
        let field = input.parentElement

        while (field && !field.textContent?.includes("업로드할 GitHub 저장소 경로입니다.")) {
          field = field.parentElement
        }

        const label = field?.querySelector("label")
        const caption = Array.from(field?.querySelectorAll("*") ?? []).find(
          (element) => element.textContent?.trim() === "업로드할 GitHub 저장소 경로입니다.",
        )

        if (!label || !input || !caption) {
          return null
        }

        const labelRect = label.getBoundingClientRect()
        const inputRect = input.getBoundingClientRect()
        const captionRect = caption.getBoundingClientRect()

        return {
          captionTop: captionRect.top,
          inputBottom: inputRect.bottom,
          inputTop: inputRect.top,
          labelBottom: labelRect.bottom,
        }
      })

    if (!repositoryFieldLayout) {
      throw new Error("repository field did not expose label, input, and caption")
    }

    if (repositoryFieldLayout.inputTop - repositoryFieldLayout.labelBottom > 10) {
      throw new Error("repository field label and input are spaced too far apart")
    }

    if (repositoryFieldLayout.captionTop < repositoryFieldLayout.inputBottom) {
      throw new Error("repository field caption should render below the input")
    }

    await page.fill("#upload-providerField-repo", "owner/name")
    await page.fill("#upload-providerField-token", "placeholder-token")

    const testUploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/upload-providers/test` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.getByRole("button", { name: "테스트 업로드" }).click()
    const testUploadResponse = await testUploadResponsePromise

    if (testUploadResponse.status() !== 200) {
      throw new Error(`test upload request failed: ${testUploadResponse.status()}`)
    }

    if (
      mockState.testUploadPayload?.providerKey !== "github" ||
      mockState.testUploadPayload.providerFields.repo !== "owner/name" ||
      mockState.testUploadPayload.providerFields.token !== "placeholder-token"
    ) {
      throw new Error("test upload request did not submit the provider payload")
    }

    await page.waitForSelector("text=https://cdn.example.com/test-upload.png")

    await page.click('button:has-text("링크 처리")')
    await waitForStepView({
      page,
      step: "links-options",
    })

    if (await page.locator("#export-button").count()) {
      throw new Error("export button should stay hidden inside the 링크 처리 step")
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
      step: "upload-provider-options",
    })
    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "assets-options",
    })
    await page.click('button:has-text("이전")')
    await waitForStepView({
      page,
      step: "frontmatter-options",
    })
    await fillFrontmatterAlias({ page, fieldName: "source", value: "" })
    await fillFrontmatterAlias({ page, fieldName: "title", value: "postTitle" })
    await page.click('button:has-text("자산 설정")')
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
      const getSelectValue = (selector: string) => {
        const element = document.querySelector(selector)
        const select =
          element instanceof HTMLSelectElement ? element : element?.querySelector("select")

        return select?.value ?? element?.getAttribute("data-value")
      }
      const getInput = (selector: string) => {
        const element = document.querySelector(selector)

        return element instanceof HTMLInputElement ? element : element?.querySelector("input")
      }
      const compression = getInput("#assets-compressionEnabled")
      const downloadImages = getInput("#assets-downloadImages")
      const downloadThumbnails = getInput("#assets-downloadThumbnails")

      return (
        getSelectValue("#assets-imageHandlingMode") === "remote" &&
        compression?.matches(":disabled") === true &&
        downloadImages?.matches(":disabled") === true &&
        downloadThumbnails?.matches(":disabled") === true
      )
    })

    const remoteModeState = await page.evaluate(() => {
      const getSelectValue = (selector: string) => {
        const element = document.querySelector(selector)
        const select =
          element instanceof HTMLSelectElement ? element : element?.querySelector("select")

        return select?.value ?? element?.getAttribute("data-value") ?? null
      }
      const getInput = (selector: string) => {
        const element = document.querySelector(selector)

        return element instanceof HTMLInputElement ? element : element?.querySelector("input")
      }
      const compression = getInput("#assets-compressionEnabled")
      const downloadImages = getInput("#assets-downloadImages")
      const downloadThumbnails = getInput("#assets-downloadThumbnails")

      return {
        imageHandlingMode: getSelectValue("#assets-imageHandlingMode"),
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
      const getSelectValue = (selector: string) => {
        const element = document.querySelector(selector)
        const select =
          element instanceof HTMLSelectElement ? element : element?.querySelector("select")

        return select?.value ?? element?.getAttribute("data-value")
      }
      const getInput = (selector: string) => {
        const element = document.querySelector(selector)

        return element instanceof HTMLInputElement ? element : element?.querySelector("input")
      }
      const downloadImages = getInput("#assets-downloadImages")
      const downloadThumbnails = getInput("#assets-downloadThumbnails")

      return (
        getSelectValue("#assets-imageHandlingMode") === "download-and-upload" &&
        downloadImages?.matches(":checked") === true &&
        downloadThumbnails?.matches(":checked") === true
      )
    })

    const uploadModeState = await page.evaluate(() => {
      const getSelectValue = (selector: string) => {
        const element = document.querySelector(selector)
        const select =
          element instanceof HTMLSelectElement ? element : element?.querySelector("select")

        return select?.value ?? element?.getAttribute("data-value") ?? null
      }
      const getInput = (selector: string) => {
        const element = document.querySelector(selector)

        return element instanceof HTMLInputElement ? element : element?.querySelector("input")
      }
      const downloadImages = getInput("#assets-downloadImages")
      const downloadThumbnails = getInput("#assets-downloadThumbnails")

      return {
        imageHandlingMode: getSelectValue("#assets-imageHandlingMode"),
        downloadImagesChecked: downloadImages?.matches(":checked") === true,
        downloadThumbnailsChecked: downloadThumbnails?.matches(":checked") === true,
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

    await page.click('button:has-text("다음")')
    await waitForStepView({
      page,
      step: "upload-provider-options",
    })

    await page.fill("#upload-providerField-repo", "owner/name")
    await page.fill("#upload-providerField-token", "placeholder-token")

    const finalTestUploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/upload-providers/test` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.getByRole("button", { name: "테스트 업로드" }).click()
    const finalTestUploadResponse = await finalTestUploadResponsePromise

    if (finalTestUploadResponse.status() !== 200) {
      throw new Error(`final test upload request failed: ${finalTestUploadResponse.status()}`)
    }

    await page.click('button:has-text("링크 처리")')
    await waitForStepView({
      page,
      step: "links-options",
    })

    await page.waitForSelector("#links-sameBlogPostMode-custom-url")
    await page.click("#links-sameBlogPostMode-custom-url")
    await fillCodeMirror({
      page,
      editor: "#links-sameBlogPostCustomUrlTemplate",
      value: "{{",
    })

    if (!(await page.locator("#links-sameBlogPostCustomUrlPreview").isVisible())) {
      throw new Error("custom link template preview crashed on incomplete expression")
    }

    if (
      !(await page.locator("#links-sameBlogPostCustomUrlPreview").textContent())?.includes(
        "템플릿 오류: unterminated template expression",
      )
    ) {
      throw new Error("custom link template preview did not show syntax error")
    }

    await fillCodeMirror({
      page,
      editor: "#links-sameBlogPostCustomUrlTemplate",
      value: "https://myblog/{{ slug }}",
    })
    await assertNoTemplateEcho({
      page,
      editor: "#links-sameBlogPostCustomUrlTemplate",
      value: "https://myblog/{{ slug }}",
    })

    const livePreview = page.locator("#links-sameBlogPostCustomUrlPreview")

    if (!(await livePreview.textContent())?.includes("https://myblog/")) {
      throw new Error("custom link template preview did not update")
    }

    await page.click('button:has-text("진단 설정")')
    await waitForStepView({
      page,
      step: "diagnostics-options",
    })

    await page.click("#export-button")
    await waitForStepView({
      page,
      step: "block-scan",
    })
    await waitForStepView({
      page,
      step: "markdown-review",
    })

    if (await page.locator("#markdown-linkCardStyle").count()) {
      throw new Error("removed markdown link card controls reappeared")
    }

    if (!(await page.locator('[data-block-template-card="naver-se4:image"]').count())) {
      throw new Error("detected block output cards should appear in the markdown review step")
    }

    if (await page.locator('[data-block-template-card="naver-se4:table"]').count()) {
      throw new Error(
        "undetected block output cards should stay hidden in the markdown review step",
      )
    }

    await page
      .locator('[data-template-code-section] button[aria-label="템플릿 문법 도움말"]')
      .first()
      .click()
    const templateHelpDialog = page.locator('[role="dialog"]')
    const templateHelpText = await templateHelpDialog.textContent()

    if (!templateHelpText?.includes("{{ title }}")) {
      throw new Error("template syntax help dialog did not open")
    }

    await templateHelpDialog.getByRole("button", { name: /Close|닫기/ }).click()
    await templateHelpDialog.waitFor({ state: "hidden", timeout: responseTimeoutMs })

    const intermediateBlockTemplateSettingsSavePromise = waitForBlockTemplateSettingsSave({
      page,
      baseUrl,
    })
    await fillCodeMirror({
      page,
      editor: "#block-template-editor-naver-se4-image",
      value: "{{ alt }}",
    })
    await intermediateBlockTemplateSettingsSavePromise

    const blockTemplateSettingsSavePromise = waitForBlockTemplateSettingsSave({
      page,
      baseUrl,
    })
    await fillCodeMirror({
      page,
      editor: "#block-template-editor-naver-se4-image",
      value: "{{ `![${alt}](${url})` }}",
    })
    await blockTemplateSettingsSavePromise

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export` && response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )
    await page.click('button:has-text("변환 시작")')

    await exportResponsePromise

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

    const runningStatusPanelText =
      (await page.locator("#status-panel").textContent())?.replace(/\s+/g, " ").trim() ?? ""

    if (!runningStatusPanelText.includes("7 / 18")) {
      throw new Error("running progress text did not reflect completed/total posts")
    }

    await waitForStepView({
      page,
      step: "upload",
    })
    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "uploading",
      timeoutLabel: "UI automatic uploading state",
    })

    const setupPanelsHidden = await page.evaluate(() => {
      return !document.querySelector("#category-panel") && !document.querySelector("#export-panel")
    })

    if (!setupPanelsHidden) {
      throw new Error("post-submit flow reopened setup panels")
    }

    await page.waitForSelector("#job-file-tree table")

    const uploadTargetRow = await page.locator("#job-file-tree tbody tr").first().textContent()

    if (!uploadTargetRow?.includes("NestJS 업로드 플로우 점검")) {
      throw new Error("upload target table did not render the expected post")
    }

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

    const partialUploadStatusPanelText =
      (await page.locator("#status-panel").textContent())?.replace(/\s+/g, " ").trim() ?? ""

    if (!partialUploadStatusPanelText.includes("4 / 54")) {
      throw new Error("partial uploading state did not expose intermediate progress text")
    }

    await page.setViewportSize(mobileViewport)
    await page.waitForTimeout(150)
    await page.setViewportSize(desktopViewport)
    await page.waitForTimeout(150)

    await page.waitForFunction(
      () => document.querySelector("#status-text")?.getAttribute("data-status") === "uploading",
      undefined,
      { timeout: 10_000 },
    )
    await page.waitForFunction(
      () => {
        const statusPanelText =
          document.querySelector("#status-panel")?.textContent?.replace(/\s+/g, " ").trim() ?? ""

        return statusPanelText.includes("54 / 54")
      },
      undefined,
      { timeout: 10_000 },
    )

    const rewritePendingStatusPanelText =
      (await page.locator("#status-panel").textContent())?.replace(/\s+/g, " ").trim() ?? ""

    if (!rewritePendingStatusPanelText.includes("54 / 54")) {
      throw new Error("rewrite-pending state did not keep full upload progress text")
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

    const manifest = (await page.evaluate(async () => {
      const response = await fetch("/api/export/job-local/manifest")

      if (!response.ok) {
        throw new Error(`manifest request failed: ${response.status}`)
      }

      return response.json()
    })) as {
      totalPosts: number
      successCount: number
      failureCount: number
      upload: {
        status: string
        uploadedCount: number
      }
      options: ExportOptions
      posts: Array<{
        outputPath: string | null
        assetPaths: string[]
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

    const firstCompletedPost = manifest.posts.find((post) => post.outputPath)

    if (!firstCompletedPost?.assetPaths.some((assetPath) => assetPath.startsWith("https://"))) {
      throw new Error("manifest did not expose uploaded URLs after automatic upload")
    }

    await page.waitForSelector('#job-file-tree a[href^="https://cdn.example.com/"]', {
      timeout: 10_000,
    })
    const visibleUploadedLinks = await page
      .locator('#job-file-tree a[href^="https://cdn.example.com/"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))

    if (visibleUploadedLinks.length === 0) {
      throw new Error("result file tree did not expose uploaded asset URLs")
    }

    if (typeof manifest.options.blockOutputs.templates.gfm?.["naver-se4:image"] !== "string") {
      throw new Error("manifest did not preserve the naver-se4 image template")
    }

    if (Object.hasOwn(manifest.options.blockOutputs.templates.gfm ?? {}, "formula")) {
      throw new Error("manifest included block-type-only template key")
    }

    const finalStatusText = await page.locator("#status-panel").textContent()

    if (finalStatusText?.includes("owner/name")) {
      throw new Error("upload placeholder config leaked into the visible UI")
    }

    if (await page.locator("#upload-providerKey").count()) {
      throw new Error("result step should not expose upload credentials")
    }

    if (mockState.manualUploadRequestCount !== 0) {
      throw new Error("normal upload flow sent a manual upload POST")
    }

    await page.waitForSelector("#job-file-tree [data-job-item-id]")
    await page.click('[data-job-filter="failed"]')
    await page.waitForTimeout(200)

    await page.click('[data-job-filter="all"]')

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
  } finally {
    await context.close()
    server.close()
    await rm(tempRoot, {
      recursive: true,
      force: true,
    })
  }
}

test.describe("local", () => {
  test("export wizard flow", async ({ browser }) => {
    await runUiLocalExport({ browser })
  })
})
