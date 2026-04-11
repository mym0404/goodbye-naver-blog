// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
  ],
}

const previewMarkdown = markdownShowcase

const completedJob: ExportJobState = {
  id: "job-1",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir: "./output",
    profile: "gfm",
    options: defaultExportOptions(),
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

afterEach(() => {
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
    expect(await screen.findByText("글 제목을 기록합니다.")).toBeInTheDocument()
    expect(document.querySelector("#scan-button")?.closest("#scan-workbench")).not.toBeNull()
    expect(document.querySelector("#export-button")?.closest(".app-sidebar")).not.toBeNull()

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
    const previewOrder =
      document.querySelector("#preview-panel")?.compareDocumentPosition(document.querySelector("#status-panel") ?? document.body) ?? 0
    expect((previewOrder & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)

    await user.click(screen.getByRole("button", { name: "에러" }))
    expect(screen.getByRole("button", { name: "에러" })).toHaveClass("is-active")

    await user.click(screen.getByRole("button", { name: "전체" }))
    const item = screen.getByRole("button", { name: /test\.md/ })
    await user.click(item)

    const modal = screen.getByRole("dialog", { name: "결과 미리보기" })
    expect(within(modal).getByText("결과 미리보기")).toBeInTheDocument()
    expect(document.querySelector("#markdown-modal-body")?.textContent).toContain("postTitle:")
    expect(document.querySelector("#markdown-modal-body")?.textContent).toContain("테스트 글")
  })
})
