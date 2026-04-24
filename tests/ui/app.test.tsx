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
import type { ExportJobState, ScanResult, UploadProviderCatalogResponse } from "../../src/shared/types.js"
import { App } from "../../src/ui/App.js"
import { createTestPath } from "../helpers/test-paths.js"

const testOutputDir = createTestPath("ui-app", "output")
const testResumeOutputDir = createTestPath("ui-app", "resume-output")

const buildJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

const selectOption = async ({
  user,
  trigger,
  value,
}: {
  user: ReturnType<typeof userEvent.setup>
  trigger: HTMLElement
  value: string
}) => {
  await user.click(trigger)

  await waitFor(() => {
    expect(document.querySelector(`[data-slot="select-item"][data-value="${value}"]`)).not.toBeNull()
  })

  await user.click(document.querySelector(`[data-slot="select-item"][data-value="${value}"]`) as HTMLElement)
}

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

const uploadProviderCatalog: UploadProviderCatalogResponse = {
  defaultProviderKey: "github",
  providers: [
    {
      key: "github",
      label: "GitHub",
      description: "리포지토리에 이미지를 커밋하고 URL로 사용합니다.",
      fields: [
        {
          key: "repo",
          label: "Repository",
          description: "업로드할 GitHub 저장소 경로입니다.",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "owner/repo",
        },
        {
          key: "branch",
          label: "Branch",
          description: "업로드를 커밋할 브랜치 이름입니다.",
          inputType: "text",
          required: false,
          defaultValue: "main",
          placeholder: "",
        },
        {
          key: "path",
          label: "Path",
          description: "원격 저장소 안에서 파일을 둘 하위 경로입니다.",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "images/posts",
        },
        {
          key: "token",
          label: "Token",
          description: "서비스 API 접근용 토큰을 입력합니다.",
          inputType: "password",
          required: true,
          defaultValue: null,
          placeholder: "ghp_xxx",
        },
        {
          key: "customUrl",
          label: "Custom URL",
          description: "최종 파일 URL을 직접 덮어쓸 때 사용합니다.",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "",
        },
      ],
    },
    {
      key: "tcyun",
      label: "Tencent COS",
      description: "Tencent COS 버킷에 이미지를 업로드합니다.",
      fields: [
        {
          key: "appId",
          label: "App ID",
          description: "스토리지 서비스의 앱 ID를 입력합니다.",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "",
        },
        {
          key: "permission",
          label: "Permission",
          description: "이미지 공개 범위 또는 접근 권한을 선택합니다.",
          inputType: "select",
          required: true,
          defaultValue: null,
          placeholder: "",
          options: [
            { label: "Public", value: 0 },
            { label: "Private", value: 1 },
          ],
        },
        {
          key: "port",
          label: "Port",
          description: "기본 포트 대신 사용할 포트 번호입니다.",
          inputType: "number",
          required: false,
          defaultValue: 36677,
          placeholder: "",
        },
        {
          key: "slim",
          label: "Slim",
          description: "COS 이미지 처리 압축 옵션을 함께 사용합니다.",
          inputType: "checkbox",
          required: false,
          defaultValue: false,
          placeholder: "압축 경로 사용",
        },
      ],
    },
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
    outputDir: testOutputDir,
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
        uploadedUrls: [],
        rewriteStatus: "pending" as const,
        rewrittenAt: null,
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
  items: [
    completedJob.items[0]!,
    {
      ...completedJob.items[0]!,
      id: "posts/React/test-2.md",
      logNo: "2",
      title: "진행 중에 먼저 끝난 글",
      source: "https://blog.naver.com/mym0404/2",
      category: {
        id: 102,
        name: "React",
        path: ["React"],
      },
      outputPath: "posts/React/test-2.md",
      updatedAt: "2026-04-11T04:00:02.000Z",
    },
  ],
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

const uploadItem: ExportJobState["items"][number] = {
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
    uploadedUrls: [],
    rewriteStatus: "pending" as const,
    rewrittenAt: null,
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
        uploadedUrls: [
          "https://cdn.example.com/shared.png",
          "https://cdn.example.com/detail.png",
        ],
        rewriteStatus: "completed",
        rewrittenAt: "2026-04-11T04:00:03.000Z",
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
        uploadedUrls: [
          "https://cdn.example.com/shared.png",
          "https://cdn.example.com/detail.png",
        ],
        rewriteStatus: "completed",
        rewrittenAt: "2026-04-11T04:00:03.000Z",
      },
    },
  ],
}

