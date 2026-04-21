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
import type { UploadProviderCatalogResponse, UploadProviderValue } from "../../src/shared/types.js"

const responseTimeoutMs = 90_000
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

const contrastTargets = [
  { selector: ".wizard-step-label", minRatio: 4.5 },
  { selector: ".wizard-heading .panel-description", minRatio: 4.5 },
  { selector: ".wizard-summary-metric span", minRatio: 4.5 },
  { selector: "#status-text", minRatio: 4.5 },
  { selector: "#category-status", minRatio: 4.5 },
  { selector: ".panel-description", minRatio: 4.5 },
  { selector: ".field-help", minRatio: 4.5 },
  { selector: ".frontmatter-description", minRatio: 4.5 },
  { selector: ".results-description", minRatio: 4.5 },
  { selector: ".job-results-row span", minRatio: 4.5 },
  { selector: ".scan-status-note", minRatio: 4.5 },
  { selector: "#export-button span", minRatio: 4.5 },
] as const

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
    outputDir: "/tmp/farewell-naver-blog-smoke",
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
      outputDir: "/tmp/farewell-naver-blog-smoke",
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

    await page.waitForTimeout(1000)
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

const assertUploadTargetsBounded = async ({
  page,
  label,
  expectHorizontalScroll = false,
}: {
  page: import("playwright").Page
  label: string
  expectHorizontalScroll?: boolean
}) => {
  const bounded = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#job-file-tree")
    const viewport = root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    const table = root?.querySelector<HTMLElement>("table")
    const section = document.querySelector<HTMLElement>(".job-results-panel")

    if (!root || !viewport || !table || !section) {
      return null
    }

    const rootStyles = window.getComputedStyle(root)
    const rootRect = root.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()

    return {
      hasMaxHeight:
        rootStyles.maxHeight !== "none" &&
        rootStyles.maxHeight !== "0px" &&
        Number.parseFloat(rootStyles.maxHeight) > 0,
      viewportHasInternalOverflow: viewport.scrollHeight > viewport.clientHeight,
      viewportHasHorizontalOverflow: table.scrollWidth > viewport.clientWidth + 1,
      rootFitsPanel: rootRect.width <= sectionRect.width + 1,
      tableFitsPanel: tableRect.width <= sectionRect.width + 1,
    }
  })

  if (!bounded?.hasMaxHeight) {
    throw new Error(`${label} missing upload table max-height`)
  }

  if (!bounded.viewportHasInternalOverflow) {
    throw new Error(`${label} missing internal upload table overflow`)
  }

  if (!bounded.rootFitsPanel) {
    throw new Error(`${label} upload table container overflowed its panel`)
  }

  if (!expectHorizontalScroll && !bounded.tableFitsPanel) {
    throw new Error(`${label} upload table overflowed its panel`)
  }

  if (expectHorizontalScroll && !bounded.viewportHasHorizontalOverflow) {
    throw new Error(`${label} should keep horizontal room for the upload table`)
  }
}

