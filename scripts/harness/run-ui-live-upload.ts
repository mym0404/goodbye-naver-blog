import { existsSync, readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium } from "playwright"

import { createHttpServer } from "../../src/server/http-server.js"
import type { ExportJobState, PostManifestEntry, ScanResult } from "../../src/shared/types.js"

const blogId = "mym0404"
const targetLogNo = "222990202785"
const uploadRepo = "mym0404/image-archive"
const uploadBranch = "master"
const uploadPath = `farewell-live/${Date.now()}`
const responseTimeoutMs = 240_000
const githubApiBaseUrl = "https://api.github.com"
const getCaptureDir = () => {
  const index = process.argv.indexOf("--capture-dir")

  if (index < 0) {
    return null
  }

  return process.argv[index + 1] ?? null
}
const resolveBrowserMode = () => {
  if (process.argv.includes("--headed")) {
    return {
      headless: false,
      slowMo: 200,
    }
  }

  if (process.argv.includes("--headless")) {
    return {
      headless: true,
      slowMo: 0,
    }
  }

  return {
    headless: true,
    slowMo: 0,
  }
}

type LiveUploadConfig = {
  token: string
  branch: string
}

type BranchResponse = {
  commit?: {
    sha?: string
  }
}

type CompareResponse = {
  files?: Array<{
    filename?: string
  }>
}

type TreeResponse = {
  tree?: Array<{
    path?: string
    type?: string
  }>
}

const loadDotEnv = (filePath: string) => {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, "utf8")

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!key || process.env[key] !== undefined) {
      continue
    }

    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value

    process.env[key] = unquoted
  }
}

const resolveLiveUploadConfig = (): LiveUploadConfig => {
  loadDotEnv(".env")

  if (process.env.FAREWELL_UPLOAD_E2E !== "1") {
    throw new Error("FAREWELL_UPLOAD_E2E=1 이 필요합니다.")
  }

  const token = process.env.FAREWELL_UPLOAD_E2E_GITHUB_TOKEN?.trim()

  if (!token) {
    throw new Error("FAREWELL_UPLOAD_E2E_GITHUB_TOKEN 이 필요합니다.")
  }

  return {
    token,
    branch: uploadBranch,
  }
}

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

const waitForStepView = async ({
  page,
  step,
}: {
  page: import("playwright").Page
  step: string
}) => {
  await page.waitForFunction(
    (nextStep) => document.querySelector(`[data-step-view="${nextStep}"]`) instanceof HTMLElement,
    step,
    { timeout: responseTimeoutMs },
  )
}

const waitForStatus = async ({
  page,
  status,
}: {
  page: import("playwright").Page
  status: ExportJobState["status"]
}) => {
  await page.waitForFunction(
    (expectedStatus) =>
      document.querySelector("#status-text")?.textContent?.trim() === expectedStatus,
    status,
    { timeout: responseTimeoutMs },
  )
}

