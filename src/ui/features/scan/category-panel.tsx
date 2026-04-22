import { RiCheckDoubleLine, RiEraserLine } from "@remixicon/react"
import { getCategoryCheckboxState, orderCategoriesHierarchically } from "./category-selection.js"
import type { ScanResult } from "../../../shared/types.js"

import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import { Checkbox } from "../../components/ui/checkbox.js"
import { Input } from "../../components/ui/input.js"
import { ScrollArea } from "../../components/ui/scroll-area.js"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.js"

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
  categoryMode: "selected-and-descendants" | "exact-selected"
  dateFrom: string | null
  dateTo: string | null
  selectedCount: number
  selectedPostCount: number
  totalPostCount: number
  onCategorySearchChange: (value: string) => void
  onCategoryModeChange: (value: "selected-and-descendants" | "exact-selected") => void
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

  return (
    <Card
      variant="panel"
      className="board-card overflow-hidden"
      id="category-panel"
    >
      <CardHeader className="panel-header gap-4 p-6 sm:flex sm:items-start sm:justify-between">
        <div className="panel-heading space-y-2">
          <CardTitle className="section-title text-2xl">
            카테고리 선택
          </CardTitle>
        </div>
        <CardDescription id="category-status" className="panel-description max-w-2xl text-sm leading-7">
          {categoryStatus}
        </CardDescription>
      </CardHeader>

      <CardContent className="panel-body grid gap-5 p-6">
        <div className="grid gap-4 xl:grid-cols-3">
          <label className="field-card grid min-h-0 gap-2 rounded-2xl px-4 py-4">
            <span className="text-sm font-semibold text-foreground">카테고리 포함 범위</span>
            <select
              id="scope-categoryMode"
              value={categoryMode}
              disabled={!scanResult}
              onChange={(event) =>
                onCategoryModeChange(event.target.value as "selected-and-descendants" | "exact-selected")
              }
            >
              <option value="selected-and-descendants">선택 카테고리 + 하위 카테고리</option>
              <option value="exact-selected">선택 카테고리만</option>
            </select>
          </label>

          <label className="field-card grid min-h-0 gap-2 rounded-2xl px-4 py-4">
            <span className="text-sm font-semibold text-foreground">시작일</span>
            <Input
              id="scope-dateFrom"
              type="date"
              value={dateFrom ?? ""}
              disabled={!scanResult}
              onChange={(event) => onDateFromChange(event.target.value || null)}
            />
          </label>

          <label className="field-card grid min-h-0 gap-2 rounded-2xl px-4 py-4">
            <span className="text-sm font-semibold text-foreground">종료일</span>
            <Input
              id="scope-dateTo"
              type="date"
              value={dateTo ?? ""}
              disabled={!scanResult}
              onChange={(event) => onDateToChange(event.target.value || null)}
            />
          </label>
        </div>

        <div className="toolbar category-toolbar grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="input-stack toolbar-search grid gap-2">
            <span className="toolbar-label wizard-kicker">검색</span>
            <Input
              id="category-search"
              placeholder="카테고리 이름 또는 경로 검색"
              disabled={!scanResult}
              value={categorySearch}
              onChange={(event) => onCategorySearchChange(event.target.value)}
            />
          </label>

          <div className="toolbar-actions flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="surface"
              id="select-all-categories"
              disabled={!scanResult}
              className="min-h-10 rounded-xl px-4"
              onClick={onSelectAll}
            >
              <RiCheckDoubleLine className="size-4" aria-hidden="true" />
              전체 선택
            </Button>
            <Button
              type="button"
              variant="ghost"
              id="clear-all-categories"
              disabled={!scanResult}
              className="ghost-button min-h-10 rounded-xl px-4"
              onClick={onClearAll}
            >
              <RiEraserLine className="size-4" aria-hidden="true" />
              전체 해제
            </Button>
          </div>
        </div>

        <div className="selection-summary flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <span id="selected-category-count">
              선택한 카테고리 {selectedCount}개 / {categories.length}개
            </span>
            <span id="selected-post-count">
              대상 글 {selectedPostCount}개 / 전체 {totalPostCount}개
            </span>
          </div>
          <Badge
            variant={selectedCount > 0 ? "success" : "idle"}
            className="w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          >
            {selectedCount > 0 ? "선택됨" : "미선택"}
          </Badge>
        </div>

        {!scanResult ? (
          <div
            id="category-list"
            className="category-list empty-state-surface grid min-h-24 place-items-center rounded-2xl px-4 py-6 text-center text-sm"
          >
            스캔을 진행하면 카테고리가 여기에 표시됩니다.
          </div>
        ) : filteredCategories.length === 0 ? (
          <div
            id="category-list"
            className="category-list empty-state-surface grid min-h-24 place-items-center rounded-2xl px-4 py-6 text-center text-sm"
          >
            검색 결과가 없습니다.
          </div>
        ) : (
          <div id="category-list" className="section-card category-list overflow-hidden rounded-2xl">
            <ScrollArea className="h-[min(28rem,52vh)] overflow-hidden">
              <Table className="min-w-[42rem]">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14">선택</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>경로</TableHead>
                    <TableHead className="w-20">깊이</TableHead>
                    <TableHead className="w-24">글 수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow
                        key={category.id}
                        className="category-item last:border-b-0"
                        data-category-id={category.id}
                      >
                        <TableCell className="w-14">
                          <Checkbox
                            checked={checked}
                            aria-label={categoryPath}
                            onCheckedChange={(next) => onCategoryToggle(category.id, next === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            className="grid gap-0.5"
                            style={{ paddingLeft: indentWidth }}
                          >
                            {hasParent ? (
                              <span
                                aria-hidden="true"
                                className="mb-1 inline-flex items-center"
                              >
                                <span className="h-px w-4 bg-border" />
                              </span>
                            ) : null}
                            <span className="font-semibold text-foreground">{category.name}</span>
                            <span className="text-sm text-muted-foreground">{categoryPath}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{categoryPath}</TableCell>
                        <TableCell className="text-sm font-medium text-foreground">{category.depth}</TableCell>
                        <TableCell>
                          <Badge className="category-count min-w-10 justify-center rounded-full px-2.5 py-0.5" variant="idle">
                            {category.postCount}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
