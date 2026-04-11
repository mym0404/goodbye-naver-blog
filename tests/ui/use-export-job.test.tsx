// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defaultExportOptions } from "../../src/shared/export-options.js"
import { useExportJob } from "../../src/ui/hooks/use-export-job.js"
import { fetchJson, postJson } from "../../src/ui/lib/api.js"

vi.mock("../../src/ui/lib/api.js", () => ({
  fetchJson: vi.fn(),
  postJson: vi.fn(),
}))

const mockedFetchJson = vi.mocked(fetchJson)
const mockedPostJson = vi.mocked(postJson)

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
})
