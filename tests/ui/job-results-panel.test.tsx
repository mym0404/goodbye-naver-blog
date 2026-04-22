// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import { defaultExportOptions } from "../../src/shared/export-options.js"
import type {
  ExportJobState,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../../src/shared/types.js"
import { JobResultsPanel } from "../../src/ui/features/job-results/job-results-panel.js"
import { createTestPath } from "../helpers/test-paths.js"

const testOutputDir = createTestPath("ui-job-results-panel", "output")

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
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
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
          required: true,
          defaultValue: "main",
          placeholder: "main",
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
          placeholder: "https://cdn.example.com",
        },
      ],
    },
    {
      key: "alistplist",
      label: "AList",
      description: "AList 스토리지 경로로 이미지를 업로드합니다.",
      fields: [
        {
          key: "url",
          label: "Server URL",
          description: "AList 서버 주소입니다.",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "https://alist.example.com",
        },
        {
          key: "token",
          label: "Token",
          description: "Token 인증을 사용할 때 입력합니다.",
          inputType: "password",
          required: false,
          defaultValue: null,
          placeholder: "alist_token_xxx",
        },
        {
          key: "username",
          label: "Username",
          description: "계정 인증을 사용할 때 사용자 이름을 입력합니다.",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "username",
        },
        {
          key: "password",
          label: "Password",
          description: "계정 인증을 사용할 때 비밀번호를 입력합니다.",
          inputType: "password",
          required: false,
          defaultValue: null,
          placeholder: "password",
        },
      ],
    },
    {
      key: "aws-s3-plist",
      label: "AWS S3",
      description: "S3 호환 버킷에 이미지를 업로드합니다.",
      fields: [
        {
          key: "pathStyleAccess",
          label: "Path Style Access",
          description: "S3 URL을 path style 방식으로 생성합니다.",
          inputType: "checkbox",
          required: false,
          defaultValue: false,
          placeholder: "",
        },
        {
          key: "disableBucketPrefixToURL",
          label: "Hide Bucket Prefix In URL",
          description: "path style URL에서 bucket 접두사를 숨깁니다.",
          inputType: "checkbox",
          required: false,
          defaultValue: false,
          placeholder: "",
        },
      ],
    },
    {
      key: "lskyplist",
      label: "Lsky Pro",
      description: "Lsky Pro 이미지 호스팅 서버로 업로드합니다.",
      fields: [
        {
          key: "version",
          label: "Version",
          description: "Lsky Pro 서버 버전을 선택합니다.",
          inputType: "select",
          required: true,
          defaultValue: "V1",
          placeholder: "",
          options: [
            { label: "V1", value: "V1" },
            { label: "V2", value: "V2" },
          ],
        },
        {
          key: "albumId",
          label: "Album ID",
          description: "업로드에 사용할 앨범 ID를 입력합니다.",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "1",
        },
      ],
    },
    {
      key: "sftpplist",
      label: "Built-in SFTP",
      description: "SFTP 서버 경로에 이미지를 전송합니다.",
      fields: [
        {
          key: "privateKey",
          label: "Private Key",
          description: "SFTP 접속에 사용할 개인 키 경로입니다.",
          inputType: "password",
          required: false,
          defaultValue: null,
          placeholder: "/Users/name/.ssh/id_rsa",
        },
        {
          key: "passphrase",
          label: "Passphrase",
          description: "개인 키에 암호가 걸려 있으면 입력합니다.",
          inputType: "password",
          required: false,
          defaultValue: null,
          placeholder: "passphrase",
        },
      ],
    },
  ],
}

