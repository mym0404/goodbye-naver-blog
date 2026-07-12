// @vitest-environment jsdom

import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createTestPath } from "@tests/support/test-paths.js"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"

import { fetchJson, postJson } from "../../lib/Api.js"

import { useExportJob } from "./UseExportJob.js"

vi.mock("../../lib/Api.js", () => ({
  fetchJson: vi.fn(),
  postJson: vi.fn(),
}))

const mockedFetchJson = vi.mocked(fetchJson)
const mockedPostJson = vi.mocked(postJson)
const testOutputDir = createTestPath("ui-use-export-job", "output")
const scanResult: ScanResult = {
  blogKey: "naver",
  sourceId: "mym0404",
  totalPostCount: 1,
  categories: [
    {
      id: 84,
      name: "PS 알고리즘, 팁",
      parentId: null,
      postCount: 1,
      isDivider: false,
      isOpen: true,
      path: ["PS 알고리즘, 팁"],
      depth: 0,
    },
  ],
  posts: [
    {
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "223034929697",
      title: "테스트 글",
      publishedAt: "2023-03-04T13:00:00+09:00",
      categoryId: 84,
      categoryName: "PS 알고리즘, 팁",
      source: "https://blog.naver.com/mym0404/223034929697",
      thumbnailUrl: null,
    },
  ],
}

describe("useExportJob", () => {
  afterEach(() => {
    mockedFetchJson.mockReset()
    mockedPostJson.mockReset()
    vi.restoreAllMocks()
  })

  it("starts a job, polls until completion, and clears the interval", async () => {
    mockedPostJson.mockResolvedValue({
      jobId: "job-1",
    })
    mockedFetchJson
      .mockResolvedValueOnce({
        id: "job-1",
        request: {
          blogKey: "naver",
          sourceInput: "mym0404",
          outputDir: testOutputDir,
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
          blogKey: "naver",
          sourceInput: "mym0404",
          outputDir: testOutputDir,
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

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      void Promise.resolve().then(() => {
        if (typeof handler === "function") {
          handler()
        }
      })

      return 1 as unknown as ReturnType<typeof window.setTimeout>
    })
    const { result, unmount } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogKey: "naver",
        sourceInput: "mym0404",
        outputDir: testOutputDir,
        options: defaultExportOptions(),
        scanResult,
      })
    })

    await waitFor(() => {
      expect(result.current.job?.status).toBe("completed")
    })
    expect(result.current.submitting).toBe(false)
    expect(result.current.jobId).toBe("job-1")
    expect(mockedPostJson).toHaveBeenCalledWith("/api/export", {
      blogKey: "naver",
      sourceInput: "mym0404",
      outputDir: testOutputDir,
      profile: "gfm",
      options: defaultExportOptions(),
      scanResult,
    })
    expect(mockedFetchJson).toHaveBeenCalledTimes(2)
    expect(mockedFetchJson).toHaveBeenCalledWith("/api/export/job-1")
    expect(clearTimeoutSpy).toHaveBeenCalled()

    unmount()
  })

  it("submits upload provider payload with download-and-upload exports", async () => {
    const uploadFlowOptions = defaultExportOptions()
    uploadFlowOptions.assets.imageHandlingMode = "download-and-upload"

    mockedPostJson.mockResolvedValue({ jobId: "job-upload-auto" })
    mockedFetchJson.mockResolvedValue({
      id: "job-upload-auto",
      status: "queued",
      request: {
        blogKey: "naver",
        sourceInput: "blog",
        outputDir: "/tmp/out",
        profile: "gfm",
        options: uploadFlowOptions,
      },
      progress: { total: 0, completed: 0, failed: 0 },
      upload: {
        status: "not-requested",
        eligiblePostCount: 0,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      items: [],
      logs: [],
      resumeAvailable: false,
      startedAt: null,
      finishedAt: null,
      error: null,
    })

    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogKey: "naver",
        sourceInput: "blog",
        outputDir: "/tmp/out",
        options: uploadFlowOptions,
        scanResult: null,
        uploadProvider: {
          providerKey: "github",
          providerFields: {
            repo: "owner/repo",
            branch: "main",
            token: "secret-token",
          },
        },
      })
    })

    expect(mockedPostJson).toHaveBeenCalledWith("/api/export", {
      blogKey: "naver",
      sourceInput: "blog",
      outputDir: "/tmp/out",
      profile: "gfm",
      options: uploadFlowOptions,
      scanResult: null,
      uploadProvider: {
        providerKey: "github",
        providerFields: {
          repo: "owner/repo",
          branch: "main",
          token: "secret-token",
        },
      },
    })
  })

  it("does not expose a manual upload starter", () => {
    const { result } = renderHook(() => useExportJob())

    expect(result.current).not.toHaveProperty("startUpload")
  })

  it("restarts polling after resuming a hydrated job", async () => {
    const resumableJob = {
      id: "job-resume",
      request: {
        blogKey: "naver",
        sourceInput: "mym0404",
        outputDir: testOutputDir,
        profile: "gfm" as const,
        options: defaultExportOptions(),
      },
      status: "running" as const,
      resumeAvailable: true,
      logs: [],
      createdAt: "2026-04-11T04:00:00.000Z",
      startedAt: "2026-04-11T04:00:00.000Z",
      finishedAt: null,
      progress: {
        total: 3,
        completed: 1,
        failed: 0,
      },
      upload: {
        status: "not-requested" as const,
        eligiblePostCount: 0,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      items: [],
      manifest: null,
      error: null,
    } satisfies ExportJobState

    mockedPostJson.mockResolvedValue({
      jobId: "job-resume",
      status: "running",
    })
    mockedFetchJson
      .mockResolvedValueOnce({
        ...resumableJob,
        resumeAvailable: false,
        progress: {
          ...resumableJob.progress,
          completed: 2,
        },
      })
      .mockResolvedValueOnce({
        ...resumableJob,
        status: "completed",
        resumeAvailable: false,
        finishedAt: "2026-04-11T04:00:05.000Z",
        progress: {
          ...resumableJob.progress,
          completed: 3,
        },
      })

    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      void Promise.resolve().then(() => {
        if (typeof handler === "function") {
          handler()
        }
      })

      return 1 as unknown as ReturnType<typeof window.setTimeout>
    })

    const { result } = renderHook(() => useExportJob())

    act(() => {
      result.current.hydrateJob(resumableJob)
    })

    await act(async () => {
      await result.current.resumeJob()
    })

    await waitFor(() => {
      expect(mockedFetchJson).toHaveBeenCalledWith("/api/export/job-resume")
    })
    expect(result.current.job?.resumeAvailable).toBe(false)
    expect(result.current.job?.progress.completed).toBe(3)
  })
})
