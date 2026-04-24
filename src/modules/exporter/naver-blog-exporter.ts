import path from "node:path"
import { writeFile } from "node:fs/promises"

import { cloneExportOptions } from "../../shared/export-options.js"
import { UPLOAD_STATUSES } from "../../shared/export-job-state.js"
import { filterPostsByScope } from "../../shared/export-scope.js"
import type {
  ExportManifest,
  ExportJobItem,
  ExportRequest,
  PostManifestEntry,
  ScanResult,
} from "../../shared/types.js"
import {
  ensureDir,
  extractBlogId,
  isAbortOperationError,
  mapConcurrent,
  resolveRepoPath,
  throwIfAborted,
  toErrorMessage,
} from "../../shared/utils.js"
import { NaverBlogFetcher } from "../blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../converter/markdown-renderer.js"
import { parsePostHtml } from "../parser/post-parser.js"
import { reviewParsedPost } from "../reviewer/post-reviewer.js"
import { AssetStore } from "./asset-store.js"
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"
import { buildPostLinkTargets, createSameBlogPostLinkResolver } from "./post-link-rewriter.js"
import { dedupeUploadCandidatesByLocalPath } from "./upload-candidate-utils.js"

const emptyPostUploadSummary = () => ({
  eligible: false,
  candidateCount: 0,
  uploadedCount: 0,
  failedCount: 0,
  candidates: [],
  uploadedUrls: [],
  rewriteStatus: "pending" as const,
  rewrittenAt: null,
})

const postExportConcurrency = 3

type ProcessedPostResult = {
  manifestEntry: PostManifestEntry
  jobItem: ExportJobItem
  warningCount: number
  uploadCandidateLocalPaths: string[]
  uploadEligible: boolean
}

type ExportResumeState = {
  items: ExportJobItem[]
  manifest: ExportManifest | null
}

type ExportProgressState = {
  completed: number
  failed: number
  warningCount: number
  uploadEligiblePostCount: number
  uploadCandidateMap: Map<string, true>
}

const createInitialManifest = ({
  resumeManifest,
  blogId,
  profile,
  options,
  categories,
  totalPosts,
  uploadEnabled,
}: {
  resumeManifest: ExportManifest | null
  blogId: string
  profile: ExportRequest["profile"]
  options: ExportRequest["options"]
  categories: ScanResult["categories"]
  totalPosts: number
  uploadEnabled: boolean
}): ExportManifest =>
  resumeManifest
    ? {
        ...resumeManifest,
        options,
        categories,
        finishedAt: null,
      }
    : {
        blogId,
        profile,
        options,
        selectedCategoryIds: options.scope.categoryIds,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        totalPosts,
        successCount: 0,
        failureCount: 0,
        warningCount: 0,
        upload: {
          status: uploadEnabled ? UPLOAD_STATUSES.UPLOAD_READY : UPLOAD_STATUSES.NOT_REQUESTED,
          eligiblePostCount: 0,
          candidateCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        },
        categories,
        posts: [],
      }

const createExportProgressState = (manifest: ExportManifest): ExportProgressState => ({
  completed: manifest.successCount,
  failed: manifest.failureCount,
  warningCount: manifest.warningCount,
  uploadEligiblePostCount: manifest.posts.reduce(
    (count, post) => count + (post.status === "success" && post.upload.eligible ? 1 : 0),
    0,
  ),
  uploadCandidateMap: new Map<string, true>(
    manifest.posts.flatMap((post) =>
      post.status === "success" ? post.upload.candidates.map((candidate) => [candidate.localPath, true] as const) : [],
    ),
  ),
})

const createPostUploadSummary = (
  uploadCandidates: NonNullable<ReturnType<typeof dedupeUploadCandidatesByLocalPath>>,
) => ({
  eligible: uploadCandidates.length > 0,
  candidateCount: uploadCandidates.length,
  uploadedCount: 0,
  failedCount: 0,
  candidates: uploadCandidates,
  uploadedUrls: [],
  rewriteStatus: "pending" as const,
  rewrittenAt: null,
})

