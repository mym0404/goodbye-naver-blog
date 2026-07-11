import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { sanitizePersistedExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { Dispatch, SetStateAction } from "react"

import type { ExportBootstrapResponse } from "../../../../lib/Api.js"
import type { JobFilter } from "../../../job-results/JobResultsHelpers.js"
import type { ResumeDialogState } from "../../../resume/ResumeState.js"
import type { SetupStep } from "../../shell/WizardFlow.js"

export type UseWizardActionsArgs = {
  isSetupStep: boolean
  setupStep: SetupStep
  setupStepIndex: number
  currentScanTarget: string
  blogKey: string
  outputDir: string
  outputDirBaseline: string
  activeScanResult: ScanResult | null
  scanCache: Record<string, ScanResult>
  scopedPostCount: number
  options: ExportOptions
  uploadProviderSettingsReady: boolean
  resumeDialog: ResumeDialogState | null
  frontmatterValidationErrors: string[]
  updateOptions: (updater: (current: ExportOptions) => ExportOptions) => void
  startBlockScan: () => Promise<void>
  resumeJob: () => Promise<unknown>
  hydrateJob: (job: ExportBootstrapResponse["resumedJob"]) => void
  applyResumedState: (args: {
    source: ResumeDialogState["source"]
    resumedJob: NonNullable<ExportBootstrapResponse["resumedJob"]>
    resumeSummary: NonNullable<ExportBootstrapResponse["resumeSummary"]>
    resumedScanResult: ScanResult | null
  }) => void
  applyBootstrapState: (defaults: ExportBootstrapResponse) => void
  setJob: (job: ExportJobState | null) => void
  setResumeDialog: (value: ResumeDialogState | null) => void
  setScanCache: Dispatch<SetStateAction<Record<string, ScanResult>>>
  setScanPending: (value: boolean) => void
  setCategoryStatus: (value: string) => void
  setUploadProviderStepMessage: (value: string | null) => void
  setCategorySearch: (value: string) => void
  setSetupStep: (value: SetupStep) => void
  setActiveJobFilter: (value: JobFilter) => void
  setResettingResume: (value: boolean) => void
  setRestoringResume: (value: boolean) => void
  setSourceIdOrUrl: (value: string) => void
  setBlogKey: (value: string) => void
  setOutputDir: Dispatch<SetStateAction<string>>
  setNeutralScanStatus: (message: string) => void
  setErrorScanStatus: (message: string) => void
  setOptions: Dispatch<SetStateAction<ExportOptions>>
  latestPersistedOptionsRef: { current: ReturnType<typeof sanitizePersistedExportOptions> }
  latestThemePreferenceRef: { current: ThemePreference }
  persistedUiStateSignatureRef: { current: string | null }
}

export type WizardScanActionsArgs = Pick<
  UseWizardActionsArgs,
  | "currentScanTarget"
  | "blogKey"
  | "outputDir"
  | "outputDirBaseline"
  | "activeScanResult"
  | "scanCache"
  | "options"
  | "setResumeDialog"
  | "setScanCache"
  | "setScanPending"
  | "setCategoryStatus"
  | "setCategorySearch"
  | "setSetupStep"
  | "setSourceIdOrUrl"
  | "setBlogKey"
  | "setOutputDir"
  | "setNeutralScanStatus"
  | "setErrorScanStatus"
  | "setOptions"
  | "updateOptions"
>
