import {
  RiArrowRightLine,
  RiDownload2Line,
  RiLoader4Line,
  RiMoonClearLine,
  RiRadarLine,
  RiSunLine,
} from "@remixicon/react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  defaultExportOptions,
  type PartialExportOptions,
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
  ExportResumeSummary,
  ScanResult,
  ThemePreference,
  UploadProviderCatalogResponse,
  UploadProviderValue,
} from "../shared/types.js"

import { Badge } from "./components/ui/badge.js"
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert.js"
import { Button } from "./components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog.js"
import { Input } from "./components/ui/input.js"
import { Toaster, toast } from "./components/ui/sonner.js"
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group.js"
import { toggleCategorySelection } from "./features/scan/category-selection.js"
import { CategoryPanel } from "./features/scan/category-panel.js"
import {
  ExportOptionsPanel,
  type ExportOptionsStep,
} from "./features/options/export-options-panel.js"
import { JobResultsPanel } from "./features/job-results/job-results-panel.js"
import { setExportJobPollingConfig, useExportJob } from "./hooks/use-export-job.js"
import type {
  ExportBootstrapResponse,
  UploadProvidersResponse,
} from "./lib/api.js"
import { fetchJson, postJson, postJsonNoContent } from "./lib/api.js"
import { cn } from "./lib/cn.js"

