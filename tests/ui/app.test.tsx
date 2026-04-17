// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
import { markdownShowcase } from "../fixtures/markdown-showcase.js"

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
    ...Array.from({ length: 5 }, (_, index) =>
      buildPostSummary(index + 1, 101, "NestJS"),
    ),
    ...Array.from({ length: 7 }, (_, index) =>
      buildPostSummary(index + 6, 202, "React"),
    ),
  ],
}

const previewMarkdown = markdownShowcase
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
      markdown: previewMarkdown,
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

  return options
})()

const uploadItem = {
  ...completedJob.items[0]!,
  id: "NestJS/2026-04-11-1/index.md",
  outputPath: "NestJS/2026-04-11-1/index.md",
  assetPaths: ["thumbnail-01.png", "image-01.png"],
  upload: {
    eligible: true,
    candidateCount: 2,
    uploadedCount: 0,
    failedCount: 0,
    candidates: [
      {
        kind: "thumbnail" as const,
        sourceUrl: "https://example.com/thumb.png",
        localPath: "NestJS/2026-04-11-1/thumbnail-01.png",
        markdownReference: "thumbnail-01.png",
      },
      {
        kind: "image" as const,
        sourceUrl: "https://example.com/image.png",
        localPath: "NestJS/2026-04-11-1/image-01.png",
        markdownReference: "image-01.png",
      },
    ],
  },
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
    eligiblePostCount: 1,
    candidateCount: 2,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  items: [uploadItem],
}

const uploadingJob: ExportJobState = {
  ...uploadReadyJob,
  status: "uploading",
  upload: {
    ...uploadReadyJob.upload,
    status: "uploading",
    uploadedCount: 1,
  },
}

