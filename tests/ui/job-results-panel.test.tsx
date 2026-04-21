// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import { defaultExportOptions } from "../../src/shared/export-options.js"
import type {
  ExportJobState,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../../src/shared/types.js"
import { JobResultsPanel } from "../../src/ui/features/job-results/job-results-panel.js"

afterEach(() => {
  cleanup()
})

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
    outputDir: "./output",
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
	      },
	      warnings: [],
	      warningCount: 0,
	      error: null,
	      externalPreviewUrl: "https://markdownviewer.pages.dev/#share=test",
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
      uploadSubmitting={false}
      uploadProviders={uploadProviderCatalog}
      uploadProviderError={null}
      onFilterChange={vi.fn()}
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

    const resultsTable = document.querySelector("#job-file-tree table")

    expect(resultsTable).not.toBeNull()
    expect(within(resultsTable as HTMLElement).getByText("업로드 상태")).toBeInTheDocument()
    expect(
      document.querySelector('#job-file-tree [data-upload-row-id="posts/first/index.md"]')?.getAttribute(
        "data-upload-row-status",
      ),
    ).toBe("pending")
  })

  it("uses smaller table typography when upload columns are visible", () => {
    renderPanel()

    const resultsTable = document.querySelector("#job-file-tree table")
    const firstHeader = document.querySelector("#job-file-tree thead th")
    const firstBadge = document.querySelector('[data-upload-row-status-badge="pending"]')

    expect(resultsTable).toHaveClass("text-[11px]", "min-w-[44rem]")
    expect(firstHeader).toHaveClass("text-[10px]")
    expect(firstBadge).toHaveClass("text-[10px]")
  })

  it("hides upload columns when the job did not request upload", () => {
    renderPanel({
      mode: "result",
      job: completedJobWithoutUpload,
    })

    expect(screen.queryByText("업로드 상태")).not.toBeInTheDocument()
    expect(document.querySelector('[data-upload-row-id="posts/first/index.md"]')).toBeNull()
  })

  it("applies soft badge styles for pending, partial, complete, and failed upload states", () => {
    const { rerender } = render(
      <JobResultsPanel
        mode="upload"
        job={uploadReadyJob}
        activeJobFilter="all"
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="pending"]')).toHaveClass(
      "border-slate-300",
      "bg-slate-100",
      "text-slate-700",
    )

    rerender(
      <JobResultsPanel
        mode="upload"
        job={uploadingJob}
        activeJobFilter="all"
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="partial"]')).toHaveClass(
      "border-amber-200",
      "bg-amber-50",
      "text-amber-800",
    )

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
              },
            },
          ],
        }}
        activeJobFilter="all"
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="complete"]')).toHaveClass(
      "border-emerald-200",
      "bg-emerald-50",
      "text-emerald-800",
    )

    rerender(
      <JobResultsPanel
        mode="upload"
        job={uploadFailedJob}
        activeJobFilter="all"
        uploadSubmitting={false}
        uploadProviders={uploadProviderCatalog}
        uploadProviderError={null}
        onFilterChange={vi.fn()}
        onUploadStart={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-upload-row-status-badge="failed"]')).toHaveClass(
      "border-rose-200",
      "bg-rose-50",
      "text-rose-800",
    )
  })

  it("renders an external markdown preview link for successful results", () => {
    renderPanel()

    expect(
      screen.getByRole("link", {
        name: "첫 글 미리보기",
      }),
    ).toHaveAttribute("href", "https://markdownviewer.pages.dev/#share=test")
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

    await user.selectOptions(screen.getByLabelText("Provider"), "alistplist")

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

    await user.click(screen.getByLabelText("Username + Password"))
    expect(tokenInput).toBeDisabled()
    expect(usernameInput).toBeEnabled()
    expect(passwordInput).toBeEnabled()
    expect(submitButton).toBeDisabled()

    await user.type(usernameInput, "mj")
    await user.type(passwordInput, "pw")
    expect(submitButton).toBeEnabled()

    await user.click(
      screen.getByRole("radio", {
        name: "Token",
      }),
    )
    expect(tokenInput).toBeEnabled()
    expect(tokenInput).toHaveValue("alist_token_xxx")
  })

  it("applies AWS S3, Lsky Pro, and SFTP conditional field rules with reasons", async () => {
    const user = userEvent.setup()

    renderPanel()

    await user.selectOptions(screen.getByLabelText("Provider"), "aws-s3-plist")
    expect(screen.getByLabelText("Hide Bucket Prefix In URL")).toBeDisabled()
    expect(screen.getByText("Path Style Access를 켜야 이 옵션을 사용할 수 있습니다.")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Path Style Access"))
    expect(screen.getByLabelText("Hide Bucket Prefix In URL")).toBeEnabled()

    await user.selectOptions(screen.getByLabelText("Provider"), "lskyplist")
    expect(screen.getByLabelText("Album ID")).toBeDisabled()
    expect(screen.getByText("Lsky Pro V2를 선택한 경우에만 Album ID를 사용할 수 있습니다.")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Version"), "V2")
    expect(screen.getByLabelText("Album ID")).toBeEnabled()

    await user.selectOptions(screen.getByLabelText("Provider"), "sftpplist")
    expect(screen.getByLabelText("Passphrase")).toBeDisabled()
    expect(screen.getByText("Private Key를 입력하면 Passphrase를 사용할 수 있습니다.")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Private Key"), "/Users/name/.ssh/id_rsa")
    expect(screen.getByLabelText("Passphrase")).toBeEnabled()
  })
})