const fallbackDefaults: ExportBootstrapResponse = {
  profile: "gfm",
  options: defaultExportOptions(),
  lastOutputDir: "./output",
  themePreference: "dark",
  resumedJob: null,
  resumeSummary: null,
  resumedScanResult: null,
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

const NextActionIcon = ({
  setupStep,
  scanPending,
  submitting,
}: {
  setupStep: SetupStep
  scanPending: boolean
  submitting: boolean
}) => {
  if (setupStep === "blog-input") {
    return scanPending ? (
      <RiLoader4Line className="size-4 motion-safe:animate-spin" aria-hidden="true" />
    ) : (
      <RiRadarLine className="size-4" aria-hidden="true" />
    )
  }

  if (setupStep === "diagnostics-options") {
    return submitting ? (
      <RiLoader4Line className="size-4 motion-safe:animate-spin" aria-hidden="true" />
    ) : (
      <RiDownload2Line className="size-4" aria-hidden="true" />
    )
  }

  return <RiArrowRightLine className="size-4" aria-hidden="true" />
}

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
    title: "Image Upload",
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
    resumeAvailable: false,
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
    "status-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
    status === "completed" || status === "upload-completed" || status === "ready"
      ? "status-pill--success"
      : status === "upload-ready"
        ? "status-pill--ready"
        : status === "running" || status === "queued" || status === "success" || status === "uploading"
          ? "status-pill--running"
          : status === "failed" || status === "upload-failed"
            ? "status-pill--error"
            : "status-pill--idle",
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

const getPersistedUiStateSignature = ({
  options,
  themePreference,
}: {
  options: ExportOptions | PartialExportOptions
  themePreference: ThemePreference
}) =>
  JSON.stringify({
    options: sanitizePersistedExportOptions(options),
    themePreference,
  })

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [uploadProviders, setUploadProviders] = useState(fallbackUploadProviders)
  const [uploadProviderError, setUploadProviderError] = useState<string | null>(null)
  const [resettingResume, setResettingResume] = useState(false)
  const [blogIdOrUrl, setBlogIdOrUrl] = useState("")
  const [outputDir, setOutputDir] = useState("./output")
  const [resumeDialog, setResumeDialog] = useState<ExportResumeSummary | null>(null)
  const [scanCache, setScanCache] = useState<Record<string, ScanResult>>({})
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    fallbackDefaults.themePreference,
  )
  const [options, setOptions] = useState<ExportOptions>(
    fallbackDefaults.options,
  )
  const [scanStatus, setScanStatus] = useState(
    "블로그를 아직 스캔하지 않았습니다.",
  )
  const [scanStatusTone, setScanStatusTone] = useState<"default" | "error">(
    "default",
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
  const {
    job,
    submitting,
    uploadSubmitting,
    hydrateJob,
    resumeJob,
    setJob,
    startJob,
    startUpload,
  } = useExportJob()
  const lastNotifiedJobKeyRef = useRef<string | null>(null)
  const stepViewRef = useRef<HTMLElement | null>(null)
  const previousStepRef = useRef<WizardStep | null>(null)
  const persistedUiStateSignatureRef = useRef<string | null>(null)
  const hasLoadedDefaultsRef = useRef(false)
  const latestPersistedOptionsRef = useRef(sanitizePersistedExportOptions(fallbackDefaults.options))
  const latestThemePreferenceRef = useRef<ThemePreference>(fallbackDefaults.themePreference)
  const setNeutralScanStatus = (message: string) => {
    setScanStatus(message)
    setScanStatusTone("default")
  }
  const setErrorScanStatus = (message: string) => {
    setScanStatus(message)
    setScanStatusTone("error")
  }

  const applyBootstrapState = (nextDefaults: ExportBootstrapResponse) => {
    setDefaults(nextDefaults)
    setOptions(nextDefaults.resumedJob?.request.options ?? nextDefaults.options)
    setOutputDir(nextDefaults.resumedJob?.request.outputDir ?? nextDefaults.lastOutputDir)
    setThemePreference(nextDefaults.themePreference)
    setBlogIdOrUrl(nextDefaults.resumedJob?.request.blogIdOrUrl ?? "")
    setCategorySearch("")
    setSetupStep("blog-input")
    setActiveJobFilter("all")
    setScanPending(false)

    if (nextDefaults.resumedScanResult) {
      setScanCache({
        [nextDefaults.resumedScanResult.blogId]: nextDefaults.resumedScanResult,
      })
      setNeutralScanStatus(`${nextDefaults.resumedScanResult.blogId} 스캔 결과 재개`)
      setCategoryStatus("이전 작업 상태를 복구했습니다.")
    } else {
      setScanCache({})
      setNeutralScanStatus("블로그를 아직 스캔하지 않았습니다.")
      setCategoryStatus("스캔 후 카테고리를 선택할 수 있습니다.")
    }

    if (nextDefaults.resumedJob) {
      lastNotifiedJobKeyRef.current = `${nextDefaults.resumedJob.id}:${nextDefaults.resumedJob.status}:${nextDefaults.resumedJob.finishedAt ?? ""}`
      hydrateJob(nextDefaults.resumedJob)
      setResumeDialog(nextDefaults.resumeSummary)
      return
    }

    lastNotifiedJobKeyRef.current = null
    hydrateJob(null)
    setResumeDialog(null)
  }

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
    job?.status === "upload-ready" ||
    job?.status === "upload-failed" ||
    (job?.status === "uploading" && job.resumeAvailable)
  const persistedOptions = useMemo(() => sanitizePersistedExportOptions(options), [options])
  const persistedUiStateSignature = useMemo(
    () =>
      JSON.stringify({
        options: persistedOptions,
        themePreference,
      }),
    [persistedOptions, themePreference],
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
    const root = document.documentElement
    root.classList.remove("dark", "light")
    root.classList.add(themePreference)
    root.style.colorScheme = themePreference
    latestThemePreferenceRef.current = themePreference
  }, [themePreference])

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
        const nextDefaults = await fetchJson<ExportBootstrapResponse>("/api/export-defaults")

        if (cancelled) {
          return
        }

        const nextPersistedOptions = sanitizePersistedExportOptions(nextDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        latestThemePreferenceRef.current = nextDefaults.themePreference
        setExportJobPollingConfig(nextDefaults.jobPolling)
        persistedUiStateSignatureRef.current = getPersistedUiStateSignature({
          options: nextDefaults.options,
          themePreference: nextDefaults.themePreference,
        })
        hasLoadedDefaultsRef.current = true
        applyBootstrapState(nextDefaults)
        setBootstrapping(false)
      } catch (error) {
        if (cancelled) {
          return
        }

        const nextPersistedOptions = sanitizePersistedExportOptions(fallbackDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        latestThemePreferenceRef.current = fallbackDefaults.themePreference
        setExportJobPollingConfig(fallbackDefaults.jobPolling)
        persistedUiStateSignatureRef.current = getPersistedUiStateSignature({
          options: fallbackDefaults.options,
          themePreference: fallbackDefaults.themePreference,
        })
        hasLoadedDefaultsRef.current = true
        applyBootstrapState(fallbackDefaults)
        setErrorScanStatus(error instanceof Error ? error.message : String(error))
        setBootstrapping(false)
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

    if (persistedUiStateSignature === persistedUiStateSignatureRef.current) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      const nextThemePreference = latestThemePreferenceRef.current
      const nextOptions = latestPersistedOptionsRef.current
      const nextPersistedSignature = getPersistedUiStateSignature({
        options: nextOptions,
        themePreference: nextThemePreference,
      })

      void postJsonNoContent("/api/export-settings", {
        options: nextOptions,
        themePreference: nextThemePreference,
      })
        .then(() => {
          if (cancelled) {
            return
          }

          persistedUiStateSignatureRef.current = nextPersistedSignature
        })
        .catch(() => {})
    }, exportSettingsSaveDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [persistedUiStateSignature])

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
      toast("내보내기가 끝났습니다. Image Upload를 시작할 수 있습니다.", {
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
      toast.success("Image Upload까지 완료되었습니다.", {
        description: `업로드 ${job.upload.uploadedCount}개`,
      })
      return
    }

    if (job.status === "upload-failed") {
      toast.error("Image Upload에 실패했습니다.", {
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
      setErrorScanStatus("블로그 ID 또는 URL을 입력하세요.")
      return false
    }

    if (activeScanResult && !forceRefresh) {
      setNeutralScanStatus(`${activeScanResult.blogId} 스캔 결과를 재사용합니다.`)
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
    setNeutralScanStatus(forceRefresh ? "캐시를 무효화하고 카테고리를 다시 불러오는 중입니다." : "카테고리를 스캔하는 중입니다.")
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
      setNeutralScanStatus(`${nextScanResult.blogId} 스캔 완료`)
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
      setErrorScanStatus(message)
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
      setNeutralScanStatus("캐시된 카테고리를 다시 사용할 수 있습니다.")
      setCategoryStatus("내보낼 카테고리를 선택하세요.")
      return
    }

    setNeutralScanStatus(
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
      toast("Image Upload를 시작했습니다.", {
        description: "현재 단계에서 진행률을 확인할 수 있습니다.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("Image Upload를 시작하지 못했습니다.", {
        description: message,
      })
    }
  }

  const handleResumeExport = async () => {
    try {
      await resumeJob()
      toast("남은 내보내기를 다시 시작했습니다.", {
        description: "이전 진행 상태를 이어서 처리합니다.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("내보내기를 다시 시작하지 못했습니다.", {
        description: message,
      })
    }
  }

  const handleResetResume = async () => {
    if (!resumeDialog) {
      return
    }

    const confirmed = window.confirm(
      `${resumeDialog.outputDir} 경로의 작업내역과 output 파일을 모두 삭제하고 초기화할까요?`,
    )

    if (!confirmed) {
      return
    }

    setResettingResume(true)

    try {
      const nextDefaults = await postJson<ExportBootstrapResponse>("/api/export-reset", {
        outputDir: resumeDialog.outputDir,
        jobId: job?.id ?? null,
      })
      const nextPersistedOptions = sanitizePersistedExportOptions(nextDefaults.options)

      latestPersistedOptionsRef.current = nextPersistedOptions
      latestThemePreferenceRef.current = nextDefaults.themePreference
      persistedUiStateSignatureRef.current = getPersistedUiStateSignature({
        options: nextDefaults.options,
        themePreference: nextDefaults.themePreference,
      })
      applyBootstrapState(nextDefaults)
      toast.success("이전 작업을 초기화했습니다.", {
        description: `${resumeDialog.outputDir} 작업내역을 삭제했습니다.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("작업 초기화에 실패했습니다.", {
        description: message,
      })
    } finally {
      setResettingResume(false)
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
          resumeSubmitting={submitting}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onResumeExport={handleResumeExport}
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
          resumeSubmitting={submitting}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onResumeExport={handleResumeExport}
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
          resumeSubmitting={submitting}
          uploadSubmitting={uploadSubmitting}
          uploadProviders={uploadProviders}
          uploadProviderError={uploadProviderError}
          onFilterChange={setActiveJobFilter}
          onResumeExport={handleResumeExport}
          onUploadStart={handleUpload}
        />
      )
    }

    if (currentStep === "blog-input") {
      return (
        <Card variant="panel" className="hero-panel overflow-hidden">
          <CardHeader className="panel-header gap-4 p-6">
            <div className="space-y-2">
              <CardTitle className="section-title text-2xl">
                블로그 ID 또는 URL
              </CardTitle>
              <CardDescription className="panel-description max-w-3xl text-sm leading-7">
                네이버 블로그 ID나 주소를 입력하면 카테고리를 불러옵니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-foreground">
                블로그 ID 또는 URL
              </span>
              <Input
                id="blogIdOrUrl"
                placeholder="mym0404 또는 https://blog.naver.com/..."
                disabled={scanPending}
                value={blogIdOrUrl}
                aria-invalid={scanStatusTone === "error" || undefined}
                className={
                  scanStatusTone === "error"
                    ? "border-[var(--destructive)] shadow-[var(--panel-shadow-border),0_0_0_1px_color-mix(in_srgb,var(--destructive)_18%,transparent)]"
                    : undefined
                }
                onChange={(event) => handleBlogInputChange(event.target.value)}
              />
            </label>
            <p
              id="scan-status"
              className={cn(
                "scan-status-note text-sm leading-7",
                scanStatusTone === "error" && "danger-copy",
              )}
            >
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
    <main
      className={cn("dashboard-shell relative min-h-screen w-full overflow-x-clip", themePreference)}
      aria-busy={bootstrapping || undefined}
    >
      <Dialog open={Boolean(resumeDialog)} onOpenChange={(open) => (!open ? setResumeDialog(null) : null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>이전 작업을 다시 불러왔습니다.</DialogTitle>
            <DialogDescription>
              output 상태를 읽어 마지막 작업 화면으로 복구했습니다.
            </DialogDescription>
          </DialogHeader>
          {resumeDialog ? (
            <div className="grid gap-3">
              <div className="subtle-panel grid gap-2 rounded-[var(--radius-lg)] px-4 py-4 text-sm text-foreground">
                <p>
                  <strong className="font-semibold text-foreground">상태</strong> {resumeDialog.status}
                </p>
                <p>
                  <strong className="font-semibold text-foreground">출력 경로</strong> {resumeDialog.outputDir}
                </p>
                <p>
                  <strong className="font-semibold text-foreground">진행</strong> 총 {resumeDialog.totalPosts} / 완료 {resumeDialog.completedCount} / 실패 {resumeDialog.failedCount}
                </p>
                <p>
                  <strong className="font-semibold text-foreground">업로드</strong> {resumeDialog.uploadedCount} / {resumeDialog.uploadCandidateCount}
                </p>
              </div>
              <Alert variant="destructive">
                <AlertTitle>초기화 경고</AlertTitle>
                <AlertDescription>
                  작업 초기화를 실행하면 <strong>{resumeDialog.outputDir}</strong> 경로의 작업내역과 output 파일을 함께 삭제합니다.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          <DialogFooter showCloseButton closeButtonLabel="확인">
            <Button variant="destructive" onClick={() => void handleResetResume()} disabled={resettingResume}>
              {resettingResume ? "초기화 중" : "작업 초기화"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        id="dashboard-backdrop"
        className="shell-backdrop pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      />

      {bootstrapping ? (
        <section className="fixed inset-0 z-50 grid place-items-center px-4 py-6" data-step-view="bootstrap-loading">
          <div className="absolute inset-0 bg-background/78 backdrop-blur-[6px]" aria-hidden="true" />
          <Card variant="panel" className="relative w-full max-w-xl overflow-hidden">
            <CardContent className="grid gap-4 px-6 py-8 sm:px-8 sm:py-10">
              <div
                className="grid justify-items-center gap-4 text-center"
                role="status"
                aria-live="polite"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-[var(--panel-shadow-border)]">
                  <RiLoader4Line className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                </span>
                <div className="grid gap-1.5">
                  <h1 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                    작업 상태를 확인하는 중입니다.
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    이전 작업을 다시 불러올지, 새로 시작할지 확인하고 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 xl:px-6 xl:py-6">
        <Card variant="panel" className="overflow-hidden">
          <CardContent className="grid gap-4 p-5">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="wizard-heading grid gap-1.5">
                <span className="wizard-step-label wizard-kicker">
                  {isSetupStep ? `단계 ${setupStepIndex + 1} / ${setupSteps.length}` : "현재 단계"}
                </span>
                <div className="grid gap-1.5">
                  <h1 className="wizard-title text-[clamp(1.7rem,2.5vw,2.4rem)] leading-[1.04]">
                    {stepMeta[currentStep].title}
                  </h1>
                  {stepMeta[currentStep].description ? (
                    <p className="panel-description max-w-3xl text-sm leading-6">
                      {stepMeta[currentStep].description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
                <ToggleGroup
                  className="theme-toggle rounded-full p-1"
                  aria-label="테마 선택"
                  value={themePreference}
                  onValueChange={(value) => {
                    if (value === "dark" || value === "light") {
                      setThemePreference(value)
                    }
                  }}
                >
                  <ToggleGroupItem
                    aria-label="다크"
                    className="theme-toggle-item size-8 p-0"
                    title="다크"
                    value="dark"
                  >
                    <RiMoonClearLine data-theme-icon aria-hidden="true" />
                    <span className="sr-only">다크</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    aria-label="라이트"
                    className="theme-toggle-item size-8 p-0"
                    title="라이트"
                    value="light"
                  >
                    <RiSunLine data-theme-icon aria-hidden="true" />
                    <span className="sr-only">라이트</span>
                  </ToggleGroupItem>
                </ToggleGroup>
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
              className="wizard-summary-stats flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {summaryCards.map((card) => (
                <span
                  key={card.label}
                  className="wizard-summary-metric inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
                >
                  <span className="shrink-0 text-muted-foreground">{card.label}</span>
                  <strong className="metric-value min-w-0 break-all font-semibold">
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
            <div className="floating-dock flex min-h-16 w-full max-w-fit flex-wrap items-center justify-end gap-2.5 rounded-[1.4rem] px-3 py-3">
              {setupStepIndex > 0 ? (
                <Button
                  type="button"
                  variant="surface"
                  className="h-10 rounded-xl px-4"
                  onClick={goToPreviousStep}
                >
                  이전
                </Button>
              ) : null}

              {setupStep === "blog-input" ? (
                <Button
                  type="button"
                  id="force-scan-button"
                  variant="surface"
                  className="h-10 rounded-xl px-4"
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
                className="h-10 rounded-xl px-4"
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
                <NextActionIcon
                  setupStep={setupStep}
                  scanPending={scanPending}
                  submitting={submitting}
                />
                <span>{nextButtonLabel}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <Toaster theme={themePreference} />
    </main>
  )
}
