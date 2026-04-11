import path from "node:path"

import type { AssetRecord, ExportOptions } from "../../shared/types.js"
import { normalizeAssetUrl, relativePathFrom } from "../../shared/utils.js"

type AssetBinary = {
  bytes: Buffer
  contentType: string | null
}

type AssetDownloader = {
  downloadBinary: (input: {
    sourceUrl: string
    destinationPath: string
  }) => Promise<void>
  fetchBinary?: (input: {
    sourceUrl: string
  }) => Promise<AssetBinary>
}

const extensionFromUrl = (value: string) => {
  try {
    const url = new URL(value)
    const extension = path.extname(url.pathname)

    return extension || ".jpg"
  } catch {
    return ".jpg"
  }
}

const inferMimeType = (value: string) => {
  const extension = extensionFromUrl(value).toLowerCase()

  if (extension === ".png") {
    return "image/png"
  }

  if (extension === ".gif") {
    return "image/gif"
  }

  if (extension === ".webp") {
    return "image/webp"
  }

  if (extension === ".svg") {
    return "image/svg+xml"
  }

  return "image/jpeg"
}

export class AssetStore {
  readonly outputDir: string
  readonly downloader: AssetDownloader
  readonly options: Pick<ExportOptions, "assets" | "structure">
  readonly cache = new Map<string, string>()
  readonly dataUrlCache = new Map<string, string>()
  readonly counters = new Map<string, number>()

  constructor({
    outputDir,
    downloader,
    options,
  }: {
    outputDir: string
    downloader: AssetDownloader
    options: Pick<ExportOptions, "assets" | "structure">
  }) {
    this.outputDir = outputDir
    this.downloader = downloader
    this.options = options
  }

  async saveAsset({
    kind,
    postLogNo,
    sourceUrl,
    markdownFilePath,
    embedAsDataUrl,
  }: {
    kind: "image" | "thumbnail"
    postLogNo: string
    sourceUrl: string
    markdownFilePath: string
    embedAsDataUrl?: boolean
  }) {
    const normalizedSourceUrl = normalizeAssetUrl(sourceUrl)

    if (embedAsDataUrl) {
      const cacheKey = `${postLogNo}:${kind}:base64:${normalizedSourceUrl}`
      const cachedDataUrl = this.dataUrlCache.get(cacheKey)

      if (cachedDataUrl) {
        return {
          kind,
          sourceUrl: normalizedSourceUrl,
          reference: cachedDataUrl,
          relativePath: null,
          storageMode: "base64",
        } satisfies AssetRecord
      }

      if (!this.downloader.fetchBinary) {
        throw new Error("base64 임베딩을 지원하는 fetchBinary downloader가 필요합니다.")
      }

      const binary = await this.downloader.fetchBinary({
        sourceUrl: normalizedSourceUrl,
      })
      const mimeType = binary.contentType || inferMimeType(normalizedSourceUrl)
      const dataUrl = `data:${mimeType};base64,${binary.bytes.toString("base64")}`

      this.dataUrlCache.set(cacheKey, dataUrl)

      return {
        kind,
        sourceUrl: normalizedSourceUrl,
        reference: dataUrl,
        relativePath: null,
        storageMode: "base64",
      } satisfies AssetRecord
    }

    const shouldDownload =
      this.options.assets.assetPathMode === "relative" &&
      ((kind === "image" && this.options.assets.downloadImages) ||
        (kind === "thumbnail" && this.options.assets.downloadThumbnails))

    if (!shouldDownload) {
      return {
        kind,
        sourceUrl: normalizedSourceUrl,
        reference: normalizedSourceUrl,
        relativePath: null,
        storageMode: "remote",
      } satisfies AssetRecord
    }

    const cacheKey = `${postLogNo}:${kind}:${normalizedSourceUrl}`
    const cachedAbsolutePath = this.cache.get(cacheKey)

    if (cachedAbsolutePath) {
      const relativePath = relativePathFrom({
        from: markdownFilePath,
        to: cachedAbsolutePath,
      })

      return {
        kind,
        sourceUrl: normalizedSourceUrl,
        reference: relativePath,
        relativePath,
        storageMode: "relative",
      } satisfies AssetRecord
    }

    const counterKey = `${postLogNo}:${kind}`
    const nextIndex = (this.counters.get(counterKey) ?? 0) + 1
    const extension = extensionFromUrl(normalizedSourceUrl)
    const fileName = `${kind}-${String(nextIndex).padStart(2, "0")}${extension}`
    const absolutePath = path.join(
      this.outputDir,
      this.options.structure.assetDirectoryName,
      postLogNo,
      fileName,
    )

    this.counters.set(counterKey, nextIndex)
    await this.downloader.downloadBinary({
      sourceUrl: normalizedSourceUrl,
      destinationPath: absolutePath,
    })
    this.cache.set(cacheKey, absolutePath)

    return {
      kind,
      sourceUrl: normalizedSourceUrl,
      reference: relativePathFrom({
        from: markdownFilePath,
        to: absolutePath,
      }),
      relativePath: relativePathFrom({
        from: markdownFilePath,
        to: absolutePath,
      }),
      storageMode: "relative",
    } satisfies AssetRecord
  }
}
