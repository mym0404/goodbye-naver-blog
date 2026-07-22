import path from "node:path"

import { sanitizeCategoryName } from "@exitpress/domain/blog/CategoryName.js"
import { formatCategorySegment } from "@exitpress/domain/export-paths/PathFormat.js"
import { buildPostFolderName } from "@exitpress/domain/export-paths/PostPathTemplate.js"

import type { CategoryInfo, PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import type { OutputAdapter } from "../profiles/OutputAdapter.js"

import { getOutputAdapter } from "../profiles/OutputAdapters.js"

type PathOutputAdapter = Pick<
  OutputAdapter,
  "contentRootSegments" | "documentFileName" | "formatPathSegment"
>

export const getCategoryForPost = ({
  categories,
  categoryId,
  categoryName,
}: {
  categories: Map<number, CategoryInfo>
  categoryId: number
  categoryName: string
}) => {
  const matchedCategory = categories.get(categoryId)

  if (matchedCategory) {
    return matchedCategory
  }

  const resolvedName = sanitizeCategoryName(categoryName) || "Uncategorized"

  return {
    id: categoryId,
    name: resolvedName,
    parentId: null,
    postCount: 0,
    isDivider: false,
    isOpen: true,
    path: [resolvedName],
    depth: 0,
  } satisfies CategoryInfo
}

export const buildMarkdownFilePath = ({
  outputDir,
  post,
  category,
  options,
  adapter,
}: {
  outputDir: string
  post: PostSummary
  category: CategoryInfo
  options: Pick<ExportOptions, "structure">
  adapter?: PathOutputAdapter
}) => {
  const outputAdapter = adapter ?? getOutputAdapter("gfm")
  const segments = [outputDir, ...outputAdapter.contentRootSegments]

  if (options.structure.groupByCategory) {
    const categorySegments = (category.path.length > 0 ? category.path : [category.name]).map(
      (segment) =>
        formatCategorySegment({
          value: segment,
          slugStyle: options.structure.slugStyle,
          slugWhitespace: options.structure.slugWhitespace,
        }),
    )

    segments.push(...categorySegments.map(outputAdapter.formatPathSegment))
  }

  const postFolderName = buildPostFolderName({
    post: {
      blogKey: post.blogKey,
      sourceId: post.sourceId,
      postId: post.postId,
      title: post.title,
      publishedAt: post.publishedAt,
      categoryName: category.name,
    },
    options,
  })

  return path.join(
    ...segments,
    outputAdapter.formatPathSegment(postFolderName),
    outputAdapter.documentFileName,
  )
}

export const assertUniquePostOutputPaths = ({
  outputDir,
  posts,
  categories,
  options,
  adapter,
}: {
  outputDir: string
  posts: PostSummary[]
  categories: CategoryInfo[]
  options: Pick<ExportOptions, "structure">
  adapter?: PathOutputAdapter
}) => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const postsByOutputPath = new Map<string, PostSummary[]>()

  for (const post of posts) {
    const category = getCategoryForPost({
      categories: categoryMap,
      categoryId: post.categoryId,
      categoryName: post.categoryName,
    })
    const outputPath = buildMarkdownFilePath({
      outputDir,
      post,
      category,
      options,
      adapter,
    })

    postsByOutputPath.set(outputPath, [...(postsByOutputPath.get(outputPath) ?? []), post])
  }

  const collision = [...postsByOutputPath].find(([, collidingPosts]) => collidingPosts.length > 1)

  if (!collision) {
    return
  }

  const [outputPath, collidingPosts] = collision
  const relativeOutputPath = path.relative(outputDir, outputPath).split(path.sep).join("/")
  const postIds = collidingPosts.map((post) => post.postId).join(", ")

  throw new Error(
    `글 출력 경로가 중복됩니다: ${relativeOutputPath} (postId: ${postIds}). 폴더명 템플릿에 {{ postId }}를 포함하세요.`,
  )
}
