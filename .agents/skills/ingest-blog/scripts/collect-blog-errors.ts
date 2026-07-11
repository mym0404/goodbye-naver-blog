#!/usr/bin/env bun

import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { ensureDir, resolveRepoPath } from "@exitpress/engine/infra/node/FilePaths.js"

import type { SinglePostInspectDiagnostics } from "../../../../packages/blog-naver/src/exporting/SinglePostInspect.js"
import type { ScanResult } from "../../../../packages/domain/src/blog/schema/BlogScan.js"
import type { ExportJobItem } from "../../../../packages/domain/src/export-job/schema/ExportJobState.js"
import type {
  ExportManifest,
  PostManifestEntry,
} from "../../../../packages/domain/src/export-job/schema/ExportManifest.js"
import type { EvidenceCase } from "../../../../scripts/post-evidence/cases.js"
import type { ReusableIngestOutput } from "../../../../scripts/post-evidence/ingest-output.js"

import type { SupportUnitFailureGroup } from "./lib/ingest-focus.js"

import { inspectSinglePost } from "../../../../packages/blog-naver/src/exporting/SinglePostInspect.js"
import { createNaverBlog } from "../../../../packages/blog-naver/src/NaverBlog.js"
import { createTistoryBlog } from "../../../../packages/blog-tistory/src/TistoryBlog.js"
import { defaultExportOptions } from "../../../../packages/domain/src/export-options/ExportOptions.js"
import { createBlogRegistry } from "../../../../packages/engine/src/blog/BlogRegistry.js"
import { BlogExportWorkflow } from "../../../../packages/engine/src/exporting/blog/BlogExportWorkflow.js"
import { runWithLogSink } from "../../../../packages/engine/src/infra/runtime/Logger.js"
import { toErrorMessage } from "../../../../packages/engine/src/shared/error/util/toErrorMessage.js"
import { createPostHtmlCache } from "../../../../packages/server/src/state/PostHtmlCache.js"
import {
  capturePostEvidence,
  createEvidenceMarkdownSections,
} from "../../../../scripts/post-evidence/capture.js"
import { renderEvidenceMarkdownSections } from "../../../../scripts/post-evidence/evidence.js"
import {
  findLatestReusableIngestOutput,
  loadReusableIngestOutput,
} from "../../../../scripts/post-evidence/ingest-output.js"

import { mergeSupportUnitFailureGroups, selectFocusedSupportUnit } from "./lib/ingest-focus.js"
import { createSupportUnit } from "./lib/ingest-support-units.js"

type CollectArgs = {
  blogKey: string
  sourceInput: string
  outputDir?: string
  reuseOutputDir?: string
  rerunFailures: boolean
  forceFull: boolean
  changesPath?: string
  focusSupportUnit?: string
}

type CollectChanges = {
  parserChanges: string[]
  fixtures: string[]
  verification: Array<{
    command: string
    result: string
  }>
  unresolved: string[]
}

type FailedPostReport = {
  postId: string
  title: string
  source: string
  error: string
  inspectReportPath: string | null
  inspectError: string | null
  editor: SinglePostInspectDiagnostics["editor"] | null
  parse: SinglePostInspectDiagnostics["parse"] | null
  unsupportedCount: number
  firstUnsupported: {
    path: string
    tagName: string
    className?: string
    moduleType?: string
    text: string
    html: string
  } | null
}

type FailureGroup = {
  key: string
  count: number
  error: string
  editorType: string | null
  firstUnsupportedPath: string | null
  firstUnsupportedTag: string | null
  firstUnsupportedClassName: string | null
  firstUnsupportedModuleType: string | null
  supportUnitKey: string
  failureBlockHash: string
  representative: {
    postId: string
    title: string
    source: string
    inspectReportPath: string | null
  }
  postIds: string[]
}

const allIngestReuseModes = ["full", "rerun-failures", "completed-no-failures"] as const
type IngestReuseMode = (typeof allIngestReuseModes)[number]

const usage = () => `Usage:
  bun .agents/skills/ingest-blog/scripts/collect-blog-errors.ts --blogKey <blogKey> --sourceInput <sourceInput> [--outputDir tmp/harness/ingest-blog/<runId>]
  bun .agents/skills/ingest-blog/scripts/collect-blog-errors.ts --blogKey <blogKey> --sourceInput <sourceInput> --reuseOutputDir /absolute/path/to/tmp/harness/ingest-blog/<runId> --rerunFailures

Options:
  --reuseOutputDir <dir>  Reuse a completed ingest output and rerun only failed posts.
                         Use the first collect's printed absolute outputDir from support-unit branches.
  --rerunFailures        Require failed-post rerun from a reusable output.
  --forceFull            Ignore reusable output and run a full ingest.
  --focusSupportUnit <key>
                         Report and exit against one parser support unit.
  --changesPath <json>   Include parser/fixture/verification changes in report.

Exports public posts with remote asset references, reuses completed outputs when possible, inspects failures, and writes report.md/report.json/evidence.md.`

