import path from "node:path"
import { writeFile } from "node:fs/promises"

import type { AssetRecord, ExportOptions } from "../../shared/types.js"
import { ensureDir, normalizeAssetUrl, relativePathFrom } from "../../shared/utils.js"

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

type AssetCompressor = (input: {
  bytes: Buffer
  contentType: string | null
  sourceUrl: string
}) => Promise<Buffer>

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

const normalizeOutputPath = (value: string) => value.split(path.sep).join("/")

const isCompressionSafeMimeType = (contentType: string | null, sourceUrl: string) => {
  const resolvedContentType = (contentType || inferMimeType(sourceUrl)).toLowerCase()

  return (
    resolvedContentType === "image/jpeg" ||
    resolvedContentType === "image/png" ||
    resolvedContentType === "image/webp"
  )
}

const compressWithSharp: AssetCompressor = async ({ bytes, contentType, sourceUrl }) => {
  const sharpModule = await import("sharp")
  const sharp = sharpModule.default
  const resolvedContentType = (contentType || inferMimeType(sourceUrl)).toLowerCase()
  const image = sharp(bytes, {
    failOn: "none",
  }).rotate()

  if (resolvedContentType === "image/png") {
    return image.png({ compressionLevel: 9 }).toBuffer()
  }

  if (resolvedContentType === "image/webp") {
    return image.webp({ quality: 80 }).toBuffer()
  }

  return image.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}

export class AssetStore {
  readonly outputDir: string
  readonly downloader: AssetDownloader
  readonly options: Pick<ExportOptions, "assets" | "structure">
  readonly cache = new Map<string, string>()
  readonly dataUrlCache = new Map<string, string>()
  readonly counters = new Map<string, number>()
  readonly compressImage: AssetCompressor

  constructor({
    outputDir,
    downloader,
    options,
    compressImage,
  }: {
    outputDir: string
    downloader: AssetDownloader
    options: Pick<ExportOptions, "assets" | "structure">
    compressImage?: AssetCompressor
  }) {
    this.outputDir = outputDir
    this.downloader = downloader
    this.options = options
    this.compressImage = compressImage ?? compressWithSharp
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
          uploadCandidate: null,
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
        uploadCandidate: null,
      } satisfies AssetRecord
    }

    const shouldDownload =
      this.options.assets.imageHandlingMode !== "remote" &&
      ((kind === "image" && this.options.assets.downloadImages) ||
        (kind === "thumbnail" && this.options.assets.downloadThumbnails))

    if (!shouldDownload) {
      return {
        kind,
        sourceUrl: normalizedSourceUrl,
        reference: normalizedSourceUrl,
        relativePath: null,
        storageMode: "remote",
        uploadCandidate: null,
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
        uploadCandidate: {
          kind,
          sourceUrl: normalizedSourceUrl,
          localPath: normalizeOutputPath(path.relative(this.outputDir, cachedAbsolutePath)),
          markdownReference: relativePath,
        },
      } satisfies AssetRecord
    }

    const counterKey = `${postLogNo}:${kind}`
    const nextIndex = (this.counters.get(counterKey) ?? 0) + 1
    const extension = extensionFromUrl(normalizedSourceUrl)
    const fileName = `${kind}-${String(nextIndex).padStart(2, "0")}${extension}`
    const absolutePath = path.join(path.dirname(markdownFilePath), fileName)

    this.counters.set(counterKey, nextIndex)
    await ensureDir(path.dirname(absolutePath))

    if (this.options.assets.compressionEnabled && this.downloader.fetchBinary) {
      const binary = await this.downloader.fetchBinary({
        sourceUrl: normalizedSourceUrl,
      })

      if (isCompressionSafeMimeType(binary.contentType, normalizedSourceUrl)) {
        try {
          const compressedBytes = await this.compressImage({
            bytes: binary.bytes,
            contentType: binary.contentType,
            sourceUrl: normalizedSourceUrl,
          })

          await writeFile(absolutePath, compressedBytes)
        } catch {
          await writeFile(absolutePath, binary.bytes)
        }
      } else {
        await writeFile(absolutePath, binary.bytes)
      }
    } else {
      await this.downloader.downloadBinary({
        sourceUrl: normalizedSourceUrl,
        destinationPath: absolutePath,
      })
    }
    this.cache.set(cacheKey, absolutePath)

    const relativePath = relativePathFrom({
      from: markdownFilePath,
      to: absolutePath,
    })

    return {
      kind,
      sourceUrl: normalizedSourceUrl,
      reference: relativePath,
      relativePath,
      storageMode: "relative",
      uploadCandidate: {
        kind,
        sourceUrl: normalizedSourceUrl,
        localPath: normalizeOutputPath(path.relative(this.outputDir, absolutePath)),
        markdownReference: relativePath,
      },
    } satisfies AssetRecord
  }
}
