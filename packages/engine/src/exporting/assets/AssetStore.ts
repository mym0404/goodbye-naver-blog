import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  AssetRecord,
  UploadCandidateKind,
} from "@exitpress/domain/export-job/schema/UploadState.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import type { AssetCompressor } from "./AssetCompression.js"

import { ensureDir, relativePathFrom } from "../../infra/node/FilePaths.js"

import {
  compressWithSharp,
  extensionFromContentType,
  extensionFromUrl,
  isCompressionSafeMimeType,
} from "./AssetCompression.js"

type AssetBinary = {
  bytes: Buffer
  contentType: string | null
}

type AssetDownloader = {
  downloadBinary: (input: { sourceUrl: string; destinationPath: string }) => Promise<void>
  fetchBinary?: (input: { sourceUrl: string }) => Promise<AssetBinary>
}

const normalizeOutputPath = (value: string) => value.split(path.sep).join("/")

export class AssetStore {
  readonly outputDir: string
  readonly downloader: AssetDownloader
  readonly options: Pick<ExportOptions, "assets" | "structure">
  readonly cache = new Map<string, string>()
  readonly sourceUrlCache = new Map<string, string>()
  readonly inFlightSourceUrlCache = new Map<string, Promise<string>>()
  readonly compressImage: AssetCompressor
  readonly formatReference: (relativeAssetPath: string) => string

  constructor({
    outputDir,
    downloader,
    options,
    compressImage,
    formatReference,
  }: {
    outputDir: string
    downloader: AssetDownloader
    options: Pick<ExportOptions, "assets" | "structure">
    compressImage?: AssetCompressor
    formatReference?: (relativeAssetPath: string) => string
  }) {
    this.outputDir = outputDir
    this.downloader = downloader
    this.options = options
    this.compressImage = compressImage ?? compressWithSharp
    this.formatReference = formatReference ?? ((relativeAssetPath) => relativeAssetPath)
  }

  async saveAsset({
    kind,
    sourceUrl,
    markdownFilePath,
  }: {
    kind: UploadCandidateKind
    sourceUrl: string
    markdownFilePath: string
  }) {
    const normalizedSourceUrl = sourceUrl.trim()

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

    if (!this.downloader.fetchBinary) {
      throw new Error("로컬 자산 저장을 지원하는 fetchBinary downloader가 필요합니다.")
    }

    const cachedBySourceUrl = this.sourceUrlCache.get(normalizedSourceUrl)

    if (cachedBySourceUrl) {
      const relativePath = relativePathFrom({
        from: markdownFilePath,
        to: cachedBySourceUrl,
      })
      const reference = this.formatReference(relativePath)

      return {
        kind,
        sourceUrl: normalizedSourceUrl,
        reference,
        relativePath,
        storageMode: "relative",
        uploadCandidate: {
          kind,
          sourceUrl: normalizedSourceUrl,
          localPath: normalizeOutputPath(path.relative(this.outputDir, cachedBySourceUrl)),
          markdownReference: reference,
        },
      } satisfies AssetRecord
    }

    const absolutePath = await this.getOrCreateLocalAssetPath(normalizedSourceUrl)

    const relativePath = relativePathFrom({
      from: markdownFilePath,
      to: absolutePath,
    })
    const reference = this.formatReference(relativePath)

    return {
      kind,
      sourceUrl: normalizedSourceUrl,
      reference,
      relativePath,
      storageMode: "relative",
      uploadCandidate: {
        kind,
        sourceUrl: normalizedSourceUrl,
        localPath: normalizeOutputPath(path.relative(this.outputDir, absolutePath)),
        markdownReference: reference,
      },
    } satisfies AssetRecord
  }

  private async getOrCreateLocalAssetPath(normalizedSourceUrl: string) {
    const cachedAbsolutePath = this.sourceUrlCache.get(normalizedSourceUrl)

    if (cachedAbsolutePath) {
      return cachedAbsolutePath
    }

    const inFlightAbsolutePath = this.inFlightSourceUrlCache.get(normalizedSourceUrl)

    if (inFlightAbsolutePath) {
      return inFlightAbsolutePath
    }

    const absolutePathPromise = (async () => {
      const binary = await this.downloader.fetchBinary!({
        sourceUrl: normalizedSourceUrl,
      })
      const contentHash = createHash("sha256").update(binary.bytes).digest("hex")
      const cachedByHash = this.cache.get(contentHash)

      if (cachedByHash) {
        this.sourceUrlCache.set(normalizedSourceUrl, cachedByHash)
        return cachedByHash
      }

      const extension =
        extensionFromContentType(binary.contentType) ?? extensionFromUrl(normalizedSourceUrl)
      const absolutePath = path.join(this.outputDir, "public", `${contentHash}${extension}`)

      await ensureDir(path.dirname(absolutePath))

      if (this.options.assets.compressionEnabled) {
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
        await writeFile(absolutePath, binary.bytes)
      }

      this.cache.set(contentHash, absolutePath)
      this.sourceUrlCache.set(normalizedSourceUrl, absolutePath)

      return absolutePath
    })()

    this.inFlightSourceUrlCache.set(normalizedSourceUrl, absolutePathPromise)

    try {
      return await absolutePathPromise
    } finally {
      this.inFlightSourceUrlCache.delete(normalizedSourceUrl)
    }
  }
}
