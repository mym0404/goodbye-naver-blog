import { writeFile } from "node:fs/promises"
import path from "node:path"

import { cloneExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { filterPostsByScope } from "@exitpress/domain/export-scope/ExportScope.js"
import {
  isAbortOperationError,
  throwIfAborted,
} from "@exitpress/engine/infra/runtime/AbortOperation.js"
import { log } from "@exitpress/engine/infra/runtime/Logger.js"
import { mapConcurrent } from "@exitpress/engine/shared/async/util/AsyncTasks.js"
import { toErrorMessage } from "@exitpress/engine/shared/error/util/toErrorMessage.js"

import type { BlogCategoryRef, BlogPostRef } from "@exitpress/domain/blog/schema/Blog.js"
import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobItem } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportManifest } from "@exitpress/domain/export-job/schema/ExportManifest.js"
import type { ExportRequest } from "@exitpress/domain/export-job/schema/ExportRequest.js"
import type { Blog, BlogPostContentCache } from "@exitpress/engine/blog/Blog.js"
import type { ProcessedPostResult } from "@exitpress/engine/exporting/post/PostExportResult.js"

import { ensureDir, resolveRepoPath } from "../../infra/node/FilePaths.js"
import {
  createExportProgressState,
  createInitialManifest,
} from "../manifest/ExportManifestProgress.js"
import { assertUniquePostOutputPaths, getCategoryForPost } from "../paths/ExportPaths.js"
import { createFailedPostResult } from "../post/PostExportResult.js"
import { getOutputAdapter } from "../profiles/OutputAdapters.js"
import {
  completeManifestUploadSummary,
  flushCompletedPostResults,
} from "../workflow/ExportWorkflowProgress.js"

import { exportBlogPostUnit, mapBlogCategory, mapBlogPost } from "./BlogPostExportUnit.js"

const postExportConcurrency = 3

type ExportResumeState = {
  items: ExportJobItem[]
  manifest: ExportManifest | null
}

const fromCachedScan = ({
  sourceInput,
  cachedScanResult,
}: {
  sourceInput: string
  cachedScanResult: ScanResult
}) => {
  const source = {
    blogKey: cachedScanResult.blogKey,
    sourceId: cachedScanResult.sourceId,
    displayName: cachedScanResult.sourceId,
    input: sourceInput,
  }

  return {
    source,
    totalPostCount: cachedScanResult.totalPostCount,
    categories: cachedScanResult.categories.map(
      (category): BlogCategoryRef => ({
        id: category.id,
        name: category.name,
        parentId: category.parentId ?? undefined,
        postCount: category.postCount,
        path: category.path,
        depth: category.depth,
      }),
    ),
    posts: (cachedScanResult.posts ?? []).map(
      (post): BlogPostRef => ({
        blogKey: post.blogKey,
        sourceId: post.sourceId,
        postId: post.postId,
        title: post.title,
        sourceUrl: post.source,
        publishedAt: post.publishedAt,
        categoryId: post.categoryId,
        categoryName: post.categoryName,
        thumbnailUrl: post.thumbnailUrl ?? undefined,
      }),
    ),
  }
}

export class BlogExportWorkflow {
  readonly blog: Blog
  readonly request: ExportRequest
  readonly onProgress: (progress: { total: number; completed: number; failed: number }) => void
  readonly onItem: ((item: ExportJobItem) => void) | null
  readonly cachedScanResult: ScanResult | null
  readonly resumeState: ExportResumeState | null
  readonly writeManifestFile: boolean
  readonly abortSignal: AbortSignal | null
  readonly postContentCache: BlogPostContentCache | undefined

  constructor({
    blog,
    request,
    onProgress,
    onItem,
    cachedScanResult,
    resumeState,
    writeManifestFile,
    abortSignal,
    postContentCache,
  }: {
    blog: Blog
    request: ExportRequest
    onProgress: (progress: { total: number; completed: number; failed: number }) => void
    onItem?: (item: ExportJobItem) => void
    cachedScanResult?: ScanResult | null
    resumeState?: ExportResumeState | null
    writeManifestFile?: boolean
    abortSignal?: AbortSignal | null
    postContentCache?: BlogPostContentCache
  }) {
    this.blog = blog
    this.request = request
    this.onProgress = onProgress
    this.onItem = onItem ?? null
    this.cachedScanResult = cachedScanResult ?? null
    this.resumeState = resumeState ?? null
    this.writeManifestFile = writeManifestFile ?? true
    this.abortSignal = abortSignal ?? null
    this.postContentCache = postContentCache
  }

