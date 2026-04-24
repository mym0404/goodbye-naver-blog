import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import * as fs from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { NaverBlogExporter } from "../src/modules/exporter/naver-blog-exporter.js"
import { rewriteUploadedAssets } from "../src/modules/exporter/image-upload-rewriter.js"
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

const parallelPosts = [
  posts[0],
  {
    ...posts[0],
    logNo: "223034929698",
    title: "두번째 글",
    source: "https://blog.naver.com/mym0404/223034929698",
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

const unsupportedSe3Html = `
  <div id="viewTypeSelector">
    <div class="se_component_wrap sect_dsc">
      <div class="se_component se_text">
        <div class="se_textarea">본문 시작입니다.</div>
      </div>
      <div class="se_component se_horizontalLine default">
        <div class="se_horizontalLineView">
          <div class="se_hr"><hr></div>
        </div>
      </div>
      <div class="se_component se_horizontalLine line5">
        <div class="se_horizontalLineView">
          <div class="se_hr"><hr></div>
        </div>
      </div>
      <div class="se_component se_oglink og_bSize ">
        <div class="se_viewArea se_og_wrap">
          <a class="se_og_box" href="https://blog.naver.com/is02019/221072284462" target="_blank">
            <div class="se_og_thumb">
              <img src="https://dthumb-phinf.pstatic.net/sample.jpg?type=ff500_300" alt="">
            </div>
            <div class="se_og_txt">
              <div class="se_og_tit">비타는 삶이다</div>
              <div class="se_og_desc">PS Vita 리뷰</div>
              <div class="se_og_cp">blog.naver.com</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
`

const sharedAssetHash = createHash("sha256").update("image").digest("hex")
const sharedPublicPath = `../../public/${sharedAssetHash}.png`
const sharedLocalPath = `public/${sharedAssetHash}.png`

const createUploadReadyFixture = ({
  outputDir,
}: {
  outputDir: string
}) => {
  const outputPath = "PS-알고리즘-팁/2023-03-04-테스트-글/index.md"
  const markdown = `---
title: 테스트 글
thumbnail: ${sharedPublicPath}
assetPaths:
  - ${sharedPublicPath}
---

![diagram](${sharedPublicPath})
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
        candidateCount: 1,
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
          assetPaths: [sharedPublicPath],
          upload: {
            eligible: true,
            candidateCount: 1,
            uploadedCount: 0,
            failedCount: 0,
            candidates: [
              {
                kind: "thumbnail" as const,
                sourceUrl: "https://example.com/thumb.png",
                localPath: sharedLocalPath,
                markdownReference: sharedPublicPath,
              },
            ],
            uploadedUrls: [],
            rewriteStatus: "pending" as const,
            rewrittenAt: null,
          },
          warnings: [],
          warningCount: 0,
          error: null,
        },
      ],
    },
  }
}

const createHtmlFragmentUploadReadyFixture = ({
  outputDir,
}: {
  outputDir: string
}) => {
  const outputPath = "PS-알고리즘-팁/2023-03-04-테스트-글/index.md"
  const markdown = `<a data-naver-block="se3-oglink" data-size="og_bSize" href="https://blog.naver.com/is02019/221072284462">
  <img src="${sharedPublicPath}" alt="">
  <strong>비타는 삶이다</strong>
</a>
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
        candidateCount: 1,
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
          editorVersion: 3 as const,
          status: "success" as const,
          outputPath,
          assetPaths: [sharedPublicPath],
          upload: {
            eligible: true,
            candidateCount: 1,
            uploadedCount: 0,
            failedCount: 0,
            candidates: [
              {
                kind: "image" as const,
                sourceUrl: "https://dthumb-phinf.pstatic.net/sample.jpg?type=ff500_300",
                localPath: sharedLocalPath,
                markdownReference: sharedPublicPath,
              },
            ],
            uploadedUrls: [],
            rewriteStatus: "pending" as const,
            rewrittenAt: null,
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
        options: (() => {
          const options = defaultExportOptions()
          options.assets.imageHandlingMode = "download"
          return options
        })(),
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
	      warningCount: expect.any(Number),
	      upload: {
	        eligible: false,
	        candidateCount: 0,
	        uploadedCount: 0,
	        failedCount: 0,
	        candidates: [],
	      },
	    })
	    expect(onItem.mock.calls[0]?.[0]).not.toHaveProperty("externalPreviewUrl")

    const manifestPath = path.join(outputDir, "manifest.json")
    const writtenManifest = JSON.parse(await readFile(manifestPath, "utf8")) as typeof manifest

	    expect(writtenManifest.successCount).toBe(1)
	    expect(writtenManifest.posts[0]?.outputPath).toMatch(/index\.md$/)
	    expect(writtenManifest.posts[0]?.upload.candidateCount).toBe(0)
	    expect(writtenManifest.posts[0]).not.toHaveProperty("externalPreviewUrl")

    await rm(outputDir, { recursive: true, force: true })
  })

  it("reuses the scanned metadata snapshot instead of fetching the list again", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const scanBlogSpy = vi.spyOn(NaverBlogFetcher.prototype, "scanBlog")
    const getAllPostsSpy = vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts")
    const fetchPostHtmlSpy = vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockResolvedValue(postHtml)
    const downloadBinarySpy = vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    const fetchBinarySpy = vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
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
      cachedScanResult: {
        ...scanResult,
        posts,
      },
      onLog: () => {},
      onProgress: () => {},
      onItem: () => {},
    })

    const manifest = await exporter.run()

    expect(manifest.totalPosts).toBe(1)
    expect(scanBlogSpy).not.toHaveBeenCalled()
    expect(getAllPostsSpy).not.toHaveBeenCalled()
    expect(fetchPostHtmlSpy).toHaveBeenCalledTimes(1)
    expect(downloadBinarySpy).not.toHaveBeenCalled()
    expect(fetchBinarySpy).toHaveBeenCalled()

    await rm(outputDir, { recursive: true, force: true })
  })

  it("renders normalized unsupported representative cases as fallback html with warnings in bulk exports", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const onProgress = vi.fn()
    const onItem = vi.fn()
    const options = defaultExportOptions()
    const se3Post = {
      ...posts[0],
      logNo: "221290869775",
      title: "대표 미지원 블록 글",
      source: "https://blog.naver.com/sekishin/221290869775",
      editorVersion: 3 as const,
      thumbnailUrl: null,
    }

    options.frontmatter.enabled = false
    options.assets.imageHandlingMode = "download"

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue(scanResult)
    vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts").mockResolvedValue([se3Post])
    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockResolvedValue(unsupportedSe3Html)
    vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    })

    try {
      const exporter = new NaverBlogExporter({
        request: {
          blogIdOrUrl: "https://blog.naver.com/mym0404",
          outputDir,
          profile: "gfm",
          options,
        },
        onLog: () => {},
        onProgress,
        onItem,
      })

      const manifest = await exporter.run()
      const markdownPath = path.join(outputDir, manifest.posts[0]!.outputPath!)
      const writtenMarkdown = await readFile(markdownPath, "utf8")

      expect(manifest.warningCount).toBe(4)
      expect(manifest.posts[0]).toMatchObject({
        logNo: se3Post.logNo,
        editorVersion: 3,
        warnings: [
          "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_horizontalLine default",
          "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_horizontalLine line5",
          "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_oglink og_bSize ",
          "fallback HTML 블록 3개가 포함됩니다.",
        ],
        warningCount: 4,
      })
      expect(onProgress).toHaveBeenCalledWith({
        total: 1,
        completed: 1,
        failed: 0,
        warnings: 4,
      })
      expect(onItem).toHaveBeenCalledWith(
        expect.objectContaining({
          logNo: se3Post.logNo,
          warnings: [
            "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_horizontalLine default",
            "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_horizontalLine line5",
            "SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_oglink og_bSize ",
            "fallback HTML 블록 3개가 포함됩니다.",
          ],
          warningCount: 4,
        }),
      )
      expect(writtenMarkdown).toContain("본문 시작입니다.")
      expect(writtenMarkdown).toContain("se_component se_horizontalLine default")
      expect(writtenMarkdown).toContain("se_component se_horizontalLine line5")
      expect(writtenMarkdown).toContain("se_component se_oglink og_bSize")
      expect(writtenMarkdown).toContain("비타는 삶이다")
      expect(writtenMarkdown).toContain("## Export Diagnostics")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("keeps normalized unsupported html fragments literal without upload candidates", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const options = defaultExportOptions()
    const se3Post = {
      ...posts[0],
      logNo: "221290869775",
      title: "대표 미지원 블록 글",
      source: "https://blog.naver.com/sekishin/221290869775",
      editorVersion: 3 as const,
      thumbnailUrl: null,
    }

    options.frontmatter.enabled = false
    options.assets.imageHandlingMode = "download-and-upload"

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue(scanResult)
    vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts").mockResolvedValue([se3Post])
    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockResolvedValue(unsupportedSe3Html)
    vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    })

    try {
      const exporter = new NaverBlogExporter({
        request: {
          blogIdOrUrl: "https://blog.naver.com/mym0404",
          outputDir,
          profile: "gfm",
          options,
        },
        onLog: () => {},
        onProgress: () => {},
        onItem: () => {},
      })

      const manifest = await exporter.run()
      const postManifest = manifest.posts[0]!
      const markdownPath = path.join(outputDir, postManifest.outputPath!)
      const writtenMarkdown = await readFile(markdownPath, "utf8")

      expect(manifest.warningCount).toBe(4)
      expect(postManifest.assetPaths).toEqual([])
      expect(postManifest.upload.candidateCount).toBe(0)
      expect(postManifest.upload.candidates).toEqual([])
      expect(writtenMarkdown).toContain('<img src="https://dthumb-phinf.pstatic.net/sample.jpg?type=ff500_300" alt="">')
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("keeps manifest and job item order stable while exporting posts in parallel", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const onProgress = vi.fn()
    const onItem = vi.fn()
    let releaseFirstPost!: () => void
    const firstPostGate = new Promise<void>((resolve) => {
      releaseFirstPost = resolve
    })
    const fetchPostHtml = vi.fn(async (requestedLogNo: string) => {
      if (requestedLogNo === parallelPosts[0]!.logNo) {
        await firstPostGate
      }

      return postHtml
    })
    const fetchBinary = vi.fn(async () => ({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    }))

    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockImplementation(fetchPostHtml)
    vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockImplementation(fetchBinary)

    const exporter = new NaverBlogExporter({
      request: {
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      cachedScanResult: {
        ...scanResult,
        totalPostCount: parallelPosts.length,
        posts: parallelPosts,
      },
      onLog: () => {},
      onProgress,
      onItem,
    })

    const manifestPromise = exporter.run()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (fetchPostHtml.mock.calls.length === 2) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    expect(fetchPostHtml).toHaveBeenCalledTimes(2)

    releaseFirstPost()

    const manifest = await manifestPromise

    expect(fetchBinary).toHaveBeenCalledTimes(2)
    expect(manifest.posts.map((post) => post.logNo)).toEqual(parallelPosts.map((post) => post.logNo))
    expect(onItem.mock.calls.map((call) => call[0].logNo)).toEqual(
      parallelPosts.map((post) => post.logNo),
    )
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      {
        total: 2,
        completed: 1,
        failed: 0,
        warnings: manifest.posts[0]!.warningCount,
      },
      {
        total: 2,
        completed: 2,
        failed: 0,
        warnings: manifest.warningCount,
      },
    ])

    await rm(outputDir, { recursive: true, force: true })
  })

  it("keeps failure and success order stable in mixed parallel exports", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-"))
    const onProgress = vi.fn()
    const onItem = vi.fn()
    let releaseFirstPost!: () => void
    const firstPostGate = new Promise<void>((resolve) => {
      releaseFirstPost = resolve
    })
    const fetchPostHtml = vi.fn(async (requestedLogNo: string) => {
      if (requestedLogNo === parallelPosts[0]!.logNo) {
        await firstPostGate
        throw new Error("first post failed")
      }

      return postHtml
    })

    vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockImplementation(fetchPostHtml)
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
      cachedScanResult: {
        ...scanResult,
        totalPostCount: parallelPosts.length,
        posts: parallelPosts,
      },
      onLog: () => {},
      onProgress,
      onItem,
    })

    const manifestPromise = exporter.run()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (fetchPostHtml.mock.calls.length === 2) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    expect(fetchPostHtml).toHaveBeenCalledTimes(2)

    releaseFirstPost()

    const manifest = await manifestPromise

    expect(manifest.failureCount).toBe(1)
    expect(manifest.successCount).toBe(1)
    expect(manifest.posts.map((entry) => entry.status)).toEqual(["failed", "success"])
    expect(manifest.posts.map((entry) => entry.logNo)).toEqual(parallelPosts.map((post) => post.logNo))
    expect(onItem.mock.calls.map((call) => call[0].status)).toEqual(["failed", "success"])
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      {
        total: 2,
        completed: 0,
        failed: 1,
        warnings: 0,
      },
      {
        total: 2,
        completed: 1,
        failed: 1,
        warnings: manifest.warningCount,
      },
    ])

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
    expect(manifest.upload.candidateCount).toBe(1)
    expect(manifest.posts[0]?.upload).toMatchObject({
      eligible: true,
      candidateCount: 1,
      uploadedCount: 0,
      failedCount: 0,
    })
    expect(manifest.posts[0]?.upload.candidates[0]).toMatchObject({
      kind: expect.stringMatching(/image|thumbnail/),
      sourceUrl: expect.stringContaining("https://example.com/"),
      localPath: sharedLocalPath,
      markdownReference: sharedPublicPath,
    })
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({
      upload: {
        eligible: true,
        candidateCount: 1,
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

  it("keeps existing files, logs count mismatches, and records failed job items", async () => {
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

    expect(await readFile(sentinelPath, "utf8")).toBe("stale")
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
        rewriteStatus: "pending" as const,
        rewrittenAt: null,
      },
    })
    expect(onItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "post fetch failed",
      }),
    )
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 0,
      failed: 1,
      warnings: 0,
    })
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining("출력 디렉터리 준비 완료"))
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
            updatedAt: "2026-04-17T04:00:01.000Z",
          },
        ],
        uploadResults: [
          {
            candidate: fixture.manifest.posts[0]!.upload.candidates[0]!,
            uploadedUrl: "https://cdn.example.com/shared.png",
          },
        ],
      })

      const rewrittenMarkdown = await readFile(fixture.markdownPath, "utf8")
	      const writtenManifest = JSON.parse(
	        await readFile(path.join(outputDir, "manifest.json"), "utf8"),
	      ) as typeof rewritten.manifest

	      expect(rewrittenMarkdown).toContain("thumbnail: https://cdn.example.com/shared.png")
	      expect(rewrittenMarkdown).toContain("https://cdn.example.com/shared.png")
	      expect(writtenManifest.upload.status).toBe("upload-completed")
	      expect(writtenManifest.posts[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
	      expect(writtenManifest.posts[0]?.upload.uploadedUrls).toEqual(["https://cdn.example.com/shared.png"])
	      expect(writtenManifest.posts[0]).not.toHaveProperty("externalPreviewUrl")
	      expect(rewritten.items[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
	      expect(rewritten.items[0]?.upload.uploadedUrls).toEqual(["https://cdn.example.com/shared.png"])
	      expect(rewritten.items[0]).not.toHaveProperty("externalPreviewUrl")
	    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rewrites html-fragment image references in markdown and manifest from upload results", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "bulk-export-rewrite-"))
    const fixture = createHtmlFragmentUploadReadyFixture({
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
        items: [],
        uploadResults: [
          {
            candidate: fixture.manifest.posts[0]!.upload.candidates[0]!,
            uploadedUrl: "https://cdn.example.com/shared.png",
          },
        ],
      })

      const rewrittenMarkdown = await readFile(fixture.markdownPath, "utf8")
      const writtenManifest = JSON.parse(
        await readFile(path.join(outputDir, "manifest.json"), "utf8"),
      ) as typeof rewritten.manifest

      expect(rewrittenMarkdown).toContain('<img src="https://cdn.example.com/shared.png" alt="">')
      expect(writtenManifest.posts[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
      expect(writtenManifest.posts[0]?.upload.uploadedUrls).toEqual(["https://cdn.example.com/shared.png"])
      expect(rewritten.items[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
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
              uploadedUrl: "ftp://cdn.example.com/shared.png",
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

  it("rejects secret-bearing upload URLs before rewrite and keeps originals untouched", async () => {
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
              uploadedUrl: "https://cdn.example.com/shared.png?X-Amz-Signature=secret",
            },
          ],
        }),
      ).rejects.toThrow("signed or secret-bearing query params")

      expect(await readFile(fixture.markdownPath, "utf8")).toBe(fixture.markdown)
      expect(
        JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("keeps already rewritten markdown when the manifest snapshot rename fails", async () => {
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
              uploadedUrl: "https://cdn.example.com/shared.png",
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

      expect(await readFile(fixture.markdownPath, "utf8")).toContain(
        "https://cdn.example.com/shared.png",
      )
      expect(
        JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
