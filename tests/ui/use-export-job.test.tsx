// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defaultExportOptions } from "../../src/shared/export-options.js"
import { useExportJob } from "../../src/ui/hooks/use-export-job.js"
import { fetchJson, postJson, postUploadJson } from "../../src/ui/lib/api.js"

vi.mock("../../src/ui/lib/api.js", () => ({
  fetchJson: vi.fn(),
  postJson: vi.fn(),
  postUploadJson: vi.fn(),
}))

const mockedFetchJson = vi.mocked(fetchJson)
const mockedPostJson = vi.mocked(postJson)
const mockedPostUploadJson = vi.mocked(postUploadJson)

describe("useExportJob", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("starts a job, polls until completion, and clears the interval", async () => {
    mockedPostJson.mockResolvedValue({
      jobId: "job-1",
    })
    mockedFetchJson
      .mockResolvedValueOnce({
        id: "job-1",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "running",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: null,
        progress: {
          total: 1,
          completed: 0,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "not-requested",
          eligiblePostCount: 0,
          candidateCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "job-1",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "completed",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: "2026-04-11T04:00:02.000Z",
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "not-requested",
          eligiblePostCount: 0,
          candidateCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })

    const clearIntervalSpy = vi.spyOn(window, "clearInterval")
    vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler) => {
      void Promise.resolve().then(() => {
        if (typeof handler === "function") {
          handler()
        }
      })

      return 1 as unknown as ReturnType<typeof window.setInterval>
    })
    const { result, unmount } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: defaultExportOptions(),
      })
    })

    await waitFor(() => {
      expect(result.current.job?.status).toBe("completed")
    })
    expect(result.current.submitting).toBe(false)
    expect(result.current.jobId).toBe("job-1")
    expect(mockedPostJson).toHaveBeenCalledWith("/api/export", {
      blogIdOrUrl: "mym0404",
      outputDir: "./output",
      options: defaultExportOptions(),
    })
    expect(mockedFetchJson).toHaveBeenCalledTimes(2)
    expect(mockedFetchJson).toHaveBeenCalledWith("/api/export/job-1")
    expect(clearIntervalSpy).toHaveBeenCalled()

    unmount()
  })

  it("keeps polling through upload-ready and uploading until upload-completed", async () => {
    mockedPostJson.mockResolvedValue({
      jobId: "job-2",
    })
    mockedPostUploadJson.mockResolvedValue({
      jobId: "job-2",
      status: "uploading",
    })
    mockedFetchJson
      .mockResolvedValueOnce({
        id: "job-2",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "upload-ready",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: null,
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "upload-ready",
          eligiblePostCount: 1,
          candidateCount: 2,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "job-2",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "upload-completed",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: "2026-04-11T04:00:03.000Z",
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "upload-completed",
          eligiblePostCount: 1,
          candidateCount: 2,
          uploadedCount: 2,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "job-2",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "uploading",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: null,
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "uploading",
          eligiblePostCount: 1,
          candidateCount: 2,
          uploadedCount: 1,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "job-2",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: defaultExportOptions(),
        },
        status: "upload-completed",
        logs: [],
        createdAt: "2026-04-11T04:00:00.000Z",
        startedAt: "2026-04-11T04:00:00.000Z",
        finishedAt: "2026-04-11T04:00:03.000Z",
        progress: {
          total: 1,
          completed: 1,
          failed: 0,
          warnings: 0,
        },
        upload: {
          status: "upload-completed",
          eligiblePostCount: 1,
          candidateCount: 2,
          uploadedCount: 2,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })

    vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler) => {
      void Promise.resolve().then(() => {
        if (typeof handler === "function") {
          handler()
          handler()
        }
      })

      return 1 as unknown as ReturnType<typeof window.setInterval>
    })

    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: defaultExportOptions(),
      })
    })

    await act(async () => {
      await result.current.startUpload({
        uploaderKey: "github",
        uploaderConfigJson: '{"repo":"owner/name"}',
      })
    })

    await waitFor(() => {
      expect(result.current.job?.status).toBe("upload-completed")
    })
    expect(mockedPostUploadJson).toHaveBeenCalledWith("/api/export/job-2/upload", {
      uploaderKey: "github",
      uploaderConfigJson: '{"repo":"owner/name"}',
    })
  })
})
