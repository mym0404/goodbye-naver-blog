import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createElement } from "react"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdir } from "node:fs/promises"

import { chromium } from "playwright"
import { renderToStaticMarkup } from "react-dom/server"

import { createHttpServer } from "../../src/server/http-server.js"
import { MarkdownDocument } from "../../src/ui/lib/markdown.js"
import { markdownShowcase } from "../../tests/fixtures/markdown-showcase.js"

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
  { selector: "#preview-status", minRatio: 4.5 },
  { selector: ".panel-description", minRatio: 4.5 },
  { selector: ".field-help", minRatio: 4.5 },
  { selector: ".frontmatter-description", minRatio: 4.5 },
  { selector: ".results-description", minRatio: 4.5 },
  { selector: ".job-tree-item-copy small", minRatio: 4.5 },
  { selector: ".job-tree-group-header span", minRatio: 4.5 },
  { selector: "#markdown-modal-meta span", minRatio: 4.5 },
  { selector: ".markdown-frontmatter-key", minRatio: 4.5 },
  { selector: ".scan-status-note", minRatio: 4.5 },
  { selector: ".sidebar-brand strong", minRatio: 4.5 },
  { selector: ".sidebar-heading", minRatio: 4.5 },
  { selector: ".sidebar-link span", minRatio: 4.5 },
  { selector: ".sidebar-summary-title", minRatio: 4.5 },
  { selector: ".sidebar-summary-metric span", minRatio: 4.5 },
  { selector: "#export-button span", minRatio: 4.5 },
] as const

const assertRendererFixture = () => {
  const markup = renderToStaticMarkup(createElement(MarkdownDocument, { markdown: markdownShowcase }))

  if (!markup.includes("hljs")) {
    throw new Error("renderer fixture did not produce highlighted code blocks")
  }

  if (!markup.includes("<table")) {
    throw new Error("renderer fixture did not render tables")
  }

  if (!markup.includes("Warning: parser note")) {
    throw new Error("renderer fixture did not preserve warning callouts")
  }
}

const getCaptureDir = () => {
  const index = process.argv.indexOf("--capture-dir")

  if (index < 0) {
    return null
  }

  return process.argv[index + 1] ?? null
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
  await page.click("#job-file-tree .job-tree-item")
  await page.waitForSelector("#markdown-modal")
  await page.screenshot({
    path: path.join(captureDir, "desktop-modal.png"),
    fullPage: true,
  })
  await page.click("#markdown-modal-close")
  await page.setViewportSize(mobileViewport)
  await page.screenshot({
    path: path.join(captureDir, "mobile-overview.png"),
    fullPage: true,
  })
}