const readValue = (args: string[], index: number) => {
  const value = args[index + 1]

  if (!value || value.startsWith("--")) {
    throw new Error(usage())
  }

  return value
}

const parseArgs = (args: string[]): CollectArgs | "help" => {
  let blogKey: string | undefined
  let sourceInput: string | undefined
  let outputDir: string | undefined
  let reuseOutputDir: string | undefined
  let changesPath: string | undefined
  let focusSupportUnit: string | undefined
  let rerunFailures = false
  let forceFull = false

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg === "--help" || arg === "-h") {
      return "help"
    }

    if (arg === "--blogKey") {
      blogKey = readValue(args, index)
      index++
      continue
    }

    if (arg === "--sourceInput") {
      sourceInput = readValue(args, index)
      index++
      continue
    }

    if (arg === "--outputDir") {
      outputDir = readValue(args, index)
      index++
      continue
    }

    if (arg === "--reuseOutputDir") {
      reuseOutputDir = readValue(args, index)
      index++
      continue
    }

    if (arg === "--rerunFailures") {
      rerunFailures = true
      continue
    }

    if (arg === "--forceFull") {
      forceFull = true
      continue
    }

    if (arg === "--changesPath") {
      changesPath = readValue(args, index)
      index++
      continue
    }

    if (arg === "--focusSupportUnit") {
      focusSupportUnit = readValue(args, index)
      index++
      continue
    }

    throw new Error(usage())
  }

  if (!blogKey || !sourceInput) {
    throw new Error(usage())
  }

  return {
    blogKey,
    sourceInput,
    rerunFailures,
    forceFull,
    ...(outputDir ? { outputDir } : {}),
    ...(reuseOutputDir ? { reuseOutputDir } : {}),
    ...(changesPath ? { changesPath } : {}),
    ...(focusSupportUnit ? { focusSupportUnit } : {}),
  }
}

const createIngestOptions = () => {
  const options = defaultExportOptions()

  options.assets.imageHandlingMode = "remote"
  options.assets.compressionEnabled = false
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false

  return options
}

const safePathSegment = (value: string) => {
  const segment = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")

  return segment || "blog"
}

const createDefaultOutputDir = (sourceId: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

  return path.join("tmp", "harness", "ingest-blog", `${safePathSegment(sourceId)}-${timestamp}`)
}

const isNotFoundError = (error: unknown) =>
  error instanceof Error &&
  typeof (error as { code?: unknown }).code === "string" &&
  (error as { code?: unknown }).code === "ENOENT"

const listFilesRecursive = async (dir: string): Promise<string[]> => {
  let entries: Awaited<ReturnType<typeof readdir>>

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isNotFoundError(error)) {
      return []
    }

    throw error
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        return listFilesRecursive(entryPath)
      }

      return [entryPath]
    }),
  )

  return nested.flat()
}

const writeJson = async ({ targetPath, value }: { targetPath: string; value: unknown }) => {
  await ensureDir(path.dirname(targetPath))
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

const emptyChanges = (): CollectChanges => ({
  parserChanges: [],
  fixtures: [],
  verification: [],
  unresolved: [],
})

const readChanges = async (changesPath: string | undefined) => {
  if (!changesPath) {
    return emptyChanges()
  }

  const value = JSON.parse(await readFile(changesPath, "utf8")) as Record<string, unknown>
  const readStringArray = (key: string) => {
    const items = value[key]

    return Array.isArray(items)
      ? items.filter((item): item is string => typeof item === "string")
      : []
  }
  const verification = Array.isArray(value.verification)
    ? value.verification.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return []
        }

        const record = item as Record<string, unknown>

        return typeof record.command === "string" && typeof record.result === "string"
          ? [
              {
                command: record.command,
                result: record.result,
              },
            ]
          : []
      })
    : []

  return {
    parserChanges: readStringArray("parserChanges"),
    fixtures: readStringArray("fixtures"),
    verification,
    unresolved: readStringArray("unresolved"),
  } satisfies CollectChanges
}

const compactError = (error: string) => error.replace(/\s+/g, " ").trim()

const firstUnsupportedOf = (diagnostics: SinglePostInspectDiagnostics | null) => {
  const node = diagnostics?.unsupportedNodes[0]

  if (!node) {
    return null
  }

  return {
    path: node.path,
    tagName: node.tagName,
    ...(node.className ? { className: node.className } : {}),
    ...(node.moduleType ? { moduleType: node.moduleType } : {}),
    text: node.text,
    html: node.html,
  }
}

const createFailureKey = (report: FailedPostReport) =>
  [
    compactError(report.error),
    report.editor?.type ?? "unknown-editor",
    report.firstUnsupported?.tagName ?? "unknown-tag",
    report.firstUnsupported?.className ?? "no-class",
    report.firstUnsupported?.moduleType ?? "no-module",
  ].join(" | ")

