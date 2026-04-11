import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { mkdir } from "node:fs/promises"

import { chromium } from "playwright"

import { createHttpServer } from "../../src/server/http-server.js"

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
] as const

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

      function parseColor(value) {
        const match = value.match(/rgba?\\(([^)]+)\\)/i)

        if (!match) {
          return [255, 255, 255, 1]
        }

        const [r, g, b, a = "1"] = match[1].split(",").map((part) => part.trim())
        return [Number(r), Number(g), Number(b), Number(a)]
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
        let current = element
        const fallback = [255, 255, 255]

        while (current) {
          const style = window.getComputedStyle(current)
          const background = parseColor(style.backgroundColor)

          if (background[3] > 0) {
            return background[3] >= 0.98 ? background.slice(0, 3) : blend(background, [...fallback, 1])
          }

          current = current.parentElement
        }

        return fallback
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
    await page.goto(baseUrl)
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
    await page.click('.category-item [data-slot="checkbox"]')
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

    if (!summaryText?.includes("Completed")) {
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

    await assertTextContrast({
      page,
    })

    await page.click("#markdown-modal-close")

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