const assertTextContrast = async ({
  page,
}: {
  page: import("playwright").Page
}) => {
  const evaluationScript = `
    (() => {
      const targets = ${JSON.stringify(contrastTargets)};
      const colorProbe = document.createElement("canvas").getContext("2d");

      function normalizeColor(value) {
        if (!colorProbe) {
          return value;
        }

        colorProbe.fillStyle = "#ffffff";

        try {
          colorProbe.fillStyle = value;
          return colorProbe.fillStyle;
        } catch {
          return value;
        }
      }

      function parseOklch(value) {
        const match = value.match(/^oklch\\(([^)]+)\\)$/i)

        if (!match) {
          return null
        }

        const [colorPart, alphaPart] = match[1].split("/").map((part) => part.trim())
        const parts = colorPart.split(/\\s+/)

        if (parts.length < 3) {
          return null
        }

        const parseChannel = (channel) =>
          channel.endsWith("%") ? Number(channel.slice(0, -1)) / 100 : Number(channel)

        const lightness = parseChannel(parts[0])
        const chroma = Number(parts[1])
        const hue = Number(parts[2]) * Math.PI / 180
        const alpha = alphaPart ? parseChannel(alphaPart) : 1

        const a = chroma * Math.cos(hue)
        const b = chroma * Math.sin(hue)

        const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
        const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
        const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b

        const l = lRoot ** 3
        const m = mRoot ** 3
        const s = sRoot ** 3

        const toSrgb = (channel) => {
          const clipped = Math.min(1, Math.max(0, channel))
          const gammaCorrected =
            clipped <= 0.0031308
              ? 12.92 * clipped
              : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055

          return Math.round(gammaCorrected * 255)
        }

        return [
          toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
          alpha,
        ]
      }

      function parseOklab(value) {
        const match = value.match(/^oklab\\(([^)]+)\\)$/i)

        if (!match) {
          return null
        }

        const [colorPart, alphaPart] = match[1].split("/").map((part) => part.trim())
        const parts = colorPart.split(/\\s+/)

        if (parts.length < 3) {
          return null
        }

        const parseChannel = (channel) =>
          channel.endsWith("%") ? Number(channel.slice(0, -1)) / 100 : Number(channel)

        const lightness = parseChannel(parts[0])
        const a = Number(parts[1])
        const b = Number(parts[2])
        const alpha = alphaPart ? parseChannel(alphaPart) : 1

        const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
        const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
        const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b

        const l = lRoot ** 3
        const m = mRoot ** 3
        const s = sRoot ** 3

        const toSrgb = (channel) => {
          const clipped = Math.min(1, Math.max(0, channel))
          const gammaCorrected =
            clipped <= 0.0031308
              ? 12.92 * clipped
              : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055

          return Math.round(gammaCorrected * 255)
        }

        return [
          toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
          alpha,
        ]
      }

      function parseColor(value) {
        const oklch = parseOklch(value)

        if (oklch) {
          return oklch
        }

        const oklab = parseOklab(value)

        if (oklab) {
          return oklab
        }

        const normalized = normalizeColor(value);
        const rgbMatch = normalized.match(/rgba?\\(([^)]+)\\)/i)

        if (rgbMatch) {
          const [r, g, b, a = "1"] = rgbMatch[1].split(",").map((part) => part.trim())
          return [Number(r), Number(g), Number(b), Number(a)]
        }

        const hexMatch = normalized.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)

        if (hexMatch) {
          const hex = hexMatch[1]
          const hasAlpha = hex.length === 8
          const r = Number.parseInt(hex.slice(0, 2), 16)
          const g = Number.parseInt(hex.slice(2, 4), 16)
          const b = Number.parseInt(hex.slice(4, 6), 16)
          const a = hasAlpha ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
          return [r, g, b, a]
        }

        return [255, 255, 255, 1]
      }

      function toLinear(channel) {
        const normalized = channel / 255
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
      }

      function luminance(rgb) {
        return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2])
      }

      function blend(foreground, background) {
        const alpha = foreground[3]
        return [
          Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
          Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
          Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
        ]
      }

      function findBackground(element) {
        const chain = []
        let current = element

        while (current) {
          chain.push(window.getComputedStyle(current).backgroundColor)
          current = current.parentElement
        }

        let background = parseColor(window.getComputedStyle(document.body).backgroundColor)

        for (let index = chain.length - 1; index >= 0; index -= 1) {
          const layer = parseColor(chain[index])

          if (layer[3] <= 0) {
            continue
          }

          if (layer[3] >= 0.98) {
            background = layer
            continue
          }

          background = [...blend(layer, background), 1]
        }

        return background.slice(0, 3)
      }

      function contrastRatio(foreground, background) {
        const foregroundLuminance = luminance(foreground)
        const backgroundLuminance = luminance(background)
        const lighter = Math.max(foregroundLuminance, backgroundLuminance)
        const darker = Math.min(foregroundLuminance, backgroundLuminance)

        return (lighter + 0.05) / (darker + 0.05)
      }

      return targets.flatMap((target) =>
        Array.from(document.querySelectorAll(target.selector)).flatMap((element, index) => {
          const style = window.getComputedStyle(element)

          if (style.display === "none" || style.visibility === "hidden") {
            return []
          }

          const text = element.textContent?.trim() ?? ""

          if (!text) {
            return []
          }

          const foreground = parseColor(style.color)
          const background = findBackground(element)
          const ratio = contrastRatio(foreground, background)

          if (ratio >= target.minRatio) {
            return []
          }

          return [
            {
              selector: \`\${target.selector}#\${index}\`,
              text,
              ratio: Number(ratio.toFixed(2)),
            },
          ]
        }),
      )
    })()
  `

  const failures = await page.evaluate(evaluationScript)

  if (failures.length > 0) {
    const summary = failures
      .map((failure) => `${failure.selector} "${failure.text.slice(0, 60)}" (${failure.ratio})`)
      .join(", ")

    throw new Error(`contrast gate failed: ${summary}`)
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

const assertNoHorizontalOverflow = async ({
  page,
  label,
}: {
  page: import("playwright").Page
  label: string
}) => {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const appRoot = document.querySelector<HTMLElement>("#root")

    return {
      root: root.scrollWidth - root.clientWidth,
      body: body.scrollWidth - body.clientWidth,
      app: appRoot ? appRoot.scrollWidth - appRoot.clientWidth : 0,
    }
  })

  const worstOverflow = Math.max(overflow.root, overflow.body, overflow.app)

  if (worstOverflow > 1) {
    throw new Error(`${label} introduced horizontal overflow (${worstOverflow}px)`)
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
  const server = createHttpServer()
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
  const outputDir = await mkdtemp(path.join(tmpdir(), "farewell-naver-blog-smoke-"))
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
    uploadAttempt: 0 | 1 | 2
    jobFetchCount: number
    uploadPayload: null | {
      providerKey: string
      providerFields: Record<string, UploadProviderValue>
    }
  } = {
    scanRequestCount: 0,
    uploadAttempt: 0,
    jobFetchCount: 0,
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
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        }),
      )
      return
    }

    if (pathname === "/api/upload-providers") {
      await route.fulfill(buildJsonResponse(uploadProviderCatalog))
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
          mockState.jobFetchCount <= 8 ? createRunningJob() : createUploadReadyJob()

        await route.fulfill(buildJsonResponse(applyCurrentOutputDir(nextJob, outputDir)))
        return
      }

      const nextJob =
        mockState.uploadAttempt === 1
          ? applyCurrentOutputDir(
              mockState.jobFetchCount <= 12 ? createPartialUploadingJob() : createUploadFailedJob(),
              outputDir,
            )
          : applyCurrentOutputDir(
              mockState.jobFetchCount <= 20 ? createRewritePendingJob() : createUploadCompletedJob(),
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
    await assertNoHorizontalOverflow({
      page,
      label: "initial desktop layout",
    })
    await waitForStepView({
      page,
      step: "blog-input",
    })
    await page.fill("#blogIdOrUrl", "mym0404")

    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

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

    const categoryTableLayoutOk = await page.evaluate(() => {
      const categoryList = document.querySelector<HTMLElement>("#category-list")
      const table = categoryList?.querySelector("table")
      const scrollArea = categoryList?.querySelector<HTMLElement>('[data-slot="scroll-area"]')

      if (!categoryList || !table || !scrollArea) {
        return false
      }

      return scrollArea.clientHeight >= 260 && scrollArea.clientHeight <= 560
    })

    if (!categoryTableLayoutOk) {
      throw new Error("category panel did not render as a fixed-height table")
    }

    await page.selectOption("#scope-categoryMode", "exact-selected")
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

    const structureStepVisible = await page.evaluate(() => {
      return (
        document.querySelector('[data-step-view="structure-options"] #export-panel') instanceof HTMLElement &&
        !document.querySelector("#category-panel")
      )
    })

    if (!structureStepVisible) {
      throw new Error("structure step did not replace the category step")
    }

    await page.fill("#outputDir", outputDir)
    await page.click("#structure-cleanOutputDir")
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

    const frontmatterLayoutOk = await page.evaluate(() => {
      const frontmatterGrid = document.querySelector<HTMLElement>("#frontmatter-fields")

      if (!frontmatterGrid) {
        return false
      }

      const frontmatterColumns = window
        .getComputedStyle(frontmatterGrid)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length

      return frontmatterColumns >= 2
    })

    if (!frontmatterLayoutOk) {
      throw new Error("frontmatter grid layout regressed")
    }

    await page.fill('[data-frontmatter-field="title"] input[data-alias-input="true"]', "shared")
    await page.fill('[data-frontmatter-field="source"] input[data-alias-input="true"]', "shared")

    const frontmatterStatusText = await page.locator("#frontmatter-status").textContent()

    if (!frontmatterStatusText?.includes('title와 source가 같은 alias "shared"')) {
      throw new Error("frontmatter alias collision was not shown")
    }

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

    await page.selectOption("#markdown-linkStyle", "referenced")
    await page.fill("#markdown-formulaInlineWrapperOpen", "\\(")
    await page.fill("#markdown-formulaInlineWrapperClose", "\\)")
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
    await page.selectOption("#assets-imageHandlingMode", "remote")

    const remoteModeState = await page.evaluate(() => {
      const imageHandlingMode = document.querySelector<HTMLSelectElement>("#assets-imageHandlingMode")
      const compression = document.querySelector<HTMLInputElement>("#assets-compressionEnabled")
      const downloadImages = document.querySelector<HTMLInputElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLInputElement>("#assets-downloadThumbnails")

      return {
        imageHandlingMode: imageHandlingMode?.value ?? null,
        compressionDisabled: compression?.disabled ?? null,
        downloadImagesDisabled: downloadImages?.disabled ?? null,
        downloadThumbnailsDisabled: downloadThumbnails?.disabled ?? null,
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

    await page.selectOption("#assets-imageHandlingMode", "download-and-upload")

    const uploadModeState = await page.evaluate(() => {
      const imageHandlingMode = document.querySelector<HTMLSelectElement>("#assets-imageHandlingMode")
      const downloadImages = document.querySelector<HTMLInputElement>("#assets-downloadImages")
      const downloadThumbnails = document.querySelector<HTMLInputElement>("#assets-downloadThumbnails")

      return {
        imageHandlingMode: imageHandlingMode?.value ?? null,
        downloadImagesChecked: downloadImages?.checked ?? null,
        downloadThumbnailsChecked: downloadThumbnails?.checked ?? null,
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

    const uploadTargetPath = await page.locator("#job-file-tree tbody tr td").nth(0).textContent()

    if (!uploadTargetPath?.includes("NestJS 업로드 플로우 점검")) {
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
    await assertUploadTargetsBounded({
      page,
      label: "desktop upload-ready flow",
    })

    const providerValue = await page.locator("#upload-providerKey").inputValue()

    if (providerValue !== "github") {
      throw new Error("upload provider default did not stay on github")
    }

    await page.fill("#upload-providerField-repo", "owner/name")
    await page.fill("#upload-providerField-token", "placeholder-invalid-token")

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
    await assertNoHorizontalOverflow({
      page,
      label: "mobile upload flow",
    })
    await assertUploadTargetsBounded({
      page,
      label: "mobile upload flow",
      expectHorizontalScroll: true,
    })

    await page.setViewportSize(desktopViewport)
    await page.waitForTimeout(150)
    await page.fill("#upload-providerField-token", "placeholder-fixed-token")

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

    const errorFilterState = await page.locator('[data-job-filter="errors"]').getAttribute("class")

    if (!errorFilterState?.includes("is-active")) {
      throw new Error("error filter button did not become active")
    }

    await page.click('[data-job-filter="all"]')

    await assertStickyTop({
      page,
      selector: "#dashboard-backdrop",
      label: "background backdrop",
    })

    await assertTextContrast({
      page,
    })
    await assertNoHorizontalOverflow({
      page,
      label: "desktop export flow",
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
    await rm(outputDir, {
      recursive: true,
      force: true,
    })
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
