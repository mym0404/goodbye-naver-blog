import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { defaultExportOptions } from "../../src/shared/ExportOptions.js"
import type { ExportJobState, ExportManifest, ExportOptions, ScanResult } from "../../src/shared/Types.js"

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const resumeCases = {
  default: {
    blogId: "mym0404",
    dateFrom: "2017-03-31",
    dateTo: "2017-03-31",
    categoryId: "17",
    delayedLogNo: "220971956932",
    expectedPosts: "2",
  },
  "se2-table": {
    blogId: "blogpeople",
    dateFrom: "2013-06-26",
    dateTo: "2013-06-27",
    categoryId: "21",
    delayedLogNo: "150170710293",
    expectedPosts: "4",
  },
} as const

type ResumeCaseId = keyof typeof resumeCases

const parseResumeCaseId = (argv: string[]): ResumeCaseId => {
  const caseFlagIndex = argv.indexOf("--case")
  const caseId = caseFlagIndex >= 0 ? argv[caseFlagIndex + 1] : "default"

  if (caseId !== "default" && caseId !== "se2-table") {
    throw new Error(`unknown live resume export case: ${caseId}`)
  }

  return caseId
}

const selectedResumeCase = resumeCases[parseResumeCaseId(process.argv.slice(2))]
const blogId = process.env.FAREWELL_LIVE_RESUME_BLOG_ID ?? selectedResumeCase.blogId
const scopedDateFrom = process.env.FAREWELL_LIVE_RESUME_DATE_FROM ?? selectedResumeCase.dateFrom
const scopedDateTo = process.env.FAREWELL_LIVE_RESUME_DATE_TO ?? selectedResumeCase.dateTo
const scopedCategoryId = Number(process.env.FAREWELL_LIVE_RESUME_CATEGORY_ID ?? selectedResumeCase.categoryId)
const delayedLogNo = process.env.FAREWELL_LIVE_RESUME_DELAY_LOGNO ?? selectedResumeCase.delayedLogNo
const expectedScopedPostCount = Number(
  process.env.FAREWELL_LIVE_RESUME_EXPECTED_POSTS ?? selectedResumeCase.expectedPosts,
)
const scopedOutputDir = `output/live-resume-e2e-${Date.now()}`
const responseTimeoutMs = 240_000

const isWithinScopedDateRange = (publishedAt: string) => {
  const publishedDate = publishedAt.slice(0, 10)

  return publishedDate >= scopedDateFrom && publishedDate <= scopedDateTo
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`)
  }

  return (await response.json()) as T
}

const postJson = async <T>({
  url,
  body,
}: {
  url: string
  body: unknown
}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${url}`)
  }

  return (await response.json()) as T
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
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const job = await fetchJson<ExportJobState>(`${baseUrl}/api/export/${jobId}`)

    if (accept(job)) {
      return job
    }

    await wait(1_000)
  }

  throw new Error(`timed out while waiting for job ${jobId}`)
}

const waitForManifest = async ({
  manifestPath,
  accept,
}: {
  manifestPath: string
  accept: (manifest: ExportManifest) => boolean
}) => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ExportManifest

      if (accept(manifest)) {
        return manifest
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }

    await wait(500)
  }

  throw new Error(`timed out while waiting for manifest ${manifestPath}`)
}

const waitForServerReady = (child: ChildProcessWithoutNullStreams) =>
  new Promise<string>((resolve, reject) => {
    let stdoutBuffer = ""
    let stderrBuffer = ""

    const cleanup = () => {
      child.stdout.off("data", handleStdout)
      child.stderr.off("data", handleStderr)
      child.off("exit", handleExit)
    }

    const handleStdout = (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8")

      const readyLine = stdoutBuffer
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => /^READY \d+$/.test(line))

      if (!readyLine) {
        return
      }

      cleanup()
      resolve(`http://127.0.0.1:${readyLine.slice("READY ".length)}`)
    }

    const handleStderr = (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf8")
    }

    const handleExit = (code: number | null) => {
      cleanup()
      reject(new Error(`live server exited before ready: code=${code}\n${stderrBuffer}`))
    }

    child.stdout.on("data", handleStdout)
    child.stderr.on("data", handleStderr)
    child.on("exit", handleExit)
  })

const startServer = async ({
  settingsPath,
  scanCachePath,
  delayedLogNos = [],
  delayMs = 0,
}: {
  settingsPath: string
  scanCachePath: string
  delayedLogNos?: string[]
  delayMs?: number
}) => {
  const child = spawn("pnpm", ["exec", "tsx", "scripts/harness/run-live-server.ts"], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      FAREWELL_SETTINGS_PATH: settingsPath,
      FAREWELL_SCAN_CACHE_PATH: scanCachePath,
      FAREWELL_LIVE_FETCH_DELAY_LOGNOS: delayedLogNos.join(","),
      FAREWELL_LIVE_FETCH_DELAY_MS: String(delayMs),
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  const baseUrl = await waitForServerReady(child)

  return {
    child,
    baseUrl,
  }
}

const stopServer = async ({
  child,
  signal = "SIGTERM",
}: {
  child: ChildProcessWithoutNullStreams
  signal?: NodeJS.Signals
}) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve()
      return
    }

    child.once("exit", () => resolve())

    try {
      process.kill(-child.pid!, signal)
    } catch {
      child.kill(signal)
    }
  })

const buildScopedOptions = () => {
  const options: ExportOptions = defaultExportOptions()

  options.scope.categoryMode = "exact-selected"
  options.scope.categoryIds = [scopedCategoryId]
  options.scope.dateFrom = scopedDateFrom
  options.scope.dateTo = scopedDateTo
  options.assets.imageHandlingMode = "remote"

  return options
}

