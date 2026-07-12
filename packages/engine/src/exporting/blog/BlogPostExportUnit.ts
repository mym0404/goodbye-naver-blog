import { writeFile } from "node:fs/promises"
import path from "node:path"

import { throwIfAborted } from "@exitpress/engine/infra/runtime/AbortOperation.js"
import { renderMarkdownPost } from "@exitpress/engine/markdown/util/renderMarkdownPost.js"

import type {
  BlogCategoryRef,
  BlogPostRef,
  BlogSource,
} from "@exitpress/domain/blog/schema/Blog.js"
import type { CategoryInfo, PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { Blog, BlogPostContentCache } from "@exitpress/engine/blog/Blog.js"

import { ensureDir } from "../../infra/node/FilePaths.js"
import { AssetStore } from "../assets/AssetStore.js"
import { createPostUploadSummary } from "../manifest/ExportManifestProgress.js"
import { buildMarkdownFilePath, getCategoryForPost } from "../paths/ExportPaths.js"
import { buildPostLinkTargets, createPostLinkResolver } from "../paths/PostLinkRewriter.js"
import { createSuccessPostResult } from "../post/PostExportResult.js"
import { getOutputAdapter } from "../profiles/OutputAdapters.js"
import { dedupeUploadCandidatesByLocalPath } from "../upload/util/dedupeUploadCandidatesByLocalPath.js"

export const mapBlogCategory = (category: BlogCategoryRef): CategoryInfo => ({
  id: category.id,
  name: category.name,
  parentId: category.parentId ?? null,
  postCount: category.postCount,
  isDivider: false,
  isOpen: true,
  path: category.path,
  depth: category.depth,
})

export const mapBlogPost = (post: BlogPostRef): PostSummary => ({
  blogKey: post.blogKey,
  sourceId: post.sourceId,
  postId: post.postId,
  title: post.title,
  publishedAt: post.publishedAt,
  categoryId: post.categoryId,
  categoryName: post.categoryName,
  source: post.sourceUrl,
  thumbnailUrl: post.thumbnailUrl ?? null,
})

const createDefaultBlockTemplateMap = ({
  blog,
  profile = "gfm",
}: {
  blog: Blog
  profile?: ExportProfile
}) => {
  const defaults = Object.fromEntries(
    blog
      .getBlockTemplateDefinitions()
      .map((definition) => [definition.key, definition.presets[0].template]),
  )
  const overrides = Object.fromEntries(
    Object.entries(blog.getOutputBlockTemplates?.(profile) ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )

  return { ...defaults, ...overrides }
}

const createBlogAssetDownloader = (
  blog: Blog,
): ConstructorParameters<typeof AssetStore>[0]["downloader"] => {
  const downloadBinary = blog.downloadBinary ?? (async () => {})

  return {
    downloadBinary,
    ...(blog.fetchBinary ? { fetchBinary: blog.fetchBinary } : {}),
  }
}

const mapBlogLinkIdentity = ({ blog, url }: { blog: Blog; url: string }) => {
  const identity = blog.resolvePostLinkIdentity?.(url)

  if (!identity || identity.blogKey !== blog.key) {
    return null
  }

  return {
    blogKey: identity.blogKey,
    sourceId: identity.sourceId,
    postId: identity.postId,
  }
}

export const exportBlogPostUnit = async ({
  blog,
  source,
  outputDir,
  post,
  posts,
  categories,
  options,
  profile = "gfm",
  uploadEnabled,
  abortSignal,
  postContentCache,
}: {
  blog: Blog
  source: BlogSource
  outputDir: string
  post: BlogPostRef
  posts?: BlogPostRef[]
  categories: BlogCategoryRef[]
  options: ExportOptions
  profile?: ExportProfile
  uploadEnabled: boolean
  abortSignal: AbortSignal | null
  postContentCache?: BlogPostContentCache
}) => {
  const adapter = getOutputAdapter(profile)
  const mappedPost = mapBlogPost(post)
  const categoryMap = new Map(
    categories.map((category) => [category.id, mapBlogCategory(category)]),
  )
  const category = getCategoryForPost({
    categories: categoryMap,
    categoryId: mappedPost.categoryId,
    categoryName: mappedPost.categoryName,
  })
  const markdownFilePath = buildMarkdownFilePath({
    outputDir,
    post: mappedPost,
    category,
    options,
    adapter,
  })
  const resolveLinkUrl = createPostLinkResolver({
    blogKey: source.blogKey,
    sourceId: source.sourceId,
    markdownFilePath,
    options,
    targets: buildPostLinkTargets({
      outputDir,
      posts: (posts ?? [post]).map(mapBlogPost),
      categories: categories.map(mapBlogCategory),
      options,
      adapter,
    }),
    resolveIdentity: (url) => mapBlogLinkIdentity({ blog, url }),
  })
  const assetStore = new AssetStore({
    outputDir,
    downloader: createBlogAssetDownloader(blog),
    options,
    assetRootSegments: adapter.assetRootSegments,
    formatReference: adapter.formatAssetReference,
  })
  const content = await blog.loadPostContent({
    source,
    post,
    ...(postContentCache ? { cache: postContentCache } : {}),
    signal: abortSignal ?? undefined,
  })

  throwIfAborted(abortSignal)

  const parsedPost = blog.parseContent({
    source,
    post,
    content,
    options: {
      blockOutputs: options.blockOutputs,
      assets: options.assets,
      resolveLinkUrl,
    },
  })
  const rendered = await renderMarkdownPost({
    post: mappedPost,
    category,
    parsedPost,
    defaultBlockTemplates: createDefaultBlockTemplateMap({ blog, profile }),
    markdownFilePath,
    options,
    profile,
    adapter,
    resolveAsset: async (input) => assetStore.saveAsset(input),
  })

  throwIfAborted(abortSignal)
  await ensureDir(path.dirname(markdownFilePath))
  throwIfAborted(abortSignal)
  await writeFile(markdownFilePath, rendered.markdown, "utf8")

  const assetPaths = rendered.assetRecords
    .map((asset) => asset.relativePath)
    .filter((assetPath): assetPath is string => Boolean(assetPath))
  const uploadCandidates = uploadEnabled
    ? dedupeUploadCandidatesByLocalPath(
        rendered.assetRecords
          .map((asset) => asset.uploadCandidate)
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
      )
    : []

  return {
    ...createSuccessPostResult({
      post: mappedPost,
      category,
      outputDir,
      markdownFilePath,
      assetPaths,
      upload: createPostUploadSummary(uploadCandidates),
    }),
    markdown: rendered.markdown,
    markdownFilePath,
    blockIds: [...new Set(parsedPost.blocks.map((block) => block.blockId))],
    assetPaths,
  }
}