const clickWizardButton = async ({
  page,
  label,
}: {
  page: import("playwright").Page
  label: string
}) => {
  await page.getByRole("button", { name: label }).click()
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`)
  }

  return (await response.json()) as T
}

const fetchGitHubJson = async <T>({
  token,
  pathname,
}: {
  token: string
  pathname: string
}): Promise<T> => {
  const response = await fetch(`${githubApiBaseUrl}${pathname}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "farewell-naver-blog-playwright-e2e",
      "x-github-api-version": "2022-11-28",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${pathname}`)
  }

  return (await response.json()) as T
}

const getBranchHeadSha = async ({
  token,
  branch,
}: LiveUploadConfig) => {
  const response = await fetchGitHubJson<BranchResponse>({
    token,
    pathname: `/repos/${uploadRepo}/branches/${encodeURIComponent(branch)}`,
  })
  const sha = response.commit?.sha?.trim()

  if (!sha) {
    throw new Error(`GitHub branch head SHA를 찾을 수 없습니다: ${branch}`)
  }

  return sha
}

const waitForBranchHeadChange = async ({
  beforeSha,
  config,
}: {
  beforeSha: string
  config: LiveUploadConfig
}) => {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const nextSha = await getBranchHeadSha(config)

    if (nextSha !== beforeSha) {
      return nextSha
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  return null
}

const getChangedFilesBetween = async ({
  token,
  beforeSha,
  afterSha,
}: {
  token: string
  beforeSha: string
  afterSha: string
}) => {
  const response = await fetchGitHubJson<CompareResponse>({
    token,
    pathname: `/repos/${uploadRepo}/compare/${beforeSha}...${afterSha}`,
  })

  return (response.files ?? [])
    .map((file) => file.filename?.trim())
    .filter((filename): filename is string => Boolean(filename))
}

const assertRepoContainsFiles = async ({
  token,
  branch,
  fileNames,
}: {
  token: string
  branch: string
  fileNames: string[]
}) => {
  const response = await fetchGitHubJson<TreeResponse>({
    token,
    pathname: `/repos/${uploadRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  })
  const treePaths = new Set(
    (response.tree ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path?.trim())
      .filter((entry): entry is string => Boolean(entry)),
  )

  for (const fileName of fileNames) {
    if (!Array.from(treePaths).some((treePath) => treePath === fileName || treePath.endsWith(`/${fileName}`))) {
      throw new Error(`GitHub repo root did not contain uploaded file: ${fileName}`)
    }
  }
}

const assertImageVisible = async ({
  context,
  imageUrl,
}: {
  context: import("playwright").BrowserContext
  imageUrl: string
}) => {
  const page = await context.newPage()

  try {
    await page.setContent('<img id="uploaded-image" alt="uploaded image" />')
    await page.locator("#uploaded-image").evaluate((element, nextUrl) => {
      if (!(element instanceof HTMLImageElement)) {
        throw new Error("uploaded-image element is not an image")
      }

      element.src = nextUrl
    }, imageUrl)

    await page.waitForFunction(() => {
      const image = document.querySelector("#uploaded-image")

      return (
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
      )
    }, undefined, { timeout: responseTimeoutMs })
  } finally {
    await page.close()
  }
}

const saveCapture = async ({
  page,
  captureDir,
  fileName,
}: {
  page: import("playwright").Page
  captureDir: string | null
  fileName: string
}) => {
  if (!captureDir) {
    return null
  }

  await mkdir(captureDir, {
    recursive: true,
  })

  const filePath = path.join(captureDir, fileName)
  await page.screenshot({
    path: filePath,
    fullPage: true,
  })

  return filePath
}

const saveJsonCapture = async ({
  captureDir,
  fileName,
  payload,
}: {
  captureDir: string | null
  fileName: string
  payload: unknown
}) => {
  if (!captureDir) {
    return null
  }

  await mkdir(captureDir, {
    recursive: true,
  })

  const filePath = path.join(captureDir, fileName)
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  return filePath
}

const readUiUploadState = async ({
  page,
}: {
  page: import("playwright").Page
}) =>
  page.evaluate(() => ({
    statusText: document.querySelector("#status-text")?.textContent?.trim() ?? null,
    uploadProgress: Number(
      document.querySelector("#upload-progress")?.getAttribute("aria-valuenow") ?? "0",
    ),
    partialRowCount: document.querySelectorAll('[data-upload-row-status="partial"]').length,
    completeRowCount: document.querySelectorAll('[data-upload-row-status="complete"]').length,
    uploadFormVisible: Boolean(document.querySelector("#upload-providerKey")),
    rewritePendingCopy: document.querySelector("#status-panel")?.textContent?.includes(
      "자산 업로드는 끝났고 결과 파일에 URL을 반영하는 중입니다.",
    ),
  }))

