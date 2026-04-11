import type { ExportJobItem, ExportJobState } from "../../../shared/types.js"

import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.js"
import { Separator } from "../../components/ui/separator.js"
import { MarkdownDocument } from "../../lib/markdown.js"

type JobFilter = "all" | "warnings" | "errors"

const buildJobItemSeverity = (item: ExportJobItem) => {
  if (item.status === "failed" || item.error) {
    return "error"
  }

  if (item.warningCount > 0) {
    return "warning"
  }

  return "success"
}

const getJobItems = (job: ExportJobState | null) => {
  if (!job || !Array.isArray(job.items)) {
    return []
  }

  return job.items
}

const getSummaryCards = (job: ExportJobState | null) => {
  if (!job) {
    return [
      { label: "Status", value: "Ready" },
      { label: "Completed", value: "0" },
      { label: "Failed", value: "0" },
      { label: "Warnings", value: "0" },
    ]
  }

  return [
    { label: "Status", value: job.status },
    { label: "Completed", value: String(job.progress.completed) },
    { label: "Failed", value: String(job.progress.failed) },
    { label: "Warnings", value: String(job.progress.warnings) },
  ]
}

const buildModalMarkdown = (item: ExportJobItem) => {
  if (item.markdown) {
    return item.markdown
  }

  if (item.error) {
    return `> ❌ Error: ${item.error}`
  }

  if (item.warningCount > 0) {
    return item.warnings.map((warning) => `> ⚠️ Warning: ${warning}`).join("\n\n")
  }

  return "표시할 Markdown이 없습니다."
}

const severityMeta = {
  success: { badge: "secondary" as const, label: "정상", iconClass: "ri-file-text-line" },
  warning: { badge: "outline" as const, label: "경고", iconClass: "ri-alert-line" },
  error: { badge: "destructive" as const, label: "에러", iconClass: "ri-error-warning-line" },
}

