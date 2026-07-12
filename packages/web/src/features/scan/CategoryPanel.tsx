import { allCategoryModes } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import { Box, Checkbox, FormControl, Label, Text, TextInput } from "@primer/react"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { CategoryMode } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import { PrimerSelectActionMenu } from "../../components/primer/PrimerSelectActionMenu.js"

import { getCategoryCheckboxState, orderCategoriesHierarchically } from "./CategorySelection.js"

const isCategoryMode = (value: string): value is CategoryMode =>
  allCategoryModes.includes(value as CategoryMode)

export const CategoryPanel = ({
  scanResult,
  selectedCategoryIds,
  categorySearch,
  categoryStatus,
  categoryMode,
  dateFrom,
  dateTo,
  selectedCount,
  selectedPostCount,
  totalPostCount,
  onCategorySearchChange,
  onCategoryModeChange,
  onDateFromChange,
  onDateToChange,
  onSelectAll,
  onClearAll,
  onCategoryToggle,
}: {
  scanResult: ScanResult | null
  selectedCategoryIds: number[]
  categorySearch: string
  categoryStatus: string
  categoryMode: CategoryMode
  dateFrom: string | null
  dateTo: string | null
  selectedCount: number
  selectedPostCount: number
  totalPostCount: number
  onCategorySearchChange: (value: string) => void
  onCategoryModeChange: (value: CategoryMode) => void
  onDateFromChange: (value: string | null) => void
  onDateToChange: (value: string | null) => void
  onSelectAll: () => void
  onClearAll: () => void
  onCategoryToggle: (categoryId: number, checked: boolean) => void
}) => {
  const categories = scanResult?.categories ?? []
  const orderedCategories = orderCategoriesHierarchically(categories)
  const keyword = categorySearch.trim().toLowerCase()
  const filteredCategories = orderedCategories.filter((category) => {
    if (!keyword) {
      return true
    }

    const haystack = `${category.path.join(" / ")} ${category.name}`.toLowerCase()
    return haystack.includes(keyword)
  })
  const bulkSelectionState =
    selectedCount === 0 ? false : selectedCount === categories.length ? true : "indeterminate"

  return (
    <Box id="category-panel" sx={{ display: "grid", gap: 3 }}>
      <Box
        id="category-status"
        as="p"
        sx={{ color: "fg.muted", fontSize: 1, lineHeight: 1.7, maxWidth: "48rem", m: 0 }}
      >
        {categoryStatus}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
        }}
      >
        <FormControl id="scope-categoryMode" disabled={!scanResult}>
          <FormControl.Label>카테고리 포함 범위</FormControl.Label>
          <PrimerSelectActionMenu
            id="scope-categoryMode"
            value={categoryMode}
            disabled={!scanResult}
            options={[
              {
                value: "selected-and-descendants",
                label: "선택 카테고리 + 하위 카테고리",
              },
              {
                value: "exact-selected",
                label: "선택 카테고리만",
              },
            ]}
            onValueChange={(value) => {
              if (isCategoryMode(value)) {
                onCategoryModeChange(value)
              }
            }}
          />
        </FormControl>

        <FormControl id="scope-dateFrom" disabled={!scanResult}>
          <FormControl.Label>시작일</FormControl.Label>
          <TextInput
            block
            type="date"
            value={dateFrom ?? ""}
            onChange={(event) => onDateFromChange(event.target.value || null)}
          />
        </FormControl>

        <FormControl id="scope-dateTo" disabled={!scanResult}>
          <FormControl.Label>종료일</FormControl.Label>
          <TextInput
            block
            type="date"
            value={dateTo ?? ""}
            onChange={(event) => onDateToChange(event.target.value || null)}
          />
        </FormControl>
      </Box>

      <Box className="toolbar category-toolbar" sx={{ display: "grid", gap: 2 }}>
        <FormControl id="category-search" disabled={!scanResult}>
          <FormControl.Label>검색</FormControl.Label>
          <TextInput
            block
            placeholder="카테고리 이름 또는 경로 검색"
            value={categorySearch}
            onChange={(event) => onCategorySearchChange(event.target.value)}
          />
        </FormControl>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: ["column", "row"],
          gap: 3,
          alignItems: ["flex-start", "center"],
          justifyContent: "space-between",
          color: "fg.muted",
          fontSize: 1,
        }}
      >
        <Box sx={{ display: "grid", gap: 1 }}>
          <Text id="selected-category-count" sx={{ display: "block" }}>
            선택한 카테고리 {selectedCount}개 / {categories.length}개
          </Text>
          <Text id="selected-post-count" sx={{ display: "block" }}>
            대상 글 {selectedPostCount}개 / 전체 {totalPostCount}개
          </Text>
        </Box>
        <Label variant={selectedCount > 0 ? "success" : "secondary"}>
          {selectedCount > 0 ? "선택됨" : "미선택"}
        </Label>
      </Box>

      {!scanResult ? (
        <Box
          id="category-list"
          className="category-list"
          sx={{
            bg: "canvas.subtle",
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: 2,
            color: "fg.muted",
            display: "grid",
            fontSize: 1,
            minHeight: "6rem",
            placeItems: "center",
            px: 3,
            py: 4,
            textAlign: "center",
          }}
        >
          스캔을 진행하면 카테고리가 여기에 표시됩니다.
        </Box>
      ) : filteredCategories.length === 0 ? (
        <Box
          id="category-list"
          className="category-list"
          sx={{
            bg: "canvas.subtle",
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: 2,
            color: "fg.muted",
            display: "grid",
            fontSize: 1,
            minHeight: "6rem",
            placeItems: "center",
            px: 3,
            py: 4,
            textAlign: "center",
          }}
        >
          검색 결과가 없습니다.
        </Box>
      ) : (
        <Box
          id="category-list"
          className="category-list"
          sx={{
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box sx={{ maxHeight: "min(28rem, 52vh)", overflowX: "hidden", overflowY: "auto" }}>
            <Box
              as="table"
              sx={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}
            >
              <Box as="thead" sx={{ bg: "canvas.subtle", position: "sticky", top: 0, zIndex: 1 }}>
                <Box as="tr">
                  <Box
                    as="th"
                    scope="col"
                    sx={{
                      borderBottom: "1px solid",
                      borderColor: "border.default",
                      p: 2,
                      textAlign: "left",
                      width: "3rem",
                    }}
                  >
                    <Checkbox
                      aria-label="전체 카테고리 선택"
                      checked={bulkSelectionState === true}
                      data-category-bulk-selection="true"
                      disabled={!scanResult}
                      indeterminate={bulkSelectionState === "indeterminate"}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onSelectAll()
                          return
                        }

                        onClearAll()
                      }}
                    />
                  </Box>
                  <Box
                    as="th"
                    scope="col"
                    sx={{
                      borderBottom: "1px solid",
                      borderColor: "border.default",
                      color: "fg.muted",
                      fontSize: 0,
                      fontWeight: 600,
                      p: 2,
                      textAlign: "left",
                    }}
                  >
                    카테고리
                  </Box>
                  <Box
                    as="th"
                    scope="col"
                    sx={{
                      borderBottom: "1px solid",
                      borderColor: "border.default",
                      color: "fg.muted",
                      fontSize: 0,
                      fontWeight: 600,
                      p: 2,
                      textAlign: "left",
                      width: "4.5rem",
                    }}
                  >
                    글 수
                  </Box>
                </Box>
              </Box>
              <Box as="tbody">
                {filteredCategories.map((category) => {
                  const checked = getCategoryCheckboxState({
                    categories,
                    selectedIds: selectedCategoryIds,
                    categoryId: category.id,
                  })
                  const categoryPath = category.path.join(" / ")
                  const hasParent = category.parentId !== null
                  const indentWidth = `${Math.max(category.depth, 0) * 1.2}rem`

                  return (
                    <Box
                      as="tr"
                      key={category.id}
                      className="category-item"
                      data-category-id={category.id}
                      data-category-level={hasParent ? "child" : "root"}
                      sx={{
                        bg: hasParent ? "canvas.subtle" : "canvas.default",
                        cursor: "pointer",
                        ":hover": { bg: "canvas.subtle" },
                      }}
                      onClick={() => onCategoryToggle(category.id, checked !== true)}
                    >
                      <Box
                        as="td"
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "border.default",
                          p: 2,
                          verticalAlign: "middle",
                          width: "3rem",
                        }}
                      >
                        <Checkbox
                          checked={checked === true}
                          aria-label={categoryPath}
                          indeterminate={checked === "indeterminate"}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => onCategoryToggle(category.id, event.target.checked)}
                        />
                      </Box>
                      <Box
                        as="td"
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "border.default",
                          p: 2,
                          verticalAlign: "middle",
                        }}
                      >
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            minWidth: 0,
                            pl: indentWidth,
                            position: "relative",
                          }}
                        >
                          {hasParent ? (
                            <Box
                              aria-hidden="true"
                              data-category-tree-line="true"
                              sx={{
                                bg: "border.default",
                                bottom: 0,
                                left: `calc(${indentWidth} - 0.65rem)`,
                                position: "absolute",
                                top: 0,
                                width: "1px",
                              }}
                            />
                          ) : null}
                          <Text
                            sx={{
                              color: "fg.default",
                              display: "block",
                              fontWeight: 600,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {category.name}
                          </Text>
                        </Box>
                      </Box>
                      <Box
                        as="td"
                        sx={{
                          borderBottom: "1px solid",
                          borderColor: "border.default",
                          p: 2,
                          verticalAlign: "middle",
                          width: "4.5rem",
                        }}
                      >
                        <Label className="category-count" variant="secondary">
                          {category.postCount}
                        </Label>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
