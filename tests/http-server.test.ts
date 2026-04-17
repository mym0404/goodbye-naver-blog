import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type { ExportJobState, ScanResult, UploadCandidate } from "../src/shared/types.js"
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
    activeServer = createHttpServer()
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
    expect(body.optionDescriptions["assets-imageContentMode"]).toContain("base64")
  })

  it("accepts same-origin upload actions for upload-ready jobs without persisting credentials", async () => {
    const uploadPhaseRunner = vi.fn(async ({ candidates }: { candidates: UploadCandidate[] }) =>
      candidates.map((candidate) => ({
        candidate,
        uploadedUrl: `https://cdn.example.com/${candidate.localPath}`,
      })),
    )

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createHttpServer({
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
    expect(readyJob.upload.candidateCount).toBeGreaterThan(0)

    const uploadResponse = await fetch(`${baseUrl}/api/export/${exportBody.jobId}/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        uploaderKey: "github",
        uploaderConfigJson: JSON.stringify({
          repo: "owner/name",
        }),
      }),
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
    expect(serializedJob).not.toContain("uploaderConfigJson")
    expect(serializedJob).not.toContain('{"repo":"owner/name"}')
  })

  it("rejects cross-site style upload requests", async () => {
    const uploadPhaseRunner = vi.fn()

    mockFetcher({
      html: uploadHtml,
      thumbnailUrl: "https://example.com/thumb.png",
    })

    activeServer = createHttpServer({
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
      body: JSON.stringify({
        uploaderKey: "github",
        uploaderConfigJson: "{}",
      }),
    })
    const body = (await uploadResponse.json()) as {
      error: string
    }

    expect(uploadResponse.status).toBe(403)
    expect(body.error).toContain("same-origin")
    expect(uploadPhaseRunner).not.toHaveBeenCalled()
  })

  it("finishes zero-candidate download-and-upload jobs as completed with skipped-no-candidates", async () => {
    mockFetcher({
      html: textOnlyHtml,
      thumbnailUrl: null,
    })

    activeServer = createHttpServer()
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
      body: JSON.stringify({
        uploaderKey: "github",
        uploaderConfigJson: "{}",
      }),
    })

    expect(completedJob.upload.status).toBe("skipped")
    expect(completedJob.upload.terminalReason).toBe("skipped-no-candidates")
    expect(uploadResponse.status).toBe(409)
  })
})