const readPreviousRepresentative = (value: unknown): SupportUnitFailureGroup["representative"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>

  if (typeof record.postId !== "string") {
    return undefined
  }

  return {
    postId: record.postId,
    ...(typeof record.title === "string" ? { title: record.title } : {}),
    ...(typeof record.source === "string" ? { source: record.source } : {}),
    ...(typeof record.inspectReportPath === "string" || record.inspectReportPath === null
      ? { inspectReportPath: record.inspectReportPath }
      : {}),
  }
}

const readPreviousFailureGroups = async (outputDir: string): Promise<SupportUnitFailureGroup[]> => {
  try {
    const parsed = JSON.parse(
      await readFile(path.join(outputDir, "failure-summary.json"), "utf8"),
    ) as Record<string, unknown>
    const value = Array.isArray(parsed.discoveredSupportUnits)
      ? parsed.discoveredSupportUnits
      : Array.isArray(parsed.allFailureGroups)
        ? parsed.allFailureGroups
        : parsed.failureGroups
    const groups = Array.isArray(value) ? value : []

    return groups.flatMap((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) {
        return []
      }

      const record = group as Record<string, unknown>
      const supportUnitKey = record.supportUnitKey
      const failureBlockHash = record.failureBlockHash
      const editorType = record.editorType
      const firstUnsupportedPath = record.firstUnsupportedPath
      const firstUnsupportedTag = record.firstUnsupportedTag
      const representative = readPreviousRepresentative(record.representative)
      const postIds = record.postIds

      return typeof supportUnitKey === "string" && Array.isArray(postIds)
        ? [
            {
              supportUnitKey,
              ...(typeof failureBlockHash === "string" ? { failureBlockHash } : {}),
              ...(typeof editorType === "string" ? { editorType } : {}),
              ...(typeof firstUnsupportedPath === "string" ? { firstUnsupportedPath } : {}),
              ...(typeof firstUnsupportedTag === "string" ? { firstUnsupportedTag } : {}),
              ...(representative ? { representative } : {}),
              postIds: postIds.filter((postId): postId is string => typeof postId === "string"),
            },
          ]
        : []
    })
  } catch (error) {
    if (isNotFoundError(error)) {
      return []
    }

    throw error
  }
}

const groupFailures = (reports: FailedPostReport[]): FailureGroup[] => {
  const groups = new Map<string, FailedPostReport[]>()

  for (const report of reports) {
    const key = createFailureKey(report)
    const currentReports = groups.get(key) ?? []

    currentReports.push(report)
    groups.set(key, currentReports)
  }

  return Array.from(groups.entries())
    .map(([key, groupReports]) => {
      const representative = groupReports[0]

      if (!representative) {
        throw new Error("failure group cannot be empty")
      }
      const supportUnit = createSupportUnit({
        editorType: representative.editor?.type ?? null,
        firstUnsupportedTag: representative.firstUnsupported?.tagName ?? null,
        firstUnsupportedClassName: representative.firstUnsupported?.className ?? null,
        firstUnsupportedModuleType: representative.firstUnsupported?.moduleType ?? null,
      })

      return {
        key,
        count: groupReports.length,
        error: representative.error,
        editorType: representative.editor?.type ?? null,
        firstUnsupportedPath: representative.firstUnsupported?.path ?? null,
        firstUnsupportedTag: representative.firstUnsupported?.tagName ?? null,
        firstUnsupportedClassName: representative.firstUnsupported?.className ?? null,
        firstUnsupportedModuleType: representative.firstUnsupported?.moduleType ?? null,
        supportUnitKey: supportUnit.supportUnitKey,
        failureBlockHash: supportUnit.failureBlockHash,
        representative: {
          postId: representative.postId,
          title: representative.title,
          source: representative.source,
          inspectReportPath: representative.inspectReportPath,
        },
        postIds: groupReports.map((report) => report.postId),
      }
    })
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
}

const createJobItemFromManifestPost = (post: PostManifestEntry): ExportJobItem => ({
  id: post.outputPath ?? `failed:${post.postId}`,
  blogKey: post.blogKey,
  sourceId: post.sourceId,
  postId: post.postId,
  title: post.title,
  source: post.source,
  category: post.category,
  status: post.status,
  outputPath: post.outputPath,
  assetPaths: post.assetPaths,
  upload: post.upload,
  error: post.error,
  updatedAt: new Date().toISOString(),
})

const createFailureRerunResumeState = (manifest: ExportManifest) => {
  const successfulPosts = manifest.posts.filter((post) => post.status === "success")

  return {
    items: successfulPosts.map(createJobItemFromManifestPost),
    manifest: {
      ...manifest,
      posts: successfulPosts,
      successCount: successfulPosts.length,
      failureCount: 0,
      finishedAt: null,
    },
  }
}