const waitForJobCompletion = async ({
  page,
  timeoutMs,
}: {
  page: import("playwright").Page
  timeoutMs: number
}) => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const status = await page.locator("#status-text").textContent()

    if (status === "completed") {
      return
    }

    if (status === "failed") {
      throw new Error("UI export job failed")
    }

    await page.waitForTimeout(1000)
  }

  throw new Error("UI export job timed out")
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

  try {
    assertRendererFixture()
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

      return tabColumns === 4 && frontmatterColumns >= 2
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
    await page.waitForSelector("#assets-assetPathMode")
    await page.selectOption("#assets-assetPathMode", "remote")
    await page.uncheck("#assets-downloadImages")
    await page.uncheck("#assets-downloadThumbnails")
    const previewResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/preview` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await assertNavActive({
      page,
      sectionId: "preview-panel",
    })
    await page.click("#preview-button")
    await previewResponsePromise
    await page.waitForFunction(
      () =>
        document.querySelector("#preview-markdown")?.textContent?.includes("postTitle:") ?? false,
    )

    const previewMarkdown = await page.locator("#preview-markdown").textContent()

    if (!previewMarkdown?.includes("postTitle:")) {
      throw new Error("preview markdown missing frontmatter alias")
    }

    if (/<[a-z][^>]*>/i.test(previewMarkdown)) {
      throw new Error("preview markdown still contains html")
    }

    const sourceModeLayoutOk = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".preview-content-grid")
      const sourcePane = document.querySelector<HTMLElement>(".preview-markdown-shell")
      const sourceContent = document.querySelector<HTMLElement>("#preview-markdown")
      const renderedPane = document.querySelector<HTMLElement>("#preview-rendered")

      if (!grid || !sourcePane || !sourceContent || renderedPane) {
        return false
      }

      const gridColumns = window
        .getComputedStyle(grid)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
      const gridRect = grid.getBoundingClientRect()
      const paneRect = sourcePane.getBoundingClientRect()
      const sourceStyle = window.getComputedStyle(sourceContent)

      return (
        gridColumns === 1 &&
        Math.abs(gridRect.width - paneRect.width) <= 2 &&
        sourceStyle.marginTop === "0px" &&
        sourceStyle.marginRight === "0px" &&
        sourceStyle.marginBottom === "0px" &&
        sourceStyle.marginLeft === "0px"
      )
    })

    if (!sourceModeLayoutOk) {
      throw new Error("preview source mode layout regressed")
    }

    await page.click('[data-preview-mode="rendered"]')

    const renderedModeState = await page.locator('[data-preview-mode="rendered"]').getAttribute("class")

    if (!renderedModeState?.includes("is-active")) {
      throw new Error("preview rendered mode did not become active")
    }

    await page.waitForFunction(
      () => document.querySelector("#preview-rendered")?.textContent?.includes("postTitle:") ?? false,
    )

    const previewRenderedText = await page.locator("#preview-rendered").textContent()

    if (!previewRenderedText?.includes("postTitle:")) {
      throw new Error("preview rendered pane missing markdown result")
    }

    const renderedModeLayoutOk = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".preview-content-grid")
      const sourcePane = document.querySelector<HTMLElement>(".preview-markdown-shell")
      const renderedPane = document.querySelector<HTMLElement>("#preview-rendered")
      const renderedContent = document.querySelector<HTMLElement>("#preview-rendered .preview-rendered-content")

      if (!grid || sourcePane || !renderedPane || !renderedContent) {
        return false
      }

      const gridColumns = window
        .getComputedStyle(grid)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
      const gridRect = grid.getBoundingClientRect()
      const paneRect = renderedPane.getBoundingClientRect()
      const renderedStyle = window.getComputedStyle(renderedContent)

      return (
        gridColumns === 1 &&
        Math.abs(gridRect.width - paneRect.width) <= 2 &&
        renderedStyle.paddingTop === renderedStyle.paddingBottom &&
        renderedStyle.paddingLeft === renderedStyle.paddingRight
      )
    })

    if (!renderedModeLayoutOk) {
      throw new Error("preview rendered mode layout regressed")
    }

    await page.click('[data-preview-mode="split"]')
    await page.waitForFunction(
      () => document.querySelector('[data-preview-mode="split"]')?.className.includes("is-active") ?? false,
    )

    const previewLayoutOk = await page.evaluate(() => {
      const previewPanel = document.querySelector<HTMLElement>("#preview-panel")
      const statusPanel = document.querySelector<HTMLElement>("#status-panel")
      const sourcePane = document.querySelector<HTMLElement>(".preview-markdown-shell")
      const renderedPane = document.querySelector<HTMLElement>("#preview-rendered")

      if (!previewPanel || !statusPanel || !sourcePane || !renderedPane) {
        return false
      }

      const previewBeforeStatus =
        (previewPanel.compareDocumentPosition(statusPanel) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

      return previewBeforeStatus && sourcePane.clientHeight > 280 && renderedPane.clientHeight > 280
    })

    if (!previewLayoutOk) {
      throw new Error("preview section order or scrollable pane sizing was incorrect")
    }

    const splitModeLayoutOk = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".preview-content-grid")
      const sourcePane = document.querySelector<HTMLElement>(".preview-markdown-shell")
      const renderedPane = document.querySelector<HTMLElement>("#preview-rendered")
      const sourceContent = document.querySelector<HTMLElement>("#preview-markdown")
      const renderedContent = document.querySelector<HTMLElement>("#preview-rendered .preview-rendered-content")

      if (!grid || !sourcePane || !renderedPane || !sourceContent || !renderedContent) {
        return false
      }

      const gridColumns = window
        .getComputedStyle(grid)
        .gridTemplateColumns
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
      const sourceRect = sourcePane.getBoundingClientRect()
      const renderedRect = renderedPane.getBoundingClientRect()
      const sourceStyle = window.getComputedStyle(sourceContent)
      const renderedStyle = window.getComputedStyle(renderedContent)

      return (
        gridColumns === 2 &&
        Math.abs(sourceRect.width - renderedRect.width) <= 4 &&
        sourceStyle.paddingTop === renderedStyle.paddingTop &&
        sourceStyle.paddingRight === renderedStyle.paddingRight &&
        sourceStyle.paddingBottom === renderedStyle.paddingBottom &&
        sourceStyle.paddingLeft === renderedStyle.paddingLeft
      )
    })

    if (!splitModeLayoutOk) {
      throw new Error("preview split mode width or padding regressed")
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

    await waitForJobCompletion({
      page,
      timeoutMs: 90_000,
    })

    await assertNavActive({
      page,
      sectionId: "status-panel",
    })

    const manifestResponse = await context.request.get(`${baseUrl}/api/export/${jobId}/manifest`)

    if (!manifestResponse.ok()) {
      throw new Error(`manifest request failed: ${manifestResponse.status()}`)
    }

    const manifest = (await manifestResponse.json()) as {
      totalPosts: number
      successCount: number
      failureCount: number
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

    await page.waitForSelector("#job-file-tree .job-tree-item")
    await page.click('[data-job-filter="errors"]')
    await page.waitForTimeout(200)

    const errorFilterState = await page.locator('[data-job-filter="errors"]').getAttribute("class")

    if (!errorFilterState?.includes("is-active")) {
      throw new Error("error filter button did not become active")
    }

    await page.click('[data-job-filter="all"]')
    await page.click("#job-file-tree .job-tree-item")
    await page.waitForSelector("#markdown-modal")

    const modalText = await page.locator("#markdown-modal-body").textContent()

    if (!modalText?.includes("postTitle") && !modalText?.includes("테스트") && !modalText?.includes("Markdown")) {
      throw new Error("markdown modal did not render content")
    }

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

    await page.click("#markdown-modal-close")

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

    await page.locator("#preview-panel").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)

    const previewMobileLayoutOk = await page.evaluate(() => {
      const frontmatterItem = document.querySelector<HTMLElement>("#preview-rendered .markdown-frontmatter-item")
      const frontmatterValue = frontmatterItem?.querySelector<HTMLElement>("pre")

      if (!frontmatterItem || !frontmatterValue) {
        return false
      }

      const columns = window.getComputedStyle(frontmatterItem).gridTemplateColumns.trim().split(/\s+/)
      const itemRect = frontmatterItem.getBoundingClientRect()
      const valueRect = frontmatterValue.getBoundingClientRect()

      return columns.length === 1 && valueRect.width > itemRect.width * 0.7 && valueRect.height < 160
    })

    if (!previewMobileLayoutOk) {
      throw new Error("mobile preview frontmatter layout collapsed")
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

    const exportedMarkdown = await readFile(path.join(outputDir, firstOutputPath), "utf8")

    if (!exportedMarkdown.startsWith("---")) {
      throw new Error("exported markdown missing frontmatter")
    }

    if (!exportedMarkdown.includes("postTitle:")) {
      throw new Error("exported markdown did not use frontmatter alias")
    }

    if (exportedMarkdown.includes("\ntitle:")) {
      throw new Error("exported markdown still used the original title key")
    }

    if (/<[a-z][^>]*>/i.test(exportedMarkdown)) {
      throw new Error("exported markdown still contains html")
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