const uploadReadyJob: ExportJobState = {
  id: "job-upload-ready",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir: testOutputDir,
    profile: "gfm",
    options: (() => {
      const options = defaultExportOptions()
      options.assets.imageHandlingMode = "download-and-upload"
      return options
    })(),
  },
  status: "upload-ready",
  logs: [],
  createdAt: "2026-04-21T00:00:00.000Z",
  startedAt: "2026-04-21T00:00:01.000Z",
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
  items: [
    {
      id: "posts/first/index.md",
      logNo: "223034929697",
      title: "첫 글",
      source: "https://blog.naver.com/mym0404/223034929697",
      category: {
        id: 1,
        name: "NestJS",
        path: ["NestJS"],
      },
	      status: "success",
	      outputPath: "posts/first/index.md",
	      assetPaths: [],
		      upload: {
		        eligible: true,
		        candidateCount: 2,
		        uploadedCount: 0,
		        failedCount: 0,
		        candidates: [],
		        uploadedUrls: [],
		        rewriteStatus: "pending",
		        rewrittenAt: null,
		      },
		      warnings: [],
		      warningCount: 0,
		      error: null,
		      updatedAt: "2026-04-21T00:00:02.000Z",
		    },
		  ],
  manifest: null,
  error: null,
}

const runningUploadJob: ExportJobState = {
  ...uploadReadyJob,
  status: "running",
  upload: {
    ...uploadReadyJob.upload,
    status: "upload-ready",
  },
}

const uploadingJob: ExportJobState = {
  ...uploadReadyJob,
  status: "uploading",
  upload: {
    ...uploadReadyJob.upload,
    status: "uploading",
    uploadedCount: 1,
  },
  items: [
    {
      ...uploadReadyJob.items[0]!,
      upload: {
        ...uploadReadyJob.items[0]!.upload,
        uploadedCount: 1,
      },
    },
  ],
}

const uploadFailedJob: ExportJobState = {
  ...uploadReadyJob,
  status: "upload-failed",
  error: "upload failed",
}

const completedJobWithoutUpload: ExportJobState = {
  ...uploadReadyJob,
  status: "completed",
  request: {
    ...uploadReadyJob.request,
    options: (() => {
      const options = defaultExportOptions()
      options.assets.imageHandlingMode = "download"
      return options
    })(),
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
      ...uploadReadyJob.items[0]!,
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
        uploadedUrls: [],
        rewriteStatus: "pending",
        rewrittenAt: null,
      },
    },
  ],
}

const renderPanel = ({
  mode = "upload",
  job = uploadReadyJob,
  onUploadStart = vi.fn(),
}: {
  mode?: "running" | "upload" | "result"
  job?: ExportJobState
  onUploadStart?: (input: {
    providerKey: string
    providerFields: Record<string, UploadProviderValue>
  }) => Promise<void> | void
} = {}) => {
  render(
    <JobResultsPanel
      mode={mode}
      job={job}
      activeJobFilter="all"
      resumeSubmitting={false}
      uploadSubmitting={false}
      uploadProviders={uploadProviderCatalog}
      uploadProviderError={null}
      onFilterChange={vi.fn()}
      onResumeExport={vi.fn()}
      onUploadStart={onUploadStart}
    />,
  )

  return {
    onUploadStart,
  }
}

