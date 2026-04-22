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
import { Button } from "./components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card.js"
import { Input } from "./components/ui/input.js"
import { ResumeDialogPanel } from "./components/resume-dialog-panel.js"
import { WizardDock } from "./components/wizard-dock.js"
import { WizardHeader } from "./components/wizard-header.js"
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
  ExportResumeLookupResponse,
} from "./lib/api.js"
import { fetchJson, postJson, postJsonNoContent } from "./lib/api.js"
import { cn } from "./lib/cn.js"
import {
  buildSummaryCards,
  createResumeDialogState,
  defaultOutputDir,
  getHeaderStatus,
  getNextButtonLabel,
  getPersistedUiStateSignature,
  normalizeOutputDir,
  resolveScopedCategoryIds,
  resolveWizardStep,
  shouldLoadUploadProviders,
  type ResumeDialogState,
} from "./app-helpers.js"
import { getStatusPillClassName } from "./lib/status-pill.js"
import { useUploadProvidersCatalog } from "./hooks/use-upload-providers-catalog.js"

const fallbackDefaults: ExportBootstrapResponse = {
  profile: "gfm",
  options: defaultExportOptions(),
  lastOutputDir: defaultOutputDir,
  themePreference: "dark",
  resumedJob: null,
  resumeSummary: null,
  resumedScanResult: null,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
}

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
    description: "블로그 ID와 출력 경로를 정한 뒤 카테고리를 불러옵니다.",
  },
  "category-selection": {
    title: "카테고리 선택",
    description: "내보낼 카테고리와 범위 조건을 정합니다.",
  },
  "structure-options": {
    title: "구조 설정",
    description: "폴더 구조와 파일 이름 규칙을 정합니다.",
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

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [resettingResume, setResettingResume] = useState(false)
  const [restoringResume, setRestoringResume] = useState(false)
  const [blogIdOrUrl, setBlogIdOrUrl] = useState("")
  const [outputDir, setOutputDir] = useState(defaultOutputDir)
  const [resumeDialog, setResumeDialog] = useState<ResumeDialogState | null>(null)
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
  const applyResumedState = ({
    source,
    resumedJob,
    resumeSummary,
    resumedScanResult,
  }: {
    source: ResumeDialogState["source"]
    resumedJob: ExportJobState
    resumeSummary: ExportResumeSummary
    resumedScanResult: ScanResult | null
  }) => {
    setDefaults((current) => ({
      ...current,
      lastOutputDir: resumedJob.request.outputDir,
      resumedJob,
      resumeSummary,
      resumedScanResult,
    }))
    setOptions(resumedJob.request.options)
    setOutputDir(normalizeOutputDir(resumedJob.request.outputDir))
    setBlogIdOrUrl(resumedJob.request.blogIdOrUrl)
    setCategorySearch("")
    setSetupStep("blog-input")
    setActiveJobFilter("all")
    setScanPending(false)

    if (resumedScanResult) {
      setScanCache((current) => ({
        ...current,
        [resumedScanResult.blogId]: resumedScanResult,
      }))
      setNeutralScanStatus(`${resumedScanResult.blogId} 스캔 결과 재개`)
      setCategoryStatus("이전 작업 상태를 복구했습니다.")
    } else {
      setScanCache({})
      setNeutralScanStatus("이전 작업 상태를 복구했습니다.")
      setCategoryStatus("복구된 작업 상태를 확인하세요.")
    }

    lastNotifiedJobKeyRef.current = `${resumedJob.id}:${resumedJob.status}:${resumedJob.finishedAt ?? ""}`
    hydrateJob(resumedJob)
    setResumeDialog(
      source === "bootstrap"
        ? createResumeDialogState({
            source,
            resumedJob,
            resumeSummary,
            resumedScanResult,
          })
        : null,
    )
  }

  const applyBootstrapState = (nextDefaults: ExportBootstrapResponse) => {
    setDefaults(nextDefaults)
    setOptions(nextDefaults.resumedJob?.request.options ?? nextDefaults.options)
    setOutputDir(normalizeOutputDir(nextDefaults.resumedJob?.request.outputDir ?? nextDefaults.lastOutputDir))
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

    if (nextDefaults.resumedJob && nextDefaults.resumeSummary) {
      applyResumedState({
        source: "bootstrap",
        resumedJob: nextDefaults.resumedJob,
        resumeSummary: nextDefaults.resumeSummary,
        resumedScanResult: nextDefaults.resumedScanResult,
      })
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
  const persistedOptions = useMemo(() => sanitizePersistedExportOptions(options), [options])
  const persistedUiStateSignature = useMemo(
    () =>
      JSON.stringify({
        options: persistedOptions,
        themePreference,
      }),
    [persistedOptions, themePreference],
  )
  const outputDirBaseline = normalizeOutputDir(defaults.resumedJob?.request.outputDir ?? defaults.lastOutputDir)
  const shouldWarnBeforeUnload =
    !bootstrapping &&
    (blogIdOrUrl.trim().length > 0 ||
      normalizeOutputDir(outputDir) !== outputDirBaseline ||
      activeScanResult !== null ||
      Boolean(job))

  const currentStep = useMemo(
    () =>
      resolveWizardStep({
        setupStep,
        jobStatus: job?.status,
        submitting,
        uploadSubmitting,
      }) as WizardStep,
    [job?.status, setupStep, submitting, uploadSubmitting],
  )

  const isSetupStep = currentStep === setupStep
  const { uploadProviders, uploadProviderError } = useUploadProvidersCatalog({
    jobId: job?.id,
    shouldLoad: shouldLoadUploadProviders(job),
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark", "light")
    root.classList.add(themePreference)
    root.style.colorScheme = themePreference
    latestThemePreferenceRef.current = themePreference
  }, [themePreference])

  useEffect(() => {
    const root = document.documentElement
    let frameId = 0

    const updateBrandMarkScale = () => {
      frameId = 0

      const scrollRange = Math.max(window.innerHeight * 0.75, 320)
      const progress = Math.min(window.scrollY / scrollRange, 1)
      const nextScale = 1.04 - progress * 0.12

      root.style.setProperty("--brand-mark-scroll-scale", nextScale.toFixed(3))
    }

    const requestScaleUpdate = () => {
      if (frameId !== 0) {
        return
      }

      frameId = window.requestAnimationFrame(updateBrandMarkScale)
    }

    requestScaleUpdate()
    window.addEventListener("scroll", requestScaleUpdate, { passive: true })
    window.addEventListener("resize", requestScaleUpdate)

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }

      window.removeEventListener("scroll", requestScaleUpdate)
      window.removeEventListener("resize", requestScaleUpdate)
      root.style.removeProperty("--brand-mark-scroll-scale")
    }
  }, [])

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

  useEffect(() => {
    if (!shouldWarnBeforeUnload) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [shouldWarnBeforeUnload])

  const updateOptions = (
    updater: (current: ExportOptions) => ExportOptions,
  ) => {
    setOptions((current) => updater(current))
  }

  const ensureScanResult = async ({
    forceRefresh = false,
    skipResumeLookup = false,
  }: {
    forceRefresh?: boolean
    skipResumeLookup?: boolean
  } = {}) => {
    if (!currentScanTarget) {
      setErrorScanStatus("블로그 ID 또는 URL을 입력하세요.")
      return false
    }

    const normalizedOutputDir = normalizeOutputDir(outputDir)

    if (!forceRefresh && !skipResumeLookup) {
      setScanPending(true)
      setNeutralScanStatus("기존 작업 상태를 확인하는 중입니다.")
      setCategoryStatus("출력 경로의 manifest.json 상태를 확인하는 중입니다.")

      try {
        const resumed = await postJson<ExportResumeLookupResponse>("/api/export-resume/lookup", {
          outputDir: normalizedOutputDir,
        })
        const nextResumeDialog = createResumeDialogState({
          source: "before-scan",
          resumedJob: resumed.resumedJob,
          resumeSummary: resumed.resumeSummary,
          resumedScanResult: resumed.resumedScanResult,
        })

        if (nextResumeDialog) {
          setResumeDialog(nextResumeDialog)
          setNeutralScanStatus("이 경로에서 이어서 불러올 작업을 찾았습니다.")
          setCategoryStatus("작업 초기화 또는 불러오기 중 하나를 선택하세요.")
          return false
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setErrorScanStatus(message)
        setCategoryStatus("작업 상태 확인에 실패했습니다. 다시 시도하세요.")
        toast.error("작업 상태 확인에 실패했습니다.", {
          description: message,
        })
        return false
      } finally {
        setScanPending(false)
      }
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

  const handleOutputDirBlur = () => {
    setOutputDir((current) => normalizeOutputDir(current))
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
        outputDir: normalizeOutputDir(outputDir),
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
          outputDir: normalizeOutputDir(outputDir),
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

  const handleRestoreResume = async () => {
    if (!resumeDialog) {
      return
    }

    if (resumeDialog.source === "bootstrap") {
      setResumeDialog(null)
      return
    }

    setRestoringResume(true)

    try {
      const restored = await postJson<ExportResumeLookupResponse>("/api/export-resume/restore", {
        outputDir: resumeDialog.resumeSummary.outputDir,
      })

      if (!restored.resumedJob || !restored.resumeSummary) {
        throw new Error("불러올 수 있는 작업 상태를 찾지 못했습니다.")
      }

      applyResumedState({
        source: "before-scan",
        resumedJob: restored.resumedJob,
        resumeSummary: restored.resumeSummary,
        resumedScanResult: restored.resumedScanResult,
      })
      toast.success("이전 작업을 다시 불러왔습니다.", {
        description: `${restored.resumeSummary.outputDir} 작업 상태를 복구했습니다.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("이전 작업을 불러오지 못했습니다.", {
        description: message,
      })
    } finally {
      setRestoringResume(false)
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

    setResettingResume(true)

    try {
      const nextDefaults = await postJson<ExportBootstrapResponse>("/api/export-reset", {
        outputDir: resumeDialog.resumeSummary.outputDir,
        jobId: resumeDialog.resumedJob.id,
      })

      if (resumeDialog.source === "bootstrap") {
        const nextPersistedOptions = sanitizePersistedExportOptions(nextDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        latestThemePreferenceRef.current = nextDefaults.themePreference
        persistedUiStateSignatureRef.current = getPersistedUiStateSignature({
          options: nextDefaults.options,
          themePreference: nextDefaults.themePreference,
        })
        applyBootstrapState(nextDefaults)
      } else {
        setResumeDialog(null)
        hydrateJob(null)
        await ensureScanResult({
          skipResumeLookup: true,
        })
      }

      toast.success("이전 작업을 초기화했습니다.", {
        description: `${resumeDialog.resumeSummary.outputDir} 작업내역을 삭제했습니다.`,
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

  const summaryCards = buildSummaryCards({
    currentStep,
    job,
    scopedPostCount,
    activeCategoryCount: activeScanResult?.categories.length ?? 0,
    selectedCount,
    outputDir,
  })
  const headerStatus = getHeaderStatus({
    job,
    scanPending,
    activeScanResult,
  })
  const nextButtonLabel = getNextButtonLabel({
    setupStep,
    scanPending,
    submitting,
  })

  const renderCurrentStep = () => {
    if (currentStep === "running" || currentStep === "upload" || currentStep === "result") {
      return (
        <JobResultsPanel
          mode={currentStep}
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
                네이버 블로그 ID나 주소와 결과를 저장할 경로를 먼저 정합니다.
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
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-foreground">출력 경로</span>
              <Input
                id="outputDir"
                value={outputDir}
                required
                onChange={(event) => setOutputDir(event.target.value)}
                onBlur={handleOutputDirBlur}
              />
              <small className="text-sm leading-6 text-muted-foreground">
                결과를 저장할 위치입니다.
              </small>
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
      <ResumeDialogPanel
        resumeDialog={resumeDialog}
        resettingResume={resettingResume}
        restoringResume={restoringResume}
        onReset={() => void handleResetResume()}
        onRestore={() => void handleRestoreResume()}
      />

      <div
        id="dashboard-backdrop"
        className="shell-backdrop pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      />
      <div className="dashboard-brand-mark pointer-events-none fixed inset-x-0 z-0" aria-hidden="true">
        <img src="/brand/logo.svg" alt="" />
      </div>

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

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 xl:px-6 xl:py-6">
        <WizardHeader
          isSetupStep={isSetupStep}
          setupStepIndex={setupStepIndex}
          setupStepCount={setupSteps.length}
          title={stepMeta[currentStep].title}
          description={stepMeta[currentStep].description}
          themePreference={themePreference}
          headerStatus={headerStatus}
          summaryCards={summaryCards}
          onThemeChange={setThemePreference}
        />

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

      <WizardDock
        isSetupStep={isSetupStep}
        setupStep={setupStep}
        setupStepIndex={setupStepIndex}
        currentScanTarget={currentScanTarget}
        scanPending={scanPending}
        exportDisabled={exportDisabled}
        submitting={submitting}
        nextButtonLabel={nextButtonLabel}
        nextActionIcon={
          <NextActionIcon
            setupStep={setupStep}
            scanPending={scanPending}
            submitting={submitting}
          />
        }
        onPrevious={goToPreviousStep}
        onForceScan={() => {
          void ensureScanResult({ forceRefresh: true })
        }}
        onNext={() => {
          void goToNextStep()
        }}
      />
      <Toaster theme={themePreference} />
    </main>
  )
}
