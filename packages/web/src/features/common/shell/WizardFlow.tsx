import { JOB_STATUSES } from "@exitpress/domain/export-job/ExportJobState.js"
import { sanitizePersistedExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { ImageHandlingMode } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"

import { exportOptionsStepMeta } from "../../options/ExportOptionsSteps.js"

export const setupSteps = [
  "blog-input",
  "category-selection",
  "structure-options",
  "frontmatter-options",
  "assets-options",
  "upload-provider-options",
  "links-options",
  "diagnostics-options",
] as const

const allWizardSteps = [
  ...setupSteps,
  "block-scan",
  "markdown-review",
  "running",
  "upload",
  "result",
] as const

export type SetupStep = (typeof setupSteps)[number]
export type WizardStep = (typeof allWizardSteps)[number]

type SummaryCard = {
  label: string
  value: string
}

export const stepMeta: Record<WizardStep, { title: string }> = {
  "blog-input": {
    title: "블로그 입력",
  },
  "category-selection": {
    title: "카테고리 선택",
  },
  "structure-options": {
    title: exportOptionsStepMeta.structure.title,
  },
  "frontmatter-options": {
    title: exportOptionsStepMeta.frontmatter.title,
  },
  "assets-options": {
    title: exportOptionsStepMeta.assets.title,
  },
  "upload-provider-options": {
    title: "이미지 업로드 설정",
  },
  "links-options": {
    title: exportOptionsStepMeta.links.title,
  },
  "diagnostics-options": {
    title: exportOptionsStepMeta.diagnostics.title,
  },
  "block-scan": {
    title: "Markdown 옵션 준비",
  },
  "markdown-review": {
    title: exportOptionsStepMeta.markdown.title,
  },
  running: {
    title: "실행 중",
  },
  upload: {
    title: "이미지 업로드",
  },
  result: {
    title: "결과",
  },
}

export const getPersistedUiStateSignature = ({
  options,
  themePreference,
  profile,
}: {
  options: ExportOptions | PartialExportOptions
  themePreference: ThemePreference
  profile?: ExportProfile
}) =>
  JSON.stringify({
    options: sanitizePersistedExportOptions(options),
    themePreference,
    profile,
  })

export const getNextSetupStep = ({
  setupStep,
  imageHandlingMode,
}: {
  setupStep: SetupStep
  imageHandlingMode: ImageHandlingMode
}) => {
  if (setupStep === "assets-options") {
    return imageHandlingMode === "download-and-upload" ? "upload-provider-options" : "links-options"
  }

  const nextStep = setupSteps[setupSteps.indexOf(setupStep) + 1]

  return nextStep ?? setupStep
}

export const getPreviousSetupStep = ({
  setupStep,
  imageHandlingMode,
}: {
  setupStep: SetupStep
  imageHandlingMode: ImageHandlingMode
}) => {
  if (setupStep === "links-options") {
    return imageHandlingMode === "download-and-upload"
      ? "upload-provider-options"
      : "assets-options"
  }

  const previousStep = setupSteps[setupSteps.indexOf(setupStep) - 1]

  return previousStep ?? setupStep
}

export const resolveWizardStep = ({
  setupStep,
  jobStatus,
  submitting,
}: {
  setupStep: string
  jobStatus: ExportJobState["status"] | undefined
  submitting: boolean
}) => {
  if (submitting || jobStatus === JOB_STATUSES.QUEUED || jobStatus === JOB_STATUSES.RUNNING) {
    return "running"
  }

  if (
    jobStatus === JOB_STATUSES.UPLOAD_READY ||
    jobStatus === JOB_STATUSES.UPLOADING ||
    jobStatus === JOB_STATUSES.UPLOAD_FAILED
  ) {
    return "upload"
  }

  if (
    jobStatus === JOB_STATUSES.COMPLETED ||
    jobStatus === JOB_STATUSES.FAILED ||
    jobStatus === JOB_STATUSES.UPLOAD_COMPLETED
  ) {
    return "result"
  }

  return setupStep
}

export const buildSummaryCards = ({
  currentStep,
  job,
  scopedPostCount,
  activeCategoryCount,
  selectedCount,
  outputDir,
}: {
  currentStep: string
  job: ExportJobState | null
  scopedPostCount: number
  activeCategoryCount: number
  selectedCount: number
  outputDir: string
}): SummaryCard[] => {
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
    { label: "카테고리", value: String(activeCategoryCount) },
    { label: "선택", value: String(selectedCount) },
    { label: "출력", value: outputDir.trim() || "." },
  ]
}

export const getHeaderStatus = ({
  job,
  scanPending,
  activeScanResult,
}: {
  job: ExportJobState | null
  scanPending: boolean
  activeScanResult: ScanResult | null
}) => {
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
}

export const getNextButtonLabel = ({
  setupStep,
  scanPending,
  submitting,
}: {
  setupStep: string
  scanPending: boolean
  submitting: boolean
}) => {
  switch (setupStep) {
    case "blog-input":
      return scanPending ? "스캔 중" : "카테고리 불러오기"
    case "category-selection":
      return "구조 설정"
    case "structure-options":
      return "Frontmatter 설정"
    case "frontmatter-options":
      return "자산 설정"
    case "assets-options":
      return "다음"
    case "upload-provider-options":
      return "링크 처리"
    case "links-options":
      return "진단 설정"
    case "diagnostics-options":
      return submitting ? "작업 등록 중" : "내보내기"
    default:
      return ""
  }
}
