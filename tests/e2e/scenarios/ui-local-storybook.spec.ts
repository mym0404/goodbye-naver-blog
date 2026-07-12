import { rm } from "node:fs/promises"
import path from "node:path"

import { createHttpServer } from "@exitpress/server/http/HttpServer.js"
import { expect, test } from "@playwright/test"

import type { Browser } from "playwright"

import { createTestTempDir } from "../../support/test-paths.js"

const storyKey = "tistory-11-list"

const createStorybookHarness = async ({
  browser,
  viewport,
}: {
  browser: Browser
  viewport: { width: number; height: number }
}) => {
  const tempRoot = await createTestTempDir("exitpress-local-storybook-")
  const server = createHttpServer({
    settingsPath: path.join(tempRoot, "settings.json"),
    scanCachePath: path.join(tempRoot, "scan-cache.json"),
    postHtmlCacheDir: path.join(tempRoot, "post-html"),
  })

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a numeric port")
  }

  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const browserErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => {
    browserErrors.push(error.message)
  })

  return {
    browserErrors,
    page,
    url: `http://127.0.0.1:${address.port}/storybook#${storyKey}`,
    close: async () => {
      await context.close()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await rm(tempRoot, { recursive: true, force: true })
    },
  }
}

test.describe("local", () => {
  test("renders a Tistory story with nested props and matching evidence", async ({ browser }) => {
    const harness = await createStorybookHarness({
      browser,
      viewport: { width: 1440, height: 1000 },
    })

    try {
      await harness.page.goto(harness.url)

      const story = harness.page.locator(`[data-active-storybook-story="${storyKey}"]`)
      const propGrid = story.locator("[data-template-prop-grid]")

      await expect(story).toBeVisible()
      await expect(propGrid.locator("[data-template-prop]")).toHaveCount(5)

      for (const path of [
        "items",
        "items[].depth",
        "items[].ordered",
        "items[].index",
        "items[].text",
      ]) {
        await expect(propGrid.locator(`[data-template-prop="${path}"]`)).toBeVisible()
      }

      await expect(story.locator('[data-storybook-code="html"]')).toContainText("<ul>")
      await expect(story.locator("[data-storybook-markdown]")).toContainText("- 글 스캔")
      await expect(story.getByRole("img", { name: "목록 원본 캡처" })).toBeVisible()
      expect(harness.browserErrors).toEqual([])
    } finally {
      await harness.close()
    }
  })

  test("keeps prop labels on one line until the wide layout fits two columns", async ({
    browser,
  }) => {
    const harness = await createStorybookHarness({
      browser,
      viewport: { width: 846, height: 836 },
    })

    try {
      await harness.page.goto(harness.url)

      const propGrid = harness.page.locator("[data-template-prop-grid]")
      const readLayout = () =>
        propGrid.evaluate((element) => ({
          columns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
          rows: Array.from(element.querySelectorAll("[data-template-prop]")).map((row) => ({
            height: row.getBoundingClientRect().height,
            maxCellHeight: Math.max(
              ...Array.from(row.children).map((cell) => cell.getBoundingClientRect().height),
            ),
          })),
        }))

      await expect(propGrid).toBeVisible()

      const regularLayout = await readLayout()

      expect(regularLayout.columns).toBe(1)
      expect(regularLayout.rows.every((row) => row.height <= 36 && row.maxCellHeight <= 24)).toBe(
        true,
      )

      await harness.page.setViewportSize({ width: 1440, height: 836 })

      const wideLayout = await readLayout()

      expect(wideLayout.columns).toBe(2)
      expect(wideLayout.rows.every((row) => row.height <= 36 && row.maxCellHeight <= 24)).toBe(true)
      expect(harness.browserErrors).toEqual([])
    } finally {
      await harness.close()
    }
  })
})