const run = async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "farewell-live-resume-export-"))
  const settingsPath = path.join(tempRoot, "export-ui-settings.json")
  const scanCachePath = path.join(tempRoot, "scan-cache.json")
  const manifestPath = path.join(repoRoot, scopedOutputDir, "manifest.json")
  let firstServer: { child: ChildProcessWithoutNullStreams; baseUrl: string } | null = null
  let secondServer: { child: ChildProcessWithoutNullStreams; baseUrl: string } | null = null

  try {
    firstServer = await startServer({
      settingsPath,
      scanCachePath,
      delayedLogNos: [delayedLogNo],
      delayMs: 30_000,
    })
    console.log("live resume: first server ready")

    const scanResult = await postJson<ScanResult>({
      url: `${firstServer.baseUrl}/api/scan`,
      body: {
        blogIdOrUrl: blogId,
      },
    })
    console.log("live resume: scan completed")

    const scopedPosts = (scanResult.posts ?? []).filter(
      (post) => post.categoryId === scopedCategoryId && isWithinScopedDateRange(post.publishedAt),
    )

    if (scopedPosts.length !== expectedScopedPostCount) {
      throw new Error(
        `live resume scope drifted: expected exactly ${expectedScopedPostCount} posts for category ${scopedCategoryId} from ${scopedDateFrom} to ${scopedDateTo}, got ${scopedPosts.length}`,
      )
    }

    if (!scopedPosts.some((post) => post.logNo === delayedLogNo)) {
      throw new Error(`live resume delayed target is missing from the scoped posts: ${delayedLogNo}`)
    }

    const exportResponse = await postJson<{ jobId: string }>({
      url: `${firstServer.baseUrl}/api/export`,
      body: {
        blogIdOrUrl: blogId,
        outputDir: scopedOutputDir,
        options: buildScopedOptions(),
        scanResult,
      },
    })
    console.log("live resume: export accepted")

    const jobId = exportResponse.jobId?.trim()

    if (!jobId) {
      throw new Error("export response did not return a jobId")
    }

    await waitForJob({
      baseUrl: firstServer.baseUrl,
      jobId,
      accept: (job) => job.status === "running" && job.progress.completed >= 1,
    })

    const partialManifest = await waitForManifest({
      manifestPath,
      accept: (manifest) =>
        manifest.job?.id === jobId &&
        manifest.job?.status === "running" &&
        manifest.job.request.outputDir === scopedOutputDir &&
        manifest.job.request.options.assets.imageHandlingMode === "remote",
    })
    console.log("live resume: partial manifest persisted")

    if (partialManifest.job?.scanResult?.posts) {
      throw new Error("partial manifest should not persist scanResult.posts")
    }

    await stopServer({
      child: firstServer.child,
      signal: "SIGKILL",
    })
    firstServer = null
    console.log("live resume: first server killed")

    secondServer = await startServer({
      settingsPath,
      scanCachePath,
    })
    console.log("live resume: second server ready")

    const defaults = await fetchJson<{
      resumedJob: ExportJobState | null
      resumedScanResult: ScanResult | null
    }>(`${secondServer.baseUrl}/api/export-defaults`)

    if (defaults.resumedJob?.id !== jobId || !defaults.resumedJob.resumeAvailable) {
      throw new Error("bootstrap did not expose a resumable running job")
    }

    const resumedScanPosts = defaults.resumedScanResult?.posts ?? []

    if (
      resumedScanPosts.length < expectedScopedPostCount ||
      !scopedPosts.every((post) => resumedScanPosts.some((resumedPost) => resumedPost.logNo === post.logNo))
    ) {
      throw new Error("bootstrap did not restore cached scan posts for the resumed job")
    }

    await postJson<{ jobId: string; status: string }>({
      url: `${secondServer.baseUrl}/api/export/${jobId}/resume`,
      body: {},
    })
    console.log("live resume: resume requested")

    const completedJob = await waitForJob({
      baseUrl: secondServer.baseUrl,
      jobId,
      accept: (job) => job.status === "completed",
    })
    const completedManifest = await waitForManifest({
      manifestPath,
      accept: (manifest) =>
        manifest.job?.status === "completed" &&
        manifest.successCount === expectedScopedPostCount &&
        manifest.totalPosts === expectedScopedPostCount,
    })
    console.log("live resume: completed manifest persisted")

    if (completedJob.progress.completed !== expectedScopedPostCount || completedJob.progress.failed !== 0) {
      throw new Error(`unexpected completed job progress: ${JSON.stringify(completedJob.progress)}`)
    }

    for (const post of completedManifest.posts) {
      if (!post.outputPath) {
        throw new Error(`completed manifest post outputPath missing: ${post.logNo}`)
      }
    }

    console.log(
      JSON.stringify(
        {
          blogId,
          scopedDateFrom,
          scopedDateTo,
          scopedCategoryId,
          outputDir: scopedOutputDir,
          resumedJobId: jobId,
          completedCount: completedManifest.successCount,
        },
        null,
        2,
      ),
    )
  } finally {
    if (firstServer) {
      await stopServer({
        child: firstServer.child,
      })
    }

    if (secondServer) {
      await stopServer({
        child: secondServer.child,
      })
    }

    await rm(path.join(repoRoot, scopedOutputDir), {
      recursive: true,
      force: true,
    })
    await rm(tempRoot, {
      recursive: true,
      force: true,
    })
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
