import { describe, expect, it, vi } from "vitest"

import type { UploadCandidate } from "../src/shared/types.js"
import {
  PicGoUploadPhaseError,
  runPicGoUploadPhase,
  type PicGoUploadProgress,
} from "../src/modules/exporter/picgo-upload-phase.js"

const createCandidate = (localPath: string, sourceUrl = `https://example.com/${localPath}`): UploadCandidate => ({
  kind: "image",
  sourceUrl,
  localPath,
  markdownReference: `../../${localPath}`,
})

describe("runPicGoUploadPhase", () => {
  it("uploads deduped candidates one by one and reports monotonic progress", async () => {
    const progressUpdates: PicGoUploadProgress[] = []
    const upload = vi
      .fn()
      .mockResolvedValueOnce([{ imgUrl: "https://cdn.example.com/a.png" }])
      .mockResolvedValueOnce([{ url: "https://cdn.example.com/b.png" }])
    const client = {
      setConfig: vi.fn(),
      upload,
    }

    const results = await runPicGoUploadPhase(
      {
        outputDir: "/tmp/export",
        candidates: [
          createCandidate("public/a.png"),
          createCandidate("public/a.png", "https://example.com/duplicate-a.png"),
          createCandidate("public/b.png"),
        ],
        uploaderKey: "github",
        uploaderConfig: {
          repo: "owner/name",
        },
        onProgress: (progress) => progressUpdates.push(progress),
      },
      async () => client,
    )

    expect(client.setConfig).toHaveBeenCalledWith({
      picBed: {
        current: "github",
        github: {
          repo: "owner/name",
        },
      },
    })
    expect(upload.mock.calls).toEqual([[["/tmp/export/public/a.png"]], [["/tmp/export/public/b.png"]]])
    expect(progressUpdates).toEqual([
      {
        total: 2,
        uploadedCount: 0,
        lastCompletedLocalPath: null,
      },
      {
        total: 2,
        uploadedCount: 1,
        lastCompletedLocalPath: "public/a.png",
      },
      {
        total: 2,
        uploadedCount: 2,
        lastCompletedLocalPath: "public/b.png",
      },
    ])
    expect(results).toEqual([
      {
        candidate: createCandidate("public/a.png"),
        uploadedUrl: "https://cdn.example.com/a.png",
      },
      {
        candidate: createCandidate("public/b.png"),
        uploadedUrl: "https://cdn.example.com/b.png",
      },
    ])
  })

  it("keeps already uploaded results on failure after partial success", async () => {
    const progressUpdates: PicGoUploadProgress[] = []
    const client = {
      setConfig: vi.fn(),
      upload: vi
        .fn()
        .mockResolvedValueOnce([{ imgUrl: "https://cdn.example.com/a.png" }])
        .mockResolvedValueOnce(new Error("provider failed")),
    }

    const uploadPromise = runPicGoUploadPhase(
      {
        outputDir: "/tmp/export",
        candidates: [createCandidate("public/a.png"), createCandidate("public/b.png")],
        uploaderKey: "github",
        uploaderConfig: {
          repo: "owner/name",
        },
        onProgress: (progress) => progressUpdates.push(progress),
      },
      async () => client,
    )

    await expect(uploadPromise).rejects.toBeInstanceOf(PicGoUploadPhaseError)

    try {
      await uploadPromise
    } catch (error) {
      expect(error).toBeInstanceOf(PicGoUploadPhaseError)
      expect((error as PicGoUploadPhaseError).uploadedResults).toEqual([
        {
          candidate: createCandidate("public/a.png"),
          uploadedUrl: "https://cdn.example.com/a.png",
        },
      ])
    }

    expect(progressUpdates).toEqual([
      {
        total: 2,
        uploadedCount: 0,
        lastCompletedLocalPath: null,
      },
      {
        total: 2,
        uploadedCount: 1,
        lastCompletedLocalPath: "public/a.png",
      },
    ])
  })
})
