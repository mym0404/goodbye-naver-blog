import path from "node:path"

import type { UploadCandidate } from "../../shared/types.js"
import { dedupeUploadCandidatesByLocalPath } from "./upload-candidate-utils.js"

type PicGoUploadResponse = {
  imgUrl?: string
  url?: string
}

type PicGoLike = {
  setConfig: (config: Record<string, unknown>) => void
  upload: (input: string[]) => Promise<PicGoUploadResponse[] | Error>
}

export type PicGoUploadResult = {
  candidate: UploadCandidate
  uploadedUrl: string
}

export type PicGoUploadProgress = {
  total: number
  uploadedCount: number
  lastCompletedLocalPath: string | null
}

export class PicGoUploadPhaseError extends Error {
  readonly uploadedResults: PicGoUploadResult[]

  constructor(message: string, uploadedResults: PicGoUploadResult[]) {
    super(message)
    this.name = "PicGoUploadPhaseError"
    this.uploadedResults = uploadedResults
  }
}

export type RunPicGoUploadPhaseInput = {
  outputDir: string
  candidates: UploadCandidate[]
  uploaderKey: string
  uploaderConfig: Record<string, unknown>
  onProgress?: (progress: PicGoUploadProgress) => void
}

const createPicGoClient = async (): Promise<PicGoLike> => {
  const picgoModule = await import("picgo")

  return new picgoModule.PicGo()
}

const getUploadedUrl = (result: PicGoUploadResponse) => result.imgUrl || result.url || null

export const runPicGoUploadPhase = async (
  input: RunPicGoUploadPhaseInput,
  createClient: () => Promise<PicGoLike> = createPicGoClient,
): Promise<PicGoUploadResult[]> => {
  const dedupedCandidates = dedupeUploadCandidatesByLocalPath(input.candidates)
  const client = await createClient()

  client.setConfig({
    picBed: {
      current: input.uploaderKey,
      [input.uploaderKey]: input.uploaderConfig,
    },
  })

  const total = dedupedCandidates.length
  const uploadedResults: PicGoUploadResult[] = []

  input.onProgress?.({
    total,
    uploadedCount: 0,
    lastCompletedLocalPath: null,
  })

  for (const candidate of dedupedCandidates) {
    const filePath = path.join(input.outputDir, candidate.localPath)
    const uploaded = await client.upload([filePath])

    if (uploaded instanceof Error) {
      throw new PicGoUploadPhaseError("PicGo upload failed.", uploadedResults)
    }

    if (uploaded.length !== 1) {
      throw new PicGoUploadPhaseError("PicGo upload result count mismatch.", uploadedResults)
    }

    const uploadedUrl = getUploadedUrl(uploaded[0]!)

    if (!uploadedUrl) {
      throw new PicGoUploadPhaseError("PicGo upload result is missing a URL.", uploadedResults)
    }

    uploadedResults.push({
      candidate,
      uploadedUrl,
    })

    input.onProgress?.({
      total,
      uploadedCount: uploadedResults.length,
      lastCompletedLocalPath: candidate.localPath,
    })
  }

  return uploadedResults
}
