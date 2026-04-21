import os from "node:os"
import path from "node:path"

import type { UploadCandidate } from "../../shared/types.js"
import { dedupeUploadCandidatesByLocalPath } from "./upload-candidate-utils.js"

type RuntimeUploadResponse = {
  imgUrl?: string
  url?: string
}

type RuntimeUploaderClient = {
  changeCurrentUploader: (uploaderKey: string, uploaderConfig: Record<string, unknown>) => void
  upload: (input: string[]) => Promise<RuntimeUploadResponse[] | Error>
}

export type ImageUploadResult = {
  candidate: UploadCandidate
  uploadedUrl: string
}

export type ImageUploadProgress = {
  total: number
  uploadedCount: number
  lastCompletedLocalPath: string | null
}

export class ImageUploadPhaseError extends Error {
  readonly uploadedResults: ImageUploadResult[]

  constructor(message: string, uploadedResults: ImageUploadResult[]) {
    super(message)
    this.name = "ImageUploadPhaseError"
    this.uploadedResults = uploadedResults
  }
}

export type RunImageUploadPhaseInput = {
  outputDir: string
  candidates: UploadCandidate[]
  uploaderKey: string
  uploaderConfig: Record<string, unknown>
  onAssetStart?: (candidate: UploadCandidate) => void | Promise<void>
  onAssetUploaded?: (input: {
    result: ImageUploadResult
    progress: ImageUploadProgress
  }) => void | Promise<void>
  onProgress?: (progress: ImageUploadProgress) => void
}

const createRuntimeClient = async (): Promise<RuntimeUploaderClient> => {
  const runtimeModule = await import("piclist")
  const runtimeConfigPath = path.join(os.tmpdir(), "farewell-naver-blog-image-upload.json")

  return runtimeModule.PicGo.create(runtimeConfigPath)
}

const getUploadedUrl = (result: RuntimeUploadResponse) => result.imgUrl || result.url || null

export const runImageUploadPhase = async (
  input: RunImageUploadPhaseInput,
  createClient: () => Promise<RuntimeUploaderClient> = createRuntimeClient,
): Promise<ImageUploadResult[]> => {
  const dedupedCandidates = dedupeUploadCandidatesByLocalPath(input.candidates)
  const client = await createClient()

  client.changeCurrentUploader(input.uploaderKey, input.uploaderConfig)

  const total = dedupedCandidates.length
  const uploadedResults: ImageUploadResult[] = []

  input.onProgress?.({
    total,
    uploadedCount: 0,
    lastCompletedLocalPath: null,
  })

  for (const candidate of dedupedCandidates) {
    await input.onAssetStart?.(candidate)

    const filePath = path.join(input.outputDir, candidate.localPath)
    const uploaded = await client.upload([filePath])

    if (uploaded instanceof Error) {
      throw new ImageUploadPhaseError(`Image upload failed for ${candidate.localPath}.`, uploadedResults)
    }

    if (uploaded.length !== 1) {
      throw new ImageUploadPhaseError(
        `Image upload result count mismatch for ${candidate.localPath}.`,
        uploadedResults,
      )
    }

    const uploadedUrl = getUploadedUrl(uploaded[0]!)

    if (!uploadedUrl) {
      throw new ImageUploadPhaseError(
        `Image upload result is missing a URL for ${candidate.localPath}.`,
        uploadedResults,
      )
    }

    const result = {
      candidate,
      uploadedUrl,
    } satisfies ImageUploadResult

    uploadedResults.push(result)

    const progress = {
      total,
      uploadedCount: uploadedResults.length,
      lastCompletedLocalPath: candidate.localPath,
    } satisfies ImageUploadProgress

    input.onProgress?.(progress)
    await input.onAssetUploaded?.({
      result,
      progress,
    })
  }

  return uploadedResults
}
