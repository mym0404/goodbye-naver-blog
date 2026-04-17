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

const responseTimeoutMs = 90_000
const desktopViewport = {
  width: 1440,
  height: 1200,
} as const
const mobileViewport = {
  width: 375,
  height: 812,
} as const

const contrastTargets = [
  { selector: "#category-status", minRatio: 4.5 },
  { selector: ".panel-description", minRatio: 4.5 },
  { selector: ".field-help", minRatio: 4.5 },
  { selector: ".frontmatter-description", minRatio: 4.5 },
  { selector: ".results-description", minRatio: 4.5 },
  { selector: ".job-results-row span", minRatio: 4.5 },
  { selector: ".scan-status-note", minRatio: 4.5 },
  { selector: ".sidebar-brand strong", minRatio: 4.5 },
  { selector: ".sidebar-heading", minRatio: 4.5 },
  { selector: ".sidebar-link span", minRatio: 4.5 },
  { selector: ".sidebar-summary-title", minRatio: 4.5 },
  { selector: ".sidebar-summary-metric span", minRatio: 4.5 },
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
      timestamp: "2026-04-11T04:00:00.000Z",
      message: "작업을 큐에 등록했습니다.",
    },
  ],
  createdAt: "2026-04-11T04:00:00.000Z",
  startedAt: "2026-04-11T04:00:01.000Z",
  progress: {
    total: 1,
    completed: 1,
    failed: 0,
    warnings: 0,
  },
  error: null,
})

