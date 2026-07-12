import { Buffer } from "node:buffer"

import {
  createHtmlFragmentUploadReadyFixture,
  createTestTempDir,
  createUploadReadyFixture,
  defaultExportOptions,
  fs,
  NaverBlogExporter,
  NaverBlogFetcher,
  parallelPosts,
  path,
  postHtml,
  posts,
  readFile,
  rewriteUploadedAssets,
  rm,
  runWithLogSink,
  scanResult,
  sharedLocalPath,
  sharedPublicPath,
  unsupportedSe3Html,
  writeFile,
} from "@tests/support/exporting/NaverBlogExporterHarness.js"
import { afterEach, describe, expect, it, vi } from "vitest"

const unsupportedSe3Error =
  '파싱 가능한 naver-se3 block이 없습니다: div class="se_component se_unknown default"'

describe("NaverBlogExporter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("writes manifest, progress, and running job items for successful exports", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
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
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: (() => {
          const options = defaultExportOptions()
          options.assets.imageHandlingMode = "download"
          return options
        })(),
      },
      onProgress,
      onItem,
    })

    const manifest = await exporter.run()

    expect(manifest.totalPosts).toBe(1)
    expect(manifest.successCount).toBe(1)
    expect(manifest.failureCount).toBe(0)
    expect(manifest.upload.status).toBe("not-requested")
    expect(manifest.upload.candidateCount).toBe(0)
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 1,
      failed: 0,
    })
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({
      status: "success",
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
    expect(writtenManifest.options.blockOutputs.templates.gfm?.["naver-se4:code"]).toBeUndefined()
    expect(writtenManifest.options.blockOutputs.templates.gfm).not.toHaveProperty("code")

    await rm(outputDir, { recursive: true, force: true })
  })

  it("reuses the scanned metadata snapshot instead of fetching the list again", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const scanBlogSpy = vi.spyOn(NaverBlogFetcher.prototype, "scanBlog")
    const getAllPostsSpy = vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts")
    const fetchPostHtmlSpy = vi
      .spyOn(NaverBlogFetcher.prototype, "fetchPostHtml")
      .mockResolvedValue(postHtml)
    const downloadBinarySpy = vi
      .spyOn(NaverBlogFetcher.prototype, "downloadBinary")
      .mockResolvedValue()
    const fetchBinarySpy = vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    })

    const exporter = new NaverBlogExporter({
      request: {
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      cachedScanResult: {
        ...scanResult,
        posts,
      },
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

  it("passes the injected post html cache to the Naver fetcher", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const getPostHtml = vi.fn().mockResolvedValue(postHtml)
    const setPostHtml = vi.fn()
    const onProgress = vi.fn()

    vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
    vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    })

    const exporter = new NaverBlogExporter({
      request: {
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      cachedScanResult: {
        ...scanResult,
        posts,
      },
      fetcherCache: {
        getPostHtml,
        setPostHtml,
      },
      onProgress,
    })

    await exporter.run()

    expect(getPostHtml).toHaveBeenCalledWith({
      sourceId: "mym0404",
      postId: "223034929697",
    })
    expect(setPostHtml).not.toHaveBeenCalled()

    await rm(outputDir, { recursive: true, force: true })
  })

  it("records unsupported representative cases as failed bulk export items", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const onProgress = vi.fn()
    const onItem = vi.fn()
    const options = defaultExportOptions()
    const se3Post = {
      ...posts[0],
      postId: "221290869775",
      title: "대표 미지원 블록 글",
      source: "https://blog.naver.com/sekishin/221290869775",
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
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
          outputDir,
          profile: "gfm",
          options,
        },
        onProgress,
        onItem,
      })

      const manifest = await exporter.run()

      expect(manifest.failureCount).toBe(1)
      expect(manifest.posts[0]).toMatchObject({
        postId: se3Post.postId,
        status: "failed",
        outputPath: null,
        error: unsupportedSe3Error,
      })
      expect(onProgress).toHaveBeenCalledWith({
        total: 1,
        completed: 0,
        failed: 1,
      })
      expect(onItem).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: se3Post.postId,
          status: "failed",
          error: unsupportedSe3Error,
        }),
      )
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("does not create upload candidates for failed unsupported html exports", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const options = defaultExportOptions()
    const se3Post = {
      ...posts[0],
      postId: "221290869775",
      title: "대표 미지원 블록 글",
      source: "https://blog.naver.com/sekishin/221290869775",
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
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
          outputDir,
          profile: "gfm",
          options,
        },
        onProgress: () => {},
        onItem: () => {},
      })

      const manifest = await exporter.run()
      const postManifest = manifest.posts[0]!

      expect(manifest.failureCount).toBe(1)
      expect(manifest.upload.status).toBe("skipped")
      expect(postManifest.status).toBe("failed")
      expect(postManifest.outputPath).toBeNull()
      expect(postManifest.assetPaths).toEqual([])
      expect(postManifest.upload.candidateCount).toBe(0)
      expect(postManifest.upload.candidates).toEqual([])
      expect(postManifest.error).toBe(unsupportedSe3Error)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("keeps manifest and job item order stable while exporting posts in parallel", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const onProgress = vi.fn()
    const onItem = vi.fn()
    let releaseFirstPost!: () => void
    const firstPostGate = new Promise<void>((resolve) => {
      releaseFirstPost = resolve
    })
    const fetchPostHtml = vi.fn(async (requestedPostId: string) => {
      if (requestedPostId === parallelPosts[0]!.postId) {
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
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      cachedScanResult: {
        ...scanResult,
        totalPostCount: parallelPosts.length,
        posts: parallelPosts,
      },
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
    expect(manifest.posts.map((post) => post.postId)).toEqual(
      parallelPosts.map((post) => post.postId),
    )
    expect(onItem.mock.calls.map((call) => call[0].postId)).toEqual(
      parallelPosts.map((post) => post.postId),
    )
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      {
        total: 2,
        completed: 1,
        failed: 0,
      },
      {
        total: 2,
        completed: 2,
        failed: 0,
      },
    ])

    await rm(outputDir, { recursive: true, force: true })
  })

  it("keeps failure and success order stable in mixed parallel exports", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const onProgress = vi.fn()
    const onItem = vi.fn()
    let releaseFirstPost!: () => void
    const firstPostGate = new Promise<void>((resolve) => {
      releaseFirstPost = resolve
    })
    const fetchPostHtml = vi.fn(async (requestedPostId: string) => {
      if (requestedPostId === parallelPosts[0]!.postId) {
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
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      cachedScanResult: {
        ...scanResult,
        totalPostCount: parallelPosts.length,
        posts: parallelPosts,
      },
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
    expect(manifest.posts.map((entry) => entry.postId)).toEqual(
      parallelPosts.map((post) => post.postId),
    )
    expect(onItem.mock.calls.map((call) => call[0].status)).toEqual(["failed", "success"])
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      {
        total: 2,
        completed: 0,
        failed: 1,
      },
      {
        total: 2,
        completed: 1,
        failed: 1,
      },
    ])

    await rm(outputDir, { recursive: true, force: true })
  })

  it("marks download-and-upload exports as upload-ready with local candidate metadata", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
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
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options,
      },
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
    const outputDir = await createTestTempDir("bulk-export-")
    const sentinelPath = path.join(outputDir, "keep.txt")
    await writeFile(sentinelPath, "keep", "utf8")

    vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockRejectedValueOnce(new Error("scan failed"))

    const exporter = new NaverBlogExporter({
      request: {
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      onProgress: () => {},
    })

    await expect(exporter.run()).rejects.toThrow("scan failed")
    expect(await readFile(sentinelPath, "utf8")).toBe("keep")

    await rm(outputDir, { recursive: true, force: true })
  })

  it("keeps existing files, logs count mismatches, and records failed job items", async () => {
    const outputDir = await createTestTempDir("bulk-export-")
    const sentinelPath = path.join(outputDir, "stale.txt")
    const logSink = vi.fn()
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
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "gfm",
        options: defaultExportOptions(),
      },
      onProgress,
      onItem,
    })

    const manifest = await runWithLogSink(logSink, () => exporter.run())
    const writtenManifest = JSON.parse(
      await readFile(path.join(outputDir, "manifest.json"), "utf8"),
    ) as typeof manifest

    expect(await readFile(sentinelPath, "utf8")).toBe("stale")
    expect(manifest.failureCount).toBe(1)
    expect(manifest.successCount).toBe(0)
    expect(writtenManifest.posts[0]).toMatchObject({
      status: "failed",
      error: "post fetch failed",
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
    })
    expect(logSink).toHaveBeenCalledWith(expect.stringContaining("출력 디렉터리 준비 완료"))
    expect(logSink).toHaveBeenCalledWith(expect.stringContaining("collected=1, expected=2"))

    await rm(outputDir, { recursive: true, force: true })
  })

  it("rewrites markdown, frontmatter thumbnail, manifest, and job items from upload results", async () => {
    const outputDir = await createTestTempDir("bulk-export-rewrite-")
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
            blogKey: fixture.manifest.posts[0]!.blogKey,
            sourceId: fixture.manifest.posts[0]!.sourceId,
            postId: fixture.manifest.posts[0]!.postId,
            title: fixture.manifest.posts[0]!.title,
            source: fixture.manifest.posts[0]!.source,
            category: fixture.manifest.posts[0]!.category,
            status: "success",
            outputPath: fixture.manifest.posts[0]!.outputPath,
            assetPaths: fixture.manifest.posts[0]!.assetPaths,
            upload: fixture.manifest.posts[0]!.upload,
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
      expect(writtenManifest.posts[0]?.upload.uploadedUrls).toEqual([
        "https://cdn.example.com/shared.png",
      ])
      expect(writtenManifest.posts[0]).not.toHaveProperty("externalPreviewUrl")
      expect(rewritten.items[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
      expect(rewritten.items[0]?.upload.uploadedUrls).toEqual([
        "https://cdn.example.com/shared.png",
      ])
      expect(rewritten.items[0]).not.toHaveProperty("externalPreviewUrl")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rewrites html-fragment image references in markdown and manifest from upload results", async () => {
    const outputDir = await createTestTempDir("bulk-export-rewrite-")
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
      expect(writtenManifest.posts[0]?.upload.uploadedUrls).toEqual([
        "https://cdn.example.com/shared.png",
      ])
      expect(rewritten.items[0]?.assetPaths).toEqual(["https://cdn.example.com/shared.png"])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rejects non-http(s) upload URLs before rewrite and keeps originals untouched", async () => {
    const outputDir = await createTestTempDir("bulk-export-rewrite-")
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
        JSON.parse(
          await readFile(path.join(outputDir, "manifest.json"), "utf8"),
        ) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("rejects secret-bearing upload URLs before rewrite and keeps originals untouched", async () => {
    const outputDir = await createTestTempDir("bulk-export-rewrite-")
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
        JSON.parse(
          await readFile(path.join(outputDir, "manifest.json"), "utf8"),
        ) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("keeps already rewritten markdown when the manifest snapshot rename fails", async () => {
    const outputDir = await createTestTempDir("bulk-export-rewrite-")
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
        JSON.parse(
          await readFile(path.join(outputDir, "manifest.json"), "utf8"),
        ) as typeof fixture.manifest,
      ).toEqual(fixture.manifest)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
