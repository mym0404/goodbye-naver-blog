import { describe, expect, it } from "vitest"

import type { CategoryInfo } from "../../src/shared/types.js"
import {
  getCategoryCheckboxState,
  orderCategoriesHierarchically,
  toggleCategorySelection,
} from "../../src/ui/features/scan/category-selection.js"

const categories: CategoryInfo[] = [
  {
    id: 2,
    name: "A1",
    parentId: 1,
    postCount: 500,
    isDivider: false,
    isOpen: true,
    path: ["A", "A1"],
    depth: 1,
  },
  {
    id: 1,
    name: "A",
    parentId: null,
    postCount: 1000,
    isDivider: false,
    isOpen: true,
    path: ["A"],
    depth: 0,
  },
  {
    id: 3,
    name: "A2",
    parentId: 1,
    postCount: 500,
    isDivider: false,
    isOpen: true,
    path: ["A", "A2"],
    depth: 1,
  },
]

describe("category selection", () => {
  it("orders parents before descendants for table rendering", () => {
    expect(orderCategoriesHierarchically(categories).map((category) => category.id)).toEqual([1, 2, 3])
  })

  it("cascades parent and child selection as a tree", () => {
    const allSelected = [1, 2, 3]

    expect(
      toggleCategorySelection({
        categories,
        selectedIds: allSelected,
        categoryId: 1,
        checked: false,
      }),
    ).toEqual([])

    const childOnly = toggleCategorySelection({
      categories,
      selectedIds: allSelected,
      categoryId: 2,
      checked: false,
    })

    expect(childOnly).toEqual([3])
    expect(
      getCategoryCheckboxState({
        categories,
        selectedIds: childOnly,
        categoryId: 1,
      }),
    ).toBe("indeterminate")

    expect(
      toggleCategorySelection({
        categories,
        selectedIds: childOnly,
        categoryId: 3,
        checked: false,
      }),
    ).toEqual([])

    const restored = toggleCategorySelection({
      categories,
      selectedIds: childOnly,
      categoryId: 2,
      checked: true,
    })

    expect(restored).toEqual([1, 2, 3])
  })
})