export class NaverBlogExporter {
  readonly request: ExportRequest
  readonly onLog: (message: string) => void
  readonly onProgress: (progress: {
    total: number
    completed: number
    failed: number
    warnings: number
  }) => void
  readonly onItem: ((item: ExportJobItem) => void) | null
  readonly cachedScanResult: ScanResult | null
  readonly resumeState: ExportResumeState | null
  readonly writeManifestFile: boolean
  readonly abortSignal: AbortSignal | null

  constructor({
    request,
    onLog,
    onProgress,
    onItem,
    cachedScanResult,
    resumeState,
    writeManifestFile,
    abortSignal,
  }: {
    request: ExportRequest
    onLog: (message: string) => void
    onProgress: (progress: {
      total: number
      completed: number
      failed: number
      warnings: number
    }) => void
    onItem?: (item: ExportJobItem) => void
    cachedScanResult?: ScanResult | null
    resumeState?: ExportResumeState | null
    writeManifestFile?: boolean
    abortSignal?: AbortSignal | null
  }) {
    this.request = request
    this.onLog = onLog
    this.onProgress = onProgress
    this.onItem = onItem ?? null
    this.cachedScanResult = cachedScanResult ?? null
    this.resumeState = resumeState ?? null
    this.writeManifestFile = writeManifestFile ?? true
    this.abortSignal = abortSignal ?? null
  }

  private async loadScanAndPosts(fetcher: NaverBlogFetcher, blogId: string) {
    const reusablePosts =
      this.cachedScanResult?.blogId === blogId && this.cachedScanResult.posts
        ? this.cachedScanResult.posts
        : null
    const reusableScanResult = reusablePosts ? this.cachedScanResult : null

    if (reusableScanResult && reusablePosts) {
      return {
        scan: {
          blogId: reusableScanResult.blogId,
          totalPostCount: reusableScanResult.totalPostCount,
          categories: reusableScanResult.categories,
        } satisfies ScanResult,
        posts: reusablePosts,
        reused: true,
      }
    }

    const [scan, posts] = await Promise.all([fetcher.scanBlog(), fetcher.getAllPosts()])

    return {
      scan,
      posts,
      reused: false,
    }
  }

  private createSuccessResult({
    post,
    category,
    parsedEditorVersion,
    outputDir,
    markdownFilePath,
    assetPaths,
    upload,
    warnings,
  }: {
    post: Awaited<ReturnType<NaverBlogFetcher["getAllPosts"]>>[number]
    category: ReturnType<typeof getCategoryForPost>
    parsedEditorVersion: PostManifestEntry["editorVersion"]
    outputDir: string
    markdownFilePath: string
    assetPaths: string[]
    upload: ReturnType<typeof createPostUploadSummary>
    warnings: PostManifestEntry["warnings"]
  }): ProcessedPostResult {
    const warningCount = warnings.length
    const manifestEntry = {
      logNo: post.logNo,
      title: post.title,
      source: post.source,
      category: {
        id: category.id,
        name: category.name,
        path: category.path,
      },
      editorVersion: parsedEditorVersion,
      status: "success",
      outputPath: path.relative(outputDir, markdownFilePath).split(path.sep).join("/"),
      assetPaths,
      upload,
      warnings,
      warningCount,
      error: null,
    } satisfies PostManifestEntry

    return {
      manifestEntry,
      jobItem: {
        id: manifestEntry.outputPath ?? `failed:${post.logNo}`,
        logNo: post.logNo,
        title: post.title,
        source: post.source,
        category: manifestEntry.category,
        editorVersion: manifestEntry.editorVersion,
        status: "success",
        outputPath: manifestEntry.outputPath,
        assetPaths,
        upload,
        warnings,
        warningCount,
        error: null,
        updatedAt: new Date().toISOString(),
      },
      warningCount,
      uploadCandidateLocalPaths: upload.candidates.map((candidate) => candidate.localPath),
      uploadEligible: upload.eligible,
    }
  }

