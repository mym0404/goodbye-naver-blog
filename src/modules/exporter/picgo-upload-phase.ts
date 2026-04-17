import path from "node:path"

import type { UploadCandidate } from "../../shared/types.js"

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

export type RunPicGoUploadPhaseInput = {
  outputDir: string
  candidates: UploadCandidate[]
  uploaderKey: string
  uploaderConfig: Record<string, unknown>
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
  const client = await createClient()

  client.setConfig({
    picBed: {
      current: input.uploaderKey,
      [input.uploaderKey]: input.uploaderConfig,
    },
  })

  const filePaths = input.candidates.map((candidate) => path.join(input.outputDir, candidate.localPath))
  const uploaded = await client.upload(filePaths)

  if (uploaded instanceof Error) {
    throw new Error("PicGo upload failed.")
  }

  if (uploaded.length !== input.candidates.length) {
    throw new Error("PicGo upload result count mismatch.")
  }

  return uploaded.map((result, index) => {
    const uploadedUrl = getUploadedUrl(result)

    if (!uploadedUrl) {
      throw new Error("PicGo upload result is missing a URL.")
    }

    return {
      candidate: input.candidates[index]!,
      uploadedUrl,
    }
  })
}
