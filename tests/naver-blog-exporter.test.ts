import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../src/modules/exporter/naver-blog-exporter.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

const scanResult = {
  blogId: "mym0404",
  totalPostCount: 1,
  categories: [
    {
      id: 84,
      name: "PS 알고리즘, 팁",
      parentId: null,
      postCount: 1,
      isDivider: false,
      isOpen: true,
      path: ["PS 알고리즘, 팁"],
      depth: 0,
    },
  ],
}

const posts = [
  {
    blogId: "mym0404",
    logNo: "223034929697",
    title: "테스트 글",
    publishedAt: "2023-03-04T13:00:00+09:00",
    categoryId: 84,
    categoryName: "PS 알고리즘, 팁",
    source: "https://blog.naver.com/mym0404/223034929697",
    editorVersion: 4 as const,
    thumbnailUrl: "https://example.com/thumb.png",
  },
]

const postHtml = `
  <script>var data = { smartEditorVersion: 4 }</script>
  <div id="viewTypeSelector">
    <div class="se-component se-text">
      <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
      <p class="se-text-paragraph">본문입니다.</p>
    </div>
    <div class="se-component se-image">
      <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/image.png"}'>
        <img src="https://example.com/image.png" alt="diagram" />
      </a>
      <p class="se-image-caption">caption</p>
    </div>
  </div>
`

describe("NaverBlogExporter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("writes manifest, progress, and running job items for successful exports", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const onProgress = vi.fn()
    const onItem = vi.fn()

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue(scanResult)
    vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts").mockResolvedValue(posts)
    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockResolvedValue(postHtml)
    vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    })

    const exporter = new NaverBlogExporter({
      request: {
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      onLog: () => {},
      onProgress,
      onItem,
    })

    const manifest = await exporter.run()

    expect(manifest.totalPosts).toBe(1)
    expect(manifest.successCount).toBe(1)
    expect(manifest.failureCount).toBe(0)
    expect(manifest.posts[0]?.warningCount).toBeGreaterThanOrEqual(0)
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 1,
      failed: 0,
      warnings: manifest.warningCount,
    })
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({
      status: "success",
      markdown: expect.stringContaining("본문입니다."),
      warningCount: expect.any(Number),
    })

    const manifestPath = path.join(outputDir, "manifest.json")
    const writtenManifest = JSON.parse(await readFile(manifestPath, "utf8")) as typeof manifest

    expect(writtenManifest.successCount).toBe(1)
    expect(writtenManifest.posts[0]?.outputPath).toMatch(/\.md$/)

    await rm(outputDir, { recursive: true, force: true })
  })

  it("does not clear the output directory when scan fails", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const sentinelPath = path.join(outputDir, "keep.txt")
    await writeFile(sentinelPath, "keep", "utf8")

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockRejectedValueOnce(new Error("scan failed"))

    const exporter = new NaverBlogExporter({
      request: {
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      onLog: () => {},
      onProgress: () => {},
    })

    await expect(exporter.run()).rejects.toThrow("scan failed")
    expect(await readFile(sentinelPath, "utf8")).toBe("keep")

    await rm(outputDir, { recursive: true, force: true })
  })

  it("cleans the output directory, logs count mismatches, and records failed job items", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const sentinelPath = path.join(outputDir, "stale.txt")
    const onLog = vi.fn()
    const onProgress = vi.fn()
    const onItem = vi.fn()

    await writeFile(sentinelPath, "stale", "utf8")

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue({
      ...scanResult,
      totalPostCount: 2,
    })
    vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts").mockResolvedValue(posts)
    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockRejectedValue(
      new Error("post fetch failed"),
    )

    const exporter = new NaverBlogExporter({
      request: {
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      onLog,
      onProgress,
      onItem,
    })

    const manifest = await exporter.run()
    const writtenManifest = JSON.parse(
      await readFile(path.join(outputDir, "manifest.json"), "utf8"),
    ) as typeof manifest

    await expect(readFile(sentinelPath, "utf8")).rejects.toThrow()
    expect(manifest.failureCount).toBe(1)
    expect(manifest.successCount).toBe(0)
    expect(writtenManifest.posts[0]).toMatchObject({
      status: "failed",
      error: "post fetch failed",
      warningCount: 0,
    })
    expect(onItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        markdown: null,
        error: "post fetch failed",
      }),
    )
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 0,
      failed: 1,
      warnings: 0,
    })
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining("출력 디렉터리 초기화 완료"))
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining("collected=1, expected=2"))

    await rm(outputDir, { recursive: true, force: true })
  })
})
