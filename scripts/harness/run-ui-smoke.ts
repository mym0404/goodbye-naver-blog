import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium } from "playwright"

import { createHttpServer } from "../../src/server/http-server.js"

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
  const context = await browser.newContext()
  const page = await context.newPage()
  const outputDir = await mkdtemp(path.join(tmpdir(), "farewell-naver-blog-smoke-"))

  try {
    await page.goto(baseUrl)
    await page.fill("#blogIdOrUrl", "mym0404")

    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
    )

    await page.click("#scan-button")
    await scanResponsePromise
    await page.waitForFunction(
      () => document.querySelector("#scan-status")?.textContent?.includes("스캔 완료") ?? false,
    )
    await page.fill("#category-search", "NestJS")
    await page.click("#clear-all-categories")
    await page.waitForSelector(".category-item")
    await page.check('.category-item input[type="checkbox"]')
    await page.fill("#outputDir", outputDir)
    await page.locator('details:has(summary:text("Assets"))').evaluate((element) => {
      if (!(element instanceof HTMLDetailsElement)) {
        throw new Error("Assets details element not found")
      }

      element.open = true
    })
    await page.selectOption("#assets-assetPathMode", "remote")
    await page.uncheck("#assets-downloadImages")
    await page.uncheck("#assets-downloadThumbnails")

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export` &&
        response.request().method() === "POST",
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

    const firstOutputPath = manifest.posts.find((post) => post.outputPath)?.outputPath

    if (!firstOutputPath) {
      throw new Error("manifest outputPath missing")
    }

    const exportedMarkdown = await readFile(path.join(outputDir, firstOutputPath), "utf8")

    if (!exportedMarkdown.startsWith("---")) {
      throw new Error("exported markdown missing frontmatter")
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
