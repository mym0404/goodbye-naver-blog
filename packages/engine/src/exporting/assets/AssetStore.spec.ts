import { createHash } from "node:crypto"

import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { createTestPath } from "@tests/support/test-paths.js"
import { describe, expect, it, vi } from "vitest"

import { AssetStore } from "./AssetStore.js"

const testOutputDir = createTestPath("asset-store", "output")

describe("AssetStore", () => {
  it("returns remote references when downloads are disabled", async () => {
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "remote"

    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
      },
      options,
    })

    const asset = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/test/index.md`,
    })

    expect(asset.reference).toBe("https://example.com/image.png")
    expect(asset.relativePath).toBeNull()
    expect(asset.storageMode).toBe("remote")
    expect(asset.uploadCandidate).toBeNull()
  })

  it("caches downloaded relative assets", async () => {
    const fetchBinary = vi.fn(async () => ({
      bytes: Buffer.from("image-bytes"),
      contentType: "image/png",
    }))
    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const first = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/test/index.md`,
    })
    const second = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/test/index.md`,
    })

    const expectedHash = createHash("sha256").update("image-bytes").digest("hex")

    expect(fetchBinary).toHaveBeenCalledTimes(1)
    expect(first.reference).toBe(second.reference)
    expect(first.relativePath).toBe(`../../public/${expectedHash}.png`)
    expect(first.storageMode).toBe("relative")
    expect(first.uploadCandidate).toEqual({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      localPath: `public/${expectedHash}.png`,
      markdownReference: `../../public/${expectedHash}.png`,
    })
  })

  it("writes assets under the selected adapter root", async () => {
    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary: vi.fn(async () => ({
          bytes: Buffer.from("docusaurus-image"),
          contentType: "image/png",
        })),
      },
      options: defaultExportOptions(),
      assetRootSegments: ["static"],
      formatReference: (relativePath) => `/${relativePath.split("/").at(-1)}`,
    })

    const asset = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/docusaurus.png",
      markdownFilePath: `${testOutputDir}/docs/test/index.mdx`,
    })
    const expectedHash = createHash("sha256").update("docusaurus-image").digest("hex")

    expect(asset.reference).toBe(`/${expectedHash}.png`)
    expect(asset.relativePath).toBe(`../../static/${expectedHash}.png`)
    expect(asset.uploadCandidate?.localPath).toBe(`static/${expectedHash}.png`)
  })

  it("reuses one public asset for different posts when the binary bytes match", async () => {
    const fetchBinary = vi
      .fn()
      .mockResolvedValueOnce({
        bytes: Buffer.from("same-bytes"),
        contentType: "image/png",
      })
      .mockResolvedValueOnce({
        bytes: Buffer.from("same-bytes"),
        contentType: "image/jpeg",
      })
    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const first = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/first/index.md`,
    })
    const second = await store.saveAsset({
      kind: "thumbnail",
      sourceUrl: "https://cdn.example.com/thumb.jpg",
      markdownFilePath: `${testOutputDir}/posts/second/index.md`,
    })

    const expectedHash = createHash("sha256").update("same-bytes").digest("hex")

    expect(first.relativePath).toBe(`../../public/${expectedHash}.png`)
    expect(second.relativePath).toBe(`../../public/${expectedHash}.png`)
    expect(first.uploadCandidate?.localPath).toBe(`public/${expectedHash}.png`)
    expect(second.uploadCandidate?.localPath).toBe(`public/${expectedHash}.png`)
  })

  it("dedupes in-flight local downloads for the same source url", async () => {
    let releaseFetch!: () => void
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
    const fetchBinary = vi.fn(async () => {
      await fetchGate

      return {
        bytes: Buffer.from("shared-image"),
        contentType: "image/png",
      }
    })
    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const firstPromise = store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/first/index.md`,
    })
    const secondPromise = store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/second/index.md`,
    })

    await Promise.resolve()
    expect(fetchBinary).toHaveBeenCalledTimes(1)

    releaseFetch()

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    const expectedHash = createHash("sha256").update("shared-image").digest("hex")

    expect(first.relativePath).toBe(`../../public/${expectedHash}.png`)
    expect(second.relativePath).toBe(`../../public/${expectedHash}.png`)
    expect(first.uploadCandidate?.localPath).toBe(`public/${expectedHash}.png`)
    expect(second.uploadCandidate?.localPath).toBe(`public/${expectedHash}.png`)
  })

  it("clears in-flight cache after a failed shared download and allows retry", async () => {
    let releaseFetch!: () => void
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
    const fetchBinary = vi
      .fn<() => Promise<{ bytes: Buffer; contentType: string | null }>>()
      .mockImplementationOnce(async () => {
        await fetchGate
        throw new Error("temporary failure")
      })
      .mockResolvedValueOnce({
        bytes: Buffer.from("recovered-image"),
        contentType: "image/png",
      })
    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const firstPromise = store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/first/index.md`,
    })
    const secondPromise = store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/second/index.md`,
    })

    await Promise.resolve()
    expect(fetchBinary).toHaveBeenCalledTimes(1)

    releaseFetch()

    await expect(firstPromise).rejects.toThrow("temporary failure")
    await expect(secondPromise).rejects.toThrow("temporary failure")

    const recovered = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/recovered/index.md`,
    })
    const expectedHash = createHash("sha256").update("recovered-image").digest("hex")

    expect(fetchBinary).toHaveBeenCalledTimes(2)
    expect(recovered.relativePath).toBe(`../../public/${expectedHash}.png`)
  })

  it("uses fetchBinary plus compression for safe local image formats", async () => {
    const downloadBinary = vi.fn()
    const fetchBinary = vi.fn(async () => ({
      bytes: Buffer.from("raw-image"),
      contentType: "image/png",
    }))
    const compressImage = vi.fn(async () => Buffer.from("compressed-image"))
    const options = defaultExportOptions()

    options.assets.compressionEnabled = true

    const store = new AssetStore({
      outputDir: testOutputDir,
      downloader: {
        downloadBinary,
        fetchBinary,
      },
      options,
      compressImage,
    })

    const asset = await store.saveAsset({
      kind: "image",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: `${testOutputDir}/posts/test/index.md`,
    })

    expect(fetchBinary).toHaveBeenCalledTimes(1)
    expect(downloadBinary).not.toHaveBeenCalled()
    expect(compressImage).toHaveBeenCalledTimes(1)
    expect(asset.uploadCandidate?.localPath).toMatch(/^public\/[a-f0-9]{64}\.png$/)
  })
})
