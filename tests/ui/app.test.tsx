// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "../../src/shared/export-options.js"
import type { ExportJobState, ScanResult } from "../../src/shared/types.js"
import { App } from "../../src/ui/App.js"

const buildJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const buildPostSummary = (logNo: number, categoryId: number, categoryName: string) => ({
  blogId: "mym0404",
  logNo: String(logNo),
  title: `${categoryName} 글 ${logNo}`,
  publishedAt: `2026-04-${String((logNo % 28) + 1).padStart(2, "0")}T04:00:00.000Z`,
  categoryId,
  categoryName,
  source: `https://blog.naver.com/mym0404/${logNo}`,
  editorVersion: 4 as const,
  thumbnailUrl: null,
})

const scanResult: ScanResult = {
  blogId: "mym0404",
  totalPostCount: 12,
  categories: [
    {
      id: 101,
      name: "NestJS",
      parentId: null,
      postCount: 5,
      isDivider: false,
      isOpen: true,
      path: ["NestJS"],
      depth: 1,
    },
    {
      id: 202,
      name: "React",
      parentId: null,
      postCount: 7,
      isDivider: false,
      isOpen: true,
      path: ["React"],
      depth: 1,
    },
  ],
  posts: [
    ...Array.from({ length: 5 }, (_, index) => buildPostSummary(index + 1, 101, "NestJS")),
    ...Array.from({ length: 7 }, (_, index) => buildPostSummary(index + 6, 202, "React")),
  ],
}

const exportedOptions = (() => {
  const options = defaultExportOptions()
  options.scope.categoryIds = [101]
  options.frontmatter.aliases.title = "postTitle"
  return options
})()

const completedJob: ExportJobState = {
  id: "job-1",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir: "./output",
    profile: "gfm",
    options: exportedOptions,
  },
  status: "completed",
  logs: [
    {
      timestamp: "2026-04-11T04:00:00.000Z",
      message: "작업을 큐에 등록했습니다.",
    },
  ],
  createdAt: "2026-04-11T04:00:00.000Z",
  startedAt: "2026-04-11T04:00:00.000Z",
  finishedAt: "2026-04-11T04:00:01.000Z",
  progress: {
    total: 1,
    completed: 1,
    failed: 0,
    warnings: 1,
  },
  upload: {
    status: "not-requested",
    eligiblePostCount: 0,
    candidateCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  items: [
    {
      id: "posts/NestJS/test.md",
      logNo: "1",
      title: "테스트 글",
      source: "https://blog.naver.com/mym0404/1",
      category: {
        id: 101,
        name: "NestJS",
        path: ["NestJS"],
      },
      status: "success",
      outputPath: "posts/NestJS/test.md",
      assetPaths: [],
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
      },
      warnings: ["parser note"],
      warningCount: 1,
      error: null,
      updatedAt: "2026-04-11T04:00:01.000Z",
    },
  ],
  manifest: null,
  error: null,
}

const runningJob: ExportJobState = {
  ...completedJob,
  status: "running",
  finishedAt: null,
  progress: {
    total: 5,
    completed: 2,
    failed: 0,
    warnings: 0,
  },
  items: [],
}

const uploadFlowOptions = (() => {
  const options = defaultExportOptions()
  options.scope.categoryIds = scanResult.categories.map((category) => category.id)
  options.assets.imageHandlingMode = "download-and-upload"
  return options
})()

const sharedPublicPath = "../../public/hash-shared-image.png"
const sharedLocalPath = "public/hash-shared-image.png"
const detailPublicPath = "../../public/hash-detail-image.png"
const detailLocalPath = "public/hash-detail-image.png"

const uploadItem = {
  ...completedJob.items[0]!,
  id: "NestJS/2026-04-11-1/index.md",
  outputPath: "NestJS/2026-04-11-1/index.md",
  assetPaths: [sharedPublicPath, detailPublicPath],
  upload: {
    eligible: true,
    candidateCount: 2,
    uploadedCount: 0,
    failedCount: 0,
    candidates: [
      {
        kind: "thumbnail" as const,
        sourceUrl: "https://example.com/thumb.png",
        localPath: sharedLocalPath,
        markdownReference: sharedPublicPath,
      },
      {
        kind: "image" as const,
        sourceUrl: "https://example.com/detail.png",
        localPath: detailLocalPath,
        markdownReference: detailPublicPath,
      },
    ],
  },
}

const uploadPendingItem = {
  ...uploadItem,
  id: "React/2026-04-12-2/index.md",
  title: "대기 중인 글",
  outputPath: "React/2026-04-12-2/index.md",
}