  async run() {
    throwIfAborted(this.abortSignal)

    const outputDir = resolveRepoPath(this.request.outputDir)
    const outputAdapter = getOutputAdapter(this.request.profile)
    const options = cloneExportOptions(this.request.options)
    const uploadEnabled = options.assets.imageHandlingMode === "download-and-upload"
    const source = this.blog.parseSource(this.request.sourceInput)
    const scan =
      this.cachedScanResult &&
      this.cachedScanResult.blogKey === this.blog.key &&
      this.cachedScanResult.sourceId === source.sourceId &&
      this.cachedScanResult.posts
        ? fromCachedScan({
            sourceInput: this.request.sourceInput,
            cachedScanResult: this.cachedScanResult,
          })
        : await this.blog.scan(source, {
            ...(this.postContentCache ? { cache: this.postContentCache } : {}),
            ...(this.abortSignal ? { signal: this.abortSignal } : {}),
          })

    throwIfAborted(this.abortSignal)

    if (this.cachedScanResult?.posts) {
      log(`이전 스캔 결과 재사용: categories=${scan.categories.length}, posts=${scan.posts.length}`)
    }
    const categories = scan.categories.map(mapBlogCategory)
    const posts = scan.posts.map(mapBlogPost)
    const categoryMap = new Map(categories.map((category) => [category.id, category]))
    const filteredPosts = filterPostsByScope({
      posts,
      categories,
      options,
    })
    const postById = new Map(scan.posts.map((post) => [post.postId, post]))

    assertUniquePostOutputPaths({
      outputDir,
      posts: filteredPosts,
      categories,
      options,
      adapter: outputAdapter,
    })

    await ensureDir(outputDir)
    throwIfAborted(this.abortSignal)
    log(`출력 디렉터리 준비 완료: ${outputDir}`)

    const manifest = createInitialManifest({
      resumeManifest: this.resumeState?.manifest ?? null,
      blogKey: source.blogKey,
      sourceId: source.sourceId,
      profile: this.request.profile,
      options,
      categories,
      totalPosts: filteredPosts.length,
      uploadEnabled,
    })
    const progressState = createExportProgressState(manifest)
    const completedPostIds = new Set(this.resumeState?.items.map((item) => item.postId) ?? [])
    const pendingPosts = filteredPosts.filter((post) => !completedPostIds.has(post.postId))
    const pendingResults = new Map<number, ProcessedPostResult>()
    let nextResultIndex = 0

    if (posts.length !== scan.totalPostCount) {
      log(
        `목록 수집 수와 API 총계가 다릅니다. collected=${posts.length}, expected=${scan.totalPostCount}`,
      )
    }

    log(`필터 적용 후 내보낼 글 수: ${filteredPosts.length}`)
    if (pendingPosts.length !== filteredPosts.length) {
      log(
        `이전 진행 상태 복구: 완료 ${filteredPosts.length - pendingPosts.length}개, 남음 ${pendingPosts.length}개`,
      )
    }

    const flushCompletedResults = () => {
      nextResultIndex = flushCompletedPostResults({
        pendingResults,
        nextResultIndex,
        manifest,
        progressState,
        totalPosts: filteredPosts.length,
        onItem: this.onItem,
        onProgress: this.onProgress,
      })
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
        const blogPost = postById.get(post.postId)

        try {
          if (!blogPost) {
            throw new Error(`post not found in scan result: ${post.postId}`)
          }

          log(`글 수집 시작: ${post.postId} ${post.title}`)
          pendingResults.set(
            index,
            await exportBlogPostUnit({
              blog: this.blog,
              source,
              outputDir,
              post: blogPost,
              posts: scan.posts,
              categories: scan.categories,
              options,
              profile: this.request.profile,
              uploadEnabled,
              abortSignal: this.abortSignal,
              ...(this.postContentCache ? { postContentCache: this.postContentCache } : {}),
            }),
          )
        } catch (error) {
          if (isAbortOperationError(error)) {
            throw error
          }

          pendingResults.set(index, createFailedPostResult({ post, category, error }))
          log(`글 export 실패: ${post.postId} (${toErrorMessage(error)})`)
        }

        flushCompletedResults()
      },
    })

    flushCompletedResults()
    completeManifestUploadSummary({
      manifest,
      uploadEnabled,
      progressState,
      totalPosts: filteredPosts.length,
    })

    for (const supportFile of outputAdapter.createSupportFiles(manifest)) {
      throwIfAborted(this.abortSignal)
      const supportFilePath = path.join(outputDir, supportFile.relativePath)

      await ensureDir(path.dirname(supportFilePath))
      await writeFile(supportFilePath, supportFile.content, "utf8")
    }

    if (this.writeManifestFile) {
      throwIfAborted(this.abortSignal)
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8",
      )
      log(`manifest 저장 완료: ${path.join(outputDir, "manifest.json")}`)
    }

    return manifest
  }
}
