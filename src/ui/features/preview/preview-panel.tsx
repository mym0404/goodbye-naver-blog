import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import { ScrollArea } from "../../components/ui/scroll-area.js"
import { Skeleton } from "../../components/ui/skeleton.js"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js"
import { MarkdownDocument } from "../../lib/markdown.js"
import type { ExportPreviewResult } from "../../lib/api.js"

const emptyPreviewText = "아직 예시가 없습니다."

export const PreviewPanel = ({
  preview,
  previewDirty,
  previewStatus,
  previewMode,
  disabled,
  pending,
  onPreview,
  onPreviewModeChange,
}: {
  preview: ExportPreviewResult | null
  previewDirty: boolean
  previewStatus: string
  previewMode: "source" | "split" | "rendered"
  disabled: boolean
  pending: boolean
  onPreview: () => void
  onPreviewModeChange: (mode: "source" | "split" | "rendered") => void
}) => {
  const warningCount = preview
    ? preview.parserWarnings.length + preview.reviewerWarnings.length + preview.renderWarnings.length
    : 0
  const splitMode = previewMode === "split"
  const showSourcePane = previewMode !== "rendered"
  const showRenderedPane = previewMode !== "source"
  const previewGridClassName = `preview-content-grid grid gap-4 ${splitMode ? "xl:grid-cols-2" : "grid-cols-1"}`

  return (
    <Card
      className="board-card preview-panel overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur"
      id="preview-panel"
    >
      <CardHeader className="preview-panel-header gap-4 border-b border-slate-200/70 bg-white/70 p-6 sm:flex sm:items-start sm:justify-between">
        <div className="preview-panel-copy space-y-2">
          <CardTitle className="preview-title text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            예시 Markdown
          </CardTitle>
          <CardDescription id="preview-status" className="preview-status max-w-3xl text-sm leading-7 text-slate-600">
            {previewStatus}
          </CardDescription>
        </div>
        <div className="preview-header-actions flex flex-wrap items-center gap-3">
          {previewDirty && preview ? (
            <Badge className="preview-change-badge rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" variant="secondary">
              변경됨
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="preview-trigger min-h-11 rounded-xl border-slate-300 bg-white px-4"
            id="preview-button"
            disabled={disabled || pending}
            onClick={onPreview}
          >
            <i className={`${pending ? "ri-loader-4-line motion-safe:animate-spin" : "ri-eye-line"}`} aria-hidden="true" />
            {pending ? "불러오는 중" : "예시 보기"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="preview-panel-body grid gap-5 p-6">
        {pending ? (
          <div id="preview-meta" className="preview-meta preview-meta-skeleton grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="preview-meta-card h-20 rounded-2xl" />
            <Skeleton className="preview-meta-card h-20 rounded-2xl" />
            <Skeleton className="preview-meta-card h-20 rounded-2xl" />
            <Skeleton className="preview-meta-card h-20 rounded-2xl" />
          </div>
        ) : preview ? (
          <div id="preview-meta" className="preview-meta grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)]">
              <span className="text-sm font-medium text-slate-500">대표 글</span>
              <strong className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">{preview.candidatePost.title}</strong>
            </article>
            <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)]">
              <span className="text-sm font-medium text-slate-500">카테고리</span>
              <strong className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">{preview.candidatePost.categoryName}</strong>
            </article>
            <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)]">
              <span className="text-sm font-medium text-slate-500">에디터</span>
              <strong className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">SE{preview.editorVersion}</strong>
            </article>
            <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)]">
              <span className="text-sm font-medium text-slate-500">경고</span>
              <strong className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">{warningCount}</strong>
            </article>
          </div>
        ) : (
          <div
            id="preview-meta"
            className="preview-meta empty grid min-h-24 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500"
          >
            preview 대상 글 정보가 여기에 표시됩니다.
          </div>
        )}

        <div
          className="preview-workspace relative rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 pt-20 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
          data-preview-layout={previewMode}
        >
          <div className="preview-mode-float absolute right-4 top-4 z-10">
            <ToggleGroup
              type="single"
              value={previewMode}
              onValueChange={(value) => {
                if (value === "source" || value === "split" || value === "rendered") {
                  onPreviewModeChange(value)
                }
              }}
              className="preview-mode-toggle rounded-full border border-slate-200 bg-white/90 p-1 shadow-[0_16px_36px_rgba(22,33,50,0.12)]"
              aria-label="Preview display mode"
            >
              <ToggleGroupItem
                className={`preview-mode-button inline-flex size-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900${previewMode === "source" ? " is-active bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
                value="source"
                data-preview-mode="source"
                aria-label="소스보기"
                title="소스보기"
              >
                <i className="ri-code-s-slash-line" aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem
                className={`preview-mode-button inline-flex size-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900${previewMode === "split" ? " is-active bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
                value="split"
                data-preview-mode="split"
                aria-label="같이보기"
                title="같이보기"
              >
                <i className="ri-layout-column-line" aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem
                className={`preview-mode-button inline-flex size-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900${previewMode === "rendered" ? " is-active bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
                value="rendered"
                data-preview-mode="rendered"
                aria-label="결과보기"
                title="결과보기"
              >
                <i className="ri-markdown-line" aria-hidden="true" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className={previewGridClassName}>
            {showSourcePane ? (
              <ScrollArea className="preview-scroll-area preview-markdown-shell h-[min(34rem,62vh)] overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950">
                <pre
                  id="preview-markdown"
                  className="preview-markdown m-0 min-h-full w-full whitespace-pre-wrap break-words bg-slate-950 p-4 font-mono text-[0.88rem] leading-7 text-slate-100"
                >
                  {preview?.markdown ?? emptyPreviewText}
                </pre>
              </ScrollArea>
            ) : null}
            {showRenderedPane ? (
              <ScrollArea
                id="preview-rendered"
                className="preview-scroll-area preview-rendered h-[min(34rem,62vh)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"
              >
                <article className="preview-rendered-content min-h-full w-full p-4">
                  <MarkdownDocument markdown={preview?.markdown ?? emptyPreviewText} />
                </article>
              </ScrollArea>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