const createPostSummaryFromManifestPost = ({
  sourceId,
  post,
  livePost,
}: {
  sourceId: string
  post: PostManifestEntry
  livePost?: NonNullable<ScanResult["posts"]>[number]
}): NonNullable<ScanResult["posts"]>[number] => ({
  blogKey: post.blogKey,
  sourceId: post.sourceId || sourceId,
  postId: post.postId,
  title: livePost?.title ?? post.title,
  publishedAt: livePost?.publishedAt ?? "",
  categoryId: livePost?.categoryId ?? post.category.id,
  categoryName: livePost?.categoryName ?? post.category.name,
  source: livePost?.source ?? post.source,
  thumbnailUrl: livePost?.thumbnailUrl ?? null,
})

const createFailureRerunScanResult = ({
  blogKey,
  sourceId,
  manifest,
}: {
  blogKey: string
  sourceId: string
  manifest: ExportManifest
}): ScanResult => {
  return {
    blogKey,
    sourceId,
    totalPostCount: manifest.totalPosts,
    categories: manifest.categories,
    posts: manifest.posts.map((post) =>
      createPostSummaryFromManifestPost({
        sourceId,
        post,
      }),
    ),
  }
}

const runExporter = async ({
  blogKey,
  sourceInput,
  outputDir,
  options,
  logs,
  reusableOutput,
  cachedScanResult,
}: {
  blogKey: string
  sourceInput: string
  outputDir: string
  options: ReturnType<typeof createIngestOptions>
  logs: string[]
  reusableOutput?: ReusableIngestOutput
  cachedScanResult?: ScanResult
}) => {
  const blog = createBlogRegistry([createNaverBlog(), createTistoryBlog()]).require(blogKey)
  const exporter = new BlogExportWorkflow({
    blog,
    request: {
      blogKey,
      sourceInput,
      outputDir,
      profile: "gfm",
      options,
    },
    resumeState: reusableOutput
      ? createFailureRerunResumeState(reusableOutput.manifest)
      : undefined,
    cachedScanResult,
    postContentCache: createPostHtmlCache({
      cacheDir: path.join(resolveRepoPath(outputDir), "html-cache"),
    }),
    onProgress: ({ total, completed, failed }) => {
      console.error(
        `progress: ${completed + failed}/${total} completed=${completed} failed=${failed}`,
      )
    },
    onItem: (item) => {
      if (item.status === "failed") {
        console.error(`failed: ${item.postId} ${item.error ?? ""}`)
      }
    },
  })

  return runWithLogSink(
    (message) => {
      logs.push(message)
      console.error(message)
    },
    () => exporter.run(),
  )
}

const renderFailureSummaryMarkdown = ({
  sourceId,
  manifest,
  failureGroups,
  downloadedAssetFiles,
}: {
  sourceId: string
  manifest: ExportManifest
  failureGroups: FailureGroup[]
  downloadedAssetFiles: string[]
}) => {
  const lines = [
    `# Ingest Failure Summary: ${sourceId}`,
    "",
    `- totalPosts: ${manifest.totalPosts}`,
    `- successCount: ${manifest.successCount}`,
    `- failureCount: ${manifest.failureCount}`,
    `- downloadedAssetFileCount: ${downloadedAssetFiles.length}`,
    "",
  ]

  if (failureGroups.length === 0) {
    return [...lines, "No parse failures.", ""].join("\n")
  }

  return [
    ...lines,
    "## Failure Groups",
    "",
    ...failureGroups.flatMap((group, index) => [
      `### ${index + 1}. ${group.editorType ?? "unknown-editor"} / ${group.firstUnsupportedTag ?? "unknown-tag"}`,
      "",
      `- count: ${group.count}`,
      `- supportUnitKey: ${group.supportUnitKey}`,
      `- failureBlockHash: ${group.failureBlockHash}`,
      `- error: ${group.error}`,
      `- representativePostId: ${group.representative.postId}`,
      `- representativeTitle: ${group.representative.title}`,
      `- inspectReportPath: ${group.representative.inspectReportPath ?? "(not available)"}`,
      "",
    ]),
  ].join("\n")
}

const renderList = (items: string[]) => {
  if (items.length === 0) {
    return "- 없음"
  }

  return items.map((item) => `- ${item}`).join("\n")
}

const renderVerificationList = (items: CollectChanges["verification"]) => {
  if (items.length === 0) {
    return "- 없음"
  }

  return items.map((item) => `- ${item.command}: ${item.result}`).join("\n")
}

const renderDeferredList = ({
  failureGroups,
  unresolved,
}: {
  failureGroups: FailureGroup[]
  unresolved: string[]
}) => {
  if (failureGroups.length === 0) {
    return "- 없음"
  }

  if (unresolved.length > 0) {
    return renderList(unresolved)
  }

  return failureGroups
    .map((group) => `- ${group.representative.postId}: 보류 사유 미기재`)
    .join("\n")
}