const uploadReadyJob: ExportJobState = {
  ...completedJob,
  id: "job-upload",
  request: {
    ...completedJob.request,
    options: uploadFlowOptions,
  },
  status: "upload-ready",
  finishedAt: null,
  upload: {
    status: "upload-ready",
    eligiblePostCount: 2,
    candidateCount: 4,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  items: [uploadItem, uploadPendingItem],
}

const uploadingJob: ExportJobState = {
  ...uploadReadyJob,
  status: "uploading",
  upload: {
    ...uploadReadyJob.upload,
    status: "uploading",
    uploadedCount: 3,
  },
  items: [
    {
      ...uploadItem,
      upload: {
        ...uploadItem.upload,
        uploadedCount: 2,
      },
    },
    {
      ...uploadPendingItem,
      upload: {
        ...uploadPendingItem.upload,
        uploadedCount: 1,
      },
    },
  ],
}

const rewritePendingJob: ExportJobState = {
  ...uploadReadyJob,
  status: "uploading",
  upload: {
    ...uploadReadyJob.upload,
    status: "uploading",
    uploadedCount: 4,
  },
  items: [
    {
      ...uploadItem,
      upload: {
        ...uploadItem.upload,
        uploadedCount: 2,
      },
    },
    {
      ...uploadPendingItem,
      upload: {
        ...uploadPendingItem.upload,
        uploadedCount: 2,
      },
    },
  ],
}

const uploadCompletedJob: ExportJobState = {
  ...uploadReadyJob,
  status: "upload-completed",
  finishedAt: "2026-04-11T04:00:03.000Z",
  upload: {
    ...uploadReadyJob.upload,
    status: "upload-completed",
    uploadedCount: 4,
  },
  items: [
    {
      ...uploadItem,
      assetPaths: [
        "https://cdn.example.com/shared.png",
        "https://cdn.example.com/detail.png",
      ],
      upload: {
        ...uploadItem.upload,
        uploadedCount: 2,
      },
    },
    {
      ...uploadPendingItem,
      assetPaths: [
        "https://cdn.example.com/shared.png",
        "https://cdn.example.com/detail.png",
      ],
      upload: {
        ...uploadPendingItem.upload,
        uploadedCount: 2,
      },
    },
  ],
}

const uploadFailedJob: ExportJobState = {
  ...uploadReadyJob,
  status: "upload-failed",
  error: "PicGo upload failed.",
  upload: {
    ...uploadReadyJob.upload,
    status: "upload-failed",
    failedCount: 1,
    uploadedCount: 3,
  },
  items: [
    {
      ...uploadItem,
      upload: {
        ...uploadItem.upload,
        uploadedCount: 2,
      },
    },
    {
      ...uploadPendingItem,
      upload: {
        ...uploadPendingItem.upload,
        uploadedCount: 1,
      },
    },
  ],
}

const skippedUploadJob: ExportJobState = {
  ...completedJob,
  id: "job-skipped",
  request: {
    ...completedJob.request,
    options: uploadFlowOptions,
  },
  upload: {
    status: "skipped",
    eligiblePostCount: 0,
    candidateCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240)
})

