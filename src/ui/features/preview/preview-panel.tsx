import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import { Skeleton } from "../../components/ui/skeleton.js"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group.js"
import { MarkdownDocument } from "../../lib/markdown.js"
import type { ExportPreviewResult } from "../../lib/api.js"

const emptyPreviewText = "아직 preview가 없습니다."

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

  return (
    <Card className="preview-panel">
      <CardHeader className="preview-panel-header">
        <div className="preview-panel-copy">
          <p className="section-kicker">Preview</p>
          <CardTitle className="preview-title">예시 Markdown 구조</CardTitle>
          <CardDescription id="preview-status" className="preview-status">
            {previewStatus}
          </CardDescription>
        </div>
        <div className="preview-header-actions">
          {previewDirty && preview ? (
            <Badge className="preview-change-badge" variant="secondary">
              변경됨
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="preview-trigger"
            id="preview-button"
            disabled={disabled || pending}
            onClick={onPreview}
          >
            <i className={`${pending ? "ri-loader-4-line motion-safe:animate-spin" : "ri-eye-line"}`} aria-hidden="true" />
            {pending ? "불러오는 중" : "예시 보기"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="preview-panel-body">
        {pending ? (
          <div id="preview-meta" className="preview-meta preview-meta-skeleton">
            <Skeleton className="preview-meta-card h-20" />
            <Skeleton className="preview-meta-card h-20" />
            <Skeleton className="preview-meta-card h-20" />
            <Skeleton className="preview-meta-card h-20" />
          </div>
        ) : preview ? (
          <div id="preview-meta" className="preview-meta">
            <article className="preview-meta-card">
              <span>Candidate Post</span>
              <strong>{preview.candidatePost.title}</strong>
            </article>
            <article className="preview-meta-card">
              <span>Category</span>
              <strong>{preview.candidatePost.categoryName}</strong>
            </article>
            <article className="preview-meta-card">
              <span>Editor</span>
              <strong>SE{preview.editorVersion}</strong>
            </article>
            <article className="preview-meta-card">
              <span>Warnings</span>
              <strong>{warningCount}</strong>
            </article>
          </div>
        ) : (
          <div id="preview-meta" className="preview-meta empty">
            preview 대상 글 정보가 여기에 표시됩니다.
          </div>
        )}

        <div className="preview-workspace" data-preview-layout={previewMode}>
          <div className="preview-mode-float">
            <ToggleGroup
              type="single"
              value={previewMode}
              onValueChange={(value) => {
                if (value === "source" || value === "split" || value === "rendered") {
                  onPreviewModeChange(value)
                }
              }}
              className="preview-mode-toggle"
              aria-label="Preview display mode"
            >
              <ToggleGroupItem
                className={`preview-mode-button${previewMode === "source" ? " is-active" : ""}`}
                value="source"
                data-preview-mode="source"
                aria-label="소스보기"
                title="소스보기"
              >
                <i className="ri-code-s-slash-line" aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem
                className={`preview-mode-button${previewMode === "split" ? " is-active" : ""}`}
                value="split"
                data-preview-mode="split"
                aria-label="같이보기"
                title="같이보기"
              >
                <i className="ri-layout-column-line" aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem
                className={`preview-mode-button${previewMode === "rendered" ? " is-active" : ""}`}
                value="rendered"
                data-preview-mode="rendered"
                aria-label="결과보기"
                title="결과보기"
              >
                <i className="ri-markdown-line" aria-hidden="true" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="preview-content-grid">
            <pre id="preview-markdown" className="preview-markdown">
              {preview?.markdown ?? emptyPreviewText}
            </pre>
            <article id="preview-rendered" className="preview-rendered">
              <MarkdownDocument markdown={preview?.markdown ?? emptyPreviewText} />
            </article>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
