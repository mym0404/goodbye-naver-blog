import { useEffect, useMemo, useState } from "react"

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  validateFrontmatterAliases,
} from "../shared/export-options.js"
import type { ExportJobItem, ExportJobState, ExportOptions, ScanResult } from "../shared/types.js"

import { Badge } from "./components/ui/badge.js"
import { Button } from "./components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card.js"
import { Input } from "./components/ui/input.js"
import { Separator } from "./components/ui/separator.js"
import { CategoryPanel } from "./features/scan/category-panel.js"
import { ExportOptionsPanel } from "./features/options/export-options-panel.js"
import { JobResultsPanel } from "./features/job-results/job-results-panel.js"
import { useExportJob } from "./hooks/use-export-job.js"
import type { ExportDefaultsResponse, ExportPreviewResult } from "./lib/api.js"
import { fetchJson, postJson } from "./lib/api.js"

const previewIdleStatus =
  "스캔 후 카테고리를 고르면 현재 선택 범위의 대표 글을 기준으로 예시 Markdown을 확인할 수 있습니다."

const fallbackDefaults: ExportDefaultsResponse = {
  profile: "gfm",
  options: defaultExportOptions(),
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
}

const navigationItems = [
  { href: "#scan-workbench", label: "블로그 스캔", iconClass: "ri-radar-line" },
  { href: "#category-panel", label: "카테고리 선택", iconClass: "ri-folder-chart-line" },
  { href: "#export-panel", label: "출력 설정", iconClass: "ri-equalizer-3-line" },
  { href: "#status-panel", label: "작업 상태", iconClass: "ri-file-list-3-line" },
] as const