describe("App", () => {
  const renderApp = () => {
    const user = userEvent.setup()
    render(<App />)
    return user
  }

  const moveToAssetsStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })
    await user.click(screen.getByRole("button", { name: "구조 설정" }))
    await user.click(screen.getByRole("button", { name: "Frontmatter 설정" }))
    await user.click(screen.getByRole("button", { name: "Markdown 설정" }))
    await user.click(screen.getByRole("button", { name: "Assets 설정" }))
  }

  it("runs the main export flow in the wizard without preview or modal", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        expect(init?.body).toBe(
          JSON.stringify({
            blogIdOrUrl: "mym0404",
            outputDir: "./output",
            options: exportedOptions,
            scanResult,
          }),
        )
        return buildJsonResponse({ jobId: "job-1" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-1")) {
        return buildJsonResponse(completedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })

    expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    expect(document.querySelector("#export-button")).toBeNull()

    await user.click(screen.getByRole("button", { name: "전체 해제" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /NestJS/ }))
    await waitFor(() => {
      expect(document.querySelector("#selected-post-count")?.textContent).toContain("대상 글 5개 / 전체 12개")
      expect(document.querySelector("#summary")?.textContent).toContain("대상 글")
      expect(document.querySelector("#summary")?.textContent).toContain("5")
    })

    await user.click(screen.getByRole("button", { name: "구조 설정" }))
    expect(document.querySelector('[data-step-view="structure-options"]')).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "Frontmatter 설정" }))
    expect(document.querySelector('[data-step-view="frontmatter-options"]')).not.toBeNull()
    expect(await screen.findByText("글 제목을 기록합니다.")).toBeInTheDocument()

    const titleAliasInput = screen.getByPlaceholderText("title")
    await user.clear(titleAliasInput)
    await user.type(titleAliasInput, "postTitle")

    await user.click(screen.getByRole("button", { name: "Markdown 설정" }))
    expect(document.querySelector('[data-step-view="markdown-options"]')).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "Assets 설정" }))
    expect(document.querySelector('[data-step-view="assets-options"]')).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(document.querySelector("#summary")?.textContent).toContain("1")
    })

    expect(document.querySelector("#job-file-tree table")).not.toBeNull()
    expect(document.querySelector('[data-job-log-timestamp]')?.textContent).toBe("2026-04-11T04:00:00.000Z")
    expect(document.querySelector('[data-job-log-timestamp]')?.className).toContain("text-[11px]")
    expect(document.querySelector('[data-job-log-message]')?.textContent).toContain("작업을 큐에 등록했습니다.")
    expect(document.querySelector('[data-job-log-message]')?.className).toContain("whitespace-pre-wrap")
    expect((document.querySelector('#logs [data-slot="scroll-area-viewport"]') as HTMLElement | null)?.scrollTop).toBe(240)

    const errorFilterButton = document.querySelector('[data-job-filter="errors"]') as HTMLButtonElement
    expect(errorFilterButton).not.toBeNull()
    await user.click(errorFilterButton)
    expect(errorFilterButton).toHaveClass("is-active")

    const allFilterButton = document.querySelector('[data-job-filter="all"]') as HTMLButtonElement
    expect(allFilterButton).not.toBeNull()
    await user.click(allFilterButton)
    const item = document.querySelector('[data-job-item-id="posts/NestJS/test.md"]') as HTMLElement
    expect(item).not.toBeNull()
    expect(item.className).toContain("whitespace-normal")
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("hides setup panels while the export job is running", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-1" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-1")) {
        return buildJsonResponse(runningJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToAssetsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("running")
      expect(document.querySelector('[data-step-view="running"]')).not.toBeNull()
      expect(document.querySelector("#running-progress")).not.toBeNull()
      expect(document.querySelector("#running-progress")?.getAttribute("aria-valuenow")).toBe("40")
      expect(screen.queryByLabelText("블로그 ID 또는 URL")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "카테고리 불러오기" })).not.toBeInTheDocument()
      expect(document.querySelector("#export-button")).toBeNull()
      expect(document.querySelector("#category-panel")).toBeNull()
      expect(document.querySelector("#export-panel")).toBeNull()
    })
  })

  it("submits structured provider fields from the upload step and returns to results", async () => {
    let uploadPollCount = 0
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-upload" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-upload/upload")) {
        expect(init?.headers).toMatchObject({
          "x-requested-with": "XMLHttpRequest",
        })
        expect(init?.body).toBe(
          JSON.stringify({
            providerKey: "github",
            providerFields: {
              repo: "owner/name",
              token: "ghp_upload_secret",
            },
          }),
        )
        return buildJsonResponse({ jobId: "job-upload", status: "uploading" }, 202)
      }

      if (url.endsWith("/api/export/job-upload")) {
        uploadPollCount += 1

        if (uploadPollCount <= 2) {
          return buildJsonResponse(uploadReadyJob)
        }

        if (uploadPollCount <= 5) {
          return buildJsonResponse(uploadingJob)
        }

        return buildJsonResponse(uploadCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToAssetsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(document.querySelector("#upload-targets-table")).not.toBeNull()
      expect(document.querySelector("#upload-targets-scroll")).not.toBeNull()
      expect(document.querySelector("#upload-targets-scroll")?.className).toContain("max-h-[28rem]")
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("0")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("pending")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("pending")
      expect(document.querySelector("#upload-form")).not.toBeNull()
      expect(screen.getByLabelText("Provider")).toBeInTheDocument()
      expect(screen.getByLabelText("Repository")).toBeInTheDocument()
      expect(screen.getByLabelText("Token")).toBeInTheDocument()
      expect(document.querySelector("#job-file-tree")).toBeNull()
    })

    fireEvent.change(screen.getByLabelText("Repository"), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "ghp_upload_secret" },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("uploading")
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("75")
      expect(document.querySelector("#status-panel")?.textContent).toContain("업로드한 자산 수를 같은 작업에서 실시간으로 확인합니다.")
      expect(document.querySelector("#upload-form")).toBeNull()
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("complete")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("partial")
    }, { timeout: 7000 })

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(document.querySelector("#upload-targets-table")).not.toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("100")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("complete")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("complete")
      expect(document.querySelector('[data-job-item-id="NestJS/2026-04-11-1/index.md"]')?.textContent).toContain("2026-04-11-1")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("NestJS/2026-04-11-1/index.md")
      expect(document.querySelector("#status-panel")?.textContent).toContain(
        "업로드 결과와 대상별 상태를 최종 결과와 함께 확인합니다.",
      )
    }, { timeout: 7000 })
  })

  it("keeps the same job editable after upload failure and allows retry with corrected fields", async () => {
    let uploadAttempt = 0
    let jobFetchCount = 0
    const retryReadyJob: ExportJobState = {
      ...uploadReadyJob,
      id: "job-failed",
    }
    const retryFailedJob: ExportJobState = {
      ...uploadFailedJob,
      id: "job-failed",
    }
    const retryUploadingJob: ExportJobState = {
      ...uploadingJob,
      id: "job-failed",
    }
    const retryCompletedJob: ExportJobState = {
      ...uploadCompletedJob,
      id: "job-failed",
    }
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-failed" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-failed/upload")) {
        uploadAttempt += 1
        const body = JSON.parse(String(init?.body)) as {
          providerKey: string
          providerFields: Record<string, string>
        }

        expect(body.providerKey).toBe("github")

        if (uploadAttempt === 1) {
          expect(body.providerFields).toEqual({
            repo: "owner/name",
            token: "ghp_bad_secret",
          })
          return buildJsonResponse({ jobId: "job-failed", status: "uploading" }, 202)
        }

        expect(body.providerFields).toEqual({
          repo: "owner/name",
          token: "ghp_fixed_secret",
        })
        return buildJsonResponse({ jobId: "job-failed", status: "uploading" }, 202)
      }

      if (url.endsWith("/api/export/job-failed")) {
        jobFetchCount += 1

        if (jobFetchCount <= 2) {
          return buildJsonResponse(retryReadyJob)
        }

        if (jobFetchCount <= 4) {
          return buildJsonResponse(retryFailedJob)
        }

        if (jobFetchCount <= 6) {
          return buildJsonResponse(retryUploadingJob)
        }

        return buildJsonResponse(retryCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToAssetsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(screen.getByLabelText("Repository")).toBeInTheDocument()
      expect(screen.getByLabelText("Token")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("Repository"), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "ghp_bad_secret" },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-failed")
      expect(screen.getByText("PicGo upload failed.")).toBeInTheDocument()
      expect(document.querySelector("#upload-form")).not.toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("75")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("failed")
      expect(document.querySelector('#upload-targets-table [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("failed")
      expect(screen.getByLabelText("Provider")).toBeInTheDocument()
      expect(screen.getByLabelText("Repository")).toHaveValue("owner/name")
      expect(screen.getByLabelText("Token")).toHaveValue("ghp_bad_secret")
    })

    await user.clear(screen.getByLabelText("Token"))
    await user.type(screen.getByLabelText("Token"), "ghp_fixed_secret")
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(document.querySelector("#upload-targets-table")).not.toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("100")
    }, { timeout: 7000 })
  }, 12000)

  it("shows rewrite-pending copy when the upload bar is full but completion is not final yet", async () => {
    let jobFetchCount = 0
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-rewrite-pending" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-rewrite-pending/upload")) {
        return buildJsonResponse({ jobId: "job-rewrite-pending", status: "uploading" }, 202)
      }

      if (url.endsWith("/api/export/job-rewrite-pending")) {
        jobFetchCount += 1

        if (jobFetchCount <= 2) {
          return buildJsonResponse(uploadReadyJob)
        }

        if (jobFetchCount <= 6) {
          return buildJsonResponse(rewritePendingJob)
        }

        return buildJsonResponse(uploadCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToAssetsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(document.querySelector("#upload-form")).not.toBeNull()
    })

    fireEvent.change(screen.getByLabelText("Repository"), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText("Token"), {
      target: { value: "ghp_upload_secret" },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("uploading")
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("100")
      expect(document.querySelector("#status-panel")?.textContent).toContain(
        "자산 업로드는 끝났고 결과 파일에 URL을 반영하는 중입니다.",
      )
      expect(document.querySelector("#upload-form")).toBeNull()
    })
  })

  it("hides the upload form when the export completed with skipped-no-candidates", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-skipped" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-skipped")) {
        return buildJsonResponse(skippedUploadJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToAssetsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(screen.getByText("업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.")).toBeInTheDocument()
    })
    expect(screen.queryByLabelText("Provider")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Repository")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Token")).not.toBeInTheDocument()
  })
})