describe("JobResultsPanel upload provider UX", () => {
  it("shows the merged results table during running when upload is enabled", () => {
    renderPanel({
      mode: "running",
      job: runningUploadJob,
    })

    const resultsTable = screen.getByRole("table")

    expect(within(resultsTable).getByRole("columnheader", { name: "카테고리" })).toBeInTheDocument()
    expect(within(resultsTable).getByRole("columnheader", { name: "파일" })).toBeInTheDocument()
    expect(within(resultsTable).getByRole("columnheader", { name: "업로드 상태" })).toBeInTheDocument()
    expect(within(resultsTable).getByRole("columnheader", { name: "상태" })).toBeInTheDocument()
    expect(within(resultsTable).getByRole("columnheader", { name: "액션" })).toBeInTheDocument()
    expect(within(resultsTable).queryByRole("columnheader", { name: "경로" })).not.toBeInTheDocument()
    expect(within(resultsTable).queryByRole("columnheader", { name: "경고" })).not.toBeInTheDocument()
    expect(within(resultsTable).getByText("NestJS")).toBeInTheDocument()
    expect(within(resultsTable).getByText("first")).toBeInTheDocument()
    expect(within(resultsTable).queryByText("posts/first/index.md")).not.toBeInTheDocument()
    expect(
      document.querySelector('#job-file-tree [data-upload-row-id="posts/first/index.md"]')?.getAttribute(
        "data-upload-row-status",
      ),
    ).toBe("pending")
  })

  it("hides upload columns when the job did not request upload", () => {
    renderPanel({
      mode: "result",
      job: completedJobWithoutUpload,
    })

    expect(screen.queryByText("업로드 상태")).not.toBeInTheDocument()
    expect(document.querySelector('[data-upload-row-id="posts/first/index.md"]')).toBeNull()
  })

  it("updates upload status badges for pending, partial, complete, and failed rows", () => {
    const { rerender } = render(
      <JobResultsPanel
        mode="upload"
        job={uploadReadyJob}
        activeJobFilter="all"
        resumeSubmitting={false}
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onResumeExport={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="pending"]')).not.toBeNull()

    rerender(
      <JobResultsPanel
        mode="upload"
        job={uploadingJob}
        activeJobFilter="all"
        resumeSubmitting={false}
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onResumeExport={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="partial"]')).not.toBeNull()

    rerender(
      <JobResultsPanel
        mode="result"
        job={{
          ...uploadReadyJob,
          status: "upload-completed",
          upload: {
            ...uploadReadyJob.upload,
            status: "upload-completed",
            uploadedCount: 2,
          },
          items: [
            {
              ...uploadReadyJob.items[0]!,
              upload: {
                ...uploadReadyJob.items[0]!.upload,
                uploadedCount: 2,
                uploadedUrls: [
                  "https://cdn.example.com/shared.png",
                  "https://cdn.example.com/detail.png",
                ],
                rewriteStatus: "completed",
                rewrittenAt: "2026-04-21T00:00:03.000Z",
              },
            },
          ],
        }}
        activeJobFilter="all"
        resumeSubmitting={false}
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onResumeExport={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="complete"]')).not.toBeNull()

    rerender(
      <JobResultsPanel
        mode="upload"
        job={uploadFailedJob}
        activeJobFilter="all"
        resumeSubmitting={false}
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onResumeExport={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="failed"]')).not.toBeNull()
  })

  it("renders action buttons for preview and local file open", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (input === "/api/local-file/preview-link") {
        return new Response(JSON.stringify({ previewUrl: "https://markdownviewer.pages.dev/#share=test" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      return new Response(null, { status: 204 })
    })
    const openMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("open", openMock)
    renderPanel()

    expect(
      screen.getByRole("button", {
        name: "첫 글 외부 미리보기",
      }),
    ).toHaveAttribute("data-job-item-preview-link")
    expect(screen.getByRole("button", { name: "첫 글 파일 열기" }).className).toContain("text-muted-foreground")

    await user.hover(screen.getByText("first"))

    expect((await screen.findAllByText(`${testOutputDir}/posts/first/index.md`)).length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "첫 글 외부 미리보기" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/local-file/preview-link",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: testOutputDir,
          outputPath: "posts/first/index.md",
        }),
      }),
    )
    expect(openMock).toHaveBeenCalledWith("https://markdownviewer.pages.dev/#share=test", "_blank", "noopener,noreferrer")

    await user.click(screen.getByRole("button", { name: "첫 글 파일 열기" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/local-file/open",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: testOutputDir,
          outputPath: "posts/first/index.md",
        }),
      }),
    )
  })

  it("renders provider and field descriptions", () => {
    renderPanel()

    expect(screen.getByText("리포지토리에 이미지를 커밋하고 URL로 사용합니다.")).toBeInTheDocument()
    expect(screen.getByText("업로드할 GitHub 저장소 경로입니다.")).toBeInTheDocument()
    expect(screen.getByText("서비스 API 접근용 토큰을 입력합니다.")).toBeInTheDocument()
  })

  it("disables github customUrl when jsDelivr is enabled, preserves the raw value, and submits the derived URL", async () => {
    const user = userEvent.setup()
    const onUploadStart = vi.fn()

    renderPanel({ onUploadStart })

    await user.type(screen.getByLabelText("Repository"), "owner/name")
    await user.clear(screen.getByLabelText("Branch"))
    await user.type(screen.getByLabelText("Branch"), "main")
    await user.type(screen.getByLabelText("Token"), "ghp_upload_secret")
    await user.type(screen.getByLabelText("Custom URL"), "https://raw.example.com")

    const jsDelivrToggle = screen.getByRole("checkbox", { name: /jsDelivr CDN 사용/i })

    await user.click(jsDelivrToggle)

    expect(screen.getByLabelText("Custom URL")).toBeDisabled()
    expect(screen.getByLabelText("Custom URL")).toHaveValue("https://raw.example.com")
    expect(screen.getByLabelText("자동 Custom URL")).toHaveValue("https://cdn.jsdelivr.net/gh/owner/name@main")

    await user.click(screen.getByRole("button", { name: "업로드 시작" }))

    expect(onUploadStart).toHaveBeenCalledWith({
      providerKey: "github",
      providerFields: {
        branch: "main",
        customUrl: "https://cdn.jsdelivr.net/gh/owner/name@main",
        repo: "owner/name",
        token: "ghp_upload_secret",
      },
    })

    await user.click(jsDelivrToggle)

    expect(screen.getByLabelText("Custom URL")).toBeEnabled()
    expect(screen.getByLabelText("Custom URL")).toHaveValue("https://raw.example.com")
  })

  it("switches AList auth mode and validates only active required fields", async () => {
    const user = userEvent.setup()

    renderPanel()

    await selectOption({
      user,
      trigger: screen.getByLabelText("Provider"),
      value: "alistplist",
    })

    const serverUrlInput = screen.getByLabelText("Server URL")
    const tokenInput = screen.getByLabelText("Token", {
      selector: 'input[type="password"]',
    })
    const usernameInput = screen.getByLabelText("Username")
    const passwordInput = screen.getAllByLabelText("Password")[0]
    const submitButton = screen.getByRole("button", { name: "업로드 시작" })

    await user.type(serverUrlInput, "https://alist.example.com")
    expect(tokenInput).toBeEnabled()
    expect(usernameInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
    expect(submitButton).toBeDisabled()

    await user.type(tokenInput, "alist_token_xxx")
    expect(submitButton).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Username + Password" }))
    expect(tokenInput).toBeDisabled()
    expect(usernameInput).toBeEnabled()
    expect(passwordInput).toBeEnabled()
    expect(submitButton).toBeDisabled()

    await user.type(usernameInput, "mj")
    await user.type(passwordInput, "pw")
    expect(submitButton).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Token" }))
    expect(tokenInput).toBeEnabled()
    expect(tokenInput).toHaveValue("alist_token_xxx")
  })

  it("applies AWS S3, Lsky Pro, and SFTP conditional field rules with reasons", async () => {
    const user = userEvent.setup()

    renderPanel()

    await selectOption({
      user,
      trigger: screen.getByLabelText("Provider"),
      value: "aws-s3-plist",
    })
    expect(screen.getByLabelText("Hide Bucket Prefix In URL")).toBeDisabled()
    expect(screen.getByText("Path Style Access를 켜야 이 옵션을 사용할 수 있습니다.")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Path Style Access"))
    expect(screen.getByLabelText("Hide Bucket Prefix In URL")).toBeEnabled()

    await selectOption({
      user,
      trigger: screen.getByLabelText("Provider"),
      value: "lskyplist",
    })
    expect(screen.getByLabelText("Album ID")).toBeDisabled()
    expect(screen.getByText("Lsky Pro V2를 선택한 경우에만 Album ID를 사용할 수 있습니다.")).toBeInTheDocument()
    await selectOption({
      user,
      trigger: screen.getByLabelText("Version"),
      value: "V2",
    })
    expect(screen.getByLabelText("Album ID")).toBeEnabled()

    await selectOption({
      user,
      trigger: screen.getByLabelText("Provider"),
      value: "sftpplist",
    })
    expect(screen.getByLabelText("Passphrase")).toBeDisabled()
    expect(screen.getByText("Private Key를 입력하면 Passphrase를 사용할 수 있습니다.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Private Key"), "/Users/name/.ssh/id_rsa")
    expect(screen.getByLabelText("Passphrase")).toBeEnabled()
  })
})
