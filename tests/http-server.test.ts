import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type {
  ExportJobState,
  ScanResult,
  UploadCandidate,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../src/shared/types.js"
import { createHttpServer } from "../src/server/http-server.js"

let activeServer: ReturnType<typeof createHttpServer> | null = null

const uploadHtml = `
  <script>var data = { smartEditorVersion: 4 }</script>
  <div id="viewTypeSelector">
    <div class="se-component se-text">
      <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
      <p class="se-text-paragraph">본문입니다.</p>
    </div>
    <div class="se-component se-image">
      <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/image.png"}'>
        <img src="https://example.com/image.png" alt="diagram" />
      </a>
    </div>
  </div>
`

const textOnlyHtml = `
  <script>var data = { smartEditorVersion: 4 }</script>
  <div id="viewTypeSelector">
    <div class="se-component se-text">
      <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
      <p class="se-text-paragraph">텍스트만 있습니다.</p>
    </div>
  </div>
`

const baseScanResult: ScanResult = {
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
}

const createPosts = (thumbnailUrl: string | null) => [
  {
    blogId: "mym0404",
    logNo: "223034929697",
    title: "테스트 글",
    publishedAt: "2023-03-04T13:00:00+09:00",
    categoryId: 84,
    categoryName: "PS 알고리즘, 팁",
    source: "https://blog.naver.com/mym0404/223034929697",
    editorVersion: 4 as const,
    thumbnailUrl,
  },
]

const startServer = async (server: ReturnType<typeof createHttpServer>) => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()

  if (!address || typeof address === "string") {
    throw new Error("server did not bind to a numeric port")
  }

  return `http://127.0.0.1:${address.port}`
}

const mockFetcher = ({
  html,
  thumbnailUrl,
}: {
  html: string
  thumbnailUrl: string | null
}) => {
  vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue(baseScanResult)
  vi.spyOn(NaverBlogFetcher.prototype, "getAllPosts").mockResolvedValue(createPosts(thumbnailUrl))
  vi.spyOn(NaverBlogFetcher.prototype, "fetchPostHtml").mockResolvedValue(html)
  vi.spyOn(NaverBlogFetcher.prototype, "downloadBinary").mockResolvedValue()
  vi.spyOn(NaverBlogFetcher.prototype, "fetchBinary").mockResolvedValue({
    bytes: Buffer.from("image"),
    contentType: "image/png",
  })
}

