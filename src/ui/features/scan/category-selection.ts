import type { CategoryInfo } from "../../../shared/types.js"

const buildCategoryRelations = (categories: CategoryInfo[]) => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const childrenByParent = new Map<number | null, CategoryInfo[]>()

  for (const category of categories) {
    const parentKey =
      category.parentId !== null && categoryMap.has(category.parentId)
        ? category.parentId
        : null
    const siblings = childrenByParent.get(parentKey) ?? []
    siblings.push(category)
    childrenByParent.set(parentKey, siblings)
  }

  const subtreeIdsById = new Map<number, number[]>()

  const visitSubtree = (categoryId: number): number[] => {
    const cached = subtreeIdsById.get(categoryId)

    if (cached) {
      return cached
    }

    const subtreeIds = [categoryId]

    for (const child of childrenByParent.get(categoryId) ?? []) {
      subtreeIds.push(...visitSubtree(child.id))
    }

    subtreeIdsById.set(categoryId, subtreeIds)
    return subtreeIds
  }

  const ancestorIdsById = new Map<number, number[]>()

  const visitAncestors = (categoryId: number): number[] => {
    const cached = ancestorIdsById.get(categoryId)

    if (cached) {
      return cached
    }

    const category = categoryMap.get(categoryId)

    if (!category || category.parentId === null || !categoryMap.has(category.parentId)) {
      ancestorIdsById.set(categoryId, [])
      return []
    }

    const ancestors = [category.parentId, ...visitAncestors(category.parentId)]
    ancestorIdsById.set(categoryId, ancestors)
    return ancestors
  }

  const orderedCategories: CategoryInfo[] = []

  const visitOrder = (parentId: number | null) => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      orderedCategories.push(category)
      visitOrder(category.id)
    }
  }

  visitOrder(null)
  orderedCategories.forEach((category) => {
    visitSubtree(category.id)
    visitAncestors(category.id)
  })

  return {
    orderedCategories,
    subtreeIdsById,
    ancestorIdsById,
  }
}

export const orderCategoriesHierarchically = (categories: CategoryInfo[]) =>
  buildCategoryRelations(categories).orderedCategories

export const getCategoryCheckboxState = ({
  categories,
  selectedIds,
  categoryId,
}: {
  categories: CategoryInfo[]
  selectedIds: number[]
  categoryId: number
}): boolean | "indeterminate" => {
  const relations = buildCategoryRelations(categories)
  const selectedSet = new Set(selectedIds)

  if (selectedSet.has(categoryId)) {
    return true
  }

  const descendantIds =
    (relations.subtreeIdsById.get(categoryId) ?? []).filter((id) => id !== categoryId)

  return descendantIds.some((descendantId) => selectedSet.has(descendantId))
    ? "indeterminate"
    : false
}

export const toggleCategorySelection = ({
  categories,
  selectedIds,
  categoryId,
  checked,
}: {
  categories: CategoryInfo[]
  selectedIds: number[]
  categoryId: number
  checked: boolean
}) => {
  const relations = buildCategoryRelations(categories)
  const nextSelectedIds = new Set(selectedIds)
  const subtreeIds = relations.subtreeIdsById.get(categoryId) ?? [categoryId]
  const ancestorIds = relations.ancestorIdsById.get(categoryId) ?? []

  if (checked) {
    subtreeIds.forEach((subtreeId) => nextSelectedIds.add(subtreeId))

    for (const ancestorId of ancestorIds) {
      const descendantIds =
        (relations.subtreeIdsById.get(ancestorId) ?? []).filter((id) => id !== ancestorId)

      if (descendantIds.length > 0 && descendantIds.every((descendantId) => nextSelectedIds.has(descendantId))) {
        nextSelectedIds.add(ancestorId)
      }
    }
  } else {
    subtreeIds.forEach((subtreeId) => nextSelectedIds.delete(subtreeId))
    ancestorIds.forEach((ancestorId) => nextSelectedIds.delete(ancestorId))
  }

  return relations.orderedCategories
    .filter((category) => nextSelectedIds.has(category.id))
    .map((category) => category.id)
}
