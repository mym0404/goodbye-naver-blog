import { RiLoader4Line } from "@remixicon/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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
  ExportOptions,
  ScanCacheMap,
  ScanResult,
  ThemePreference,
  UploadProviderFields,
} from "../shared/types.js"
import { Card, CardContent } from "./components/ui/card.js"
import { Toaster, toast } from "./components/ui/sonner.js"
import { BlogInputPanel } from "./features/scan/blog-input-panel.js"
import { toggleCategorySelection } from "./features/scan/category-selection.js"
import { CategoryPanel } from "./features/scan/category-panel.js"
import {
  defaultCategoryStatus,
  defaultOutputDir,
  defaultScanStatus,
  normalizeOutputDir,
  restoredCategoryFallbackStatus,
  restoredCategoryStatus,
  restoredScanStatus,
} from "./features/scan/scan-status.js"
import { ExportOptionsPanel } from "./features/options/export-options-panel.js"
import { JobResultsPanel } from "./features/job-results/job-results-panel.js"
import { shouldLoadUploadProviders } from "./features/job-results/export-job-fallback.js"
import { setExportJobPollingConfig, useExportJob } from "./features/job-results/use-export-job.js"
import { useJobNotifications } from "./features/job-results/use-job-notifications.js"
import { ResumeDialogPanel } from "./features/resume/resume-dialog-panel.js"
import type { ResumeDialogState } from "./features/resume/resume-state.js"
import { useBeforeUnloadWarning } from "./features/common/hooks/use-before-unload-warning.js"
import { useBootstrapDefaults } from "./features/common/hooks/use-bootstrap-defaults.js"
import { useBrandMarkScroll } from "./features/common/hooks/use-brand-mark-scroll.js"
import { useExportSettingsSync } from "./features/common/hooks/use-export-settings-sync.js"
import { useStepScroll } from "./features/common/hooks/use-step-scroll.js"
import { useThemePreference } from "./features/common/hooks/use-theme-preference.js"
import { useWizardActions } from "./features/common/hooks/use-wizard-actions.js"
import {
  buildSummaryCards,
  getHeaderStatus,
  getNextButtonLabel,
  getPersistedUiStateSignature,
  NextActionIcon,
  optionStepMap,
  resolveWizardStep,
  setupSteps,
  stepMeta,
  type SetupStep,
  type WizardStep,
} from "./features/common/shell/wizard-flow.js"
import { WizardDock } from "./features/common/shell/wizard-dock.js"
import { WizardHeader } from "./features/common/shell/wizard-header.js"
import type { ExportBootstrapResponse } from "./lib/api.js"
import { cn } from "./lib/cn.js"
import { useUploadProvidersCatalog } from "./features/job-results/use-upload-providers-catalog.js"

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

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [resettingResume, setResettingResume] = useState(false)
  const [restoringResume, setRestoringResume] = useState(false)
  const [blogIdOrUrl, setBlogIdOrUrl] = useState("")
  const [outputDir, setOutputDir] = useState(defaultOutputDir)
  const [resumeDialog, setResumeDialog] = useState<ResumeDialogState | null>(null)
  const [scanCache, setScanCache] = useState<ScanCacheMap>({})
  const [themePreference, setThemePreference] = useState<ThemePreference>(fallbackDefaults.themePreference)
  const [options, setOptions] = useState<ExportOptions>(fallbackDefaults.options)
  const [scanStatus, setScanStatus] = useState(defaultScanStatus)
  const [scanStatusTone, setScanStatusTone] = useState<"default" | "error">("default")
  const [categoryStatus, setCategoryStatus] = useState(defaultCategoryStatus)
  const [categorySearch, setCategorySearch] = useState("")
  const [scanPending, setScanPending] = useState(false)
  const [setupStep, setSetupStep] = useState<SetupStep>("blog-input")
  const [activeJobFilter, setActiveJobFilter] = useState<"all" | "warnings" | "errors">("all")
  const { job, submitting, uploadSubmitting, hydrateJob, resumeJob, setJob, startJob, startUpload } = useExportJob()

  const lastNotifiedJobKeyRef = useRef<string | null>(null)
  const stepViewRef = useRef<HTMLElement | null>(null)
  const previousStepRef = useRef<string | null>(null)
  const persistedUiStateSignatureRef = useRef<string | null>(null)
  const hasLoadedDefaultsRef = useRef(false)
  const hasUserInteractedRef = useRef(false)
  const latestPersistedOptionsRef = useRef(sanitizePersistedExportOptions(fallbackDefaults.options))
  const latestThemePreferenceRef = useRef<ThemePreference>(fallbackDefaults.themePreference)

  const setNeutralScanStatus = useCallback((message: string) => {
    setScanStatus(message)
    setScanStatusTone("default")
  }, [])

  const setErrorScanStatus = useCallback((message: string) => {
    setScanStatus(message)
    setScanStatusTone("error")
  }, [])

  const applyResumedState = useCallback(({
    source,
    resumedJob,
    resumeSummary,
    resumedScanResult,
  }: {
    source: ResumeDialogState["source"]
    resumedJob: NonNullable<ExportBootstrapResponse["resumedJob"]>
    resumeSummary: NonNullable<ExportBootstrapResponse["resumeSummary"]>
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
      setCategoryStatus(restoredCategoryStatus)
    } else {
      setScanCache({})
      setNeutralScanStatus(restoredScanStatus)
      setCategoryStatus(restoredCategoryFallbackStatus)
    }

    lastNotifiedJobKeyRef.current = `${resumedJob.id}:${resumedJob.status}:${resumedJob.finishedAt ?? ""}`
    hydrateJob(resumedJob)
    setResumeDialog(
      source === "bootstrap"
        ? {
            source,
            resumedJob,
            resumeSummary,
            resumedScanResult,
          }
        : null,
    )
  }, [hydrateJob])

  const applyBootstrapState = useCallback((nextDefaults: ExportBootstrapResponse) => {
    setDefaults(nextDefaults)
    setThemePreference(nextDefaults.themePreference)

    if (hasUserInteractedRef.current && !nextDefaults.resumedJob && !nextDefaults.resumedScanResult) {
      return
    }

    setOptions(nextDefaults.resumedJob?.request.options ?? nextDefaults.options)
    setOutputDir(normalizeOutputDir(nextDefaults.resumedJob?.request.outputDir ?? nextDefaults.lastOutputDir))
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
      setCategoryStatus(restoredCategoryStatus)
    } else {
      setScanCache({})
      setNeutralScanStatus(defaultScanStatus)
      setCategoryStatus(defaultCategoryStatus)
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
  }, [applyResumedState, hydrateJob])

  const currentScanTarget = blogIdOrUrl.trim()
  const activeScanResult = currentScanTarget ? scanCache[currentScanTarget] ?? null : null
  const frontmatterValidationErrors = useMemo(
    () => validateFrontmatterAliases(options.frontmatter),
    [options.frontmatter],
  )
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
  const exportDisabled =
    !activeScanResult ||
    frontmatterValidationErrors.length > 0
  const setupStepIndex = setupSteps.indexOf(setupStep)
  const persistedOptions = useMemo(() => sanitizePersistedExportOptions(options), [options])
  const persistedUiStateSignature = useMemo(
    () => getPersistedUiStateSignature({ options: persistedOptions, themePreference }),
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

  useThemePreference(themePreference)
  useBrandMarkScroll()
  useStepScroll({
    currentStep,
    isSetupStep,
    previousStepRef,
    stepViewRef,
  })
  useBootstrapDefaults({
    fallbackDefaults,
    applyBootstrapState,
    setBootstrapping,
    setErrorScanStatus,
    setExportJobPollingConfig,
    hasLoadedDefaultsRef,
    latestPersistedOptionsRef,
    latestThemePreferenceRef,
    persistedUiStateSignatureRef,
  })
  useExportSettingsSync({
    hasLoadedDefaultsRef,
    persistedUiStateSignature,
    persistedUiStateSignatureRef,
    latestPersistedOptionsRef,
    latestThemePreferenceRef,
  })
  useJobNotifications({
    job,
    lastNotifiedJobKeyRef,
  })
  useBeforeUnloadWarning(shouldWarnBeforeUnload)

  useEffect(() => {
    latestPersistedOptionsRef.current = persistedOptions
  }, [persistedOptions])

  useEffect(() => {
    latestThemePreferenceRef.current = themePreference
  }, [themePreference])

  const updateOptions = useCallback((updater: (current: ExportOptions) => ExportOptions) => {
    hasUserInteractedRef.current = true
    setOptions((current) => updater(current))
  }, [])

  const {
    ensureScanResult,
    handleBlogInputChange,
    handleOutputDirChange,
    handleOutputDirBlur,
    handleCategoryToggle,
    handleSelectAllCategories,
    handleClearAllCategories,
    handleUpload,
    handleRestoreResume,
    handleResumeExport,
    handleResetResume,
    goToPreviousStep,
    goToNextStep,
  } = useWizardActions({
    isSetupStep,
    setupStep,
    setupStepIndex,
    currentScanTarget,
    outputDir,
    outputDirBaseline,
    activeScanResult,
    scanCache,
    scopedPostCount,
    options,
    resumeDialog,
    frontmatterValidationErrors,
    updateOptions,
    startJob,
    startUpload,
    resumeJob,
    hydrateJob,
    applyResumedState,
    applyBootstrapState,
    setJob,
    setResumeDialog,
    setScanCache,
    setScanPending,
    setCategoryStatus,
    setCategorySearch,
    setSetupStep,
    setActiveJobFilter,
    setResettingResume,
    setRestoringResume,
    setBlogIdOrUrl,
    setOutputDir,
    setNeutralScanStatus,
    setErrorScanStatus,
    setOptions,
    latestPersistedOptionsRef,
    latestThemePreferenceRef,
    persistedUiStateSignatureRef,
  })

  const summaryCards = buildSummaryCards({
    currentStep,
    job,
    scopedPostCount,
    activeCategoryCount: activeScanResult?.categories.length ?? 0,
    selectedCount,
    outputDir: normalizeOutputDir(outputDir),
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
  const nextDisabled =
    setupStep === "blog-input"
      ? currentScanTarget.length === 0 || scanPending
        : setupStep === "category-selection"
          ? !activeScanResult || selectedCount === 0
        : setupStep === "markdown-options"
          ? !activeScanResult
        : setupStep === "diagnostics-options"
          ? exportDisabled || submitting
          : !activeScanResult

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
        <BlogInputPanel
          blogIdOrUrl={blogIdOrUrl}
          outputDir={outputDir}
          scanPending={scanPending}
          scanStatus={scanStatus}
          scanStatusTone={scanStatusTone}
          onBlogIdOrUrlChange={handleBlogInputChange}
          onOutputDirChange={handleOutputDirChange}
          onOutputDirBlur={handleOutputDirBlur}
        />
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
        onOutputDirChange={handleOutputDirChange}
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

      <div id="dashboard-backdrop" className="shell-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />
      <div className="dashboard-brand-mark pointer-events-none fixed inset-x-0 z-0" aria-hidden="true">
        <img src="/brand/logo.svg" alt="" />
      </div>

      {bootstrapping ? (
        <section className="fixed inset-0 z-50 grid place-items-center px-4 py-6" data-step-view="bootstrap-loading">
          <div className="absolute inset-0 bg-background/78 backdrop-blur-[6px]" aria-hidden="true" />
          <Card variant="panel" className="relative w-full max-w-xl overflow-hidden">
            <CardContent className="grid gap-4 px-6 py-8 sm:px-8 sm:py-10">
              <div className="grid justify-items-center gap-4 text-center" role="status" aria-live="polite">
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
          themePreference={themePreference}
          headerStatus={headerStatus}
          summaryCards={summaryCards}
          onThemeChange={setThemePreference}
        />

        <section
          ref={stepViewRef}
          className={cn("grid gap-4", isSetupStep ? "pb-28 sm:pb-32" : "")}
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
        nextDisabled={nextDisabled}
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