const createUploadReadyJob = () => ({
  ...createBaseJob(),
  status: "upload-ready",
  finishedAt: null,
  upload: {
    status: "upload-ready",
    eligiblePostCount: 1,
    candidateCount: 2,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  items: [
    {
      id: "NestJS/2026-04-11-223034929697/index.md",
      logNo: "223034929697",
      title: "NestJS 업로드 플로우 점검",
      source: "https://blog.naver.com/mym0404/223034929697",
      category: {
        id: 101,
        name: "NestJS",
        path: ["NestJS"],
      },
      status: "success",
      outputPath: "NestJS/2026-04-11-223034929697/index.md",
      assetPaths: [
        "NestJS/2026-04-11-223034929697/thumbnail-01.png",
        "NestJS/2026-04-11-223034929697/image-01.png",
      ],
      upload: {
        eligible: true,
        candidateCount: 2,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [
          {
            kind: "thumbnail",
            sourceUrl: "https://example.com/thumb.png",
            localPath: "NestJS/2026-04-11-223034929697/thumbnail-01.png",
            markdownReference: "thumbnail-01.png",
          },
          {
            kind: "image",
            sourceUrl: "https://example.com/image-01.png",
            localPath: "NestJS/2026-04-11-223034929697/image-01.png",
            markdownReference: "image-01.png",
          },
        ],
      },
      warnings: [],
      warningCount: 0,
      error: null,
      updatedAt: "2026-04-11T04:00:01.000Z",
    },
  ],
  manifest: {
    generatedAt: "2026-04-11T04:00:01.000Z",
    blogId: "mym0404",
    outputDir: "/tmp/farewell-naver-blog-smoke",
    totalPosts: 1,
    successCount: 1,
    failureCount: 0,
    warningCount: 0,
    upload: {
      status: "upload-ready",
      eligiblePostCount: 1,
      candidateCount: 2,
      uploadedCount: 0,
      failedCount: 0,
      terminalReason: null,
    },
    posts: [
      {
        logNo: "223034929697",
        title: "NestJS 업로드 플로우 점검",
        source: "https://blog.naver.com/mym0404/223034929697",
        category: {
          id: 101,
          name: "NestJS",
          path: ["NestJS"],
        },
        status: "success",
        outputPath: "NestJS/2026-04-11-223034929697/index.md",
        assetPaths: [
          "NestJS/2026-04-11-223034929697/thumbnail-01.png",
          "NestJS/2026-04-11-223034929697/image-01.png",
        ],
        upload: {
          eligible: true,
          candidateCount: 2,
          uploadedCount: 0,
          failedCount: 0,
          candidates: [
            {
              kind: "thumbnail",
              sourceUrl: "https://example.com/thumb.png",
              localPath: "NestJS/2026-04-11-223034929697/thumbnail-01.png",
              markdownReference: "thumbnail-01.png",
            },
            {
              kind: "image",
              sourceUrl: "https://example.com/image-01.png",
              localPath: "NestJS/2026-04-11-223034929697/image-01.png",
              markdownReference: "image-01.png",
            },
          ],
        },
        warnings: [],
        error: null,
      },
    ],
  },
})

const createUploadingJob = () => ({
  ...createUploadReadyJob(),
  status: "uploading",
  upload: {
    ...createUploadReadyJob().upload,
    status: "uploading",
    uploadedCount: 1,
  },
})

const createUploadCompletedJob = () => ({
  ...createUploadReadyJob(),
  status: "upload-completed",
  finishedAt: "2026-04-11T04:00:05.000Z",
  upload: {
    ...createUploadReadyJob().upload,
    status: "upload-completed",
    uploadedCount: 2,
  },
  items: [
    {
      ...createUploadReadyJob().items[0],
      assetPaths: [
        "https://cdn.example.com/NestJS/2026-04-11-223034929697/thumbnail-01.png",
        "https://cdn.example.com/NestJS/2026-04-11-223034929697/image-01.png",
      ],
      upload: {
        ...createUploadReadyJob().items[0].upload,
        uploadedCount: 2,
      },
      updatedAt: "2026-04-11T04:00:05.000Z",
    },
  ],
  manifest: {
    ...createUploadReadyJob().manifest,
    generatedAt: "2026-04-11T04:00:05.000Z",
    upload: {
      ...createUploadReadyJob().manifest.upload,
      status: "upload-completed",
      uploadedCount: 2,
    },
    posts: [
      {
        ...createUploadReadyJob().manifest.posts[0],
        assetPaths: [
          "https://cdn.example.com/NestJS/2026-04-11-223034929697/thumbnail-01.png",
          "https://cdn.example.com/NestJS/2026-04-11-223034929697/image-01.png",
        ],
        upload: {
          ...createUploadReadyJob().manifest.posts[0].upload,
          uploadedCount: 2,
        },
      },
    ],
  },
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

const assertNavActive = async ({
  page,
  sectionId,
}: {
  page: import("playwright").Page
  sectionId: string
}) => {
  await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
  await page.waitForFunction(
    (nextSectionId) =>
      document.querySelector(`[data-section-link="${nextSectionId}"]`)?.className.includes("is-active") ?? false,
    sectionId,
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
  const browser = await chromium.launch()
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
    uploadRequested: boolean
    uploadFetchCount: number
    uploadPayload: null | {
      uploaderKey: string
      uploaderConfigJson: string
    }
  } = {
    uploadRequested: false,
    uploadFetchCount: 0,
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

    if (pathname === "/api/scan" && request.method() === "POST") {
      await route.fulfill(buildJsonResponse(scanResult))
      return
    }

    if (pathname === "/api/export" && request.method() === "POST") {
      mockState.uploadRequested = false
      mockState.uploadFetchCount = 0
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
      if (!mockState.uploadRequested) {
        await route.fulfill(buildJsonResponse(applyCurrentOutputDir(createUploadReadyJob(), outputDir)))
        return
      }

      mockState.uploadFetchCount += 1
      const nextJob = applyCurrentOutputDir(
        mockState.uploadFetchCount === 1
          ? createUploadingJob()
          : createUploadCompletedJob(),
        outputDir,
      )

      await route.fulfill(buildJsonResponse(nextJob))
      return
    }

    if (pathname === "/api/export/job-smoke/upload" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        uploaderKey?: string
        uploaderConfigJson?: string
      }

      if (!body.uploaderKey || !body.uploaderConfigJson) {
        await route.fulfill(
          buildJsonResponse(
            {
              error: "uploaderKey와 uploaderConfigJson는 필수입니다.",
            },
            400,
          ),
        )
        return
      }

      mockState.uploadRequested = true
      mockState.uploadFetchCount = 0
      mockState.uploadPayload = {
        uploaderKey: body.uploaderKey,
        uploaderConfigJson: body.uploaderConfigJson,
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
      const manifest = mockState.uploadRequested
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
    await assertFrameFlush({
      page,
      selector: ".app-sidebar-shell",
      label: "desktop sidebar shell",
    })
    await page.waitForFunction(
      () => document.querySelector('[data-section-link="scan-workbench"]')?.className.includes("is-active") ?? false,
    )
    await page.fill("#blogIdOrUrl", "mym0404")

    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#scan-button")
    await scanResponsePromise
    await page.waitForFunction(
      () => document.querySelector("#scan-status")?.textContent?.includes("스캔 완료") ?? false,
    )
    await page.getByRole("tab", { name: "Frontmatter" }).click()
    await page.waitForSelector('[data-frontmatter-field="title"] .frontmatter-description')

    const frontmatterDescription = await page
      .locator('[data-frontmatter-field="title"] .frontmatter-description')
      .textContent()

    if (!frontmatterDescription?.includes("글 제목")) {
      throw new Error("frontmatter description missing")
    }

    const optionsLayoutOk = await page.evaluate(() => {
      const tabsList = document.querySelector<HTMLElement>(".option-tabs-list")
      const frontmatterGrid = document.querySelector<HTMLElement>("#frontmatter-fields")

      if (!tabsList || !frontmatterGrid) {
        return false
      }

      const tabColumns = window
        .getComputedStyle(tabsList)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
      const frontmatterColumns = window
        .getComputedStyle(frontmatterGrid)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length

      return tabColumns === 5 && frontmatterColumns >= 2
    })

    if (!optionsLayoutOk) {
      throw new Error("options tabs or frontmatter grid layout regressed")
    }

    await assertNavActive({
      page,
      sectionId: "category-panel",
    })

    await page.fill('[data-frontmatter-field="title"] input[data-alias-input="true"]', "shared")
    await page.fill('[data-frontmatter-field="source"] input[data-alias-input="true"]', "shared")

    const frontmatterStatusText = await page.locator("#frontmatter-status").textContent()

    if (!frontmatterStatusText?.includes('title와 source가 같은 alias "shared"')) {
      throw new Error("frontmatter alias collision was not shown")
    }

    const exportDisabledWithCollision = await page.locator("#export-button").isDisabled()

    if (!exportDisabledWithCollision) {
      throw new Error("export button should be disabled when aliases collide")
    }

    await page.fill('[data-frontmatter-field="source"] input[data-alias-input="true"]', "")
    await page.fill('[data-frontmatter-field="title"] input[data-alias-input="true"]', "postTitle")
    await page.fill("#category-search", "NestJS")
    await page.click("#clear-all-categories")
    await page.waitForSelector(".category-item")
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
    await page.click('.category-item [data-slot="checkbox"]')
    await assertNavActive({
      page,
      sectionId: "export-panel",
    })
    await page.fill("#outputDir", outputDir)
    await page.getByRole("tab", { name: "Assets" }).click()
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

    if (await page.locator("#upload-uploaderKey").count()) {
      throw new Error("upload form should not appear inside the Assets tab")
    }

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

    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "upload-ready",
      timeoutLabel: "UI upload-ready state",
    })

    await assertNavActive({
      page,
      sectionId: "status-panel",
    })

    await page.waitForSelector("#upload-targets-table")
    await page.waitForSelector("#upload-uploaderKey")
    await page.waitForSelector("#upload-uploaderConfigJson")

    const uploadSectionText = await page.locator("#status-panel").textContent()

    if (!uploadSectionText?.includes("업로드 시작")) {
      throw new Error("upload-ready panel did not expose the upload action")
    }

    const uploadTargetPath = await page.locator("#upload-targets-table tbody tr td").nth(0).textContent()

    if (!uploadTargetPath?.includes("NestJS 업로드 플로우 점검")) {
      throw new Error("upload target table did not render the expected post")
    }

    await page.fill("#upload-uploaderKey", "github")
    await page.fill("#upload-uploaderConfigJson", '{"repo":"owner/name"}')

    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export/${jobId}/upload` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.click("#upload-submit")
    await uploadResponsePromise

    if (mockState.uploadPayload?.uploaderConfigJson !== '{"repo":"owner/name"}') {
      throw new Error("upload request did not submit the placeholder config payload")
    }

    await waitForJobStatus({
      page,
      timeoutMs: 10_000,
      accept: (status) => status === "uploading",
      timeoutLabel: "UI uploading state",
    })

    await waitForJobStatus({
      page,
      timeoutMs: 90_000,
      accept: (status) => status === "upload-completed",
      timeoutLabel: "UI upload-completed state",
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

    if (manifest.upload.status !== "upload-completed" || manifest.upload.uploadedCount !== 2) {
      throw new Error("manifest did not reflect upload completion")
    }

    const finalStatusText = await page.locator("#status-panel").textContent()

    if (finalStatusText?.includes("owner/name")) {
      throw new Error("upload placeholder config leaked into the visible UI")
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
      selector: ".app-sidebar",
      label: "desktop sidebar",
    })
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

    await page.setViewportSize(mobileViewport)
    await page.waitForTimeout(150)
    const mobileRailVisible = await page.locator(".mobile-command-bar").isVisible()

    if (!mobileRailVisible) {
      throw new Error("mobile sticky rail was not visible")
    }

    const desktopSidebarVisible = await page.locator(".app-sidebar").evaluate((element) => {
      return window.getComputedStyle(element).display !== "none"
    })

    if (desktopSidebarVisible) {
      throw new Error("desktop sidebar should be hidden on mobile")
    }

    await assertStickyTop({
      page,
      selector: ".mobile-command-bar",
      label: "mobile rail",
    })
    await assertNoHorizontalOverflow({
      page,
      label: "mobile layout",
    })
    await assertFrameFlush({
      page,
      selector: ".mobile-command-bar",
      label: "mobile command rail",
    })
    await page.locator("#export-panel").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)

    const mobileCommandBarHeight = await page.locator(".mobile-command-bar").evaluate((element) => element.getBoundingClientRect().height)

    if (mobileCommandBarHeight > 360) {
      throw new Error(`mobile command bar is too tall: ${mobileCommandBarHeight}`)
    }

    await page.locator("#status-panel").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)

    const mobileUploadTableOk = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>("#status-panel")
      const table = document.querySelector<HTMLElement>("#upload-targets-table")

      if (!section || !table) {
        return false
      }

      const sectionRect = section.getBoundingClientRect()
      const tableRect = table.getBoundingClientRect()

      return tableRect.width <= sectionRect.width + 1
    })

    if (!mobileUploadTableOk) {
      throw new Error("mobile upload targets table overflowed its panel")
    }

    await page.setViewportSize(desktopViewport)
    await page.waitForTimeout(150)

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

    if (firstOutputPath !== "NestJS/2026-04-11-223034929697/index.md") {
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