const waitForObservedUploadState = async ({
  page,
  baseUrl,
  jobId,
  timeoutMs,
  accept,
}: {
  page: import("playwright").Page
  baseUrl: string
  jobId: string
  timeoutMs: number
  accept: (snapshot: {
    job: ExportJobState
    ui: Awaited<ReturnType<typeof readUiUploadState>>
  }) => Promise<boolean> | boolean
}) => {
  const startTime = Date.now()
  let lastSnapshot: {
    job: ExportJobState
    ui: Awaited<ReturnType<typeof readUiUploadState>>
  } | null = null

  while (Date.now() - startTime < timeoutMs) {
    const job = await fetchJson<ExportJobState>(`${baseUrl}/api/export/${jobId}`)
    const ui = await readUiUploadState({
      page,
    })
    lastSnapshot = {
      job,
      ui,
    }

    if (await accept({ job, ui })) {
      return { job, ui }
    }

    await page.waitForTimeout(1_000)
  }

  throw new Error(
    `expected live upload state was not observed before timeout: ${JSON.stringify(lastSnapshot)}`,
  )
}

const run = async () => {
  const config = resolveLiveUploadConfig()
  const server = createHttpServer()
  const browserMode = resolveBrowserMode()
  const browser = await chromium.launch(browserMode)
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1200,
    },
  })
  const page = await context.newPage()
  const outputDir = await mkdtemp(path.join(tmpdir(), "farewell-live-upload-ui-"))
  const captureDir = getCaptureDir()
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const liveEvidence: {
    branch: string
    beforeSha?: string
    partial?: Record<string, unknown>
    rewritePending?: Record<string, unknown>
    final?: Record<string, unknown>
  } = {
    branch: config.branch,
  }
  let baseUrl = ""

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  try {
    baseUrl = await startServer(server)
    await page.goto(baseUrl)
    await waitForStepView({
      page,
      step: "blog-input",
    })

    await page.fill("#blogIdOrUrl", blogId)

    const scanResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/scan` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await clickWizardButton({
      page,
      label: "카테고리 불러오기",
    })
    const scanResponse = await scanResponsePromise
    const scanResult = (await scanResponse.json()) as ScanResult

    await waitForStepView({
      page,
      step: "category-selection",
    })

    const targetPost = scanResult.posts.find((post) => post.logNo === targetLogNo)

    if (!targetPost) {
      throw new Error(`target post metadata not found: ${blogId}/${targetLogNo}`)
    }

    const targetCategory = scanResult.categories.find((category) => category.id === targetPost.categoryId)

    if (!targetCategory) {
      throw new Error(`target category metadata not found: ${targetPost.categoryId}`)
    }

    const scopedDate = targetPost.publishedAt.slice(0, 10)
    const scopedPosts = scanResult.posts.filter(
      (post) => post.categoryId === targetPost.categoryId && post.publishedAt.startsWith(scopedDate),
    )

    if (scopedPosts.length !== 1) {
      throw new Error(
        `live upload scope drifted: expected exactly one post for category ${targetPost.categoryId} on ${scopedDate}, got ${scopedPosts.length}`,
      )
    }

    await page.selectOption("#scope-categoryMode", "exact-selected")
    await page.fill("#scope-dateFrom", scopedDate)
    await page.fill("#scope-dateTo", scopedDate)
    await page.click("#clear-all-categories")
    await page.locator(`tr[data-category-id="${targetCategory.id}"] [role="checkbox"]`).click()
    await page.waitForFunction(
      () => document.querySelector("#selected-post-count")?.textContent?.includes("대상 글 1개") ?? false,
      undefined,
      { timeout: responseTimeoutMs },
    )

    await clickWizardButton({
      page,
      label: "구조 설정",
    })
    await waitForStepView({
      page,
      step: "structure-options",
    })

    await page.fill("#outputDir", outputDir)

    for (const nextStep of ["frontmatter-options", "markdown-options", "assets-options"] as const) {
      await clickWizardButton({
        page,
        label:
          nextStep === "frontmatter-options"
            ? "Frontmatter 설정"
            : nextStep === "markdown-options"
              ? "Markdown 설정"
              : "Assets 설정",
      })
      await waitForStepView({
        page,
        step: nextStep,
      })
    }

    await page.selectOption("#assets-imageHandlingMode", "download-and-upload")
    await clickWizardButton({
      page,
      label: "진단 설정",
    })
    await waitForStepView({
      page,
      step: "diagnostics-options",
    })

    const exportRequestPromise = page.waitForRequest(
      (request) => request.url() === `${baseUrl}/api/export` && request.method() === "POST",
      { timeout: responseTimeoutMs },
    )
    const exportResponsePromise = page.waitForResponse(
      (response) => response.url() === `${baseUrl}/api/export` && response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await clickWizardButton({
      page,
      label: "내보내기",
    })
    const exportRequest = await exportRequestPromise
    const exportResponse = await exportResponsePromise
    const exportPayload = exportRequest.postDataJSON() as {
      blogIdOrUrl: string
      outputDir: string
      options: {
        scope: {
          categoryMode: string
          categoryIds: number[]
          dateFrom: string | null
          dateTo: string | null
        }
        assets: {
          imageHandlingMode: string
        }
      }
    }

    if (exportResponse.status() !== 202) {
      throw new Error(`export request failed: ${exportResponse.status()}`)
    }

    if (
      exportPayload.blogIdOrUrl !== blogId ||
      exportPayload.outputDir !== outputDir ||
      exportPayload.options.scope.categoryMode !== "exact-selected" ||
      exportPayload.options.scope.dateFrom !== scopedDate ||
      exportPayload.options.scope.dateTo !== scopedDate ||
      exportPayload.options.scope.categoryIds.length !== 1 ||
      exportPayload.options.scope.categoryIds[0] !== targetCategory.id ||
      exportPayload.options.assets.imageHandlingMode !== "download-and-upload"
    ) {
      throw new Error("browser export payload did not match the expected scoped upload request")
    }

    const exportBody = (await exportResponse.json()) as {
      jobId?: string
    }
    const jobId = exportBody.jobId?.trim()

    if (!jobId) {
      throw new Error("export response did not return a jobId")
    }

    await waitForStatus({
      page,
      status: "upload-ready",
    })

    const readyJob = await fetchJson<ExportJobState>(`${baseUrl}/api/export/${jobId}`)
    const readyItem = readyJob.items.find((item) => item.logNo === targetLogNo)

    if (!readyItem?.outputPath) {
      throw new Error("upload-ready job did not expose the target markdown path")
    }

    if (readyItem.upload.candidateCount <= 0) {
      throw new Error("upload-ready job did not expose upload candidates")
    }

    const markdownPath = path.join(outputDir, readyItem.outputPath)
    const markdownBeforeUpload = await readFile(markdownPath, "utf8")

    for (const candidate of readyItem.upload.candidates) {
      if (!markdownBeforeUpload.includes(candidate.markdownReference)) {
        throw new Error(`markdown did not contain pre-upload reference: ${candidate.markdownReference}`)
      }
    }

    const branchHeadBeforeUpload = await getBranchHeadSha(config)
    liveEvidence.beforeSha = branchHeadBeforeUpload
    const uploadRequestPromise = page.waitForRequest(
      (request) => request.url() === `${baseUrl}/api/export/${jobId}/upload` && request.method() === "POST",
      { timeout: responseTimeoutMs },
    )
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `${baseUrl}/api/export/${jobId}/upload` &&
        response.request().method() === "POST",
      { timeout: responseTimeoutMs },
    )

    await page.fill("#upload-providerField-repo", uploadRepo)
    await page.fill("#upload-providerField-branch", config.branch)
    await page.fill("#upload-providerField-path", uploadPath)
    await page.fill("#upload-providerField-token", config.token)
    await page.click("#upload-submit")

    const uploadRequest = await uploadRequestPromise
    const uploadResponse = await uploadResponsePromise
    const uploadPayload = uploadRequest.postDataJSON() as {
      providerKey: string
      providerFields: Record<string, string>
    }

    if (uploadResponse.status() !== 202) {
      throw new Error(`upload request failed: ${uploadResponse.status()}`)
    }

    if (
      uploadPayload.providerKey !== "github" ||
      uploadPayload.providerFields.repo !== uploadRepo ||
      uploadPayload.providerFields.branch !== config.branch ||
      uploadPayload.providerFields.path !== uploadPath ||
      uploadPayload.providerFields.token !== config.token
    ) {
      throw new Error("browser upload payload did not match the expected GitHub config")
    }

    await waitForStatus({
      page,
      status: "uploading",
    })

    const partialState = await waitForObservedUploadState({
      page,
      baseUrl,
      jobId,
      timeoutMs: 60_000,
      accept: async ({ job, ui }) => {
        const uploadObserved =
          job.upload.uploadedCount > 0 &&
          (job.status === "uploading" || job.status === "upload-completed") &&
          (ui.statusText === "uploading" || ui.statusText === "upload-completed")

        if (!uploadObserved) {
          return false
        }

        const currentHead = await getBranchHeadSha(config)

        if (currentHead === branchHeadBeforeUpload) {
          return false
        }

        const changedFiles = await getChangedFilesBetween({
          token: config.token,
          beforeSha: branchHeadBeforeUpload,
          afterSha: currentHead,
        })

        return (
          changedFiles.some((filename) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(filename)) &&
          ui.uploadProgress > 0 &&
          !ui.uploadFormVisible &&
          (ui.partialRowCount > 0 || ui.completeRowCount > 0)
        )
      },
    })
    const partialSha = await getBranchHeadSha(config)
    const partialChangedFiles = await getChangedFilesBetween({
      token: config.token,
      beforeSha: branchHeadBeforeUpload,
      afterSha: partialSha,
    })
    const partialScreenshot = await saveCapture({
      page,
      captureDir,
      fileName: "live-upload-partial-progress.png",
    })

    liveEvidence.partial = {
      jobStatus: partialState.job.status,
      uploadedCount: partialState.job.upload.uploadedCount,
      candidateCount: partialState.job.upload.candidateCount,
      uiStatus: partialState.ui.statusText,
      uiUploadProgress: partialState.ui.uploadProgress,
      partialRowCount: partialState.ui.partialRowCount,
      completeRowCount: partialState.ui.completeRowCount,
      branch: config.branch,
      headSha: partialSha,
      changedFiles: partialChangedFiles,
      screenshot: partialScreenshot,
    }

    const rewritePendingState = await waitForObservedUploadState({
      page,
      baseUrl,
      jobId,
      timeoutMs: 60_000,
      accept: ({ job, ui }) => {
        const rewritePendingObserved =
          job.status === "uploading" &&
          job.upload.uploadedCount === job.upload.candidateCount &&
          ui.statusText === "uploading" &&
          ui.uploadProgress === 100 &&
          ui.rewritePendingCopy &&
          !ui.uploadFormVisible

        if (rewritePendingObserved) {
          return true
        }

        return (
          job.status === "upload-completed" &&
          job.upload.uploadedCount === job.upload.candidateCount &&
          ui.statusText === "upload-completed" &&
          ui.uploadProgress === 100 &&
          ui.completeRowCount > 0 &&
          !ui.uploadFormVisible
        )
      },
    })
    const rewritePendingScreenshot = await saveCapture({
      page,
      captureDir,
      fileName: "live-upload-rewrite-pending.png",
    })

    liveEvidence.rewritePending = {
      jobStatus: rewritePendingState.job.status,
      uploadedCount: rewritePendingState.job.upload.uploadedCount,
      candidateCount: rewritePendingState.job.upload.candidateCount,
      uiStatus: rewritePendingState.ui.statusText,
      uiUploadProgress: rewritePendingState.ui.uploadProgress,
      rewritePendingCopy: rewritePendingState.ui.rewritePendingCopy,
      screenshot: rewritePendingScreenshot,
    }

    await waitForStatus({
      page,
      status: "upload-completed",
    })

    const completedJob = await fetchJson<ExportJobState>(`${baseUrl}/api/export/${jobId}`)
    const manifest = await fetchJson<{
      upload: {
        status: string
        uploadedCount: number
        candidateCount: number
      }
      posts: PostManifestEntry[]
    }>(`${baseUrl}/api/export/${jobId}/manifest`)
    const completedPost = manifest.posts.find((post) => post.logNo === targetLogNo)

    if (completedJob.upload.status !== "upload-completed") {
      throw new Error(`job did not reach upload-completed: ${completedJob.upload.status}`)
    }

    if (manifest.upload.status !== "upload-completed") {
      throw new Error(`manifest did not reach upload-completed: ${manifest.upload.status}`)
    }

    if (manifest.upload.uploadedCount !== manifest.upload.candidateCount) {
      throw new Error("manifest uploadedCount and candidateCount diverged")
    }

    if (!completedPost || completedPost.assetPaths.length === 0) {
      throw new Error("completed manifest did not contain uploaded asset URLs")
    }

    for (const assetPath of completedPost.assetPaths) {
      const uploadedUrl = new URL(assetPath)

      if (!["http:", "https:"].includes(uploadedUrl.protocol)) {
        throw new Error(`uploaded asset is not an http(s) URL: ${assetPath}`)
      }

      if (!assetPath.includes("image-archive")) {
        throw new Error(`uploaded asset URL does not point at ${uploadRepo}: ${assetPath}`)
      }

      if (!uploadedUrl.pathname.includes(uploadPath)) {
        throw new Error(`uploaded asset URL did not preserve the requested GitHub path: ${assetPath}`)
      }
    }

    const markdownAfterUpload = await readFile(markdownPath, "utf8")

    for (const candidate of readyItem.upload.candidates) {
      if (markdownAfterUpload.includes(candidate.markdownReference)) {
        throw new Error(`markdown still contains pre-upload reference: ${candidate.markdownReference}`)
      }
    }

    for (const assetPath of completedPost.assetPaths) {
      if (!markdownAfterUpload.includes(assetPath)) {
        throw new Error(`markdown did not contain uploaded URL: ${assetPath}`)
      }
    }

    const completedJobJson = JSON.stringify(completedJob)
    const manifestJson = JSON.stringify(manifest)

    if (completedJobJson.includes(config.token) || manifestJson.includes(config.token)) {
      throw new Error("upload token leaked into job polling payload or manifest")
    }

    const uploadedFileNames = completedPost.assetPaths.map((assetPath) => {
      const uploadedUrl = new URL(assetPath)
      const fileName = decodeURIComponent(uploadedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "")

      if (!fileName) {
        throw new Error(`uploaded asset URL did not include a file name: ${assetPath}`)
      }

      return decodeURIComponent(`${uploadPath}/${fileName}`)
    })

    await assertRepoContainsFiles({
      token: config.token,
      branch: config.branch,
      fileNames: uploadedFileNames,
    })

    const branchHeadAfterUpload = await waitForBranchHeadChange({
      beforeSha: branchHeadBeforeUpload,
      config,
    })

    if (branchHeadAfterUpload) {
      const changedFiles = await getChangedFilesBetween({
        token: config.token,
        beforeSha: branchHeadBeforeUpload,
        afterSha: branchHeadAfterUpload,
      })

      if (
        !changedFiles.some((filename) =>
          /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(filename),
        )
      ) {
        throw new Error("GitHub compare result did not include uploaded image files")
      }
    }

    const finalScreenshot = await saveCapture({
      page,
      captureDir,
      fileName: "live-upload-completed.png",
    })

    liveEvidence.final = {
      jobStatus: completedJob.status,
      uploadStatus: completedJob.upload.status,
      uploadedCount: completedJob.upload.uploadedCount,
      candidateCount: completedJob.upload.candidateCount,
      branch: config.branch,
      headSha: branchHeadAfterUpload,
      screenshot: finalScreenshot,
      uploadedFiles: uploadedFileNames,
    }

    await saveJsonCapture({
      captureDir,
      fileName: "live-upload-evidence.json",
      payload: liveEvidence,
    })

    await assertImageVisible({
      context,
      imageUrl: completedPost.assetPaths[0]!,
    })

    if (consoleErrors.length > 0) {
      throw new Error(`browser console error: ${consoleErrors[0]}`)
    }

    if (pageErrors.length > 0) {
      throw new Error(`browser page error: ${pageErrors[0]}`)
    }

    console.log(JSON.stringify(liveEvidence, null, 2))
  } finally {
    await context.close()
    await browser.close()
    await rm(outputDir, {
      recursive: true,
      force: true,
    })
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
