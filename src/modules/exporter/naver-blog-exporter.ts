import path from "node:path"
import { writeFile } from "node:fs/promises"

import { cloneExportOptions } from "../../shared/export-options.js"
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
  mapConcurrent,
  recreateDir,
  toErrorMessage,
} from "../../shared/utils.js"
import { NaverBlogFetcher } from "../blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../converter/markdown-renderer.js"
import { parsePostHtml } from "../parser/post-parser.js"
import { reviewParsedPost } from "../reviewer/post-reviewer.js"
import { AssetStore } from "./asset-store.js"
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"
import { buildMarkdownViewerShareUrl } from "./markdown-viewer-share-url.js"
import { buildPostLinkTargets, createSameBlogPostLinkResolver } from "./post-link-rewriter.js"
import { dedupeUploadCandidatesByLocalPath } from "./upload-candidate-utils.js"

const emptyPostUploadSummary = () => ({
  eligible: false,
  candidateCount: 0,
  uploadedCount: 0,
  failedCount: 0,
  candidates: [],
  uploadedUrls: [],
})

const postExportConcurrency = 3

type ProcessedPostResult = {
  manifestEntry: PostManifestEntry
  jobItem: ExportJobItem
  warningCount: number
  uploadCandidateLocalPaths: string[]
  uploadEligible: boolean
}

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

  constructor({
    request,
    onLog,
    onProgress,
    onItem,
    cachedScanResult,
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
  }) {
    this.request = request
    this.onLog = onLog
    this.onProgress = onProgress
    this.onItem = onItem ?? null
    this.cachedScanResult = cachedScanResult ?? null
  }

  async run() {
    const blogId = extractBlogId(this.request.blogIdOrUrl)
    const outputDir = path.resolve(this.request.outputDir)
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

    const reusablePosts =
      this.cachedScanResult?.blogId === blogId && this.cachedScanResult.posts
        ? this.cachedScanResult.posts
        : null
    const reusableScanResult = reusablePosts ? this.cachedScanResult : null
    const [scan, posts] = reusableScanResult && reusablePosts
      ? [
          {
            blogId: reusableScanResult.blogId,
            totalPostCount: reusableScanResult.totalPostCount,
            categories: reusableScanResult.categories,
          } satisfies ScanResult,
          reusablePosts,
        ]
      : await Promise.all([fetcher.scanBlog(), fetcher.getAllPosts()])

    if (reusableScanResult) {
      this.onLog(`이전 스캔 결과 재사용: categories=${scan.categories.length}, posts=${posts.length}`)
    }
    const categoryMap = new Map(scan.categories.map((category) => [category.id, category]))
    const filteredPosts = filterPostsByScope({
      posts,
      categories: scan.categories,
      options,
    })

    if (options.structure.cleanOutputDir) {
      await recreateDir(outputDir)
      this.onLog(`출력 디렉터리 초기화 완료: ${outputDir}`)
    } else {
      await ensureDir(outputDir)
      this.onLog(`출력 디렉터리 유지: ${outputDir}`)
    }

    const manifest: ExportManifest = {
      blogId,
      profile: this.request.profile,
      options,
      selectedCategoryIds: options.scope.categoryIds,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      totalPosts: filteredPosts.length,
      successCount: 0,
      failureCount: 0,
      warningCount: 0,
      upload: {
        status: uploadEnabled ? "upload-ready" : "not-requested",
        eligiblePostCount: 0,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        terminalReason: null,
      },
      categories: scan.categories,
      posts: [],
    }
    let completed = 0
    let failed = 0
    let warningCount = 0
    let uploadEligiblePostCount = 0
    const uploadCandidateMap = new Map<string, true>()
    const pendingResults = new Map<number, ProcessedPostResult>()
    let nextResultIndex = 0

    if (posts.length !== scan.totalPostCount) {
      this.onLog(
        `목록 수집 수와 API 총계가 다릅니다. collected=${posts.length}, expected=${scan.totalPostCount}`,
      )
    }

    this.onLog(`필터 적용 후 export 대상 글 수: ${filteredPosts.length}`)
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
          completed += 1
          warningCount += result.warningCount
          manifest.successCount = completed
          manifest.warningCount = warningCount

          for (const candidateLocalPath of result.uploadCandidateLocalPaths) {
            uploadCandidateMap.set(candidateLocalPath, true)
          }

          if (result.uploadEligible) {
            uploadEligiblePostCount += 1
          }
        } else {
          failed += 1
          manifest.failureCount = failed
        }

        manifest.posts.push(result.manifestEntry)
        this.onItem?.(result.jobItem)
        this.onProgress({
          total: filteredPosts.length,
          completed,
          failed,
          warnings: warningCount,
        })
      }
    }

    await mapConcurrent({
      items: filteredPosts,
      concurrency: postExportConcurrency,
      mapper: async (post, index) => {
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

          await ensureDir(path.dirname(markdownFilePath))
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
          const upload = {
            eligible: uploadCandidates.length > 0,
            candidateCount: uploadCandidates.length,
            uploadedCount: 0,
            failedCount: 0,
            candidates: uploadCandidates,
            uploadedUrls: [],
          }
          const warningCountForPost = rendered.warnings.length

          const manifestEntry = {
            logNo: post.logNo,
            title: post.title,
            source: post.source,
            category: {
              id: category.id,
              name: category.name,
              path: category.path,
            },
            editorVersion: parsedPost.editorVersion,
            status: "success",
            outputPath: path.relative(outputDir, markdownFilePath).split(path.sep).join("/"),
            assetPaths,
            upload,
            warnings: rendered.warnings,
            warningCount: warningCountForPost,
            error: null,
            externalPreviewUrl: buildMarkdownViewerShareUrl(rendered.markdown),
          } satisfies PostManifestEntry

	          pendingResults.set(index, {
	            manifestEntry,
	            jobItem: {
	              id: manifestEntry.outputPath ?? `failed:${post.logNo}`,
	              logNo: post.logNo,
	              title: post.title,
	              source: post.source,
	              category: manifestEntry.category,
	              status: "success",
	              outputPath: manifestEntry.outputPath,
	              assetPaths,
	              upload,
	              warnings: rendered.warnings,
	              warningCount: warningCountForPost,
	              error: null,
	              externalPreviewUrl: buildMarkdownViewerShareUrl(rendered.markdown),
	              updatedAt: new Date().toISOString(),
	            },
	            warningCount: warningCountForPost,
	            uploadCandidateLocalPaths: uploadCandidates.map((candidate) => candidate.localPath),
	            uploadEligible: upload.eligible,
          })
        } catch (error) {
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
            upload: emptyPostUploadSummary(),
            warnings: [],
            warningCount: 0,
            error: toErrorMessage(error),
            externalPreviewUrl: null,
          } satisfies PostManifestEntry

	          pendingResults.set(index, {
	            manifestEntry,
	            jobItem: {
	              id: `failed:${post.logNo}`,
	              logNo: post.logNo,
	              title: post.title,
	              source: post.source,
	              category: manifestEntry.category,
	              status: "failed",
	              outputPath: null,
	              assetPaths: [],
	              upload: emptyPostUploadSummary(),
	              warnings: [],
	              warningCount: 0,
	              error: manifestEntry.error,
	              externalPreviewUrl: null,
	              updatedAt: new Date().toISOString(),
	            },
	            warningCount: 0,
	            uploadCandidateLocalPaths: [],
	            uploadEligible: false,
          })
          this.onLog(`글 export 실패: ${post.logNo} (${toErrorMessage(error)})`)
        }

        flushCompletedResults()
      },
    })

    flushCompletedResults()
    manifest.successCount = completed
    manifest.failureCount = failed
    manifest.warningCount = warningCount

    manifest.upload = uploadEnabled
      ? uploadCandidateMap.size > 0
        ? {
            status: "upload-ready",
            eligiblePostCount: uploadEligiblePostCount,
            candidateCount: uploadCandidateMap.size,
            uploadedCount: 0,
            failedCount: 0,
            terminalReason: null,
          }
        : {
            status: "skipped",
            eligiblePostCount: 0,
            candidateCount: 0,
            uploadedCount: 0,
            failedCount: 0,
            terminalReason: "skipped-no-candidates",
          }
      : {
          status: "not-requested",
          eligiblePostCount: 0,
          candidateCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          terminalReason: null,
        }
    manifest.finishedAt = new Date().toISOString()
    await writeFile(
      path.join(outputDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    )
    this.onLog(`manifest 저장 완료: ${path.join(outputDir, "manifest.json")}`)

    return manifest
  }
}