const renderIngestReportMarkdown = ({
  sourceId,
  manifest,
  outputDir,
  reuse,
  rerunResults,
  failureGroups,
  downloadedAssetFiles,
  changes,
  evidencePath,
  focusSupportUnit,
  focusedSupportUnitResolved,
  focusedSupportUnitKnown,
}: {
  sourceId: string
  manifest: ExportManifest
  outputDir: string
  reuse: {
    used: boolean
    mode: IngestReuseMode
    sourceOutputDir: string | null
    previousFailureCount: number
  }
  rerunResults: Array<{
    postId: string
    beforeError: string | null
    status: PostManifestEntry["status"] | "missing"
    afterError: string | null
  }>
  failureGroups: FailureGroup[]
  downloadedAssetFiles: string[]
  changes: CollectChanges
  evidencePath: string
  focusSupportUnit?: string
  focusedSupportUnitResolved: boolean | null
  focusedSupportUnitKnown: boolean
}) => {
  const commonSections = [
    "## Parser Changes",
    "",
    renderList(changes.parserChanges),
    "",
    "## Fixtures",
    "",
    renderList(changes.fixtures),
    "",
    "## Verification",
    "",
    renderVerificationList(changes.verification),
    "",
    "## Evidence",
    "",
    `- path: ${evidencePath}`,
    "",
    "## Unresolved Failures",
    "",
    ...(failureGroups.length === 0
      ? ["- 없음"]
      : failureGroups.map(
          (group) =>
            `- ${group.representative.postId}: ${group.error} (${group.count} posts, inspect=${group.representative.inspectReportPath ?? "none"})`,
        )),
    "",
    "## Deferred",
    "",
    renderDeferredList({
      failureGroups,
      unresolved: changes.unresolved,
    }),
    "",
  ]

  if (focusSupportUnit) {
    return [
      `# Support Unit Report: ${focusSupportUnit}`,
      "",
      "## Target",
      "",
      `- supportUnitKey: ${focusSupportUnit}`,
      `- focusedSupportUnitKnown: ${focusedSupportUnitKnown}`,
      `- focusedSupportUnitResolved: ${focusedSupportUnitResolved}`,
      `- outputDir: ${outputDir}`,
      "",
      "## Rerun Results",
      "",
      ...(rerunResults.length === 0
        ? ["- 없음"]
        : rerunResults.map(
            (result) =>
              `- ${result.postId}: ${result.status} (before=${result.beforeError ?? "none"}, after=${result.afterError ?? "none"})`,
          )),
      "",
      ...commonSections,
    ].join("\n")
  }

  return [
    `# Ingest Report: ${sourceId}`,
    "",
    "## Target",
    "",
    `- outputDir: ${outputDir}`,
    `- reuseUsed: ${reuse.used}`,
    `- reuseMode: ${reuse.mode}`,
    `- reuseSourceOutputDir: ${reuse.sourceOutputDir ?? "(none)"}`,
    "",
    "## Counts",
    "",
    `- totalPosts: ${manifest.totalPosts}`,
    `- successCount: ${manifest.successCount}`,
    `- failureCount: ${manifest.failureCount}`,
    `- previousFailureCount: ${reuse.previousFailureCount}`,
    `- downloadedAssetFileCount: ${downloadedAssetFiles.length}`,
    "",
    "## Rerun Results",
    "",
    ...(rerunResults.length === 0
      ? ["- 없음"]
      : rerunResults.map(
          (result) =>
            `- ${result.postId}: ${result.status} (before=${result.beforeError ?? "none"}, after=${result.afterError ?? "none"})`,
        )),
    "",
    ...commonSections,
  ].join("\n")
}

const inspectFailedPost = async ({
  blogKey,
  sourceId,
  failedPost,
  inspectDir,
}: {
  blogKey: string
  sourceId: string
  failedPost: PostManifestEntry
  inspectDir: string
}): Promise<FailedPostReport> => {
  const reportPath = path.join(inspectDir, `${failedPost.postId}.json`)

  if (blogKey !== "naver") {
    const unsupported =
      /Unsupported Tistory node at ([^:]+): <([\w-]+)(?:#[^.[]+)?((?:\.[^.[]+)*)/.exec(
        failedPost.error ?? "",
      )

    return {
      postId: failedPost.postId,
      title: failedPost.title,
      source: failedPost.source,
      error: failedPost.error ?? "Unknown export failure",
      inspectReportPath: null,
      inspectError: null,
      editor: unsupported ? { type: "tistory", version: null } : null,
      parse: null,
      unsupportedCount: unsupported ? 1 : 0,
      firstUnsupported: unsupported
        ? {
            path: unsupported[1]!,
            tagName: unsupported[2]!,
            ...(unsupported[3]
              ? { className: unsupported[3].split(".").filter(Boolean).join(" ") }
              : {}),
            text: "",
            html: "",
          }
        : null,
    }
  }

  try {
    const diagnostics = await inspectSinglePost({
      sourceId,
      postId: failedPost.postId,
      options: createIngestOptions(),
    })
    await writeJson({
      targetPath: reportPath,
      value: diagnostics,
    })

    return {
      postId: failedPost.postId,
      title: failedPost.title,
      source: failedPost.source,
      error: failedPost.error ?? "Unknown export failure",
      inspectReportPath: reportPath,
      inspectError: null,
      editor: diagnostics.editor,
      parse: diagnostics.parse,
      unsupportedCount: diagnostics.unsupportedNodes.length,
      firstUnsupported: firstUnsupportedOf(diagnostics),
    }
  } catch (error) {
    return {
      postId: failedPost.postId,
      title: failedPost.title,
      source: failedPost.source,
      error: failedPost.error ?? "Unknown export failure",
      inspectReportPath: null,
      inspectError: toErrorMessage(error),
      editor: null,
      parse: null,
      unsupportedCount: 0,
      firstUnsupported: null,
    }
  }
}

