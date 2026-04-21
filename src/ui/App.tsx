import { useEffect, useMemo, useRef, useState } from "react"

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  sanitizePersistedExportOptions,
  validateFrontmatterAliases,
} from "../shared/export-options.js"
import { filterPostsByScope } from "../shared/export-scope.js"
import type {
  ExportJobState,
  ExportOptions,
  ScanResult,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../shared/types.js"

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
import { toast } from "./components/ui/sonner.js"
import { toggleCategorySelection } from "./features/scan/category-selection.js"
import { CategoryPanel } from "./features/scan/category-panel.js"
import {
  ExportOptionsPanel,
  type ExportOptionsStep,
} from "./features/options/export-options-panel.js"
import { JobResultsPanel } from "./features/job-results/job-results-panel.js"
import { useExportJob } from "./hooks/use-export-job.js"
import type {
  ExportDefaultsResponse,
  UploadProvidersResponse,
} from "./lib/api.js"
import { fetchJson, postJson, postJsonNoContent } from "./lib/api.js"
import { cn } from "./lib/cn.js"

const fallbackDefaults: ExportDefaultsResponse = {
  profile: "gfm",
  options: defaultExportOptions(),
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
}

const fallbackUploadProviders: UploadProviderCatalogResponse = {
  defaultProviderKey: null,
  providers: [],
}

const uploadProviderLoadErrorMessage = "업로드 설정을 불러오지 못했습니다."
const exportSettingsSaveDelayMs = 300

const setupSteps = [
  "blog-input",
  "category-selection",
  "structure-options",
  "frontmatter-options",
  "markdown-options",
  "assets-options",
  "links-options",
  "diagnostics-options",
] as const

type SetupStep = (typeof setupSteps)[number]
type WizardStep = SetupStep | "running" | "upload" | "result"

const optionStepMap: Record<Extract<SetupStep, `${string}-options`>, ExportOptionsStep> = {
  "structure-options": "structure",
  "frontmatter-options": "frontmatter",
  "markdown-options": "markdown",
  "assets-options": "assets",
  "links-options": "links",
  "diagnostics-options": "diagnostics",
}

const stepMeta: Record<
  WizardStep,
  {
    title: string
    description: string
  }
> = {
  "blog-input": {
    title: "블로그 입력",
    description: "블로그 ID나 URL을 입력하고 카테고리를 불러옵니다.",
  },
  "category-selection": {
    title: "카테고리 선택",
    description: "내보낼 카테고리와 범위 조건을 정합니다.",
  },
  "structure-options": {
    title: "구조 설정",
    description: "출력 경로와 폴더 구조를 정합니다.",
  },
  "frontmatter-options": {
    title: "Frontmatter 설정",
    description: "메타데이터 필드와 alias를 정리합니다.",
  },
  "markdown-options": {
    title: "Markdown 설정",
    description: "본문 렌더링 규칙을 정합니다.",
  },
  "assets-options": {
    title: "Assets 설정",
    description: "이미지 다운로드와 업로드 전략을 정합니다.",
  },
  "links-options": {
    title: "Link 처리",
    description: "같은 블로그 안의 다른 글 링크를 어떻게 바꿀지 정합니다.",
  },
  "diagnostics-options": {
    title: "진단 설정",
    description: "경고와 실패 처리 방식을 정합니다.",
  },
  running: {
    title: "실행 중",
    description: "",
  },
  upload: {
    title: "이미지 업로드",
    description: "",
  },
  result: {
    title: "결과",
    description: "",
  },
}

const createErrorJobState = (
  error: string,
  request: { blogIdOrUrl: string; outputDir: string; options: ExportOptions },
) =>
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
    upload: {
      status: "not-requested",
      eligiblePostCount: 0,
      candidateCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      terminalReason: null,
    },
    items: [],
    manifest: null,
    error,
  }) satisfies ExportJobState

