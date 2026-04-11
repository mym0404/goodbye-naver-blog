import path from "node:path"

import { cloneExportOptions } from "../../shared/export-options.js"
import { filterPostsByScope } from "../../shared/export-scope.js"
import type {
  BlockType,
  ExportOptions,
  ParsedPost,
  PostSummary,
  ScanResult,
} from "../../shared/types.js"
import { extractBlogId } from "../../shared/utils.js"
import { NaverBlogFetcher } from "../blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../converter/markdown-renderer.js"
import { parsePostHtml } from "../parser/post-parser.js"
import { reviewParsedPost } from "../reviewer/post-reviewer.js"
import { AssetStore } from "./asset-store.js"
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"

export type PreviewFetcher = {
  scanBlog: () => Promise<ScanResult>
  getAllPosts: () => Promise<PostSummary[]>
  fetchPostHtml: (logNo: string) => Promise<string>
}

export type ExportPreviewResult = {
  candidatePost: PostSummary
  markdown: string
  markdownFilePath: string
  editorVersion: ParsedPost["editorVersion"]
  blockTypes: BlockType[]
  parserWarnings: string[]
  reviewerWarnings: string[]
  renderWarnings: string[]
  assetPaths: string[]
}

export const buildExportPreview = async ({
  blogIdOrUrl,
  outputDir,
  options,
  createFetcher,
}: {
  blogIdOrUrl: string
  outputDir: string
  options: ExportOptions
  createFetcher?: (input: { blogId: string }) => PreviewFetcher | Promise<PreviewFetcher>
}): Promise<ExportPreviewResult> => {
  const resolvedOptions = cloneExportOptions(options)
  const resolvedBlogId = extractBlogId(blogIdOrUrl)
  const resolvedOutputDir = path.resolve(outputDir)
  const fetcher = createFetcher
    ? await createFetcher({
        blogId: resolvedBlogId,
      })
    : new NaverBlogFetcher({
        blogId: resolvedBlogId,
      })

  const scan = await fetcher.scanBlog()
  const posts = await fetcher.getAllPosts()
  const filteredPosts = filterPostsByScope({
    posts,
    categories: scan.categories,
    options: resolvedOptions,
  })
  const candidatePost = filteredPosts[0]

  if (!candidatePost) {
    throw new Error("현재 선택 범위에 preview 할 글이 없습니다.")
  }

  const categoryMap = new Map(scan.categories.map((category) => [category.id, category]))
  const category = getCategoryForPost({
    categories: categoryMap,
    categoryId: candidatePost.categoryId,
    categoryName: candidatePost.categoryName,
  })
  const markdownFilePath = buildMarkdownFilePath({
    outputDir: resolvedOutputDir,
    post: candidatePost,
    category,
    options: resolvedOptions,
  })
  const html = await fetcher.fetchPostHtml(candidatePost.logNo)
  const parsedPost = parsePostHtml({
    html,
    sourceUrl: candidatePost.source,
    options: resolvedOptions,
  })
  const review = reviewParsedPost(parsedPost)
  const assetStore = new AssetStore({
    outputDir: resolvedOutputDir,
    downloader: {
      downloadBinary: async () => {},
      fetchBinary: async () => ({
        bytes: Buffer.from(""),
        contentType: "image/png",
      }),
    },
    options: resolvedOptions,
  })
  const rendered = await renderMarkdownPost({
    post: candidatePost,
    category,
    parsedPost,
    markdownFilePath,
    reviewedWarnings: review.warnings,
    options: resolvedOptions,
    resolveAsset: async (input) => assetStore.saveAsset(input),
  })

  return {
    candidatePost,
    markdown: rendered.markdown,
    markdownFilePath,
    editorVersion: parsedPost.editorVersion,
    blockTypes: parsedPost.blocks.map((block) => block.type),
    parserWarnings: parsedPost.warnings,
    reviewerWarnings: review.warnings,
    renderWarnings: rendered.warnings.filter((warning) => !review.warnings.includes(warning)),
    assetPaths: rendered.assetRecords
      .map((asset) => asset.relativePath)
      .filter((assetPath): assetPath is string => Boolean(assetPath)),
  }
}