export const JobResultsPanel = ({
  job,
  selectedItem,
  activeJobFilter,
  onFilterChange,
  onItemSelect,
  onModalClose,
}: {
  job: ExportJobState | null
  selectedItem: ExportJobItem | null
  activeJobFilter: JobFilter
  onFilterChange: (filter: JobFilter) => void
  onItemSelect: (item: ExportJobItem) => void
  onModalClose: () => void
}) => {
  const jobItems = getJobItems(job).filter((item) => {
    const severity = buildJobItemSeverity(item)

    if (activeJobFilter === "warnings") {
      return severity === "warning"
    }

    if (activeJobFilter === "errors") {
      return severity === "error"
    }

    return true
  })

  const groupedItems = jobItems.reduce<Map<string, ExportJobItem[]>>((groups, item) => {
    const groupKey = item.outputPath?.split("/").slice(0, -1).join(" / ") || "failed"
    const items = groups.get(groupKey) ?? []

    items.push(item)
    groups.set(groupKey, items)
    return groups
  }, new Map())

  return (
    <>
      <Card className="board-card" id="status-panel">
        <CardHeader className="panel-header">
          <div className="panel-heading">
            <p className="section-kicker">Stage 3</p>
            <CardTitle className="section-title">작업 상태</CardTitle>
          </div>
          <Badge id="status-text" className="status-pill" data-status={job?.status ?? "idle"}>
            {job?.status ?? "Idle"}
          </Badge>
        </CardHeader>

        <CardContent className="status-layout">
          <div id="summary" className="stats" aria-live="polite">
            {getSummaryCards(job).map((card) => (
              <article key={card.label} className="stat-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <div className="results-grid">
            <section className="job-results-panel">
              <div className="job-results-header">
                <div>
                  <p className="section-kicker">완료 리스트</p>
                  <CardDescription className="results-description">
                    성공, 경고, 실패 결과를 파일 트리로 보고 Markdown 또는 진단 내용을 확인합니다.
                  </CardDescription>
                </div>
                <div className="job-filter-group" role="tablist" aria-label="완료 리스트 필터">
                  {(["all", "warnings", "errors"] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      variant={activeJobFilter === filter ? "outline" : "ghost"}
                      className={`job-filter-button${activeJobFilter === filter ? " is-active" : ""}`}
                      data-job-filter={filter}
                      onClick={() => onFilterChange(filter)}
                    >
                      {filter === "all" ? "전체" : filter === "warnings" ? "경고" : "에러"}
                    </Button>
                  ))}
                </div>
              </div>

              {groupedItems.size === 0 ? (
                <div id="job-file-tree" className="job-file-tree empty">
                  {activeJobFilter === "all"
                    ? "완료된 결과가 여기에 표시됩니다."
                    : "현재 필터에 맞는 결과가 없습니다."}
                </div>
              ) : (
                <div id="job-file-tree" className="job-file-tree">
                  {Array.from(groupedItems.entries()).map(([groupKey, items]) => (
                    <section key={groupKey} className="job-tree-group">
                      <header className="job-tree-group-header">
                        <span>{groupKey}</span>
                        <Badge variant="outline">{items.length}</Badge>
                      </header>
                      <div className="job-tree-group-body">
                        {items.map((item) => {
                          const severity = buildJobItemSeverity(item)
                          const fileLabel = item.outputPath?.split("/").pop() ?? `${item.logNo}.diagnostics`
                          const meta = severityMeta[severity]

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="job-tree-item"
                              data-job-item-id={item.id}
                              data-severity={severity}
                              onClick={() => onItemSelect(item)}
                            >
                              <span className="job-tree-item-main">
                                <span className="job-tree-item-icon" aria-hidden="true">
                                  <i className={meta.iconClass} />
                                </span>
                                <span className="job-tree-item-copy">
                                  <strong>{fileLabel}</strong>
                                  <small>{item.title}</small>
                                </span>
                              </span>
                              <Badge
                                className="job-tree-item-badge"
                                variant={severity === "success" ? "secondary" : meta.badge}
                              >
                                {severity === "warning" ? `${meta.label} ${item.warningCount}` : meta.label}
                              </Badge>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="logs-panel">
              <div className="logs-header">
                <div>
                  <p className="section-kicker">작업 로그</p>
                  <CardDescription className="results-description">
                    export 진행, 오류, manifest 생성 여부를 시간 순서대로 확인합니다.
                  </CardDescription>
                </div>
              </div>
              <Separator />
              <pre id="logs" className="logs" aria-live="polite">
                {job?.logs.map((entry) => `[${entry.timestamp}] ${entry.message}`).join("\n") ?? ""}
              </pre>
            </section>
          </div>
        </CardContent>
      </Card>

      {selectedItem ? (
        <Dialog open onOpenChange={(open) => !open && onModalClose()}>
          <DialogContent
            id="markdown-modal"
            className="markdown-modal-dialog"
            showCloseButton={false}
          >
            <DialogHeader className="markdown-modal-header">
              <div>
                <p className="section-kicker">Markdown Preview</p>
                <DialogTitle>결과 미리보기</DialogTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="ghost-button"
                id="markdown-modal-close"
                onClick={onModalClose}
              >
                닫기
              </Button>
            </DialogHeader>
            <DialogDescription className="sr-only">
              export 결과 Markdown 또는 진단 내용을 확인합니다.
            </DialogDescription>
            <div id="markdown-modal-meta" className="markdown-modal-meta">
              <article className="preview-meta-card">
                <span>Item</span>
                <strong>{selectedItem.title}</strong>
              </article>
              <article className="preview-meta-card">
                <span>Status</span>
                <strong>{selectedItem.status}</strong>
              </article>
              <article className="preview-meta-card">
                <span>Warnings</span>
                <strong>{selectedItem.warningCount}</strong>
              </article>
              <article className="preview-meta-card">
                <span>Output</span>
                <strong>{selectedItem.outputPath ?? "diagnostics only"}</strong>
              </article>
            </div>
            <article id="markdown-modal-body" className="markdown-modal-body">
              <MarkdownDocument markdown={buildModalMarkdown(selectedItem)} />
            </article>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