const uploadFailedJob: ExportJobState = {
  ...uploadReadyJob,
  status: "upload-failed",
  error: "Image upload failed.",
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

const waitForAutosave = () => new Promise((resolve) => setTimeout(resolve, 350))

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
  vi.stubGlobal("scrollTo", vi.fn())
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  })
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  })
})

describe("App", () => {
  const getBootstrapResponse = (url: string) => {
    if (url.endsWith("/api/export-defaults")) {
      return buildJsonResponse({
        profile: "gfm",
        options: defaultExportOptions(),
        lastOutputDir: testOutputDir,
        resumedJob: null,
        resumeSummary: null,
        resumedScanResult: null,
        frontmatterFieldOrder,
        frontmatterFieldMeta,
        optionDescriptions,
      })
    }

    if (url.endsWith("/api/export-resume/lookup")) {
      return buildJsonResponse({
        resumedJob: null,
        resumeSummary: null,
        resumedScanResult: null,
      })
    }

    if (url.endsWith("/api/upload-providers")) {
      return buildJsonResponse(uploadProviderCatalog)
    }

    return null
  }

  const renderApp = () => {
    const user = userEvent.setup()
    render(<App />)
    return user
  }

  const moveToDiagnosticsStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })
    await user.click(screen.getByRole("button", { name: "구조 설정" }))
    await user.click(screen.getByRole("button", { name: "Frontmatter 설정" }))
    await user.click(screen.getByRole("button", { name: "Markdown 설정" }))
    await user.click(screen.getByRole("button", { name: "Assets 설정" }))
    await user.click(screen.getByRole("button", { name: "Link 처리" }))
    await user.click(screen.getByRole("button", { name: "진단 설정" }))
  }

  it("restores persisted options from the bootstrap response", async () => {
    const persistedOptions = defaultExportOptions()
    persistedOptions.structure.groupByCategory = false
    persistedOptions.frontmatter.aliases.title = "postTitle"

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: persistedOptions,
          lastOutputDir: testOutputDir,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/export-resume/lookup")) {
        return buildJsonResponse({
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
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

    await user.click(screen.getByRole("button", { name: "구조 설정" }))
    expect(screen.getByRole("checkbox", { name: /카테고리 폴더 유지/ })).not.toBeChecked()

    await user.click(screen.getByRole("button", { name: "Frontmatter 설정" }))
    expect(screen.getByPlaceholderText("title")).toHaveValue("postTitle")
  })

  it("shows a bootstrap loading state before deciding whether to resume", async () => {
    const bootstrapRequest = {
      resolve: null as ((value: Response) => void) | null,
    }

    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return new Promise<Response>((resolve) => {
          bootstrapRequest.resolve = resolve
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    renderApp()

    expect(screen.getByRole("status")).toHaveTextContent("작업 상태를 확인하는 중입니다.")
    expect(screen.getByText("이전 작업을 다시 불러올지, 새로 시작할지 확인하고 있습니다.")).toBeInTheDocument()
    expect(document.querySelector('[data-step-view="bootstrap-loading"]')).not.toBeNull()
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true")

    await waitFor(() => {
      expect(bootstrapRequest.resolve).not.toBeNull()
    })

    if (!bootstrapRequest.resolve) {
      throw new Error("bootstrap response resolver was not captured")
    }

    bootstrapRequest.resolve(
      buildJsonResponse({
        profile: "gfm",
        options: defaultExportOptions(),
        lastOutputDir: testOutputDir,
        resumedJob: null,
        resumeSummary: null,
        resumedScanResult: null,
        frontmatterFieldOrder,
        frontmatterFieldMeta,
        optionDescriptions,
      }),
    )

    expect(await screen.findByLabelText("블로그 ID 또는 URL")).toBeInTheDocument()
  })

  it("renders the category table without separate path and depth columns", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))

    const table = await screen.findByRole("table")

    expect(within(table).getByRole("columnheader", { name: "선택" })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: "카테고리" })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: "글 수" })).toBeInTheDocument()
    expect(within(table).queryByRole("columnheader", { name: "경로" })).not.toBeInTheDocument()
    expect(within(table).queryByRole("columnheader", { name: "깊이" })).not.toBeInTheDocument()
  })

  it("marks the blog input and status copy as errors when the scan request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse({ error: "API 요청 실패: 404 Not Found" }, 404)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "23213213213")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))

    await waitFor(() => {
      expect(document.querySelector("#scan-status")?.textContent).toContain("API 요청 실패: 404 Not Found")
    })

    expect(screen.getByLabelText("블로그 ID 또는 URL")).toHaveAttribute("aria-invalid", "true")
    expect(document.querySelector('[data-step-view="blog-input"]')).not.toBeNull()
  })

  it("opens a resume dialog and restores the last running step from bootstrap", async () => {
    const resumedJob: ExportJobState = {
      ...completedJob,
      id: "job-resumed",
      status: "running",
      resumeAvailable: true,
      finishedAt: null,
      request: {
        ...completedJob.request,
        outputDir: testResumeOutputDir,
      },
      progress: {
        total: 12,
        completed: 5,
        failed: 1,
        warnings: 1,
      },
    }

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: testResumeOutputDir,
          resumedJob,
          resumeSummary: {
            status: "running",
            outputDir: testResumeOutputDir,
            totalPosts: 12,
            completedCount: 5,
            failedCount: 1,
            uploadCandidateCount: 0,
            uploadedCount: 0,
          },
          resumedScanResult: scanResult,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/upload-providers")) {
        return buildJsonResponse(uploadProviderCatalog)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("이전 작업을 다시 불러왔습니다.")).toBeInTheDocument()
    expect(
      within(dialog).getByText((_, element) => element?.textContent === "상태 running"),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText((_, element) => element?.textContent === `출력 경로 ${testResumeOutputDir}`),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-step-view="running"]')).not.toBeNull()
    expect(within(dialog).queryByRole("button", { name: "닫기" })).toBeNull()
    await user.click(within(dialog).getByRole("button", { name: "불러오기" }))
    expect(screen.getByRole("button", { name: "남은 작업 계속" })).toBeInTheDocument()
  })

  it("resets the resumed output from the dialog", async () => {
    const resumedJob: ExportJobState = {
      ...completedJob,
      id: "job-reset",
      status: "running",
      resumeAvailable: true,
      finishedAt: null,
      request: {
        ...completedJob.request,
        outputDir: testResumeOutputDir,
      },
      progress: {
        total: 12,
        completed: 5,
        failed: 1,
        warnings: 1,
      },
    }

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: testResumeOutputDir,
          resumedJob,
          resumeSummary: {
            status: "running",
            outputDir: testResumeOutputDir,
            totalPosts: 12,
            completedCount: 5,
            failedCount: 1,
            uploadCandidateCount: 0,
            uploadedCount: 0,
          },
          resumedScanResult: scanResult,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/export-reset")) {
        expect(init?.method).toBe("POST")
        expect(init?.body).toBe(
          JSON.stringify({
            outputDir: testResumeOutputDir,
            jobId: "job-reset",
          }),
        )

        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: testOutputDir,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "작업 초기화" }))

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(document.querySelector('[data-step-view="blog-input"]')).not.toBeNull()
    })

    expect(screen.getByLabelText("블로그 ID 또는 URL")).toHaveValue("")
    expect(screen.queryByRole("button", { name: "남은 작업 계속" })).not.toBeInTheDocument()
  })

  it("asks whether to restore a resumable path before scanning categories", async () => {
    const resumedJob: ExportJobState = {
      ...runningJob,
      id: "job-existing-output",
      resumeAvailable: true,
      request: {
        ...runningJob.request,
        outputDir: testResumeOutputDir,
      },
    }

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-resume/lookup")) {
        expect(init?.method).toBe("POST")
        expect(init?.body).toBe(JSON.stringify({ outputDir: testResumeOutputDir }))
        return buildJsonResponse({
          resumedJob,
          resumeSummary: {
            status: "running",
            outputDir: testResumeOutputDir,
            totalPosts: 5,
            completedCount: 2,
            failedCount: 0,
            uploadCandidateCount: 0,
            uploadedCount: 0,
          },
          resumedScanResult: scanResult,
        })
      }

      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/export-resume/restore")) {
        expect(init?.method).toBe("POST")
        expect(init?.body).toBe(JSON.stringify({ outputDir: testResumeOutputDir }))
        return buildJsonResponse({
          resumedJob,
          resumeSummary: {
            status: "running",
            outputDir: testResumeOutputDir,
            totalPosts: 5,
            completedCount: 2,
            failedCount: 0,
            uploadCandidateCount: 0,
            uploadedCount: 0,
          },
          resumedScanResult: scanResult,
        })
      }

      if (url.endsWith("/api/scan")) {
        throw new Error("scan should not start before the user chooses")
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.clear(screen.getByRole("textbox", { name: /출력 경로/ }))
    await user.type(screen.getByRole("textbox", { name: /출력 경로/ }), testResumeOutputDir)
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("진행 중인 작업이 있습니다.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "닫기" })).toBeNull()

    await user.click(within(dialog).getByRole("button", { name: "불러오기" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "남은 작업 계속" })).toBeInTheDocument()
    })
  })

  it("resets a resumable path and continues category scan from the first screen", async () => {
    const resumedJob: ExportJobState = {
      ...runningJob,
      id: "job-existing-output",
      resumeAvailable: true,
      request: {
        ...runningJob.request,
        outputDir: testResumeOutputDir,
      },
    }

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-resume/lookup")) {
        return buildJsonResponse({
          resumedJob,
          resumeSummary: {
            status: "running",
            outputDir: testResumeOutputDir,
            totalPosts: 5,
            completedCount: 2,
            failedCount: 0,
            uploadCandidateCount: 0,
            uploadedCount: 0,
          },
          resumedScanResult: scanResult,
        })
      }

      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/export-reset")) {
        expect(init?.method).toBe("POST")
        expect(init?.body).toBe(
          JSON.stringify({
            outputDir: testResumeOutputDir,
            jobId: "job-existing-output",
          }),
        )

        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: testOutputDir,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/scan")) {
        expect(init?.method).toBe("POST")
        return buildJsonResponse(scanResult)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.clear(screen.getByRole("textbox", { name: /출력 경로/ }))
    await user.type(screen.getByRole("textbox", { name: /출력 경로/ }), testResumeOutputDir)
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "작업 초기화" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })
  })

  it("warns before leaving the page when the user has started entering values", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent
    Object.defineProperty(event, "returnValue", {
      configurable: true,
      writable: true,
      value: undefined,
    })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(event.returnValue).toBe("")
  })

  it("autosaves sanitized options and ignores blog, output, and category-only changes", async () => {
    const savedPayloads: Array<{
      options?: {
        scope?: {
          categoryIds?: number[]
        }
        structure?: {
          groupByCategory?: boolean
        }
      }
    }> = []

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export-settings")) {
        savedPayloads.push(JSON.parse(String(init?.body ?? "{}")) as (typeof savedPayloads)[number])
        return new Response(null, {
          status: 204,
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await waitForAutosave()
    expect(savedPayloads).toEqual([])

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await waitForAutosave()
    expect(savedPayloads).toEqual([])

    await user.clear(screen.getByRole("textbox", { name: /출력 경로/ }))
    await user.type(screen.getByRole("textbox", { name: /출력 경로/ }), "/tmp/custom-output")
    await waitForAutosave()
    expect(savedPayloads).toEqual([])

    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })

    await waitForAutosave()
    expect(savedPayloads).toEqual([])

    await user.click(screen.getByRole("button", { name: "전체 해제" }))
    await user.click(screen.getByRole("checkbox", { name: /NestJS/ }))
    await waitForAutosave()
    expect(savedPayloads).toEqual([])

    await user.click(screen.getByRole("button", { name: "구조 설정" }))
    await user.click(screen.getByRole("checkbox", { name: /카테고리 폴더 유지/ }))

    await waitFor(() => {
      expect(savedPayloads).toHaveLength(1)
    })

    expect(savedPayloads[0]?.options?.scope?.categoryIds).toBeUndefined()
    expect(savedPayloads[0]?.options?.structure?.groupByCategory).toBe(false)
  })

  it("shows the output path input in the blog step and hides it in the structure step", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    expect(document.querySelector('[data-step-view="blog-input"] #outputDir')).not.toBeNull()

    await user.type(screen.getByLabelText("블로그 ID 또는 URL"), "mym0404")
    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })

    await user.click(screen.getByRole("button", { name: "구조 설정" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="structure-options"]')).not.toBeNull()
    })

    expect(document.querySelector('[data-step-view="structure-options"] #outputDir')).toBeNull()
  })

  it("restores the bootstrap output path when the field is left empty", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      throw new Error(`unexpected fetch: ${url}`)
    }))

    const user = renderApp()
    const outputDirInput = screen.getByRole("textbox", { name: /출력 경로/ })

    await user.clear(outputDirInput)
    fireEvent.blur(outputDirInput)

    expect(outputDirInput).toHaveValue(testOutputDir)
  })

  it("runs the main export flow in the wizard without preview or modal", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        expect(init?.body).toBe(
          JSON.stringify({
            blogIdOrUrl: "mym0404",
            outputDir: testOutputDir,
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
    await user.click(screen.getByRole("button", { name: "Link 처리" }))
    expect(document.querySelector('[data-step-view="links-options"]')).not.toBeNull()
    await user.click(screen.getByRole("button", { name: "진단 설정" }))
    expect(document.querySelector('[data-step-view="diagnostics-options"]')).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(document.querySelector("#summary")?.textContent).toContain("1")
    })

    expect(document.querySelector("#job-file-tree table")).not.toBeNull()
    expect(document.querySelector('[data-job-log-timestamp]')?.textContent).toBe("2026-04-11T04:00:00.000Z")
    expect(document.querySelector('[data-job-log-message]')?.textContent).toContain("작업을 큐에 등록했습니다.")
    expect((document.querySelector('#logs [data-slot="scroll-area-viewport"]') as HTMLElement | null)?.scrollTop).toBe(240)

    const errorFilterButton = document.querySelector('[data-job-filter="errors"]') as HTMLButtonElement
    expect(errorFilterButton).not.toBeNull()
    await user.click(errorFilterButton)

    const allFilterButton = document.querySelector('[data-job-filter="all"]') as HTMLButtonElement
    expect(allFilterButton).not.toBeNull()
    await user.click(allFilterButton)
    const item = document.querySelector('[data-job-item-id="posts/NestJS/test.md"]') as HTMLElement
    expect(item).not.toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("scrolls to the top when moving to the next setup step", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
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

    const scrollToSpy = vi.mocked(window.scrollTo)
    const scrollIntoViewSpy = vi.mocked(HTMLElement.prototype.scrollIntoView)

    scrollToSpy.mockClear()
    scrollIntoViewSpy.mockClear()

    await user.click(screen.getByRole("button", { name: "구조 설정" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="structure-options"]')).not.toBeNull()
    })

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "smooth",
    })
    expect(scrollIntoViewSpy).toHaveBeenCalled()
  })

  it("reuses cached categories by default and forces a fresh scan when requested", async () => {
    let scanRequestCount = 0
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        scanRequestCount += 1
        return buildJsonResponse(scanResult)
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

    expect(scanRequestCount).toBe(1)

    await user.click(screen.getByRole("button", { name: "이전" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="blog-input"]')).not.toBeNull()
    })
    expect(screen.getByRole("button", { name: "강제로 불러오기" })).toHaveAttribute("title", "캐시 무효화")

    await user.click(screen.getByRole("button", { name: "카테고리 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })
    expect(scanRequestCount).toBe(1)

    await user.click(screen.getByRole("button", { name: "이전" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="blog-input"]')).not.toBeNull()
    })

    await user.click(screen.getByRole("button", { name: "강제로 불러오기" }))
    await waitFor(() => {
      expect(document.querySelector('[data-step-view="category-selection"]')).not.toBeNull()
    })
    expect(scanRequestCount).toBe(2)
  })

  it("hides setup panels while the export job is running", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
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

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("running")
      expect(document.querySelector('[data-step-view="running"]')).not.toBeNull()
      expect(document.querySelector("#running-progress")).not.toBeNull()
      expect(document.querySelector("#running-progress")?.getAttribute("aria-valuenow")).toBe("40")
      expect(document.querySelector("#job-file-tree table")).not.toBeNull()
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("NestJS")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("test.md")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("업로드 상태")
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
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
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
        expect(JSON.parse(String(init?.body))).toEqual({
          providerKey: "github",
          providerFields: {
            branch: "main",
            customUrl: "https://cdn.jsdelivr.net/gh/owner/name@main",
            repo: "owner/name",
            token: "ghp_upload_secret",
          },
        })
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
    let jsDelivrToggle: HTMLElement | null = null

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(document.querySelector("#upload-targets-table")).toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("0")
      expect(document.querySelector('#job-file-tree [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("pending")
      expect(document.querySelector('#job-file-tree [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("pending")
      expect(document.querySelector("#upload-form")).not.toBeNull()
      expect(document.querySelector("#upload-providerKey")).not.toBeNull()
      expect(screen.getByLabelText(/^Repository\b/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Branch\b/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Token\b/)).toBeInTheDocument()
      jsDelivrToggle = screen.getByRole("checkbox", { name: /jsDelivr CDN 사용/i })
      expect(jsDelivrToggle).not.toBeChecked()
      expect(document.querySelector("#job-file-tree")).not.toBeNull()
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("NestJS")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("2026-04-11-1")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("업로드 상태")
    })

    fireEvent.change(screen.getByLabelText(/^Repository\b/), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText(/^Branch\b/), {
      target: { value: "main" },
    })
    fireEvent.change(screen.getByLabelText(/^Token\b/), {
      target: { value: "ghp_upload_secret" },
    })
    fireEvent.change(screen.getByLabelText(/^Custom URL\b/), {
      target: { value: "https://raw.example.com" },
    })
    expect(jsDelivrToggle).not.toBeNull()

    if (!jsDelivrToggle) {
      throw new Error("jsDelivr toggle not found")
    }

    await user.click(jsDelivrToggle)
    expect(screen.getByLabelText(/^Custom URL\b/)).toBeDisabled()
    expect(screen.getByLabelText(/^Custom URL\b/)).toHaveValue("https://raw.example.com")
    expect((document.querySelector("#upload-github-jsdelivr-preview") as HTMLInputElement | null)?.value).toBe(
      "https://cdn.jsdelivr.net/gh/owner/name@main",
    )
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(
        ["uploading", "upload-completed"].some((status) =>
          document.querySelector("#status-text")?.textContent?.includes(status),
        ),
      ).toBe(true)
      expect(document.querySelector("#upload-form")).toBeNull()
    }, { timeout: 7000 })

    await waitFor(() => {
      const firstUploadRow = document.querySelector(
        '#job-file-tree [data-upload-row-id="NestJS/2026-04-11-1/index.md"]',
      )
      const secondUploadRow = document.querySelector(
        '#job-file-tree [data-upload-row-id="React/2026-04-12-2/index.md"]',
      )

      expect(document.querySelector("#status-text")?.textContent).toContain("upload-completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(document.querySelector("#upload-targets-table")).toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("100")
      expect(firstUploadRow?.getAttribute("data-upload-row-status")).toBe("complete")
      expect(secondUploadRow?.getAttribute("data-upload-row-status")).toBe("complete")
      expect(firstUploadRow?.textContent).toContain("#1")
      expect(firstUploadRow?.textContent).toContain("#2")
      expect(secondUploadRow?.textContent).toContain("#1")
      expect(secondUploadRow?.textContent).toContain("#2")
      expect(firstUploadRow?.querySelectorAll("a")).toHaveLength(2)
      expect(secondUploadRow?.querySelectorAll("a")).toHaveLength(2)
      expect(document.querySelector('[data-job-item-id="NestJS/2026-04-11-1/index.md"]')?.textContent).toContain("2026-04-11-1")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("NestJS")
      expect(document.querySelector("#job-file-tree")?.textContent).toContain("2026-04-11-1")
    }, { timeout: 7000 })
  }, 10000)

  it("keeps provider-specific values when switching upload providers", async () => {
    let jobFetchCount = 0
    const providerSwitchReadyJob: ExportJobState = {
      ...uploadReadyJob,
      id: "job-provider-switch",
    }
    const providerSwitchCompletedJob: ExportJobState = {
      ...uploadCompletedJob,
      id: "job-provider-switch",
    }
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-provider-switch" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-provider-switch/upload")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          providerKey: "tcyun",
          providerFields: {
            appId: "app-123",
            permission: 1,
            port: 2443,
            slim: true,
          },
        })

        return buildJsonResponse({ jobId: "job-provider-switch", status: "uploading" }, 202)
      }

      if (url.endsWith("/api/export/job-provider-switch")) {
        jobFetchCount += 1

        return buildJsonResponse(jobFetchCount <= 2 ? providerSwitchReadyJob : providerSwitchCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(screen.getByLabelText(/^Repository\b/)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/^Repository\b/), "owner/name")
    await user.click(screen.getByRole("checkbox", { name: /jsDelivr CDN 사용/i }))
    await selectOption({
      user,
      trigger: document.querySelector("#upload-providerKey") as HTMLElement,
      value: "tcyun",
    })

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Repository\b/)).toBeNull()
      expect(screen.getByLabelText(/^App ID\b/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Permission\b/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Port\b/)).toBeInTheDocument()
      expect(screen.getByRole("checkbox", { name: /Slim/i })).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/^Permission\b/)).toHaveAttribute("data-value", "0")
    await user.type(screen.getByLabelText(/^App ID\b/), "app-123")
    await selectOption({
      user,
      trigger: screen.getByLabelText(/^Permission\b/),
      value: "1",
    })
    await user.clear(screen.getByLabelText(/^Port\b/))
    await user.type(screen.getByLabelText(/^Port\b/), "2443")
    await user.click(screen.getByRole("checkbox", { name: /Slim/i }))

    await selectOption({
      user,
      trigger: document.querySelector("#upload-providerKey") as HTMLElement,
      value: "github",
    })
    expect(screen.getByLabelText(/^Repository\b/)).toHaveValue("owner/name")
    expect(screen.getByRole("checkbox", { name: /jsDelivr CDN 사용/i })).toBeChecked()

    await selectOption({
      user,
      trigger: document.querySelector("#upload-providerKey") as HTMLElement,
      value: "tcyun",
    })
    expect(screen.getByLabelText(/^App ID\b/)).toHaveValue("app-123")
    expect(screen.getByLabelText(/^Permission\b/)).toHaveAttribute("data-value", "1")
    expect(screen.getByLabelText(/^Port\b/)).toHaveValue(2443)
    expect(screen.getByRole("checkbox", { name: /Slim/i })).toBeChecked()

    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-completed")
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
    }, { timeout: 7000 })
  }, 10000)

  it("loads upload providers only when needed and hides internal runtime errors", async () => {
    let uploadProviderRequestCount = 0
    let jobFetchCount = 0
    const uploadErrorReadyJob: ExportJobState = {
      ...uploadReadyJob,
      id: "job-upload-error",
    }
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()

      if (url.endsWith("/api/export-defaults")) {
        return buildJsonResponse({
          profile: "gfm",
          options: defaultExportOptions(),
          lastOutputDir: testOutputDir,
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
          frontmatterFieldOrder,
          frontmatterFieldMeta,
          optionDescriptions,
        })
      }

      if (url.endsWith("/api/upload-providers")) {
        uploadProviderRequestCount += 1
        return buildJsonResponse(
          {
            error: "runtime bootstrap failed",
          },
          503,
        )
      }

      if (url.endsWith("/api/export-resume/lookup")) {
        return buildJsonResponse({
          resumedJob: null,
          resumeSummary: null,
          resumedScanResult: null,
        })
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-upload-error" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-upload-error")) {
        jobFetchCount += 1
        return buildJsonResponse(uploadErrorReadyJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToDiagnosticsStep(user)
    expect(uploadProviderRequestCount).toBe(0)

    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(jobFetchCount).toBeGreaterThan(0)
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(screen.getByText("업로드 설정을 불러오지 못했습니다.")).toBeInTheDocument()
    })

    expect(uploadProviderRequestCount).toBe(1)
    expect(screen.queryByText("runtime bootstrap failed")).toBeNull()
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
    const retryCompletedJob: ExportJobState = {
      ...uploadCompletedJob,
      id: "job-failed",
    }
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
      }

      if (url.endsWith("/api/scan")) {
        return buildJsonResponse(scanResult)
      }

      if (url.endsWith("/api/export")) {
        return buildJsonResponse({ jobId: "job-failed" }, init?.method === "POST" ? 202 : 200)
      }

      if (url.endsWith("/api/export/job-failed/upload")) {
        uploadAttempt += 1
        jobFetchCount = 0
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

        if (uploadAttempt === 0) {
          return buildJsonResponse(retryReadyJob)
        }

        if (uploadAttempt === 1) {
          return buildJsonResponse(retryFailedJob)
        }

        return buildJsonResponse(retryCompletedJob)
      }

      throw new Error(`unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const user = renderApp()

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(screen.getByLabelText(/^Repository\b/)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Token\b/)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/^Repository\b/), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText(/^Token\b/), {
      target: { value: "ghp_bad_secret" },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("upload-failed")
      expect(screen.getByText("Image upload failed.")).toBeInTheDocument()
      expect(document.querySelector("#upload-form")).not.toBeNull()
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("75")
      expect(document.querySelector('#job-file-tree [data-upload-row-id="NestJS/2026-04-11-1/index.md"]')?.getAttribute("data-upload-row-status")).toBe("failed")
      expect(document.querySelector('#job-file-tree [data-upload-row-id="React/2026-04-12-2/index.md"]')?.getAttribute("data-upload-row-status")).toBe("failed")
      expect(document.querySelector("#upload-providerKey")).not.toBeNull()
      expect(screen.getByLabelText(/^Repository\b/)).toHaveValue("owner/name")
      expect(screen.getByLabelText(/^Token\b/)).toHaveValue("ghp_bad_secret")
    })

    await user.clear(screen.getByLabelText(/^Token\b/))
    await user.type(screen.getByLabelText(/^Token\b/), "ghp_fixed_secret")
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(uploadAttempt).toBe(2)
    })
  }, 12000)

  it("shows rewrite-pending copy when the upload bar is full but completion is not final yet", async () => {
    let jobFetchCount = 0
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
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

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="upload"]')).not.toBeNull()
      expect(document.querySelector("#upload-form")).not.toBeNull()
    })

    fireEvent.change(screen.getByLabelText(/^Repository\b/), {
      target: { value: "owner/name" },
    })
    fireEvent.change(screen.getByLabelText(/^Token\b/), {
      target: { value: "ghp_upload_secret" },
    })
    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    await waitFor(() => {
      expect(document.querySelector("#status-text")?.textContent).toContain("uploading")
      expect(document.querySelector("#upload-progress")?.getAttribute("aria-valuenow")).toBe("100")
      expect(document.querySelector("#upload-form")).toBeNull()
    })
  })

  it("hides the upload form when the export completed with skipped-no-candidates", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      const bootstrapResponse = getBootstrapResponse(url)

      if (bootstrapResponse) {
        return bootstrapResponse
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

    await moveToDiagnosticsStep(user)
    await user.click(screen.getByRole("button", { name: "내보내기" }))

    await waitFor(() => {
      expect(document.querySelector('[data-step-view="result"]')).not.toBeNull()
      expect(screen.getByText("업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.")).toBeInTheDocument()
    })
    expect(document.querySelector("#upload-providerKey")).toBeNull()
    expect(screen.queryByLabelText(/^Repository\b/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Token\b/)).not.toBeInTheDocument()
  })
})
