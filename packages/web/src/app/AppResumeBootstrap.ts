import { useCallback } from "react"

import type { ScanCacheMap, ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"

import type { SetupStep } from "../features/common/shell/WizardFlow.js"
import type { JobFilter } from "../features/job-results/JobResultsHelpers.js"
import type { ResumeDialogState } from "../features/resume/ResumeState.js"
import type { ExportBootstrapResponse } from "../lib/Api.js"

import {
  defaultCategoryStatus,
  defaultScanStatus,
  normalizeOutputDir,
  restoredCategoryFallbackStatus,
  restoredCategoryStatus,
  restoredScanStatus,
} from "../features/scan/ScanStatus.js"

import { defaultBlogKey } from "./AppDefaults.js"

export const useAppResumeBootstrap = ({
  hydrateJob,
  setDefaults,
  setOptions,
  setOutputDir,
  setSourceIdOrUrl,
  setBlogKey,
  setCategorySearch,
  setSetupStep,
  setActiveJobFilter,
  setScanPending,
  setScanCache,
  setCategoryStatus,
  setThemePreference,
  setResumeDialog,
  setNeutralScanStatus,
  hasUserInteractedRef,
  lastNotifiedJobKeyRef,
}: {
  hydrateJob: (nextJob: ExportBootstrapResponse["resumedJob"]) => void
  setDefaults: Dispatch<SetStateAction<ExportBootstrapResponse>>
  setOptions: Dispatch<SetStateAction<ExportOptions>>
  setOutputDir: Dispatch<SetStateAction<string>>
  setSourceIdOrUrl: Dispatch<SetStateAction<string>>
  setBlogKey: Dispatch<SetStateAction<string>>
  setCategorySearch: Dispatch<SetStateAction<string>>
  setSetupStep: Dispatch<SetStateAction<SetupStep>>
  setActiveJobFilter: Dispatch<SetStateAction<JobFilter>>
  setScanPending: Dispatch<SetStateAction<boolean>>
  setScanCache: Dispatch<SetStateAction<ScanCacheMap>>
  setCategoryStatus: Dispatch<SetStateAction<string>>
  setThemePreference: Dispatch<SetStateAction<ExportBootstrapResponse["themePreference"]>>
  setResumeDialog: Dispatch<SetStateAction<ResumeDialogState | null>>
  setNeutralScanStatus: (message: string) => void
  hasUserInteractedRef: MutableRefObject<boolean>
  lastNotifiedJobKeyRef: MutableRefObject<string | null>
}) => {
  const applyResumedState = useCallback(
    ({
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
      setSourceIdOrUrl(resumedJob.request.sourceInput)
      setBlogKey(resumedJob.request.blogKey)
      setCategorySearch("")
      setSetupStep("blog-input")
      setActiveJobFilter("all")
      setScanPending(false)

      if (resumedScanResult) {
        setScanCache((current) => ({
          ...current,
          [resumedJob.request.sourceInput]: resumedScanResult,
        }))
        setNeutralScanStatus(`${resumedScanResult.sourceId} 스캔 결과를 불러왔습니다.`)
        setCategoryStatus(restoredCategoryStatus)
      } else {
        setScanCache({})
        setNeutralScanStatus(restoredScanStatus)
        setCategoryStatus(restoredCategoryFallbackStatus)
      }

      lastNotifiedJobKeyRef.current = `${resumedJob.id}:${resumedJob.status}:${resumedJob.finishedAt ?? ""}`
      hydrateJob(resumedJob)
      setResumeDialog(
        source === "bootstrap" ? { source, resumedJob, resumeSummary, resumedScanResult } : null,
      )
    },
    [
      hydrateJob,
      lastNotifiedJobKeyRef,
      setActiveJobFilter,
      setSourceIdOrUrl,
      setBlogKey,
      setCategorySearch,
      setCategoryStatus,
      setDefaults,
      setNeutralScanStatus,
      setOptions,
      setOutputDir,
      setResumeDialog,
      setScanCache,
      setScanPending,
      setSetupStep,
    ],
  )

  const applyBootstrapState = useCallback(
    (nextDefaults: ExportBootstrapResponse) => {
      setDefaults(nextDefaults)
      setThemePreference(nextDefaults.themePreference)

      if (
        hasUserInteractedRef.current &&
        !nextDefaults.resumedJob &&
        !nextDefaults.resumedScanResult
      ) {
        return
      }

      setOptions(nextDefaults.resumedJob?.request.options ?? nextDefaults.options)
      setOutputDir(
        normalizeOutputDir(
          nextDefaults.resumedJob?.request.outputDir ?? nextDefaults.lastOutputDir,
        ),
      )
      setSourceIdOrUrl(nextDefaults.resumedJob?.request.sourceInput ?? "")
      setBlogKey(nextDefaults.resumedJob?.request.blogKey ?? defaultBlogKey)
      setCategorySearch("")
      setSetupStep("blog-input")
      setActiveJobFilter("all")
      setScanPending(false)

      if (nextDefaults.resumedScanResult) {
        setScanCache({
          [nextDefaults.resumedJob?.request.sourceInput ?? nextDefaults.resumedScanResult.sourceId]:
            nextDefaults.resumedScanResult,
        })
        setNeutralScanStatus(`${nextDefaults.resumedScanResult.sourceId} 스캔 결과를 불러왔습니다.`)
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
    },
    [
      applyResumedState,
      hasUserInteractedRef,
      hydrateJob,
      lastNotifiedJobKeyRef,
      setActiveJobFilter,
      setSourceIdOrUrl,
      setBlogKey,
      setCategorySearch,
      setCategoryStatus,
      setDefaults,
      setNeutralScanStatus,
      setOptions,
      setOutputDir,
      setResumeDialog,
      setScanCache,
      setScanPending,
      setSetupStep,
      setThemePreference,
    ],
  )

  return {
    applyBootstrapState,
    applyResumedState,
  }
}
