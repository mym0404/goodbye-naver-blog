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

export const CategoryPanel = ({
  scanResult,
  selectedCategoryIds,
  categorySearch,
  categoryStatus,
  selectedCount,
  onCategorySearchChange,
  onSelectAll,
  onClearAll,
  onCategoryToggle,
}: {
  scanResult: ScanResult | null
  selectedCategoryIds: number[]
  categorySearch: string
  categoryStatus: string
  selectedCount: number
  onCategorySearchChange: (value: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onCategoryToggle: (categoryId: number, checked: boolean) => void
}) => {
  const categories = scanResult?.categories ?? []
  const keyword = categorySearch.trim().toLowerCase()
  const filteredCategories = categories.filter((category) => {
    if (!keyword) {
      return true
    }

    const haystack = `${category.path.join(" / ")} ${category.name}`.toLowerCase()
    return haystack.includes(keyword)
  })

  return (
    <Card className="board-card" id="category-panel">
      <CardHeader className="panel-header">
        <div className="panel-heading">
          <p className="section-kicker">Stage 1</p>
          <CardTitle className="section-title">카테고리 범위</CardTitle>
        </div>
        <CardDescription id="category-status" className="panel-description">
          {categoryStatus}
        </CardDescription>
      </CardHeader>

      <CardContent className="panel-body">
        <div className="toolbar category-toolbar">
          <label className="input-stack toolbar-search">
            <span className="toolbar-label">검색</span>
            <Input
              id="category-search"
              placeholder="카테고리 검색"
              disabled={!scanResult}
              value={categorySearch}
              onChange={(event) => onCategorySearchChange(event.target.value)}
            />
          </label>

          <div className="toolbar-actions">
            <Button
              type="button"
              variant="outline"
              id="select-all-categories"
              disabled={!scanResult}
              onClick={onSelectAll}
            >
              <i className="ri-check-double-line" aria-hidden="true" />
              전체 선택
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ghost-button"
              id="clear-all-categories"
              disabled={!scanResult}
              onClick={onClearAll}
            >
              <i className="ri-eraser-line" aria-hidden="true" />
              전체 해제
            </Button>
          </div>
        </div>

        <div className="selection-summary">
          <span id="selected-category-count">
            선택된 카테고리 {selectedCount}개 / {categories.length}개
          </span>
          <Badge variant={selectedCount > 0 ? "secondary" : "outline"}>{selectedCount > 0 ? "선택됨" : "미선택"}</Badge>
        </div>

        {!scanResult ? (
          <div id="category-list" className="category-list empty">
            카테고리를 불러오면 여기에 표시됩니다.
          </div>
        ) : filteredCategories.length === 0 ? (
          <div id="category-list" className="category-list empty">
            검색 결과가 없습니다.
          </div>
        ) : (
          <div id="category-list" className="category-list">
            {filteredCategories.map((category) => {
              const checked = selectedCategoryIds.includes(category.id)

              return (
                <label key={category.id} className="category-item" style={{ ["--depth" as string]: category.depth }}>
                  <Checkbox checked={checked} onCheckedChange={(next) => onCategoryToggle(category.id, next === true)} />
                  <span className="category-meta">
                    <span className="category-label">{category.path.join(" / ")}</span>
                    <span className="category-subtitle">
                      depth {category.depth} · posts {category.postCount}
                    </span>
                  </span>
                  <Badge className="category-count" variant="outline">
                    {category.postCount}
                  </Badge>
                </label>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