const statusPillClass = (status: string) =>
  cn(
    "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
    status === "completed" || status === "upload-completed" || status === "ready"
      ? "bg-emerald-100 text-emerald-800"
      : status === "running" || status === "queued" || status === "success" || status === "uploading"
        ? "bg-amber-100 text-amber-800"
        : status === "failed" || status === "upload-failed"
          ? "bg-rose-100 text-rose-800"
          : status === "upload-ready"
            ? "bg-sky-100 text-sky-800"
            : "bg-slate-100 text-slate-600",
	  )

const resolveScopedCategoryIds = ({
  categories,
  currentCategoryIds,
}: {
  categories: ScanResult["categories"]
  currentCategoryIds: number[]
}) => {
  const validCategoryIds = currentCategoryIds.filter((categoryId) =>
    categories.some((category) => category.id === categoryId),
  )

  return validCategoryIds.length > 0
    ? validCategoryIds
    : categories.map((category) => category.id)
}

const getPersistedOptionsSignature = (options: ExportOptions) =>
  JSON.stringify(sanitizePersistedExportOptions(options))

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults)
  const [uploadProviders, setUploadProviders] = useState(fallbackUploadProviders)
  const [uploadProviderError, setUploadProviderError] = useState<string | null>(null)
  const [blogIdOrUrl, setBlogIdOrUrl] = useState("")
  const [outputDir, setOutputDir] = useState("./output")
  const [scanCache, setScanCache] = useState<Record<string, ScanResult>>({})
  const [options, setOptions] = useState<ExportOptions>(
    fallbackDefaults.options,
  )
  const [scanStatus, setScanStatus] = useState(
    "블로그를 아직 스캔하지 않았습니다.",
  )
  const [categoryStatus, setCategoryStatus] = useState(
    "스캔 후 카테고리를 선택할 수 있습니다.",
  )
  const [categorySearch, setCategorySearch] = useState("")
  const [scanPending, setScanPending] = useState(false)
  const [setupStep, setSetupStep] = useState<SetupStep>("blog-input")
  const [activeJobFilter, setActiveJobFilter] = useState<
    "all" | "warnings" | "errors"
  >("all")
  const { job, submitting, uploadSubmitting, setJob, startJob, startUpload } = useExportJob()
  const lastNotifiedJobKeyRef = useRef<string | null>(null)
  const stepViewRef = useRef<HTMLElement | null>(null)
  const previousStepRef = useRef<WizardStep | null>(null)
  const persistedOptionsSignatureRef = useRef<string | null>(null)
  const hasLoadedDefaultsRef = useRef(false)
  const latestPersistedOptionsRef = useRef(sanitizePersistedExportOptions(fallbackDefaults.options))

  const frontmatterValidationErrors = useMemo(
    () => validateFrontmatterAliases(options.frontmatter),
    [options.frontmatter],
  )
  const currentScanTarget = blogIdOrUrl.trim()
  const activeScanResult = currentScanTarget ? scanCache[currentScanTarget] ?? null : null
  const scopedPosts = useMemo(() => {
    if (!activeScanResult?.posts) {
      return []
    }

    return filterPostsByScope({
      posts: activeScanResult.posts,
      categories: activeScanResult.categories,
      options,
    })
  }, [activeScanResult, options])
  const scopedPostCount = activeScanResult?.posts ? scopedPosts.length : activeScanResult?.totalPostCount ?? 0
  const linkTemplatePreviewPost = scopedPosts[0] ?? activeScanResult?.posts?.[0] ?? null

  const selectedCategoryIds = options.scope.categoryIds
  const selectedCount = activeScanResult ? selectedCategoryIds.length : 0
  const exportDisabled = !activeScanResult || frontmatterValidationErrors.length > 0
  const setupStepIndex = setupSteps.indexOf(setupStep)
  const shouldLoadUploadProviders =
    job?.status === "upload-ready" || job?.status === "upload-failed"
  const persistedOptions = useMemo(() => sanitizePersistedExportOptions(options), [options])
  const persistedOptionsSignature = useMemo(
    () => JSON.stringify(persistedOptions),
    [persistedOptions],
  )

  const currentStep: WizardStep = useMemo(() => {
    if (submitting || job?.status === "queued" || job?.status === "running") {
      return "running"
    }

    if (
      uploadSubmitting ||
      job?.status === "upload-ready" ||
      job?.status === "uploading" ||
      job?.status === "upload-failed"
    ) {
      return "upload"
    }

    if (
      job?.status === "completed" ||
      job?.status === "failed" ||
      job?.status === "upload-completed"
    ) {
      return "result"
    }

    return setupStep
  }, [job?.status, setupStep, submitting, uploadSubmitting])

  const isSetupStep = currentStep === setupStep

  useEffect(() => {
    const previousStep = previousStepRef.current
    previousStepRef.current = currentStep

    if (!isSetupStep || previousStep === null || previousStep === currentStep) {
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
    stepViewRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    })
  }, [currentStep, isSetupStep])

  useEffect(() => {
    let cancelled = false

    const loadDefaults = async () => {
      try {
        const nextDefaults = await fetchJson<ExportDefaultsResponse>("/api/export-defaults")

        if (cancelled) {
          return
        }

        const nextPersistedOptions = sanitizePersistedExportOptions(nextDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        persistedOptionsSignatureRef.current = getPersistedOptionsSignature(nextDefaults.options)
        hasLoadedDefaultsRef.current = true
        setDefaults(nextDefaults)
        setOptions(nextDefaults.options)
      } catch (error) {
        if (cancelled) {
          return
        }

        const nextPersistedOptions = sanitizePersistedExportOptions(fallbackDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        persistedOptionsSignatureRef.current = getPersistedOptionsSignature(fallbackDefaults.options)
        hasLoadedDefaultsRef.current = true
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
    latestPersistedOptionsRef.current = persistedOptions
  }, [persistedOptions])

  useEffect(() => {
    if (!hasLoadedDefaultsRef.current) {
      return
    }

    if (persistedOptionsSignature === persistedOptionsSignatureRef.current) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void postJsonNoContent("/api/export-settings", {
        options: latestPersistedOptionsRef.current,
      })
        .then(() => {
          if (cancelled) {
            return
          }

          persistedOptionsSignatureRef.current = persistedOptionsSignature
        })
        .catch(() => {})
    }, exportSettingsSaveDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [persistedOptionsSignature])

  useEffect(() => {
    setUploadProviders(fallbackUploadProviders)
    setUploadProviderError(null)
  }, [job?.id])

  useEffect(() => {
    if (!shouldLoadUploadProviders || uploadProviders.providers.length > 0 || uploadProviderError) {
      return
    }

    let cancelled = false

    const loadUploadProviders = async () => {
      try {
        const nextCatalog = await fetchJson<UploadProvidersResponse>("/api/upload-providers")

        if (cancelled) {
          return
        }

        setUploadProviders(nextCatalog)
        setUploadProviderError(null)
      } catch (error) {
        if (cancelled) {
          return
        }

        setUploadProviders(fallbackUploadProviders)
        setUploadProviderError(uploadProviderLoadErrorMessage)
      }
    }

    void loadUploadProviders()

    return () => {
      cancelled = true
    }
  }, [shouldLoadUploadProviders, uploadProviderError, uploadProviders.providers.length])

  useEffect(() => {
    if (!job) {
      lastNotifiedJobKeyRef.current = null
      return
    }

    const notificationKey = `${job.id}:${job.status}:${job.finishedAt ?? ""}`

    if (lastNotifiedJobKeyRef.current === notificationKey) {
      return
    }

    lastNotifiedJobKeyRef.current = notificationKey

    if (job.status === "upload-ready") {
      toast("내보내기가 끝났습니다. 이미지 업로드를 시작할 수 있습니다.", {
        description: `업로드 대상 ${job.upload.candidateCount}개`,
      })
      return
    }

    if (job.status === "completed") {
      toast.success("내보내기가 완료되었습니다.", {
        description: `완료 ${job.progress.completed}개, 실패 ${job.progress.failed}개`,
      })
      return
    }

    if (job.status === "upload-completed") {
      toast.success("이미지 업로드까지 완료되었습니다.", {
        description: `업로드 ${job.upload.uploadedCount}개`,
      })
      return
    }

    if (job.status === "upload-failed") {
      toast.error("이미지 업로드에 실패했습니다.", {
        description: job.error ?? "로그를 확인하세요.",
      })
      return
    }

    if (job.status === "failed") {
      toast.error("내보내기 작업이 실패했습니다.", {
        description: job.error ?? "로그를 확인하세요.",
      })
    }
  }, [job])

  const updateOptions = (
    updater: (current: ExportOptions) => ExportOptions,
  ) => {
    setOptions((current) => updater(current))
  }

  const ensureScanResult = async ({
    forceRefresh = false,
  }: {
    forceRefresh?: boolean
  } = {}) => {
    if (!currentScanTarget) {
      setScanStatus("블로그 ID 또는 URL을 입력하세요.")
      return false
    }

    if (activeScanResult && !forceRefresh) {
      setScanStatus(`${activeScanResult.blogId} 스캔 결과를 재사용합니다.`)
      setCategoryStatus("내보낼 카테고리를 선택하세요.")
      setCategorySearch("")
      setOptions((current) => ({
        ...current,
        scope: {
          ...current.scope,
          categoryIds: resolveScopedCategoryIds({
            categories: activeScanResult.categories,
            currentCategoryIds: current.scope.categoryIds,
          }),
        },
      }))
      setSetupStep("category-selection")
      return true
    }

    setScanPending(true)
    setScanStatus(forceRefresh ? "캐시를 무효화하고 카테고리를 다시 불러오는 중입니다." : "카테고리를 스캔하는 중입니다.")
    setCategoryStatus("카테고리를 불러오는 중입니다.")

    if (forceRefresh) {
      setScanCache((current) => {
        const next = { ...current }
        delete next[currentScanTarget]
        return next
      })
    }

    try {
      const nextScanResult = await postJson<ScanResult>("/api/scan", {
        blogIdOrUrl: currentScanTarget,
        forceRefresh,
      })

      setScanCache((current) => ({
        ...current,
        [currentScanTarget]: nextScanResult,
      }))
      setScanStatus(`${nextScanResult.blogId} 스캔 완료`)
      setCategoryStatus("내보낼 카테고리를 선택하세요.")
      setCategorySearch("")
      setOptions((current) => ({
        ...current,
        scope: {
          ...current.scope,
          categoryIds: nextScanResult.categories.map((category) => category.id),
        },
      }))
      setSetupStep("category-selection")
      toast.success("카테고리 스캔이 완료되었습니다.", {
        description: `${nextScanResult.totalPostCount}개 글과 ${nextScanResult.categories.length}개 카테고리를 불러왔습니다.`,
      })

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setScanStatus(message)
      setCategoryStatus("스캔에 실패했습니다. 다시 시도하세요.")
      toast.error("카테고리 스캔에 실패했습니다.", {
        description: message,
      })
      return false
    } finally {
      setScanPending(false)
    }
  }

  const handleBlogInputChange = (value: string) => {
    setBlogIdOrUrl(value)
    setSetupStep("blog-input")

    if (value.trim() && scanCache[value.trim()]) {
      setScanStatus("캐시된 카테고리를 다시 사용할 수 있습니다.")
      setCategoryStatus("내보낼 카테고리를 선택하세요.")
      return
    }

    setScanStatus(
      value.trim()
        ? "블로그가 바뀌었습니다. 다음 단계에서 다시 스캔합니다."
        : "블로그를 아직 스캔하지 않았습니다.",
    )
    setCategoryStatus("스캔이 끝나면 카테고리를 선택할 수 있습니다.")
    setCategorySearch("")
    setOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }))
  }

  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    if (!activeScanResult) {
      return
    }

    updateOptions((current) => {
      return {
        ...current,
        scope: {
          ...current.scope,
          categoryIds: toggleCategorySelection({
            categories: activeScanResult.categories,
            selectedIds: current.scope.categoryIds,
            categoryId,
            checked,
          }),
        },
      }
    })
  }

  const handleSelectAllCategories = () => {
    if (!activeScanResult) {
      return
    }

    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: activeScanResult.categories.map((category) => category.id),
      },
    }))
    toast("카테고리를 전체 선택했습니다.", {
      description: `${activeScanResult.totalPostCount}개 글이 선택 범위에 포함됩니다.`,
    })
  }

  const handleClearAllCategories = () => {
    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }))
    toast("카테고리 선택을 모두 해제했습니다.", {
      description: "선택 범위가 비워졌습니다.",
    })
  }

  const handleSubmit = async () => {
    if (!activeScanResult) {
      setCategoryStatus("먼저 스캔을 완료해야 합니다.")
      return
    }

    if (frontmatterValidationErrors.length > 0) {
      setSetupStep("frontmatter-options")
      setCategoryStatus("Frontmatter alias 오류를 먼저 해결해야 합니다.")
      return
    }

    setActiveJobFilter("all")

    try {
      const jobId = await startJob({
        blogIdOrUrl: currentScanTarget,
        outputDir: outputDir.trim(),
        options,
        scanResult: activeScanResult,
      })
      toast.success("내보내기 작업을 등록했습니다.", {
        description: `${scopedPostCount}개 글을 처리합니다. 작업 ID ${jobId}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setJob(
        createErrorJobState(message, {
          blogIdOrUrl: currentScanTarget,
          outputDir: outputDir.trim(),
          options,
        }),
      )
      toast.error("내보내기 작업 등록에 실패했습니다.", {
        description: message,
      })
    }
  }

  const handleUpload = async ({
    providerKey,
    providerFields,
  }: {
    providerKey: string
    providerFields: Record<string, UploadProviderValue>
  }) => {
    try {
      await startUpload({
        providerKey,
        providerFields,
      })
      toast("이미지 업로드를 시작했습니다.", {
        description: "현재 단계에서 진행률을 확인할 수 있습니다.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("이미지 업로드를 시작하지 못했습니다.", {
        description: message,
      })
    }
  }

  const goToPreviousStep = () => {
    if (!isSetupStep || setupStepIndex <= 0) {
      return
    }

    setSetupStep(setupSteps[setupStepIndex - 1])
  }

  const goToNextStep = async () => {
    if (!isSetupStep) {
      return
    }

    if (setupStep === "blog-input") {
      await ensureScanResult()
      return
    }

    if (setupStep === "diagnostics-options") {
      await handleSubmit()
      return
    }

    setSetupStep(setupSteps[setupStepIndex + 1] ?? setupStep)
  }

  const summaryCards = (() => {
    if (currentStep === "running" || currentStep === "upload" || currentStep === "result") {
      const total = job?.progress.total ?? scopedPostCount

      return [
        { label: "총 글", value: String(total) },
        { label: "완료", value: String(job?.progress.completed ?? 0) },
        { label: "실패", value: String(job?.progress.failed ?? 0) },
        { label: "업로드", value: String(job?.upload.uploadedCount ?? 0) },
      ]
    }

    return [
      { label: "대상 글", value: String(scopedPostCount) },
      { label: "카테고리", value: String(activeScanResult?.categories.length ?? 0) },
      { label: "선택", value: String(selectedCount) },
      { label: "출력", value: outputDir.trim() || "./output" },
    ]
  })()

  const headerStatus = (() => {
    if (job?.status) {
      return job.status
    }

    if (scanPending) {
      return "running"
    }

    if (activeScanResult) {
      return "ready"
    }

    return "idle"
  })()

  const nextButtonLabel = (() => {
    switch (setupStep) {
      case "blog-input":
        return scanPending ? "스캔 중" : "카테고리 불러오기"
      case "category-selection":
        return "구조 설정"
      case "structure-options":
        return "Frontmatter 설정"
      case "frontmatter-options":
        return "Markdown 설정"
      case "markdown-options":
        return "Assets 설정"
      case "assets-options":
        return "Link 처리"
      case "links-options":
        return "진단 설정"
      case "diagnostics-options":
        return submitting ? "작업 등록 중" : "내보내기"
    }
  })()

  const renderCurrentStep = () => {
    if (currentStep === "running") {
      return (
        <JobResultsPanel
          mode="running"
          job={job}
          activeJobFilter={activeJobFilter}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onUploadStart={handleUpload}
        />
      )
    }

    if (currentStep === "upload") {
      return (
        <JobResultsPanel
          mode="upload"
          job={job}
          activeJobFilter={activeJobFilter}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onUploadStart={handleUpload}
        />
      )
    }

    if (currentStep === "result") {
      return (
        <JobResultsPanel
          mode="result"
          job={job}
          activeJobFilter={activeJobFilter}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onUploadStart={handleUpload}
        />
      )
    }

    if (currentStep === "blog-input") {
      return (
        <Card className="hero-panel overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur">
          <CardHeader className="gap-4 border-b border-slate-200/70 bg-white/70 p-6">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                블로그 ID 또는 URL
              </CardTitle>
              <CardDescription className="panel-description max-w-3xl text-sm leading-7 text-slate-600">
                네이버 블로그 ID나 주소를 입력하면 카테고리를 불러옵니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-900">
                블로그 ID 또는 URL
              </span>
              <Input
                id="blogIdOrUrl"
                placeholder="mym0404 또는 https://blog.naver.com/..."
                disabled={scanPending}
                value={blogIdOrUrl}
                onChange={(event) => handleBlogInputChange(event.target.value)}
              />
            </label>
            <p id="scan-status" className="scan-status-note text-sm leading-7 text-slate-600">
              {scanStatus}
            </p>
          </CardContent>
        </Card>
      )
    }

    if (currentStep === "category-selection") {
      return (
        <CategoryPanel
          scanResult={activeScanResult}
          selectedCategoryIds={selectedCategoryIds}
          categorySearch={categorySearch}
          categoryStatus={categoryStatus}
          categoryMode={options.scope.categoryMode}
          dateFrom={options.scope.dateFrom}
          dateTo={options.scope.dateTo}
          selectedCount={selectedCount}
          selectedPostCount={scopedPostCount}
          totalPostCount={activeScanResult?.totalPostCount ?? 0}
          onCategorySearchChange={setCategorySearch}
          onCategoryModeChange={(value) =>
            updateOptions((current) => ({
              ...current,
              scope: {
                ...current.scope,
                categoryMode: value,
              },
            }))
          }
          onDateFromChange={(value) =>
            updateOptions((current) => ({
              ...current,
              scope: {
                ...current.scope,
                dateFrom: value,
              },
            }))
          }
          onDateToChange={(value) =>
            updateOptions((current) => ({
              ...current,
              scope: {
                ...current.scope,
                dateTo: value,
              },
            }))
          }
          onSelectAll={handleSelectAllCategories}
          onClearAll={handleClearAllCategories}
          onCategoryToggle={handleCategoryToggle}
        />
      )
    }

    return (
      <ExportOptionsPanel
        step={optionStepMap[currentStep]}
        outputDir={outputDir}
        options={options}
        optionDescriptions={defaults.optionDescriptions}
        frontmatterFieldOrder={defaults.frontmatterFieldOrder}
        frontmatterFieldMeta={defaults.frontmatterFieldMeta}
        frontmatterValidationErrors={frontmatterValidationErrors}
        linkTemplatePreviewPost={linkTemplatePreviewPost}
        onOutputDirChange={setOutputDir}
        onOptionsChange={updateOptions}
      />
    )
  }

  return (
    <main className="dashboard-shell relative min-h-screen w-full overflow-x-clip">
      <div
        id="dashboard-backdrop"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(51,102,255,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(79,140,255,0.08),transparent_28%),linear-gradient(180deg,#f8fbff_0%,var(--background)_100%)]"
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 xl:px-6 xl:py-6">
        <Card className="overflow-hidden border-white/80 bg-white/92 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur">
          <CardContent className="grid gap-4 p-5">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="wizard-heading grid gap-1.5">
                <span className="wizard-step-label text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {isSetupStep ? `단계 ${setupStepIndex + 1} / ${setupSteps.length}` : "현재 단계"}
                </span>
                <div className="grid gap-1.5">
                  <h1 className="text-[clamp(1.7rem,2.5vw,2.4rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-slate-900">
                    {stepMeta[currentStep].title}
                  </h1>
                  {stepMeta[currentStep].description ? (
                    <p className="panel-description max-w-3xl text-sm leading-6 text-slate-600">
                      {stepMeta[currentStep].description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-start gap-3 lg:justify-end">
                <Badge
                  id="status-text"
                  className={statusPillClass(headerStatus)}
                  data-status={headerStatus}
                >
                  {headerStatus}
                </Badge>
              </div>
            </div>

            <div
              id="summary"
              className="wizard-summary-stats flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200/70 pt-2.5 text-sm text-slate-600"
              aria-live="polite"
            >
              {summaryCards.map((card) => (
                <span
                  key={card.label}
                  className="wizard-summary-metric inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
                >
                  <span className="shrink-0 text-slate-500">{card.label}</span>
                  <strong className="min-w-0 break-all font-semibold text-slate-900">
                    {card.value}
                  </strong>
                </span>
              ))}
            </div>

          </CardContent>
        </Card>

        <section
          ref={stepViewRef}
          className={cn(
            "grid gap-4",
            isSetupStep ? "pb-28 sm:pb-32" : "",
          )}
          data-step-view={currentStep}
        >
          {renderCurrentStep()}
        </section>
      </div>

      {isSetupStep ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:pb-5 xl:px-6">
          <div className="mx-auto flex w-full max-w-6xl justify-center">
            <div className="flex min-h-16 w-full max-w-fit flex-wrap items-center justify-end gap-2.5 rounded-[1.4rem] border border-white/90 bg-white/78 px-3 py-3 shadow-[0_20px_50px_rgba(22,33,50,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/72">
              {setupStepIndex > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 rounded-xl border border-slate-200/80 bg-white px-4 shadow-[0_1px_2px_rgba(22,33,50,0.06)]"
                  onClick={goToPreviousStep}
                >
                  이전
                </Button>
              ) : null}

              {setupStep === "blog-input" ? (
                <Button
                  type="button"
                  id="force-scan-button"
                  variant="secondary"
                  className="h-10 rounded-xl border border-slate-200/80 bg-white px-4 shadow-[0_1px_2px_rgba(22,33,50,0.06)]"
                  title="캐시 무효화"
                  disabled={!currentScanTarget || scanPending}
                  onClick={() => {
                    void ensureScanResult({ forceRefresh: true })
                  }}
                >
                  강제로 불러오기
                </Button>
              ) : null}

              <Button
                type="button"
                id={
                  setupStep === "blog-input"
                    ? "scan-button"
                    : setupStep === "diagnostics-options"
                      ? "export-button"
                      : undefined
                }
                className="h-10 rounded-xl px-4 shadow-[0_10px_24px_rgba(51,102,255,0.24)]"
                disabled={
                  setupStep === "blog-input"
                    ? scanPending
                    : setupStep === "diagnostics-options"
                      ? exportDisabled || submitting
                      : false
                }
                onClick={() => {
                  void goToNextStep()
                }}
              >
                <i
                  className={cn(
                    setupStep === "blog-input"
                      ? scanPending
                        ? "ri-loader-4-line motion-safe:animate-spin"
                        : "ri-radar-line"
                      : setupStep === "diagnostics-options"
                        ? submitting
                          ? "ri-loader-4-line motion-safe:animate-spin"
                          : "ri-download-2-line"
                        : "ri-arrow-right-line",
                  )}
                  aria-hidden="true"
                />
                <span>{nextButtonLabel}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
