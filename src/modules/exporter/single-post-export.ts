import path from "node:path"
import { writeFile } from "node:fs/promises"

import { cloneExportOptions } from "../../shared/export-options.js"
import { isPostWithinScope } from "../../shared/export-scope.js"
import type {
  ExportOptions,
  ParsedPost,
  PostSummary,
  ScanResult,
  StructuredAstBlock,
} from "../../shared/types.js"
import { ensureDir, extractBlogId, recreateDir, resolveRepoPath } from "../../shared/utils.js"
import { NaverBlogFetcher } from "../blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../converter/markdown-renderer.js"
import { parsePostHtml } from "../parser/post-parser.js"
import { reviewParsedPost } from "../reviewer/post-reviewer.js"
import { AssetStore } from "./asset-store.js"
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"
import { buildPostLinkTargets, createSameBlogPostLinkResolver } from "./post-link-rewriter.js"
import { getStructuredBodyBlocks } from "../parser/blocks/body-node-utils.js"

export type SinglePostFetcher = {
  scanBlog: () => Promise<ScanResult>
  getAllPosts: () => Promise<PostSummary[]>
  fetchPostHtml: (logNo: string) => Promise<string>
  downloadBinary: (input: {
    sourceUrl: string
    destinationPath: string
  }) => Promise<void>
  fetchBinary: (input: {
    sourceUrl: string
  }) => Promise<{
    bytes: Buffer
    contentType: string | null
  }>
}

export type ExportSinglePostDiagnostics = {
  post: PostSummary
  markdown: string
  markdownFilePath: string
  editorVersion: ParsedPost["editorVersion"]
  blockTypes: StructuredAstBlock["type"][]
  parserWarnings: string[]
  reviewerWarnings: string[]
  renderWarnings: string[]
  assetPaths: string[]
}

export const exportSinglePost = async ({
  blogId,
  logNo,
  outputDir,
  options,
  createFetcher,
}: {
  blogId: string
  logNo: string
  outputDir: string
  options: ExportOptions
  createFetcher?: (input: {
    blogId: string
    onLog: (message: string) => void
  }) => SinglePostFetcher | Promise<SinglePostFetcher>
}): Promise<ExportSinglePostDiagnostics> => {
  const resolvedOutputDir = resolveRepoPath(outputDir)
  const resolvedOptions = cloneExportOptions(options)
  const resolvedBlogId = extractBlogId(blogId)
  const fetcher = createFetcher
    ? await createFetcher({
        blogId: resolvedBlogId,
        onLog: () => {},
      })
    : new NaverBlogFetcher({
        blogId: resolvedBlogId,
      })
  const assetStore = new AssetStore({
    outputDir: resolvedOutputDir,
    downloader: fetcher,
    options: resolvedOptions,
  })

  const scan = await fetcher.scanBlog()
  const posts = await fetcher.getAllPosts()
  const categoryMap = new Map(scan.categories.map((category) => [category.id, category]))
  const post = posts.find((entry) => entry.logNo === logNo)

  if (!post) {
    throw new Error(`공개 글 메타데이터를 찾을 수 없습니다: ${resolvedBlogId}/${logNo}`)
  }

  if (!isPostWithinScope({ post, categories: scan.categories, options: resolvedOptions })) {
    throw new Error(`요청한 글이 scope 범위 밖입니다: ${resolvedBlogId}/${logNo}`)
  }

  await recreateDir(resolvedOutputDir)

  const category = getCategoryForPost({
    categories: categoryMap,
    categoryId: post.categoryId,
    categoryName: post.categoryName,
  })
  const markdownFilePath = buildMarkdownFilePath({
    outputDir: resolvedOutputDir,
    post,
    category,
    options: resolvedOptions,
  })
  const postLinkTargets = buildPostLinkTargets({
    outputDir: resolvedOutputDir,
    posts: [post],
    categories: scan.categories,
    options: resolvedOptions,
  })
  const resolveLinkUrl = createSameBlogPostLinkResolver({
    blogId: resolvedBlogId,
    markdownFilePath,
    options: resolvedOptions,
    targets: postLinkTargets,
  })
  const html = await fetcher.fetchPostHtml(post.logNo)
  const parsedPost = parsePostHtml({
    html,
    sourceUrl: post.source,
    options: {
      markdown: resolvedOptions.markdown,
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
    options: resolvedOptions,
    resolveAsset: async (input) => assetStore.saveAsset(input),
    resolveLinkUrl,
  })
  const renderWarnings = rendered.warnings.filter((warning) => !review.warnings.includes(warning))

  await ensureDir(path.dirname(markdownFilePath))
  await writeFile(markdownFilePath, rendered.markdown, "utf8")

  return {
    post,
    markdown: rendered.markdown,
    markdownFilePath,
    editorVersion: parsedPost.editorVersion,
    blockTypes: getStructuredBodyBlocks(parsedPost).map((block) => block.type),
    parserWarnings: parsedPost.warnings,
    reviewerWarnings: review.warnings,
    renderWarnings,
    assetPaths: rendered.assetRecords
      .map((asset) => asset.relativePath)
      .filter((assetPath): assetPath is string => Boolean(assetPath)),
  }
}
