// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defaultExportOptions } from "../../src/shared/export-options.js"
import type { ScanResult } from "../../src/shared/types.js"
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
const scanResult: ScanResult = {
  blogId: "mym0404",
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
      blogId: "mym0404",
      logNo: "223034929697",
      title: "테스트 글",
      publishedAt: "2023-03-04T13:00:00+09:00",
      categoryId: 84,
      categoryName: "PS 알고리즘, 팁",
      source: "https://blog.naver.com/mym0404/223034929697",
      editorVersion: 4,
      thumbnailUrl: null,
    },
  ],
}

describe("useExportJob", () => {
  afterEach(() => {
    mockedFetchJson.mockReset()
    mockedPostJson.mockReset()
    mockedPostUploadJson.mockReset()
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
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
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
      blogIdOrUrl: "mym0404",
      outputDir: "./output",
      options: defaultExportOptions(),
      scanResult,
    })
    expect(mockedFetchJson).toHaveBeenCalledTimes(2)
    expect(mockedFetchJson).toHaveBeenCalledWith("/api/export/job-1")
    expect(clearTimeoutSpy).toHaveBeenCalled()

    unmount()
  })

  it("submits structured provider payload after upload-ready and moves into uploading", async () => {
    const uploadFlowOptions = defaultExportOptions()
    uploadFlowOptions.assets.imageHandlingMode = "download-and-upload"

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
          options: uploadFlowOptions,
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
          options: uploadFlowOptions,
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
    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: uploadFlowOptions,
        scanResult,
      })
    })

    expect(result.current.job?.status).toBe("upload-ready")

    await act(async () => {
      await result.current.startUpload({
        providerKey: "github",
        providerFields: {
          repo: "owner/name",
          token: "ghp_test_secret",
        },
      })
    })

    expect(result.current.job?.status).toBe("uploading")
    expect(mockedPostUploadJson).toHaveBeenCalledWith("/api/export/job-2/upload", {
      providerKey: "github",
      providerFields: {
        repo: "owner/name",
        token: "ghp_test_secret",
      },
    })
  })

  it("keeps burst polling after upload starts until partial progress becomes observable", async () => {
    const uploadFlowOptions = defaultExportOptions()
    uploadFlowOptions.assets.imageHandlingMode = "download-and-upload"

    mockedPostJson.mockResolvedValue({
      jobId: "job-burst",
    })
    mockedPostUploadJson.mockResolvedValue({
      jobId: "job-burst",
      status: "uploading",
    })
    mockedFetchJson
      .mockResolvedValueOnce({
        id: "job-burst",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: uploadFlowOptions,
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
        id: "job-burst",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: uploadFlowOptions,
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
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        },
        items: [],
        manifest: null,
        error: null,
      })
      .mockResolvedValueOnce({
        id: "job-burst",
        request: {
          blogIdOrUrl: "mym0404",
          outputDir: "./output",
          profile: "gfm",
          options: uploadFlowOptions,
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

    const nativeSetTimeout = window.setTimeout.bind(window)
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler, timeout?: number) => {
      if (timeout === 200) {
        return nativeSetTimeout(() => {
          if (typeof handler === "function") {
            handler()
          }
        }, 0) as unknown as ReturnType<typeof window.setTimeout>
      }

      return nativeSetTimeout(() => {
        if (typeof handler === "function") {
          handler()
        }
      }, timeout) as unknown as ReturnType<typeof window.setTimeout>
    })

    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: uploadFlowOptions,
        scanResult,
      })
    })

    expect(result.current.job?.status).toBe("upload-ready")

    await act(async () => {
      await result.current.startUpload({
        providerKey: "github",
        providerFields: {
          repo: "owner/name",
          token: "ghp_test_secret",
        },
      })
    })

    expect(result.current.job?.upload.uploadedCount).toBe(1)
    expect(mockedFetchJson).toHaveBeenCalledTimes(3)
  })

  it("restores the previous upload-ready job when the upload request is rejected", async () => {
    const uploadFlowOptions = defaultExportOptions()
    uploadFlowOptions.assets.imageHandlingMode = "download-and-upload"

    const uploadReadyJob = {
      id: "job-3",
      request: {
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        profile: "gfm",
        options: uploadFlowOptions,
      },
      status: "upload-ready" as const,
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
        status: "upload-ready" as const,
        eligiblePostCount: 1,
        candidateCount: 2,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      items: [],
      manifest: null,
      error: null,
    }

    mockedPostJson.mockResolvedValue({
      jobId: "job-3",
    })
    mockedFetchJson.mockResolvedValue(uploadReadyJob)
    mockedPostUploadJson.mockRejectedValueOnce(new Error("provider validation failed"))
    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: uploadFlowOptions,
      })
    })

    expect(result.current.job?.status).toBe("upload-ready")

    await expect(
      act(async () => {
        await result.current.startUpload({
          providerKey: "github",
          providerFields: {
            repo: "owner/name",
            token: "ghp_bad_secret",
          },
        })
      }),
    ).rejects.toThrow("provider validation failed")

    expect(result.current.uploadSubmitting).toBe(false)
    expect(result.current.job).toEqual(uploadReadyJob)
  })

  it("allows same-job retry after upload-failed and returns to uploading", async () => {
    const uploadFlowOptions = defaultExportOptions()
    uploadFlowOptions.assets.imageHandlingMode = "download-and-upload"

    const uploadReadyJob = {
      id: "job-4",
      request: {
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        profile: "gfm",
        options: uploadFlowOptions,
      },
      status: "upload-ready" as const,
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
        status: "upload-ready" as const,
        eligiblePostCount: 1,
        candidateCount: 2,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      items: [],
      manifest: null,
      error: null,
    }
    const uploadFailedJob = {
      ...uploadReadyJob,
      status: "upload-failed" as const,
      upload: {
        ...uploadReadyJob.upload,
        status: "upload-failed" as const,
        failedCount: 2,
      },
      error: "Image upload failed.",
    }
    const uploadingJob = {
      ...uploadReadyJob,
      status: "uploading" as const,
      upload: {
        ...uploadReadyJob.upload,
        status: "uploading" as const,
        uploadedCount: 1,
      },
    }
    mockedPostJson.mockResolvedValue({
      jobId: "job-4",
    })
    mockedPostUploadJson.mockResolvedValue({
      jobId: "job-4",
      status: "uploading",
    })
    mockedFetchJson
      .mockResolvedValueOnce(uploadReadyJob)
      .mockResolvedValueOnce(uploadFailedJob)
      .mockResolvedValueOnce(uploadingJob)
    const { result } = renderHook(() => useExportJob())

    await act(async () => {
      await result.current.startJob({
        blogIdOrUrl: "mym0404",
        outputDir: "./output",
        options: uploadFlowOptions,
      })
    })

    expect(result.current.job?.status).toBe("upload-ready")

    await act(async () => {
      await result.current.startUpload({
        providerKey: "github",
        providerFields: {
          repo: "owner/name",
          token: "ghp_bad_secret",
        },
      })
    })

    await waitFor(() => {
      expect(result.current.job?.status).toBe("upload-failed")
    })

    await act(async () => {
      await result.current.startUpload({
        providerKey: "github",
        providerFields: {
          repo: "owner/name",
          token: "ghp_fixed_secret",
        },
      })
    })

    expect(result.current.job?.status).toBe("uploading")
  })
})