const createErrorJobState = (error: string, request: { blogIdOrUrl: string; outputDir: string; options: ExportOptions }) =>
  ({
    id: "failed-local",
    request: {
      blogIdOrUrl: request.blogIdOrUrl,
      outputDir: request.outputDir,
      profile: "gfm",
      options: request.options,
    },
    status: "failed",
    logs: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      warnings: 0,
    },
    items: [],
    manifest: null,
    error,
  }) satisfies ExportJobState

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults)
  const [blogIdOrUrl, setBlogIdOrUrl] = useState("")
  const [outputDir, setOutputDir] = useState("./output")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [options, setOptions] = useState<ExportOptions>(fallbackDefaults.options)
  const [scanStatus, setScanStatus] = useState("블로그를 아직 스캔하지 않았습니다.")
  const [categoryStatus, setCategoryStatus] = useState("스캔 후 카테고리를 선택할 수 있습니다.")
  const [categorySearch, setCategorySearch] = useState("")
  const [preview, setPreview] = useState<ExportPreviewResult | null>(null)
  const [previewStatus, setPreviewStatus] = useState(previewIdleStatus)
  const [previewDirty, setPreviewDirty] = useState(true)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewMode, setPreviewMode] = useState<"source" | "split" | "rendered">("source")
  const [scanPending, setScanPending] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ExportJobItem | null>(null)
  const [activeJobFilter, setActiveJobFilter] = useState<"all" | "warnings" | "errors">("all")
  const { job, submitting, setJob, startJob } = useExportJob()

  const frontmatterValidationErrors = useMemo(
    () => validateFrontmatterAliases(options.frontmatter),
    [options.frontmatter],
  )

  const selectedCategoryIds = options.scope.categoryIds
  const selectedCount = scanResult ? selectedCategoryIds.length : 0
  const exportDisabled = !scanResult || frontmatterValidationErrors.length > 0
  const previewDisabled = exportDisabled

  useEffect(() => {
    let cancelled = false

    const loadDefaults = async () => {
      try {
        const nextDefaults = await fetchJson<ExportDefaultsResponse>("/api/export-defaults")

        if (cancelled) {
          return
        }

        setDefaults(nextDefaults)
        setOptions(nextDefaults.options)
      } catch (error) {
        if (cancelled) {
          return
        }

        setDefaults(fallbackDefaults)
        setOptions(fallbackDefaults.options)
        setScanStatus(error instanceof Error ? error.message : String(error))
      }
    }

    void loadDefaults()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedItem || !job) {
      return
    }

    const nextSelectedItem = job.items.find((item) => item.id === selectedItem.id) ?? null
    setSelectedItem(nextSelectedItem)
  }, [job, selectedItem])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedItem(null)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const markPreviewDirty = (message = "옵션이 바뀌었습니다. export 전에 예시 Markdown을 다시 확인하세요.") => {
    setPreviewDirty(true)
    setPreviewStatus(message)
  }

  const updateOptions = (updater: (current: ExportOptions) => ExportOptions) => {
    setOptions((current) => updater(current))
    if (scanResult) {
      markPreviewDirty()
    }
  }

  const resetPreview = (message = previewIdleStatus) => {
    setPreview(null)
    setPreviewStatus(message)
    setPreviewDirty(true)
    setPreviewMode("source")
  }

  const resetScanState = (message: string) => {
    setScanResult(null)
    setCategorySearch("")
    setCategoryStatus("스캔 후 카테고리를 선택할 수 있습니다.")
    setScanStatus(message)
    setOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }))
    resetPreview()
  }

  const handleBlogInputChange = (value: string) => {
    setBlogIdOrUrl(value)
    resetScanState("블로그가 변경되었습니다. 다시 스캔해야 합니다.")
  }

  const handleScan = async () => {
    if (!blogIdOrUrl.trim()) {
      setScanStatus("blog ID 또는 URL을 입력해야 합니다.")
      return
    }

    setScanPending(true)
    setScanStatus("카테고리를 스캔하는 중입니다.")
    setCategoryStatus("카테고리를 불러오는 중입니다.")

    try {
      const nextScanResult = await postJson<ScanResult>("/api/scan", {
        blogIdOrUrl: blogIdOrUrl.trim(),
      })

      setScanResult(nextScanResult)
      setScanStatus(`${nextScanResult.blogId} 스캔 완료`)
      setCategoryStatus("export 할 카테고리를 선택하세요.")
      setOptions((current) => ({
        ...current,
        scope: {
          ...current.scope,
          categoryIds: nextScanResult.categories.map((category) => category.id),
        },
      }))
      resetPreview("스캔이 끝났습니다. 현재 선택 범위의 대표 글로 예시 Markdown을 확인할 수 있습니다.")
    } catch (error) {
      resetScanState(error instanceof Error ? error.message : String(error))
    } finally {
      setScanPending(false)
    }
  }

  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    updateOptions((current) => {
      const currentIds = new Set(current.scope.categoryIds)

      if (checked) {
        currentIds.add(categoryId)
      } else {
        currentIds.delete(categoryId)
      }

      return {
        ...current,
        scope: {
          ...current.scope,
          categoryIds: Array.from(currentIds),
        },
      }
    })
  }

  const handleSelectAllCategories = () => {
    if (!scanResult) {
      return
    }

    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: scanResult.categories.map((category) => category.id),
      },
    }))
  }

  const handleClearAllCategories = () => {
    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }))
  }

  const handlePreview = async () => {
    if (!scanResult) {
      resetPreview()
      return
    }

    if (frontmatterValidationErrors.length > 0) {
      setPreviewStatus("Frontmatter alias 오류를 먼저 해결해야 preview를 볼 수 있습니다.")
      return
    }

    setPreviewPending(true)
    setPreviewStatus("대표 글을 가져와 예시 Markdown을 렌더링하는 중입니다.")

    try {
      const nextPreview = await postJson<ExportPreviewResult>("/api/preview", {
        blogIdOrUrl: blogIdOrUrl.trim(),
        outputDir: outputDir.trim(),
        options,
      })

      setPreview(nextPreview)
      setPreviewStatus(
        nextPreview.renderWarnings.length > 0
          ? "preview는 현재 옵션 기준으로 렌더링했습니다. 경고가 있으면 아래 글 요약에서 함께 확인하세요."
          : "preview는 현재 옵션 기준으로 렌더링했습니다. 본문 HTML은 export 결과에 남기지 않습니다.",
      )
      setPreviewDirty(false)
    } catch (error) {
      setPreview(null)
      setPreviewStatus(error instanceof Error ? error.message : String(error))
      setPreviewDirty(true)
    } finally {
      setPreviewPending(false)
    }
  }

  const handleSubmit = async () => {
    if (!scanResult) {
      setCategoryStatus("먼저 스캔을 완료해야 합니다.")
      return
    }

    if (frontmatterValidationErrors.length > 0) {
      setCategoryStatus("Frontmatter alias 오류를 먼저 해결해야 합니다.")
      return
    }

    setSelectedItem(null)
    setActiveJobFilter("all")

    try {
      await startJob({
        blogIdOrUrl: blogIdOrUrl.trim(),
        outputDir: outputDir.trim(),
        options,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setJob(
        createErrorJobState(message, {
          blogIdOrUrl: blogIdOrUrl.trim(),
          outputDir: outputDir.trim(),
          options,
        }),
      )
    }
  }

  const summaryCards = scanResult
    ? [
        { tone: "primary", label: "Blog ID", value: scanResult.blogId, note: "scan 완료", iconClass: "ri-pages-line" },
        {
          tone: "cyan",
          label: "Total Posts",
          value: String(scanResult.totalPostCount),
          note: "전체 포스트 수",
          iconClass: "ri-article-line",
        },
        {
          tone: "green",
          label: "Categories",
          value: String(scanResult.categories.length),
          note: "발견된 카테고리",
          iconClass: "ri-folder-chart-line",
        },
        {
          tone: "neutral",
          label: "Selection",
          value: String(selectedCount),
          note: "현재 선택 범위",
          iconClass: "ri-checkbox-multiple-line",
        },
      ]
    : [
        { tone: "primary", label: "Blog ID", value: "Ready", note: "scan 대기 중", iconClass: "ri-pages-line" },
        { tone: "cyan", label: "Total Posts", value: "0", note: "스캔 후 계산됩니다", iconClass: "ri-article-line" },
        { tone: "green", label: "Categories", value: "0", note: "선택 범위 없음", iconClass: "ri-folder-chart-line" },
        {
          tone: "neutral",
          label: "Selection",
          value: "0",
          note: "카테고리를 고르면 반영됩니다",
          iconClass: "ri-checkbox-multiple-line",
        },
      ]

  const scanStatusTone = scanPending ? "running" : scanResult ? "success" : "idle"

  return (
    <main className="dashboard-shell">
      <aside className="app-sidebar" aria-label="Dashboard sections">
        <div className="sidebar-brand">
          <div className="sidebar-brand-copy">
            <strong>Naver Blog Exporter</strong>
            <span>네이버 블로그 Markdown 내보내기</span>
          </div>
        </div>

        <Separator className="sidebar-separator" />

        <div className="sidebar-section">
          <p className="sidebar-heading">작업 순서</p>
          <nav className="sidebar-nav">
            {navigationItems.map((item, index) => (
              <a
                key={item.href}
                className={`sidebar-link${index === 0 ? " is-active" : ""}`}
                href={item.href}
              >
                <i className={item.iconClass} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </div>

        <Card className="sidebar-summary-card">
          <CardHeader className="sidebar-summary-header">
            <CardDescription className="sidebar-summary-kicker">Ready Check</CardDescription>
            <CardTitle className="sidebar-summary-title">현재 세션</CardTitle>
          </CardHeader>
          <CardContent className="sidebar-summary-content">
            <div className="sidebar-summary-row">
              <span>Preview</span>
              <Badge variant={previewDirty ? "secondary" : "outline"}>{previewDirty ? "변경됨" : "동기화"}</Badge>
            </div>
            <div className="sidebar-summary-row">
              <span>Export</span>
              <Badge variant={job?.status === "failed" ? "destructive" : "secondary"}>{job?.status ?? "idle"}</Badge>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="dashboard-main">
        <Card className="hero-panel" id="scan-workbench">
          <CardHeader className="hero-panel-header">
            <div className="hero-copy">
              <p className="eyebrow">Naver Blog Markdown Export</p>
              <CardTitle className="hero-title">네이버 블로그 내보내기</CardTitle>
              <CardDescription className="hero-description">
                네이버 블로그를 스캔한 뒤 카테고리 범위를 고르고, Markdown과 asset 출력 규칙을 한 화면에서 조정합니다.
              </CardDescription>
            </div>
            <Badge id="scan-status" className="scan-status-badge" data-status={scanStatusTone}>
              {scanStatus}
            </Badge>
          </CardHeader>
          <CardContent className="hero-panel-content">
            <div className="scan-toolbar">
              <label className="input-stack scan-field">
                <span>Blog ID 또는 URL</span>
                <Input
                  id="blogIdOrUrl"
                  placeholder="mym0404 또는 https://blog.naver.com/..."
                  value={blogIdOrUrl}
                  onChange={(event) => handleBlogInputChange(event.target.value)}
                />
              </label>

              <div className="scan-actions">
                <Button type="button" id="scan-button" size="lg" disabled={scanPending} onClick={handleScan}>
                  <i className={`${scanPending ? "ri-loader-4-line motion-safe:animate-spin" : "ri-radar-line"}`} aria-hidden="true" />
                  <span>{scanPending ? "스캔 중" : "카테고리 스캔"}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section id="scan-summary" className="kpi-strip" aria-live="polite">
          {summaryCards.map((card) => (
            <Card key={card.label} className="metric-card" data-tone={card.tone}>
              <CardContent className="metric-card-content">
                <div className="metric-card-icon" aria-hidden="true">
                  <i className={card.iconClass} />
                </div>
                <div className="metric-card-copy">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.note}</small>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="content-grid">
          <CategoryPanel
            scanResult={scanResult}
            selectedCategoryIds={selectedCategoryIds}
            categorySearch={categorySearch}
            categoryStatus={categoryStatus}
            selectedCount={selectedCount}
            onCategorySearchChange={setCategorySearch}
            onSelectAll={handleSelectAllCategories}
            onClearAll={handleClearAllCategories}
            onCategoryToggle={handleCategoryToggle}
          />

          <ExportOptionsPanel
            outputDir={outputDir}
            options={options}
            optionDescriptions={defaults.optionDescriptions}
            frontmatterFieldOrder={defaults.frontmatterFieldOrder}
            frontmatterFieldMeta={defaults.frontmatterFieldMeta}
            frontmatterValidationErrors={frontmatterValidationErrors}
            preview={preview}
            previewDirty={previewDirty}
            previewStatus={previewStatus}
            previewMode={previewMode}
            previewPending={previewPending}
            exportPending={submitting}
            disabled={previewDisabled}
            onOutputDirChange={setOutputDir}
            onOptionsChange={updateOptions}
            onPreview={handlePreview}
            onPreviewModeChange={setPreviewMode}
            onSubmit={handleSubmit}
          />

          <JobResultsPanel
            job={job}
            selectedItem={selectedItem}
            activeJobFilter={activeJobFilter}
            onFilterChange={setActiveJobFilter}
            onItemSelect={setSelectedItem}
            onModalClose={() => setSelectedItem(null)}
          />
        </div>
      </div>
    </main>
  )
}
