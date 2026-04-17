import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import * as fs from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../src/modules/exporter/naver-blog-exporter.js"
import { rewriteUploadedAssets } from "../src/modules/exporter/picgo-upload-rewriter.js"
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

const createUploadReadyFixture = ({
  outputDir,
}: {
  outputDir: string
}) => {
  const outputPath = "PS-알고리즘-팁/2023-03-04-테스트-글/index.md"
  const markdown = `---
title: 테스트 글
thumbnail: thumbnail-01.png
assetPaths:
  - thumbnail-01.png
  - image-01.png
---

![diagram](image-01.png)
`

  return {
    markdown,
    markdownPath: path.join(outputDir, outputPath),
    manifest: {
      blogId: "mym0404",
      profile: "gfm" as const,
      options: defaultExportOptions(),
      selectedCategoryIds: [],
      startedAt: "2026-04-17T04:00:00.000Z",
      finishedAt: "2026-04-17T04:00:01.000Z",
      totalPosts: 1,
      successCount: 1,
      failureCount: 0,
      warningCount: 0,
      upload: {
        status: "upload-ready" as const,
        eligiblePostCount: 1,
        candidateCount: 2,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      categories: scanResult.categories,
      posts: [
        {
          logNo: posts[0].logNo,
          title: posts[0].title,
          source: posts[0].source,
          category: {
            id: scanResult.categories[0]!.id,
            name: scanResult.categories[0]!.name,
            path: scanResult.categories[0]!.path,
          },
          editorVersion: 4 as const,
          status: "success" as const,
          outputPath,
          assetPaths: ["thumbnail-01.png", "image-01.png"],
          upload: {
            eligible: true,
            candidateCount: 2,
            uploadedCount: 0,
            failedCount: 0,
            candidates: [
              {
                kind: "thumbnail" as const,
                sourceUrl: "https://example.com/thumb.png",
                localPath: "PS-알고리즘-팁/2023-03-04-테스트-글/thumbnail-01.png",
                markdownReference: "thumbnail-01.png",
              },
              {
                kind: "image" as const,
                sourceUrl: "https://example.com/image.png",
                localPath: "PS-알고리즘-팁/2023-03-04-테스트-글/image-01.png",
                markdownReference: "image-01.png",
              },
            ],
          },
          warnings: [],
          warningCount: 0,
          error: null,
        },
      ],
    },
  }
}

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
    expect(manifest.upload.status).toBe("not-requested")
    expect(manifest.upload.candidateCount).toBe(0)
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
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
      },
    })

    const manifestPath = path.join(outputDir, "manifest.json")
    const writtenManifest = JSON.parse(await readFile(manifestPath, "utf8")) as typeof manifest

    expect(writtenManifest.successCount).toBe(1)
    expect(writtenManifest.posts[0]?.outputPath).toMatch(/index\.md$/)
    expect(writtenManifest.posts[0]?.upload.candidateCount).toBe(0)

    await rm(outputDir, { recursive: true, force: true })
  })

  it("marks download-and-upload exports as upload-ready with local candidate metadata", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const onItem = vi.fn()
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

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
        options,
      },
      onLog: () => {},
      onProgress: () => {},
      onItem,
    })

    const manifest = await exporter.run()

    expect(manifest.upload.status).toBe("upload-ready")
    expect(manifest.upload.eligiblePostCount).toBe(1)
    expect(manifest.upload.candidateCount).toBeGreaterThan(0)
    expect(manifest.posts[0]?.upload).toMatchObject({
      eligible: true,
      candidateCount: expect.any(Number),
      uploadedCount: 0,
      failedCount: 0,
    })
    expect(manifest.posts[0]?.upload.candidates[0]).toMatchObject({
      kind: expect.stringMatching(/image|thumbnail/),
      sourceUrl: expect.stringContaining("https://example.com/"),
      localPath: expect.stringContaining("2023-03-04-테스트-글/"),
      markdownReference: expect.stringMatching(/^(thumbnail|image)-\d{2}\.png$/),
    })
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({
      upload: {
        eligible: true,
        candidateCount: expect.any(Number),
        uploadedCount: 0,
        failedCount: 0,
        candidates: expect.any(Array),
      },
    })

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
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
      },
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

  it("rewrites markdown, frontmatter thumbnail, manifest, and job items from upload results", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-rewrite-"))
    const fixture = createUploadReadyFixture({
      outputDir,
    })

    try {
      await fs.mkdir(path.dirname(fixture.markdownPath), { recursive: true })
      await writeFile(fixture.markdownPath, fixture.markdown, "utf8")
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(fixture.manifest, null, 2),
        "utf8",
      )

      const rewritten = await rewriteUploadedAssets({
        outputDir,
        manifest: fixture.manifest,
        items: [
          {
            id: fixture.manifest.posts[0]!.outputPath!,
            logNo: fixture.manifest.posts[0]!.logNo,
            title: fixture.manifest.posts[0]!.title,
            source: fixture.manifest.posts[0]!.source,
            category: fixture.manifest.posts[0]!.category,
            status: "success",
            outputPath: fixture.manifest.posts[0]!.outputPath,
            assetPaths: fixture.manifest.posts[0]!.assetPaths,
            upload: fixture.manifest.posts[0]!.upload,
            warnings: [],
            warningCount: 0,
            error: null,
            markdown: fixture.markdown,
            updatedAt: "2026-04-17T04:00:01.000Z",
          },
        ],
        uploadResults: [
          {
            candidate: fixture.manifest.posts[0]!.upload.candidates[0]!,
            uploadedUrl: "https://cdn.example.com/thumbnail-01.png",
          },
          {
            candidate: fixture.manifest.posts[0]!.upload.candidates[1]!,
            uploadedUrl: "https://cdn.example.com/image-01.png",
          },
        ],
      })

      const rewrittenMarkdown = await readFile(fixture.markdownPath, "utf8")
      const writtenManifest = JSON.parse(
        await readFile(path.join(outputDir, "manifest.json"), "utf8"),
      ) as typeof rewritten.manifest

      expect(rewrittenMarkdown).toContain("thumbnail: https://cdn.example.com/thumbnail-01.png")
      expect(rewrittenMarkdown).toContain("https://cdn.example.com/image-01.png")
      expect(writtenManifest.upload.status).toBe("upload-completed")
      expect(writtenManifest.posts[0]?.assetPaths).toEqual([
        "https://cdn.example.com/thumbnail-01.png",
        "https://cdn.example.com/image-01.png",
      ])
      expect(rewritten.items[0]?.assetPaths).toEqual([
        "https://cdn.example.com/thumbnail-01.png",
        "https://cdn.example.com/image-01.png",
      ])
      expect(rewritten.items[0]?.markdown).toContain("https://cdn.example.com/image-01.png")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rejects non-http(s) upload URLs before rewrite and keeps originals untouched", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-rewrite-"))
    const fixture = createUploadReadyFixture({
      outputDir,
    })

    try {
      await fs.mkdir(path.dirname(fixture.markdownPath), { recursive: true })
      await writeFile(fixture.markdownPath, fixture.markdown, "utf8")
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(fixture.manifest, null, 2),
        "utf8",
      )

      await expect(
        rewriteUploadedAssets({
          outputDir,
          manifest: fixture.manifest,
          items: [],
          uploadResults: [
            {
              candidate: fixture.manifest.posts[0]!.upload.candidates[0]!,
              uploadedUrl: "ftp://cdn.example.com/thumbnail-01.png",
            },
            {
              candidate: fixture.manifest.posts[0]!.upload.candidates[1]!,
              uploadedUrl: "https://cdn.example.com/image-01.png",
            },
          ],
        }),
      ).rejects.toThrow("absolute http(s) URL")

      expect(await readFile(fixture.markdownPath, "utf8")).toBe(fixture.markdown)
      expect(
        JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rolls back staged temp swaps when a final rename fails", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-rewrite-"))
    const fixture = createUploadReadyFixture({
      outputDir,
    })
    let manifestRenameBlocked = false

    try {
      await fs.mkdir(path.dirname(fixture.markdownPath), { recursive: true })
      await writeFile(fixture.markdownPath, fixture.markdown, "utf8")
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(fixture.manifest, null, 2),
        "utf8",
      )

      await expect(
        rewriteUploadedAssets({
          outputDir,
          manifest: fixture.manifest,
          items: [],
          uploadResults: [
            {
              candidate: fixture.manifest.posts[0]!.upload.candidates[0]!,
              uploadedUrl: "https://cdn.example.com/thumbnail-01.png",
            },
            {
              candidate: fixture.manifest.posts[0]!.upload.candidates[1]!,
              uploadedUrl: "https://cdn.example.com/image-01.png",
            },
          ],
          fileOps: {
            readFile: fs.readFile,
            writeFile: fs.writeFile,
            rm: fs.rm,
            rename: async (from, to) => {
              if (
                typeof from === "string" &&
                from.endsWith(".tmp") &&
                typeof to === "string" &&
                to.endsWith("manifest.json") &&
                !manifestRenameBlocked
              ) {
                manifestRenameBlocked = true
                throw new Error("rename failed")
              }

              return fs.rename(from, to)
            },
          },
        }),
      ).rejects.toThrow("rename failed")

      expect(await readFile(fixture.markdownPath, "utf8")).toBe(fixture.markdown)
      expect(
        JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