  private createFailureResult({
    post,
    category,
    error,
  }: {
    post: Awaited<ReturnType<NaverBlogFetcher["getAllPosts"]>>[number]
    category: ReturnType<typeof getCategoryForPost>
    error: unknown
  }): ProcessedPostResult {
    const upload = emptyPostUploadSummary()
    const manifestEntry = {
      logNo: post.logNo,
      title: post.title,
      source: post.source,
      category: {
        id: category.id,
        name: category.name,
        path: category.path,
      },
      editorVersion: post.editorVersion,
      status: "failed",
      outputPath: null,
      assetPaths: [],
      upload,
      warnings: [],
      warningCount: 0,
      error: toErrorMessage(error),
    } satisfies PostManifestEntry

    return {
      manifestEntry,
      jobItem: {
        id: `failed:${post.logNo}`,
        logNo: post.logNo,
        title: post.title,
        source: post.source,
        category: manifestEntry.category,
        editorVersion: post.editorVersion,
        status: "failed",
        outputPath: null,
        assetPaths: [],
        upload,
        warnings: [],
        warningCount: 0,
        error: manifestEntry.error,
        updatedAt: new Date().toISOString(),
      },
      warningCount: 0,
      uploadCandidateLocalPaths: [],
      uploadEligible: false,
    }
  }

