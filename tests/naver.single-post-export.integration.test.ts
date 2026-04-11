import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import { exportSinglePost } from "../src/modules/exporter/single-post-export.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

const blogId = "mym0404"
const logNo = "223034929697"

describe("naver single post export integration", () => {
  it("exports the public sample post with remote assets disabled", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()
    options.assets.downloadImages = false
    options.assets.downloadThumbnails = false

    try {
      const diagnostics = await exportSinglePost({
        blogId,
        logNo,
        outputDir,
        options,
      })

      expect(diagnostics.post).toMatchObject({
        blogId,
        logNo,
        editorVersion: 4,
      })
      expect(diagnostics.markdownFilePath).toContain(outputDir)
      expect(path.extname(diagnostics.markdownFilePath)).toBe(".md")
      expect(diagnostics.editorVersion).toBe(4)
      expect(diagnostics.blockTypes).toEqual(expect.arrayContaining(["formula", "code", "linkCard"]))
      expect(Array.isArray(diagnostics.parserWarnings)).toBe(true)
      expect(Array.isArray(diagnostics.reviewerWarnings)).toBe(true)
      expect(Array.isArray(diagnostics.renderWarnings)).toBe(true)
      expect(diagnostics.assetPaths).toEqual([])
      expect(diagnostics.markdown.startsWith("---\n")).toBe(true)
      expect(diagnostics.markdown).toContain("title:")
      expect(diagnostics.markdown).toContain("blogId: mym0404")
      expect(diagnostics.markdown).toContain("logNo: 223034929697")
      expect(diagnostics.markdown).toContain("editorVersion: 4")
      expect(diagnostics.markdown).toContain("```")
      expect(diagnostics.markdown).toContain("$$")
      expect(diagnostics.markdown).toContain("https://")

      const writtenMarkdown = await readFile(diagnostics.markdownFilePath, "utf8")
      expect(writtenMarkdown).toBe(diagnostics.markdown)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  }, 60_000)
})