const uploadCompletedJob: ExportJobState = {
  ...uploadReadyJob,
  status: "upload-completed",
  finishedAt: "2026-04-11T04:00:03.000Z",
  upload: {
    ...uploadReadyJob.upload,
    status: "upload-completed",
    uploadedCount: 2,
  },
  items: [
    {
      ...uploadItem,
      assetPaths: [
        "https://cdn.example.com/thumbnail-01.png",
        "https://cdn.example.com/image-01.png",
      ],
      markdown: previewMarkdown.replaceAll("test.md", "https://cdn.example.com/image-01.png"),
      upload: {
        ...uploadItem.upload,
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
    failedCount: 2,
  },
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
  it("runs the main export flow with preview, filters, and modal rendering", async () => {
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

      if (url.endsWith("/api/preview")) {
        return buildJsonResponse({
          candidatePost: {
            blogId: "mym0404",
            logNo: "1",
            title: "테스트 글",
            publishedAt: "2026-04-11T04:00:00.000Z",
            categoryId: 101,
            categoryName: "NestJS",
            source: "https://blog.naver.com/mym0404/1",
            editorVersion: 4,
            thumbnailUrl: null,
          },
          markdown: previewMarkdown,
          markdownFilePath: "posts/NestJS/test.md",
          editorVersion: 4,
          blockTypes: ["heading"],
          parserWarnings: ["parser note"],
          reviewerWarnings: [],
          renderWarnings: [],
          assetPaths: [],
        })
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({
          jobId: "job-1",
        }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-1")) {
        return buildJsonResponse(completedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Blog ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 스캔" }))

    await screen.findByText("mym0404 스캔 완료")
    expect(document.querySelector("#scan-button")?.closest("#scan-workbench")).not.toBeNull()
    expect(document.querySelector("#export-button")?.closest(".app-sidebar")).not.toBeNull()

    await user.click(screen.getByRole("tab", { name: "Frontmatter" }))
    expect(await screen.findByText("글 제목을 기록합니다.")).toBeInTheDocument()
    const titleAliasInput = screen.getByPlaceholderText("title")
    const sourceAliasInput = screen.getByPlaceholderText("source")
    await user.type(titleAliasInput, "shared")
    await user.type(sourceAliasInput, "shared")

    expect(await screen.findByText(/title와 source가 같은 alias "shared"/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "내보내기" })).toBeDisabled()

    await user.clear(titleAliasInput)
    await user.type(titleAliasInput, "postTitle")
    await user.clear(sourceAliasInput)

    await user.click(screen.getByRole("button", { name: "전체 해제" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /NestJS/ }))
    await waitFor(() => {
      expect(document.querySelector("#selected-post-count")?.textContent).toContain("대상 글 5개 / 전체 12개")
      expect(document.querySelector("#summary")?.textContent).toContain("총 글5")
      expect(document.querySelector("#summary")?.textContent).toContain("남음5")
    })

    await user.click(screen.getByRole("button", { name: "예시 보기" }))

    await waitFor(() => {
      expect(document.querySelector("#preview-markdown")?.textContent).toContain("postTitle:")
      expect(document.querySelector("#preview-markdown")?.textContent).toContain("테스트 글")
    })
    expect(document.querySelector(".preview-content-grid")?.className).not.toContain("xl:grid-cols-2")
    expect(document.querySelector("#preview-markdown")?.className).toContain("m-0")

    await user.click(screen.getByTitle("결과보기"))
    await waitFor(() => {
      const renderedPreview = document.querySelector("#preview-rendered")
      expect(renderedPreview?.textContent).toContain("Frontmatter")
      expect(renderedPreview?.textContent).toContain("postTitle:")
    })
    expect(document.querySelector(".preview-content-grid")?.className).not.toContain("xl:grid-cols-2")
    expect(document.querySelector("#preview-rendered .hljs-keyword")).not.toBeNull()

    await user.click(screen.getByTitle("같이보기"))
    await waitFor(() => {
      expect(document.querySelector(".preview-content-grid")?.className).toContain("xl:grid-cols-2")
      expect(document.querySelector("#preview-markdown")).not.toBeNull()
      expect(document.querySelector("#preview-rendered")).not.toBeNull()
    })

    await user.click(screen.getByRole("button", { name: "내보내기" }))
    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("completed")
      expect(document.querySelector("#summary")?.textContent).toContain("1")
    })
    expect(document.querySelector('[data-job-log-timestamp]')?.textContent).toBe("2026-04-11T04:00:00.000Z")
    expect(document.querySelector('[data-job-log-timestamp]')?.className).toContain("text-[11px]")
    expect(document.querySelector('[data-job-log-message]')?.textContent).toContain("작업을 큐에 등록했습니다.")
    expect(document.querySelector('[data-job-log-message]')?.className).toContain("whitespace-pre-wrap")
    expect((document.querySelector('#logs [data-slot="scroll-area-viewport"]') as HTMLElement | null)?.scrollTop).toBe(240)
    const previewOrder =
      document.querySelector("#preview-panel")?.compareDocumentPosition(document.querySelector("#status-panel") ?? document.body) ?? 0
    expect((previewOrder & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)

    const errorFilterButton = document.querySelector('[data-job-filter="errors"]') as HTMLButtonElement
    expect(errorFilterButton).not.toBeNull()
    await user.click(errorFilterButton)
    expect(errorFilterButton).toHaveClass("is-active")

    const allFilterButton = document.querySelector('[data-job-filter="all"]') as HTMLButtonElement
    expect(allFilterButton).not.toBeNull()
    await user.click(allFilterButton)
    const item = document.querySelector('[data-job-item-id="posts/NestJS/test.md"]') as HTMLButtonElement
    expect(item).not.toBeNull()
    expect(item.className).toContain("whitespace-normal")
    await user.click(item)
    expect(document.querySelector("#job-file-tree table")).not.toBeNull()
    expect(document.querySelector("#category-list table")).not.toBeNull()

    const reactCheckbox = document.querySelector('[data-category-id="202"] button[role="checkbox"]')
    expect(reactCheckbox).not.toBeNull()
    fireEvent.click(reactCheckbox as Element)
    await waitFor(() => {
      expect(document.querySelector("#summary")?.textContent).toContain("총 글12")
      expect(document.querySelector("#summary")?.textContent).toContain("남음12")
    })

    const modal = document.querySelector('[role="dialog"]') as HTMLElement
    expect(modal).not.toBeNull()
    expect(within(modal).getByText("결과 미리보기")).toBeInTheDocument()
    expect(modal.className).toContain("!w-[calc(100vw-1.5rem)]")
    expect(modal.className).toContain("!max-w-[96rem]")
    expect(document.querySelector("#markdown-modal-body")?.textContent).toContain("postTitle:")
    expect(document.querySelector("#markdown-modal-body")?.textContent).toContain("테스트 글")
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
        return buildJsonResponse(
          {
            jobId: "job-1",
          },
          init?.method === "POST" ? 202 : 200,
        )
      }

      if (url.endsWith("/api/export/job-1")) {
        return buildJsonResponse(runningJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Blog ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 스캔" }))
    await screen.findByText("mym0404 스캔 완료")

    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("running")
      expect(screen.getByLabelText("Blog ID 또는 URL")).toBeDisabled()
      expect(screen.getByRole("button", { name: "카테고리 스캔" })).toBeDisabled()
      expect(document.querySelector("#export-button")).toBeDisabled()
      expect(document.querySelector("#category-panel")).toBeNull()
      expect(document.querySelector("#export-panel")).toBeNull()
      expect(document.querySelector("#preview-panel")).toBeNull()
      expect(document.querySelector('[data-section-link="category-panel"]')).toBeNull()
      expect(document.querySelector('[data-mobile-section-link="preview-panel"]')).toBeNull()
    })
  })

  it("shows upload-ready targets, submits upload config from the results panel, and keeps polling until upload completes", async () => {
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
        return buildJsonResponse({ jobId: "job-upload", status: "uploading" }, 202)
      }

      if (url.endsWith("/api/export/job-upload")) {
        uploadPollCount += 1

        if (uploadPollCount === 1) {
          return buildJsonResponse(uploadReadyJob)
        }

        if (uploadPollCount === 2) {
          return buildJsonResponse(uploadingJob)
        }

        return buildJsonResponse(uploadCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Blog ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 스캔" }))
    await screen.findByText("mym0404 스캔 완료")
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#upload-targets-table")).not.toBeNull()
      expect(screen.getByLabelText("uploaderKey")).toBeInTheDocument()
      expect(screen.getByLabelText("uploaderConfigJson")).toBeInTheDocument()
      expect(document.querySelector('[data-job-item-id="NestJS/2026-04-11-1/index.md"]')?.textContent).toContain("2026-04-11-1")
      expect(document.querySelector('[data-job-item-id="NestJS/2026-04-11-1/index.md"]')?.textContent).not.toContain("index.md")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("NestJS/2026-04-11-1/index.md")
    })

    expect(document.querySelector("#upload-targets-table")?.className).not.toContain("min-w-[")

    await user.type(screen.getByLabelText("uploaderKey"), "github")
    fireEvent.change(screen.getByLabelText("uploaderConfigJson"), {
      target: {
        value: '{"repo":"owner/name"}',
      },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-completed")
      expect(document.querySelector("#upload-targets-table")?.textContent).toContain("완료")
    })
  })

  it("renders failed upload state in the results panel", async () => {
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

      if (url.endsWith("/api/export/job-failed")) {
        return buildJsonResponse(uploadFailedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Blog ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 스캔" }))
    await screen.findByText("mym0404 스캔 완료")
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-failed")
      expect(screen.getByText("PicGo upload failed.")).toBeInTheDocument()
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

    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText("Blog ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 스캔" }))
    await screen.findByText("mym0404 스캔 완료")
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("completed")
      expect(screen.getByText("업로드할 로컬 이미지가 없어 export만 완료되었습니다.")).toBeInTheDocument()
    })
    expect(screen.queryByLabelText("uploaderKey")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("uploaderConfigJson")).not.toBeInTheDocument()
  })
})