const createEvidenceCases = ({
  blogKey,
  sourceId,
  failureGroups,
  previousFocusedGroups,
  rerunResults,
  manifest,
  focusedPostIds,
}: {
  blogKey: string
  sourceId: string
  failureGroups: FailureGroup[]
  previousFocusedGroups: SupportUnitFailureGroup[]
  rerunResults: Array<{
    postId: string
    beforeError: string | null
    status: PostManifestEntry["status"] | "missing"
    afterError: string | null
  }>
  manifest: ExportManifest
  focusedPostIds: string[]
}): EvidenceCase[] => {
  if (blogKey !== "naver") {
    return []
  }
  if (failureGroups.length > 0) {
    return failureGroups.map((group) => {
      const targetReport = group.representative

      return {
        blogKey: "naver",
        sourceInput: sourceId,
        sourceId,
        postId: targetReport.postId,
        metadata: `parse failure: ${group.editorType ?? "unknown-editor"} / ${group.firstUnsupportedTag ?? "unknown-tag"}`,
        target: group.firstUnsupportedPath
          ? {
              kind: "inspect-path",
              path: group.firstUnsupportedPath,
            }
          : {
              kind: "post",
            },
      }
    })
  }

  const focusedPostIdSet = new Set(focusedPostIds)
  const successfulPostIdSet = new Set(
    rerunResults.filter((result) => result.status === "success").map((result) => result.postId),
  )
  const previousFocusedCases = previousFocusedGroups.flatMap((group): EvidenceCase[] => {
    const representativePostId = group.representative?.postId
    const postId =
      representativePostId && successfulPostIdSet.has(representativePostId)
        ? representativePostId
        : (group.postIds.find((candidate) => successfulPostIdSet.has(candidate)) ??
          group.postIds[0])

    if (!postId || !successfulPostIdSet.has(postId)) {
      return []
    }

    return [
      {
        blogKey: "naver",
        sourceInput: sourceId,
        sourceId,
        postId: postId,
        metadata: `fixed parse example: ${group.editorType ?? "unknown-editor"} / ${group.firstUnsupportedTag ?? "unknown-tag"}`,
        target: group.firstUnsupportedPath
          ? {
              kind: "inspect-path",
              path: group.firstUnsupportedPath,
            }
          : {
              kind: "post",
            },
      },
    ]
  })

  if (previousFocusedCases.length > 0) {
    return previousFocusedCases.slice(0, 5)
  }

  return rerunResults
    .filter((result) => result.status === "success")
    .filter((result) => focusedPostIdSet.size === 0 || focusedPostIdSet.has(result.postId))
    .slice(0, 5)
    .map((result) => {
      const post = manifest.posts.find((entry) => entry.postId === result.postId)

      return {
        blogKey: "naver",
        sourceInput: sourceId,
        sourceId,
        postId: result.postId,
        metadata: result.beforeError
          ? `fixed parse example: ${result.beforeError}`
          : `converted post example: ${post?.title ?? result.postId}`,
        target: {
          kind: "post",
        },
      }
    })
}

