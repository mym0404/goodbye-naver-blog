import path from "node:path"

import type { CategoryInfo, ExportOptions, PostSummary } from "../../shared/types.js"
import {
  getDateSlug,
  sanitizeCategoryName,
  sanitizePathSegment,
  slugifyTitle,
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
      sanitizePathSegment,
    )

    segments.push(...categorySegments)
  }

  const nameParts: string[] = []

  if (options.structure.includeDateInPostFolderName) {
    nameParts.push(getDateSlug(post.publishedAt))
  }

  if (options.structure.includeLogNoInPostFolderName) {
    nameParts.push(post.logNo)
  }

  if (options.structure.slugStyle === "kebab") {
    nameParts.push(slugifyTitle(post.title))
  } else {
    nameParts.push(sanitizePathSegment(post.title))
  }

  const postFolderName = nameParts.filter(Boolean).join("-") || post.logNo

  return path.join(...segments, postFolderName, "index.md")
}
