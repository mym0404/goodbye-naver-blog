import path from "node:path"

import type { CategoryInfo, ExportOptions, PostSummary } from "../../shared/types.js"
import { buildPostFolderName } from "../../shared/post-path-template.js"
import {
  formatCategorySegment,
  sanitizeCategoryName,
} from "../../shared/utils.js"

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
}: {
  outputDir: string
  post: PostSummary
  category: CategoryInfo
  options: Pick<ExportOptions, "structure">
}) => {
  const segments = [outputDir]

  if (options.structure.groupByCategory) {
    const categorySegments = (category.path.length > 0 ? category.path : [category.name]).map(
      (segment) =>
        formatCategorySegment({
          value: segment,
          slugStyle: options.structure.slugStyle,
          slugWhitespace: options.structure.slugWhitespace,
        }),
    )

    segments.push(...categorySegments)
  }

  const postFolderName = buildPostFolderName({
    post: {
      blogId: post.blogId,
      logNo: post.logNo,
      title: post.title,
      publishedAt: post.publishedAt,
      categoryName: category.name,
    },
    options,
  })

  return path.join(...segments, postFolderName, "index.md")
}
