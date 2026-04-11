import { describe, expect, it, vi } from "vitest"

import { AssetStore } from "../src/modules/exporter/asset-store.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

describe("AssetStore", () => {
  it("returns remote references when downloads are disabled", async () => {
    const options = defaultExportOptions()

    options.assets.assetPathMode = "remote"

    const store = new AssetStore({
      outputDir: "/tmp/output",
      downloader: {
        downloadBinary: vi.fn(),
      },
      options,
    })

    const asset = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: "/tmp/output/posts/test.md",
    })

    expect(asset.reference).toBe("https://example.com/image.png")
    expect(asset.relativePath).toBeNull()
    expect(asset.storageMode).toBe("remote")
  })

  it("caches downloaded relative assets", async () => {
    const downloadBinary = vi.fn(async () => {})
    const store = new AssetStore({
      outputDir: "/tmp/output",
      downloader: {
        downloadBinary,
      },
      options: defaultExportOptions(),
    })

    const first = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: "/tmp/output/posts/test.md",
    })
    const second = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: "/tmp/output/posts/test.md",
    })

    expect(downloadBinary).toHaveBeenCalledTimes(1)
    expect(first.reference).toBe(second.reference)
    expect(first.relativePath).toBe("../assets/1/image-01.png")
    expect(first.storageMode).toBe("relative")
  })

  it("embeds data urls when base64 mode is requested", async () => {
    const fetchBinary = vi.fn(async () => ({
      bytes: Buffer.from("binary-image"),
      contentType: "image/png",
    }))
    const store = new AssetStore({
      outputDir: "/tmp/output",
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const asset = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/image.png",
      markdownFilePath: "/tmp/output/posts/test.md",
      embedAsDataUrl: true,
    })

    expect(fetchBinary).toHaveBeenCalledTimes(1)
    expect(asset.reference).toContain("data:image/png;base64,")
    expect(asset.relativePath).toBeNull()
    expect(asset.storageMode).toBe("base64")
  })

  it("reuses cached data urls and infers mime type from the source url", async () => {
    const fetchBinary = vi.fn(async () => ({
      bytes: Buffer.from("gif-image"),
      contentType: null,
    }))
    const store = new AssetStore({
      outputDir: "/tmp/output",
      downloader: {
        downloadBinary: vi.fn(),
        fetchBinary,
      },
      options: defaultExportOptions(),
    })

    const first = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/sticker.gif",
      markdownFilePath: "/tmp/output/posts/test.md",
      embedAsDataUrl: true,
    })
    const second = await store.saveAsset({
      kind: "image",
      postLogNo: "1",
      sourceUrl: "https://example.com/sticker.gif",
      markdownFilePath: "/tmp/output/posts/test.md",
      embedAsDataUrl: true,
    })

    expect(fetchBinary).toHaveBeenCalledTimes(1)
    expect(first.reference).toContain("data:image/gif;base64,")
    expect(second.reference).toBe(first.reference)
  })

  it("throws when base64 embedding is requested without fetchBinary support", async () => {
    const store = new AssetStore({
      outputDir: "/tmp/output",
      downloader: {
        downloadBinary: vi.fn(),
      },
      options: defaultExportOptions(),
    })

    await expect(
      store.saveAsset({
        kind: "image",
        postLogNo: "1",
        sourceUrl: "not-a-url",
        markdownFilePath: "/tmp/output/posts/test.md",
        embedAsDataUrl: true,
      }),
    ).rejects.toThrow("base64 임베딩을 지원하는 fetchBinary downloader가 필요합니다.")
  })
})
