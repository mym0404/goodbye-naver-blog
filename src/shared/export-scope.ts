import type { CategoryInfo, ExportOptions, PostSummary } from "./types.js"

export const resolveSelectedCategoryIds = ({
  categories,
  options,
}: {
  categories: CategoryInfo[]
  options: ExportOptions
}) => {
  if (options.scope.categoryIds.length === 0) {
    return new Set<number>()
  }

  if (options.scope.categoryMode === "exact-selected") {
    return new Set(options.scope.categoryIds)
  }

  const selectedSet = new Set(options.scope.categoryIds)
  const resolved = new Set<number>(options.scope.categoryIds)

  for (const category of categories) {
    if (category.path.length === 0) {
      continue
    }

    const matchesAncestor = options.scope.categoryIds.some((selectedId) => {
      if (!selectedSet.has(selectedId)) {
        return false
      }

      const selectedCategory = categories.find((item) => item.id === selectedId)

      if (!selectedCategory) {
        return false
      }

      return selectedCategory.path.every((segment, index) => category.path[index] === segment)
    })

    if (matchesAncestor) {
      resolved.add(category.id)
    }
  }

  return resolved
}

export const filterPostsByScope = ({
  posts,
  categories,
  options,
}: {
  posts: PostSummary[]
  categories: CategoryInfo[]
  options: ExportOptions
}) => {
  const selectedCategoryIds = resolveSelectedCategoryIds({
    categories,
    options,
  })
  const from = options.scope.dateFrom ? `${options.scope.dateFrom}T00:00:00+09:00` : null
  const to = options.scope.dateTo ? `${options.scope.dateTo}T23:59:59+09:00` : null

  return posts.filter((post) => {
    const inCategory =
      selectedCategoryIds.size === 0 || selectedCategoryIds.has(post.categoryId)
    const inDateRange =
      (!from || post.publishedAt >= from) &&
      (!to || post.publishedAt <= to)

    return inCategory && inDateRange
  })
}

export const isPostWithinScope = ({
  post,
  categories,
  options,
}: {
  post: PostSummary
  categories: CategoryInfo[]
  options: ExportOptions
}) => filterPostsByScope({ posts: [post], categories, options }).length > 0
