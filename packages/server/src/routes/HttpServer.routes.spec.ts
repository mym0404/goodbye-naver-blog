import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import { NaverBlogFetcher } from "@exitpress/blog-naver/integrations/naver-blog/NaverBlogFetcher.js"
import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { buildMarkdownViewerShareUrl } from "@exitpress/engine/exporting/post/MarkdownViewerShareUrl.js"
import {
  baseScanResult,
  cleanupTestServerRoots,
  createOversizedPreviewMarkdown,
  createPosts,
  createTestHttpServer,
  createUploadPayload,
  mockFetcher,
  startServer,
  textOnlyHtml,
  uploadHtml,
  waitForJob,
} from "@tests/support/server/HttpServerSpecHarness.js"
import { createTestTempDir } from "@tests/support/test-paths.js"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type {
  UploadProviderCatalogResponse,
  UploadProviderFields,
} from "@exitpress/domain/upload/schema/UploadProvider.js"

import { JobStore } from "../jobs/JobStore.js"

let activeServer: ReturnType<typeof createTestHttpServer> | null = null

const removeDirWithRetry = async (targetPath: string) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY" || attempt === 4) {
        throw error
      }

      await delay(20)
    }
  }
}

const waitForBlockScanJob = async ({ baseUrl, jobId }: { baseUrl: string; jobId: string }) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/scan-blocks/jobs/${jobId}`)
    const job = (await response.json()) as {
      id: string
      status: import("@exitpress/domain/block-scan/schema/BlockScanJobState.js").BlockScanJobStatus
      total: number
      completed: number
      failed: number
      detectedBlockTemplateKeys: string[]
      error: string | null
    }

    if (job.status === "completed" || job.status === "failed") {
      return {
        response,
        job,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(`timed out waiting for block scan job ${jobId}`)
}

afterEach(async () => {
  vi.restoreAllMocks()

  if (activeServer) {
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
  }

  await cleanupTestServerRoots()
})

describe("http server local routes", () => {
  it("rejects unknown output profiles before mutating output", async () => {
    const rootDir = await createTestTempDir("export-profile-invalid-")
    const outputDir = path.join(rootDir, "output")
    const sentinelPath = path.join(outputDir, "keep.txt")
    const jobStore = new JobStore()
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "remote"
    await mkdir(outputDir, { recursive: true })
    await writeFile(sentinelPath, "keep")
    activeServer = createTestHttpServer({ jobStore })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "unknown",
        options,
      }),
    })

    expect(response.status).toBe(400)
    expect(jobStore.jobs.size).toBe(0)
    await expect(access(sentinelPath)).resolves.toBeUndefined()
    await removeDirWithRetry(rootDir)
  })

  it("rejects non-empty output folders without an Exitpress manifest", async () => {
    const rootDir = await createTestTempDir("export-output-unowned-")
    const outputDir = path.join(rootDir, "fumadocs-app")
    const sentinelPath = path.join(outputDir, "package.json")
    const jobStore = new JobStore()
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "remote"
    await mkdir(outputDir, { recursive: true })
    await writeFile(sentinelPath, "{}")
    activeServer = createTestHttpServer({ jobStore })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        profile: "fumadocs",
        options,
      }),
    })

    expect(response.status).toBe(409)
    expect(jobStore.jobs.size).toBe(0)
    await expect(access(sentinelPath)).resolves.toBeUndefined()
    await removeDirWithRetry(rootDir)
  })

  it("rejects download-and-upload exports without provider settings before mutating output", async () => {
    const rootDir = await createTestTempDir("export-provider-required-")
    const outputDir = path.join(rootDir, "output")
    const sentinelPath = path.join(outputDir, "keep.txt")
    const jobStore = new JobStore()
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    await mkdir(outputDir, { recursive: true })
    await writeFile(sentinelPath, "keep")

    activeServer = createTestHttpServer({
      jobStore,
    })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        options,
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("업로드 provider 설정이 필요합니다")
    expect(jobStore.jobs.size).toBe(0)
    await expect(access(sentinelPath)).resolves.toBeUndefined()
    await removeDirWithRetry(rootDir)
  })

  it("rejects malformed upload provider keys without mutating output", async () => {
    const rootDir = await createTestTempDir("export-provider-malformed-")
    const outputDir = path.join(rootDir, "output")
    const sentinelPath = path.join(outputDir, "keep.txt")
    const jobStore = new JobStore()
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "download-and-upload"

    await mkdir(outputDir, { recursive: true })
    await writeFile(sentinelPath, "keep")

    activeServer = createTestHttpServer({
      jobStore,
    })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        options,
        uploadProvider: {
          providerKey: 1,
          providerFields: {
            token: "ghp_malformed_secret",
          },
        },
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("업로드 provider 설정이 필요합니다")
    expect(body.error).not.toContain("ghp_malformed_secret")
    expect(jobStore.jobs.size).toBe(0)
    await expect(access(sentinelPath)).resolves.toBeUndefined()
    await removeDirWithRetry(rootDir)
  })

  it("normalizes upload provider fields without storing them in export job state", async () => {
    const jobStore = new JobStore()
    const options = defaultExportOptions()
    const rawProviderFields = {
      repo: " owner/name ",
      token: " ghp_export_secret ",
    }
    const normalizedProviderFields = {
      repo: "owner/name",
      token: "ghp_export_secret",
    } satisfies UploadProviderFields
    const outputDir = await createTestTempDir("export-provider-normalized-")
    const uploadProviderSource = {
      getCatalog: vi.fn(),
      normalizeProviderFields: vi.fn(async () => normalizedProviderFields),
    }

    options.assets.imageHandlingMode = "download-and-upload"
    mockFetcher({
      html: textOnlyHtml,
      thumbnailUrl: null,
    })

    activeServer = createTestHttpServer({
      jobStore,
      uploadProviderSource,
    })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        options,
        uploadProvider: {
          providerKey: " github ",
          providerFields: rawProviderFields,
        },
      }),
    })
    const body = (await response.json()) as {
      jobId: string
    }

    expect(response.status).toBe(202)
    expect(uploadProviderSource.normalizeProviderFields).toHaveBeenCalledWith(
      "github",
      rawProviderFields,
    )
    const completedJob = await waitForJob({
      baseUrl,
      jobId: body.jobId,
      accept: (job) =>
        job.status === "completed" || job.status === "failed" || job.status === "upload-ready",
    })
    const serializedJob = JSON.stringify(completedJob)
    const serializedManifest = await readFile(path.join(outputDir, "manifest.json"), "utf8")

    expect(jobStore.get(body.jobId)?.request.uploadProvider).toBeUndefined()
    expect(serializedJob).not.toContain("uploadProvider")
    expect(serializedJob).not.toContain("ghp_export_secret")
    expect(serializedJob).not.toContain("owner/name")
    expect(serializedManifest).not.toContain("uploadProvider")
    expect(serializedManifest).not.toContain("ghp_export_secret")
    expect(serializedManifest).not.toContain("owner/name")
    await removeDirWithRetry(outputDir)
  })

  it("rejects upload providers for non-upload export modes", async () => {
    const jobStore = new JobStore()
    const options = defaultExportOptions()
    const outputDir = await createTestTempDir("export-provider-non-upload-")
    const uploadProviderSource = {
      getCatalog: vi.fn(),
      normalizeProviderFields: vi.fn(),
    }

    options.assets.imageHandlingMode = "remote"

    activeServer = createTestHttpServer({
      jobStore,
      uploadProviderSource,
    })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        options,
        uploadProvider: createUploadPayload({
          repo: "owner/name",
          token: "ghp_unexpected_provider",
        }),
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("download-and-upload")
    expect(uploadProviderSource.normalizeProviderFields).not.toHaveBeenCalled()
    expect(jobStore.jobs.size).toBe(0)
    await removeDirWithRetry(outputDir)
  })

  it("does not leak provider values when export provider normalization fails", async () => {
    const secretValue = "ghp_export_secret_leak"
    const options = defaultExportOptions()
    const outputDir = await createTestTempDir("export-provider-failure-")
    const uploadProviderSource = {
      getCatalog: vi.fn(),
      normalizeProviderFields: vi.fn(async () => {
        throw new Error(`invalid token ${secretValue}`)
      }),
    }

    options.assets.imageHandlingMode = "download-and-upload"

    activeServer = createTestHttpServer({
      uploadProviderSource,
    })
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        outputDir,
        options,
        uploadProvider: createUploadPayload({
          repo: "owner/name",
          token: secretValue,
        }),
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("업로드 provider 설정")
    expect(body.error).not.toContain(secretValue)
    expect(body.error).not.toContain("owner/name")
    await removeDirWithRetry(outputDir)
  })

  it("returns the runtime-backed upload provider catalog", async () => {
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

  it("loads upload providers lazily and hides internal runtime errors", async () => {
    const uploadProviderSource = {
      getCatalog: vi.fn(async () => {
        throw new Error("runtime bootstrap failed")
      }),
      normalizeProviderFields: vi.fn(),
    }

    activeServer = createTestHttpServer({
      uploadProviderSource,
    })
    const baseUrl = await startServer(activeServer)

    expect(uploadProviderSource.getCatalog).not.toHaveBeenCalled()

    const defaultsResponse = await fetch(`${baseUrl}/api/export-defaults`)
    expect(defaultsResponse.status).toBe(200)
    expect(uploadProviderSource.getCatalog).not.toHaveBeenCalled()

    const response = await fetch(`${baseUrl}/api/upload-providers`)
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(503)
    expect(body.error).toBe("업로드 설정을 불러오지 못했습니다.")
    expect(body.error).not.toContain("PicList")
    expect(uploadProviderSource.getCatalog).toHaveBeenCalledTimes(1)
  })

  it("opens a local output file through the action api", async () => {
    const rootDir = await createTestTempDir("open-local-file-")
    const targetPath = path.join(rootDir, "posts", "first", "index.md")
    const openLocalPath = vi.fn(async () => {})

    try {
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, "# hello")

      activeServer = createTestHttpServer({
        openLocalPath,
      })
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/local-file/open`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: rootDir,
          outputPath: "posts/first/index.md",
        }),
      })

      expect(response.status).toBe(204)
      expect(openLocalPath).toHaveBeenCalledWith(targetPath)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("builds a preview link from the current markdown file through the action api", async () => {
    const rootDir = await createTestTempDir("preview-local-file-")
    const targetPath = path.join(rootDir, "posts", "first", "index.md")

    try {
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, "# hello")

      activeServer = createTestHttpServer()
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/local-file/preview-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: rootDir,
          outputPath: "posts/first/index.md",
        }),
      })
      const body = (await response.json()) as {
        previewUrl: string
      }

      expect(response.status).toBe(200)
      expect(body.previewUrl).toMatch(/^https:\/\/markdownviewer\.pages\.dev\/#share=/)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("rejects preview-link requests for missing files", async () => {
    const rootDir = await createTestTempDir("preview-local-file-missing-")

    try {
      activeServer = createTestHttpServer()
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/local-file/preview-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: rootDir,
          outputPath: "posts/first/index.md",
        }),
      })

      expect(response.status).toBe(404)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("rejects preview-link requests that escape the output root", async () => {
    const rootDir = await createTestTempDir("preview-local-file-escape-")

    try {
      activeServer = createTestHttpServer()
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/local-file/preview-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: rootDir,
          outputPath: "../outside.md",
        }),
      })

      expect(response.status).toBe(400)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("returns 422 when a preview link cannot be generated", async () => {
    const rootDir = await createTestTempDir("preview-local-file-too-large-")
    const targetPath = path.join(rootDir, "posts", "first", "index.md")
    const markdown = createOversizedPreviewMarkdown()

    expect(buildMarkdownViewerShareUrl(markdown)).toBeNull()

    try {
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, markdown, "utf8")

      activeServer = createTestHttpServer()
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/local-file/preview-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify({
          outputDir: rootDir,
          outputPath: "posts/first/index.md",
        }),
      })

      expect(response.status).toBe(422)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("persists scan results to a json file and reuses them after app reloads", async () => {
    const rootDir = await createTestTempDir("scan-cache-")
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
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
        }),
      })

      expect(firstResponse.status).toBe(200)
      expect(scanBlogSpy).toHaveBeenCalledTimes(1)
      expect(await readFile(scanCachePath, "utf8")).toContain('"mym0404"')

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
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
        }),
      })
      const secondBody = (await secondResponse.json()) as ScanResult

      expect(secondResponse.status).toBe(200)
      expect(secondBody.sourceId).toBe("mym0404")
      expect(scanBlogSpy).toHaveBeenCalledTimes(1)

      const forcedResponse = await fetch(`${baseUrl}/api/scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
          forceRefresh: true,
        }),
      })

      expect(forcedResponse.status).toBe(200)
      expect(scanBlogSpy).toHaveBeenCalledTimes(2)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("detects block output keys from scanned posts", async () => {
    const originalFetch = globalThis.fetch

    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url

      if (url.includes("PostView.naver")) {
        return new Response(uploadHtml, { status: 200 })
      }

      return originalFetch(input, init)
    }) as typeof fetch)

    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/scan-blocks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        scanResult: {
          ...baseScanResult,
          posts: createPosts(null),
        },
        options: defaultExportOptions(),
      }),
    })
    const body = (await response.json()) as {
      jobId: string
    }

    expect(response.status).toBe(202)

    const { job } = await waitForBlockScanJob({ baseUrl, jobId: body.jobId })

    expect(job).toMatchObject({
      status: "completed",
      total: 1,
      completed: 1,
      failed: 0,
      detectedBlockTemplateKeys: ["naver-se4:image", "naver-se4:paragraph"],
      error: null,
    })
  })

  it("reuses post html fetched during block scans for exports", async () => {
    const outputDir = await createTestTempDir("scan-block-export-cache-")
    const originalFetch = globalThis.fetch
    let postViewRequestCount = 0

    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url

      if (url.includes("PostView.naver")) {
        postViewRequestCount += 1
        return new Response(uploadHtml, { status: 200 })
      }

      return originalFetch(input, init)
    }) as typeof fetch)

    try {
      activeServer = createTestHttpServer()
      const baseUrl = await startServer(activeServer)
      const options = defaultExportOptions()
      options.assets.imageHandlingMode = "remote"
      const scanResult = {
        ...baseScanResult,
        posts: createPosts(null),
      }

      const scanBlocksResponse = await fetch(`${baseUrl}/api/scan-blocks/jobs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
          scanResult,
          options,
        }),
      })

      expect(scanBlocksResponse.status).toBe(202)
      const scanBlocksBody = (await scanBlocksResponse.json()) as {
        jobId: string
      }
      const { job: blockScanJob } = await waitForBlockScanJob({
        baseUrl,
        jobId: scanBlocksBody.jobId,
      })

      expect(blockScanJob.status).toBe("completed")
      expect(postViewRequestCount).toBe(1)

      const exportResponse = await fetch(`${baseUrl}/api/export`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          blogKey: "naver",
          sourceInput: "https://blog.naver.com/mym0404",
          outputDir,
          scanResult,
          options,
        }),
      })
      const exportBody = (await exportResponse.json()) as {
        jobId: string
      }

      expect(exportResponse.status).toBe(202)

      const job = await waitForJob({
        baseUrl,
        jobId: exportBody.jobId,
        accept: (currentJob) => currentJob.status === "completed" || currentJob.status === "failed",
      })

      expect(job.status).toBe("completed")
      expect(postViewRequestCount).toBe(1)
    } finally {
      await removeDirWithRetry(outputDir)
    }
  })

  it("rejects block output scans without posts", async () => {
    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/scan-blocks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        scanResult: baseScanResult,
        options: defaultExportOptions(),
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("scanResult.posts")
  })

  it("rejects block output scans when scan result blog id does not match", async () => {
    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/scan-blocks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        scanResult: {
          ...baseScanResult,
          sourceId: "other-blog",
          posts: createPosts(null),
        },
        options: defaultExportOptions(),
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain("요청 블로그와 일치하지 않습니다")
  })

  it("rejects block output scans with invalid options", async () => {
    activeServer = createTestHttpServer()
    const baseUrl = await startServer(activeServer)

    const response = await fetch(`${baseUrl}/api/scan-blocks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogKey: "naver",
        sourceInput: "https://blog.naver.com/mym0404",
        scanResult: {
          ...baseScanResult,
          posts: createPosts(null),
        },
        options: {
          frontmatter: {
            enabled: true,
            fields: {
              source: true,
              title: true,
            },
            aliases: {
              source: "shared",
              title: "shared",
            },
          },
        },
      }),
    })
    const body = (await response.json()) as {
      error: string
    }

    expect(response.status).toBe(400)
    expect(body.error).toContain('alias "shared"')
  })
})