const run = async () => {
  const parsedArgs = parseArgs(process.argv.slice(2))

  if (parsedArgs === "help") {
    console.log(usage())
    return
  }

  const blog = createBlogRegistry([createNaverBlog(), createTistoryBlog()]).require(
    parsedArgs.blogKey,
  )
  const sourceId = blog.parseSource(parsedArgs.sourceInput).sourceId
  const logs: string[] = []
  const options = createIngestOptions()
  const explicitReuseOutputDir = parsedArgs.reuseOutputDir ?? parsedArgs.outputDir
  const reusableOutput = parsedArgs.forceFull
    ? null
    : explicitReuseOutputDir
      ? await loadReusableIngestOutput({
          blogKey: parsedArgs.blogKey,
          sourceId,
          outputDir: explicitReuseOutputDir,
        })
      : await findLatestReusableIngestOutput({
          blogKey: parsedArgs.blogKey,
          sourceId,
        })

  if (parsedArgs.rerunFailures && !reusableOutput) {
    throw new Error(`재사용 가능한 완료 output을 찾지 못했습니다: ${sourceId}`)
  }

  const reuseMode: IngestReuseMode =
    reusableOutput && reusableOutput.failedPosts.length === 0
      ? "completed-no-failures"
      : reusableOutput
        ? "rerun-failures"
        : "full"
  const outputDir =
    reusableOutput?.outputDir ?? parsedArgs.outputDir ?? createDefaultOutputDir(sourceId)
  const resolvedOutputDir = resolveRepoPath(outputDir)
  const previousFailedPosts = reusableOutput?.failedPosts ?? []
  const cachedScanResult =
    reuseMode === "rerun-failures" && reusableOutput
      ? createFailureRerunScanResult({
          blogKey: parsedArgs.blogKey,
          sourceId,
          manifest: reusableOutput.manifest,
        })
      : undefined
  const manifest =
    reuseMode === "completed-no-failures" && reusableOutput
      ? reusableOutput.manifest
      : await runExporter({
          blogKey: parsedArgs.blogKey,
          sourceInput: parsedArgs.sourceInput,
          outputDir,
          options,
          logs,
          ...(reusableOutput ? { reusableOutput } : {}),
          ...(cachedScanResult ? { cachedScanResult } : {}),
        })
  const rerunResults = previousFailedPosts.map((previousPost) => {
    const currentPost = manifest.posts.find((post) => post.postId === previousPost.postId)

    return {
      postId: previousPost.postId,
      beforeError: previousPost.error,
      status: currentPost?.status ?? "missing",
      afterError: currentPost?.error ?? null,
    }
  })
  const failedPosts = manifest.posts.filter((post) => post.status === "failed")
  const inspectDir = path.join(resolvedOutputDir, "inspect")
  const failedPostReports = await Promise.all(
    failedPosts.map((failedPost) =>
      inspectFailedPost({
        blogKey: parsedArgs.blogKey,
        sourceId,
        failedPost,
        inspectDir,
      }),
    ),
  )
  const allFailureGroups = groupFailures(failedPostReports)
  const previousFailureGroups = reusableOutput
    ? await readPreviousFailureGroups(reusableOutput.outputDir)
    : []
  const discoveredSupportUnits = mergeSupportUnitFailureGroups([
    ...previousFailureGroups,
    ...allFailureGroups,
  ])
  const focusedSelection = selectFocusedSupportUnit({
    failureGroups: allFailureGroups,
    previousFailureGroups,
    focusSupportUnit: parsedArgs.focusSupportUnit,
  })
  const failureGroups = focusedSelection.reportFailureGroups
  const focusedPostIds = parsedArgs.focusSupportUnit ? focusedSelection.previousFocusedPostIds : []
  const focusedPostIdSet = new Set(focusedPostIds)
  const reportRerunResults = parsedArgs.focusSupportUnit
    ? rerunResults.filter((result) => focusedPostIdSet.has(result.postId))
    : rerunResults
  const downloadedAssetFiles = await listFilesRecursive(path.join(resolvedOutputDir, "public"))
  const manifestPath = path.join(resolvedOutputDir, "manifest.json")
  const failureSummaryJsonPath = path.join(resolvedOutputDir, "failure-summary.json")
  const failureSummaryMarkdownPath = path.join(resolvedOutputDir, "failure-summary.md")
  const reportJsonPath = path.join(resolvedOutputDir, "report.json")
  const reportMarkdownPath = path.join(resolvedOutputDir, "report.md")
  const evidencePath = path.join(resolvedOutputDir, "evidence.md")
  const logPath = path.join(resolvedOutputDir, "ingest.log")
  const changes = await readChanges(parsedArgs.changesPath)
  const evidenceCases = createEvidenceCases({
    blogKey: parsedArgs.blogKey,
    sourceId,
    failureGroups,
    previousFocusedGroups: focusedSelection.previousFocusedGroups,
    rerunResults: reportRerunResults,
    manifest,
    focusedPostIds,
  })
  let evidenceReport: Awaited<ReturnType<typeof capturePostEvidence>> | null = null
  let evidenceError: string | null = null

  if (evidenceCases.length > 0) {
    try {
      evidenceReport = await capturePostEvidence({
        cases: evidenceCases,
        outputDir: path.join(resolvedOutputDir, "post-evidence"),
        assetProfile: "figure",
      })
      await writeFile(
        evidencePath,
        renderEvidenceMarkdownSections(
          createEvidenceMarkdownSections({
            rows: evidenceReport.rows,
            evidencePath,
          }),
          { includeSourceLink: false },
        ),
        "utf8",
      )
    } catch (error) {
      evidenceError = toErrorMessage(error)
      await writeFile(evidencePath, renderEvidenceMarkdownSections([]), "utf8")
    }
  } else {
    await writeFile(evidencePath, renderEvidenceMarkdownSections([]), "utf8")
  }
  const evidenceSummary = {
    report: evidenceReport,
    error: evidenceError,
    errorCount: evidenceReport?.errorCount ?? (evidenceError ? 1 : 0),
  }
  const aggregateSummary = {
    blogKey: parsedArgs.blogKey,
    sourceInput: parsedArgs.sourceInput,
    sourceId,
    outputDir: resolvedOutputDir,
    manifestPath,
    reportJsonPath,
    reportMarkdownPath,
    evidencePath,
    totalPosts: manifest.totalPosts,
    successCount: manifest.successCount,
    failureCount: manifest.failureCount,
    focus: {
      supportUnitKey: parsedArgs.focusSupportUnit ?? null,
      failureBlockHash: focusedSelection.focusedFailureBlockHash ?? null,
      known: focusedSelection.focusedSupportUnitKnown,
      resolved: focusedSelection.focusedSupportUnitResolved,
      previousPostIds: focusedSelection.previousFocusedPostIds,
      remainingBacklogGroupCount: focusedSelection.remainingBacklogGroups.length,
    },
    reuse: {
      used: Boolean(reusableOutput),
      mode: reuseMode,
      sourceOutputDir: reusableOutput?.outputDir ?? null,
      previousFailureCount: previousFailedPosts.length,
    },
    rerunResults: reportRerunResults,
    allRerunResults: rerunResults,
    assetMode: options.assets.imageHandlingMode,
    imageDownloadsDisabled: !options.assets.downloadImages && !options.assets.downloadThumbnails,
    downloadedAssetFileCount: downloadedAssetFiles.length,
    downloadedAssetFiles,
    failedPosts: failedPostReports,
    failureGroups,
    allFailureGroups,
    discoveredSupportUnits,
    remainingBacklogGroups: focusedSelection.remainingBacklogGroups,
    changes,
    evidence: evidenceSummary,
  }
  const reportSummary = parsedArgs.focusSupportUnit
    ? {
        blogKey: parsedArgs.blogKey,
        sourceInput: parsedArgs.sourceInput,
        sourceId,
        outputDir: resolvedOutputDir,
        reportJsonPath,
        reportMarkdownPath,
        evidencePath,
        focus: aggregateSummary.focus,
        reuse: {
          used: aggregateSummary.reuse.used,
          mode: aggregateSummary.reuse.mode,
          sourceOutputDir: aggregateSummary.reuse.sourceOutputDir,
        },
        rerunResults: reportRerunResults,
        assetMode: aggregateSummary.assetMode,
        imageDownloadsDisabled: aggregateSummary.imageDownloadsDisabled,
        failureGroups,
        changes,
        evidence: evidenceSummary,
      }
    : aggregateSummary

  await writeJson({
    targetPath: failureSummaryJsonPath,
    value: aggregateSummary,
  })
  await writeJson({
    targetPath: reportJsonPath,
    value: reportSummary,
  })
  await writeFile(
    failureSummaryMarkdownPath,
    renderFailureSummaryMarkdown({
      sourceId,
      manifest,
      failureGroups: allFailureGroups,
      downloadedAssetFiles,
    }),
    "utf8",
  )
  await writeFile(
    reportMarkdownPath,
    renderIngestReportMarkdown({
      sourceId,
      manifest,
      outputDir: resolvedOutputDir,
      reuse: aggregateSummary.reuse,
      rerunResults: reportRerunResults,
      failureGroups,
      downloadedAssetFiles,
      changes,
      evidencePath,
      focusSupportUnit: parsedArgs.focusSupportUnit,
      focusedSupportUnitResolved: focusedSelection.focusedSupportUnitResolved,
      focusedSupportUnitKnown: focusedSelection.focusedSupportUnitKnown,
    }),
    "utf8",
  )
  await writeFile(logPath, `${logs.join("\n")}${logs.length > 0 ? "\n" : ""}`, "utf8")

  console.log(
    [
      `sourceId: ${sourceId}`,
      `outputDir: ${resolvedOutputDir}`,
      `manifestPath: ${manifestPath}`,
      `reportJsonPath: ${reportJsonPath}`,
      `reportMarkdownPath: ${reportMarkdownPath}`,
      `evidencePath: ${evidencePath}`,
      `failureSummaryJsonPath: ${failureSummaryJsonPath}`,
      `failureSummaryMarkdownPath: ${failureSummaryMarkdownPath}`,
      `reuseMode: ${reuseMode}`,
      `failureCount: ${manifest.failureCount}`,
      `failureGroupCount: ${allFailureGroups.length}`,
      `focusedFailureGroupCount: ${failureGroups.length}`,
      `evidenceErrorCount: ${evidenceSummary.errorCount}`,
      `downloadedAssetFileCount: ${downloadedAssetFiles.length}`,
    ].join("\n"),
  )

  const hasBlockingFailure = parsedArgs.focusSupportUnit
    ? !focusedSelection.focusedSupportUnitKnown || failureGroups.length > 0
    : manifest.failureCount > 0

  if (hasBlockingFailure || downloadedAssetFiles.length > 0 || evidenceSummary.errorCount > 0) {
    process.exitCode = 1
  }
}

try {
  await run()
} catch (error) {
  console.error(toErrorMessage(error))
  process.exitCode = 1
}