  async run() {
    throwIfAborted(this.abortSignal)

    const blogId = extractBlogId(this.request.blogIdOrUrl)
    const outputDir = resolveRepoPath(this.request.outputDir)
    const options = cloneExportOptions(this.request.options)
    const fetcher = new NaverBlogFetcher({
      blogId,
      onLog: (message) => this.onLog(message),
    })
    const assetStore = new AssetStore({
      outputDir,
      downloader: fetcher,
      options,
    })
    const uploadEnabled = options.assets.imageHandlingMode === "download-and-upload"
    const { scan, posts, reused } = await this.loadScanAndPosts(fetcher, blogId)

    throwIfAborted(this.abortSignal)

    if (reused) {
      this.onLog(`이전 스캔 결과 재사용: categories=${scan.categories.length}, posts=${posts.length}`)
    }
    const categoryMap = new Map(scan.categories.map((category) => [category.id, category]))
    const filteredPosts = filterPostsByScope({
      posts,
      categories: scan.categories,
      options,
    })

    await ensureDir(outputDir)
    throwIfAborted(this.abortSignal)
    this.onLog(`출력 디렉터리 준비 완료: ${outputDir}`)

    const manifest = createInitialManifest({
      resumeManifest: this.resumeState?.manifest ?? null,
      blogId,
      profile: this.request.profile,
      options,
      categories: scan.categories,
      totalPosts: filteredPosts.length,
      uploadEnabled,
    })
    const progressState = createExportProgressState(manifest)
    const completedPostLogNos = new Set(this.resumeState?.items.map((item) => item.logNo) ?? [])
    const pendingPosts = filteredPosts.filter((post) => !completedPostLogNos.has(post.logNo))
    const pendingResults = new Map<number, ProcessedPostResult>()
    let nextResultIndex = 0

    if (posts.length !== scan.totalPostCount) {
      this.onLog(
        `목록 수집 수와 API 총계가 다릅니다. collected=${posts.length}, expected=${scan.totalPostCount}`,
      )
    }

    this.onLog(`필터 적용 후 export 대상 글 수: ${filteredPosts.length}`)
    if (pendingPosts.length !== filteredPosts.length) {
      this.onLog(`이전 진행 상태 복구: 완료 ${filteredPosts.length - pendingPosts.length}개, 남음 ${pendingPosts.length}개`)
    }
    const postLinkTargets = buildPostLinkTargets({
      outputDir,
      posts: filteredPosts,
      categories: scan.categories,
      options,
    })

    const flushCompletedResults = () => {
      while (pendingResults.has(nextResultIndex)) {
        const result = pendingResults.get(nextResultIndex)

        pendingResults.delete(nextResultIndex)
        nextResultIndex += 1

        if (!result) {
          continue
        }

        if (result.manifestEntry.status === "success") {
          progressState.completed += 1
          progressState.warningCount += result.warningCount
          manifest.successCount = progressState.completed
          manifest.warningCount = progressState.warningCount

          for (const candidateLocalPath of result.uploadCandidateLocalPaths) {
            progressState.uploadCandidateMap.set(candidateLocalPath, true)
          }

          if (result.uploadEligible) {
            progressState.uploadEligiblePostCount += 1
          }
        } else {
          progressState.failed += 1
          manifest.failureCount = progressState.failed
        }

        manifest.posts.push(result.manifestEntry)
        this.onItem?.(result.jobItem)
        this.onProgress({
          total: filteredPosts.length,
          completed: progressState.completed,
          failed: progressState.failed,
          warnings: progressState.warningCount,
        })
      }
    }

    await mapConcurrent({
      items: pendingPosts,
      concurrency: postExportConcurrency,
      mapper: async (post, index) => {
        throwIfAborted(this.abortSignal)

        const category = getCategoryForPost({
          categories: categoryMap,
          categoryId: post.categoryId,
          categoryName: post.categoryName,
        })

        try {
          this.onLog(`글 수집 시작: ${post.logNo} ${post.title}`)
          const markdownFilePath = buildMarkdownFilePath({
            outputDir,
            post,
            category,
            options,
          })
          const resolveLinkUrl = createSameBlogPostLinkResolver({
            blogId,
            markdownFilePath,
            options,
            targets: postLinkTargets,
          })
          const html = await fetcher.fetchPostHtml(post.logNo)
          throwIfAborted(this.abortSignal)
          const parsedPost = parsePostHtml({
            html,
            sourceUrl: post.source,
            options: {
              markdown: options.markdown,
              resolveLinkUrl,
            },
          })
          const review = reviewParsedPost(parsedPost)
          const rendered = await renderMarkdownPost({
            post,
            category,
            parsedPost,
            markdownFilePath,
            reviewedWarnings: review.warnings,
            options,
            resolveAsset: async (input) => assetStore.saveAsset(input),
            resolveLinkUrl,
          })

          throwIfAborted(this.abortSignal)
          await ensureDir(path.dirname(markdownFilePath))
          throwIfAborted(this.abortSignal)
          await writeFile(markdownFilePath, rendered.markdown, "utf8")

          const assetPaths = rendered.assetRecords
            .map((asset) => asset.relativePath)
            .filter((assetPath): assetPath is string => Boolean(assetPath))
          const uploadCandidates = uploadEnabled
            ? dedupeUploadCandidatesByLocalPath(
                rendered.assetRecords
                  .map((asset) => asset.uploadCandidate)
                  .filter(
                    (candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate),
                  ),
              )
            : []
          const upload = createPostUploadSummary(uploadCandidates)

          pendingResults.set(
            index,
            this.createSuccessResult({
              post,
              category,
              parsedEditorVersion: parsedPost.editorVersion,
              outputDir,
              markdownFilePath,
              assetPaths,
              upload,
              warnings: rendered.warnings,
            }),
          )
        } catch (error) {
          if (isAbortOperationError(error)) {
            throw error
          }

          pendingResults.set(index, this.createFailureResult({ post, category, error }))
          this.onLog(`글 export 실패: ${post.logNo} (${toErrorMessage(error)})`)
        }

        flushCompletedResults()
      },
    })

    flushCompletedResults()
    manifest.successCount = progressState.completed
    manifest.failureCount = progressState.failed
    manifest.warningCount = progressState.warningCount

    manifest.totalPosts = filteredPosts.length
    manifest.upload = uploadEnabled
      ? progressState.uploadCandidateMap.size > 0
        ? {
            status: UPLOAD_STATUSES.UPLOAD_READY,
            eligiblePostCount: progressState.uploadEligiblePostCount,
            candidateCount: progressState.uploadCandidateMap.size,
            uploadedCount: 0,
            failedCount: 0,
            terminalReason: null,
          }
        : {
            status: UPLOAD_STATUSES.SKIPPED,
            eligiblePostCount: 0,
            candidateCount: 0,
            uploadedCount: 0,
            failedCount: 0,
            terminalReason: "skipped-no-candidates",
          }
      : {
          status: UPLOAD_STATUSES.NOT_REQUESTED,
          eligiblePostCount: 0,
          candidateCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        }
    manifest.finishedAt = new Date().toISOString()

    if (this.writeManifestFile) {
      throwIfAborted(this.abortSignal)
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8",
      )
      this.onLog(`manifest 저장 완료: ${path.join(outputDir, "manifest.json")}`)
    }

    return manifest
  }
}