const waitForJob = async ({
  baseUrl,
  jobId,
  accept,
}: {
  baseUrl: string
  jobId: string
  accept: (job: ExportJobState) => boolean
}) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/export/${jobId}`)
    const job = (await response.json()) as ExportJobState

    if (accept(job)) {
      return job
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(`timed out waiting for job ${jobId}`)
}

const uploadProviderCatalog: UploadProviderCatalogResponse = {
  defaultProviderKey: "github",
  providers: [
    {
      key: "github",
      label: "GitHub",
      fields: [
        {
          key: "repo",
          label: "Repository",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "owner/repo",
        },
        {
          key: "branch",
          label: "Branch",
          inputType: "text",
          required: false,
          defaultValue: "main",
          placeholder: "",
        },
        {
          key: "path",
          label: "Path",
          inputType: "text",
          required: false,
          defaultValue: null,
          placeholder: "",
        },
        {
          key: "token",
          label: "Token",
          inputType: "password",
          required: true,
          defaultValue: null,
          placeholder: "",
        },
        {
          key: "customUrl",
          label: "Custom URL",
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
      fields: [
        {
          key: "secretId",
          label: "Secret ID",
          inputType: "text",
          required: true,
          defaultValue: null,
          placeholder: "",
        },
        {
          key: "port",
          label: "Port",
          inputType: "number",
          required: false,
          defaultValue: 0,
          placeholder: "",
        },
        {
          key: "permission",
          label: "Permission",
          inputType: "select",
          required: true,
          defaultValue: 0,
          placeholder: "",
          options: [
            { label: "Public", value: 0 },
            { label: "Private", value: 1 },
          ],
        },
        {
          key: "slim",
          label: "Slim",
          inputType: "checkbox",
          required: false,
          defaultValue: false,
          placeholder: "",
        },
      ],
    },
  ],
}

const normalizeUploadProviderFields = (providerKey: string, input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null
  }

  const provider = uploadProviderCatalog.providers.find((item) => item.key === providerKey)

  if (!provider) {
    return null
  }

  const values = input as Record<string, unknown>
  const entries: Array<readonly [string, UploadProviderValue]> = []

  for (const field of provider.fields) {
    const rawValue = values[field.key]

    if (rawValue === undefined || rawValue === null) {
      continue
    }

    if (field.inputType === "checkbox") {
      if (typeof rawValue === "boolean") {
        entries.push([field.key, rawValue] as const)
        continue
      }

      if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase()

        if (normalized === "true" || normalized === "1" || normalized === "on") {
          entries.push([field.key, true] as const)
          continue
        }

        if (normalized === "false" || normalized === "0" || normalized === "off") {
          entries.push([field.key, false] as const)
          continue
        }
      }

      continue
    }

    if (field.inputType === "number") {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        entries.push([field.key, rawValue] as const)
        continue
      }

      if (typeof rawValue === "string" && rawValue.trim()) {
        const parsed = Number(rawValue.trim())

        if (Number.isFinite(parsed)) {
          entries.push([field.key, parsed] as const)
        }
      }

      continue
    }

    if (field.inputType === "select") {
      const option = field.options?.find((item) => String(item.value) === String(rawValue))

      if (option) {
        entries.push([field.key, option.value] as const)
      }

      continue
    }

    if (typeof rawValue !== "string" || !rawValue.trim()) {
      continue
    }

    entries.push([field.key, rawValue.trim()] as const)
  }

  return entries.length > 0 ? Object.fromEntries(entries) : null
}

const createUploadProviderSourceStub = () => ({
  getCatalog: vi.fn(async () => uploadProviderCatalog),
  normalizeProviderFields: vi.fn(async (providerKey: string, value: unknown) =>
    normalizeUploadProviderFields(providerKey, value),
  ),
})

const createTestHttpServer = (
  options: NonNullable<Parameters<typeof createHttpServer>[0]> = {},
) =>
  createHttpServer({
    uploadProviderSource: createUploadProviderSourceStub(),
    ...options,
  })

const createUploadPayload = (
  providerFields: Record<string, UploadProviderValue>,
  providerKey = "github",
) => ({
  providerKey,
  providerFields,
})

afterEach(async () => {
  vi.restoreAllMocks()

  if (!activeServer) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    activeServer?.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
  activeServer = null
})

describe("http server", () => {
  it("returns frontmatter metadata from export defaults", async () => {
    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export-defaults`)
    const body = (await response.json()) as {
      frontmatterFieldMeta: {
        title: {
          label: string
          description: string
          defaultAlias: string
        }
      }
      options: {
        frontmatter: {
          aliases: {
            title: string
          }
        }
        markdown: {
          formulaBlockWrapperOpen: string
        }
        assets: {
          stickerAssetMode: string
        }
      }
      optionDescriptions: Record<string, string>
    }

    expect(response.ok).toBe(true)
    expect(body.frontmatterFieldMeta.title).toEqual({
      label: "title",
      description: "글 제목을 기록합니다.",
      defaultAlias: "title",
    })
    expect(body.options.frontmatter.aliases.title).toBe("")
    expect(body.options.markdown.formulaBlockWrapperOpen).toBe("$$")
    expect(body.options.assets.stickerAssetMode).toBe("ignore")
    expect(body.optionDescriptions["assets-imageContentMode"]).toBeUndefined()
  })

  it("returns the PicList-backed upload provider catalog", async () => {
    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/upload-providers`)
    const body = (await response.json()) as UploadProviderCatalogResponse

    expect(response.status).toBe(200)
    expect(body.defaultProviderKey).toBe("github")
    expect(body.providers.map((provider) => provider.key)).toEqual(["github", "tcyun"])
    expect(body.providers[1]?.fields.map((field) => field.inputType)).toEqual([
      "text",
      "number",
      "select",
      "checkbox",
    ])
  })

  it("persists scan results to a json file and reuses them after app reloads", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "scan-cache-"))
    const scanCachePath = path.join(rootDir, "scan-cache.json")
    const scanBlogSpy = vi.spyOn(NaverBlogFetcher.prototype, "scanBlog").mockResolvedValue({
      ...baseScanResult,
      posts: createPosts(null),
    })

    try {
      activeServer = createTestHttpServer({
        scanCachePath,
      })
      let baseUrl = await startServer(activeServer)

      const firstResponse = await fetch(`${baseUrl}/api/scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogIdOrUrl: "https://blog.naver.com/mym0404",
        }),
      })

      expect(firstResponse.status).toBe(200)
      expect(scanBlogSpy).toHaveBeenCalledTimes(1)
      expect(await readFile(scanCachePath, "utf8")).toContain("\"mym0404\"")

      await new Promise<void>((resolve, reject) => {
        activeServer?.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
      activeServer = null

      activeServer = createTestHttpServer({
        scanCachePath,
      })
      baseUrl = await startServer(activeServer)

      const secondResponse = await fetch(`${baseUrl}/api/scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogIdOrUrl: "https://blog.naver.com/mym0404",
        }),
      })
      const secondBody = (await secondResponse.json()) as ScanResult

      expect(secondResponse.status).toBe(200)
      expect(secondBody.blogId).toBe("mym0404")
      expect(scanBlogSpy).toHaveBeenCalledTimes(1)

      const forcedResponse = await fetch(`${baseUrl}/api/scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogIdOrUrl: "https://blog.naver.com/mym0404",
          forceRefresh: true,
        }),
      })

      expect(forcedResponse.status).toBe(200)
      expect(scanBlogSpy).toHaveBeenCalledTimes(2)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("accepts same-origin upload actions for upload-ready jobs without persisting provider fields", async () => {
    const uploadPhaseRunner = vi.fn(async ({
      candidates,
      uploaderConfig,
    }: {
      candidates: UploadCandidate[]
      uploaderConfig: Record<string, unknown>
    }) => {
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.localPath).toMatch(/^public\/[a-f0-9]{64}\.png$/)
      expect(uploaderConfig).toMatchObject({
        branch: "main",
        repo: "owner/name",
        token: "ghp_test_upload_token",
        customUrl: "https://cdn.jsdelivr.net/gh/mym0404/ia2@main",
      })
      expect(uploaderConfig).not.toHaveProperty("path")

      return candidates.map((candidate) => ({
        candidate,
        uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
      }))
    })

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-upload-ready",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }
    const readyJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    expect(readyJob.upload.status).toBe("upload-ready")
    expect(readyJob.upload.candidateCount).toBe(1)

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload({
          branch: "main",
          repo: "owner/name",
          path: "/",
          token: "ghp_test_upload_token",
          customUrl: "https://cdn.jsdelivr.net/gh/mym0404/ia2@main",
        }),
      ),
    })
    const completedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-completed",
    })
    const serializedJob = JSON.stringify(completedJob)

    expect(uploadResponse.status).toBe(202)
    expect(uploadPhaseRunner).toHaveBeenCalledTimes(1)
    expect(completedJob.upload.status).toBe("upload-completed")
    expect(completedJob.upload.uploadedCount).toBe(completedJob.upload.candidateCount)
    expect(serializedJob).not.toContain("providerFields")
    expect(serializedJob).not.toContain("ghp_test_upload_token")
    expect(serializedJob).not.toContain("owner/name")
  })

  it("preserves false and 0 in normalized provider fields", async () => {
    const uploadPhaseRunner = vi.fn(
      async ({
        candidates,
        uploaderConfig,
      }: {
        candidates: UploadCandidate[]
        uploaderConfig: Record<string, unknown>
      }) => {
      expect(uploaderConfig).toEqual({
        permission: 0,
        port: 0,
        secretId: "secret-id-123",
        slim: false,
      })

        return candidates.map((candidate) => ({
          candidate,
          uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
        }))
      },
    )

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-upload-provider-scalars",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload(
          {
            permission: 0,
            port: 0,
            secretId: "secret-id-123",
            slim: false,
          },
          "tcyun",
        ),
      ),
    })

    expect(uploadResponse.status).toBe(202)
    expect(uploadPhaseRunner).toHaveBeenCalledTimes(1)
  })

  it("redacts only string provider fields in upload failures", async () => {
    const uploadPhaseRunner = vi.fn().mockRejectedValueOnce(new Error("secret-id-xyz false 0"))

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-upload-provider-redaction",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload(
          {
            permission: 0,
            port: 0,
            secretId: "secret-id-xyz",
            slim: false,
          },
          "tcyun",
        ),
      ),
    })
    const failedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-failed",
    })

    expect(uploadResponse.status).toBe(202)
    expect(failedJob.error).toContain("[redacted]")
    expect(failedJob.error).toContain("false")
    expect(failedJob.error).toContain("0")
    expect(failedJob.error).not.toContain("secret-id-xyz")
  })

  it("rejects cross-site style upload requests", async () => {
    const uploadPhaseRunner = vi.fn()

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-cross-site",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(createUploadPayload({ repo: "owner/name" })),
    })
    const body = (await uploadResponse.json()) as {
      error: string
    }

    expect(uploadResponse.status).toBe(403)
    expect(body.error).toContain("same-origin")
    expect(uploadPhaseRunner).not.toHaveBeenCalled()
  })

  it("rejects upload requests that omit the Origin header", async () => {
    const uploadPhaseRunner = vi.fn()

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-missing-origin",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(createUploadPayload({ repo: "owner/name" })),
    })
    const body = (await uploadResponse.json()) as {
      error: string
    }

    expect(uploadResponse.status).toBe(403)
    expect(body.error).toContain("same-origin")
    expect(uploadPhaseRunner).not.toHaveBeenCalled()
  })

  it("keeps a safe upload failure reason and allows retry from upload-failed jobs", async () => {
    const uploadPhaseRunner = vi
      .fn()
      .mockRejectedValueOnce(new Error("GitHub rejected token ghp_retry_secret for owner/name"))
      .mockImplementationOnce(async ({ candidates }: { candidates: UploadCandidate[] }) =>
        candidates.map((candidate) => ({
          candidate,
          uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
        })),
      )

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-upload-retry",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const firstUploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload({
          repo: "owner/name",
          token: "ghp_retry_secret",
        }),
      ),
    })
    const failedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-failed",
    })

    expect(firstUploadResponse.status).toBe(202)
    expect(failedJob.error).toContain("[redacted]")
    expect(failedJob.error).not.toContain("owner/name")
    expect(failedJob.error).not.toContain("ghp_retry_secret")
    expect(failedJob.upload.status).toBe("upload-failed")

    const retryResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload({
          repo: "owner/name",
          token: "ghp_retry_fixed",
        }),
      ),
    })
    const completedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-completed",
    })

    expect(retryResponse.status).toBe(202)
    expect(uploadPhaseRunner).toHaveBeenCalledTimes(2)
    expect(completedJob.upload.status).toBe("upload-completed")
    expect(JSON.stringify(completedJob)).not.toContain("ghp_retry_fixed")
  })

  it("exposes nonzero uploadedCount while the job is still uploading", async () => {
    let releaseUpload = () => {}
    const uploadPhaseRunner = vi.fn(
      async ({
        candidates,
        onProgress,
      }: {
        candidates: UploadCandidate[]
        onProgress?: (progress: {
          total: number
          uploadedCount: number
          lastCompletedLocalPath: string | null
        }) => void
      }) => {
        onProgress?.({
          total: candidates.length,
          uploadedCount: 0,
          lastCompletedLocalPath: null,
        })
        onProgress?.({
          total: candidates.length,
          uploadedCount: 1,
          lastCompletedLocalPath: candidates[0]?.localPath ?? null,
        })

        await new Promise<void>((resolve) => {
          releaseUpload = resolve
        })

        return candidates.map((candidate) => ({
          candidate,
          uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
        }))
      },
    )

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-upload-progress",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload({
          repo: "owner/name",
          token: "ghp_upload_progress",
        }),
      ),
    })

    const uploadingJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "uploading" && job.upload.uploadedCount === 1,
    })

    expect(uploadResponse.status).toBe(202)
    expect(uploadingJob.upload.status).toBe("uploading")
    expect(uploadingJob.upload.uploadedCount).toBe(1)
    expect(uploadingJob.items[0]?.upload.uploadedCount).toBe(1)
    expect(uploadingJob.logs.some((entry) => entry.message.includes("결과 치환"))).toBe(false)

    releaseUpload()

    const completedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-completed",
    })

    expect(completedJob.logs.some((entry) => entry.message.includes("결과 치환을 진행합니다."))).toBe(true)
  })

  it("preserves uploadedCount when rewrite fails after upload results return", async () => {
    const uploadPhaseRunner = vi.fn(async ({ candidates }: { candidates: UploadCandidate[] }) =>
      candidates.map((candidate) => ({
        candidate,
        uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
      })),
    )
    const uploadRewriter = vi.fn(async () => {
      throw new Error("rewrite failed")
    })

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createTestHttpServer({
      uploadPhaseRunner,
      uploadRewriter,
    })
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-rewrite-failure",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }

    await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-ready",
    })

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(
        createUploadPayload({
          repo: "owner/name",
          token: "ghp_rewrite_failure",
        }),
      ),
    })
    const failedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "upload-failed",
    })

    expect(uploadResponse.status).toBe(202)
    expect(uploadPhaseRunner).toHaveBeenCalledTimes(1)
    expect(uploadRewriter).toHaveBeenCalledTimes(1)
    expect(failedJob.upload.uploadedCount).toBe(failedJob.upload.candidateCount)
    expect(failedJob.upload.failedCount).toBe(0)
    expect(failedJob.items[0]?.upload.uploadedCount).toBe(failedJob.items[0]?.upload.candidateCount)
  })

  it("finishes zero-candidate download-and-upload jobs as completed with skipped-no-candidates", async () => {
    mockFetcher({
      html: textOnlyHtml,
      thumbnailUrl: null,
    })

    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"
    options.assets.thumbnailSource = "none"

    const exportResponse = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "https://blog.naver.com/mym0404",
        outputDir: "/tmp/http-server-zero-candidates",
        options,
      }),
    })
    const exportBody = (await exportResponse.json()) as {
      jobId: string
    }
    const completedJob = await waitForJob({
      baseUrl,
      jobId: exportBody.jobId,
      accept: (job) => job.status === "completed",
    })
    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(createUploadPayload({ repo: "owner/name" })),
    })

    expect(completedJob.upload.status).toBe("skipped")
    expect(completedJob.upload.terminalReason).toBe("skipped-no-candidates")
    expect(uploadResponse.status).toBe(409)
  })
})
