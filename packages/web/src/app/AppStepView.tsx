import { Box, Button, Flash, ProgressBar, Text } from "@primer/react"

import type { BlockScanJobState } from "@exitpress/domain/block-scan/schema/BlockScanJobState.js"
import type { PostSummary, ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { UploadProviderCatalogResponse } from "@exitpress/domain/upload/schema/UploadProvider.js"
import type { Dispatch, SetStateAction } from "react"

import type { WizardStep } from "../features/common/shell/WizardFlow.js"
import type { JobFilter } from "../features/job-results/JobResultsHelpers.js"
import type { ScanStatusTone } from "../features/scan/BlogInputPanel.js"
import type { UploadProviderSettingsValue } from "../features/upload/UploadProviderSettingsForm.js"
import type { ExportBootstrapResponse } from "../lib/Api.js"

import { JobResultsPanel } from "../features/job-results/JobResultsPanel.js"
import { ExportOptionsPanel } from "../features/options/ExportOptionsPanel.js"
import { UploadProviderOptionsStep } from "../features/options/UploadProviderOptionsStep.js"
import { BlogInputPanel } from "../features/scan/BlogInputPanel.js"
import { CategoryPanel } from "../features/scan/CategoryPanel.js"

type AppStepViewProps = {
  currentStep: WizardStep
  job: ExportJobState | null
  activeJobFilter: JobFilter
  submitting: boolean
  uploadProviders: UploadProviderCatalogResponse
  uploadProviderError: string | null
  uploadProviderStepMessage: string | null
  testUploadSubmitting: boolean
  testUploadResult: string | null
  testUploadError: string | null
  sourceInput: string
  blogKey: string
  outputDir: string
  scanPending: boolean
  blockScanJob: BlockScanJobState | null
  blockScanError: string | null
  scanStatus: string
  scanStatusTone: ScanStatusTone
  activeScanResult: ScanResult | null
  selectedCategoryIds: number[]
  categorySearch: string
  categoryStatus: string
  scopedPostCount: number
  options: ExportOptions
  themePreference: ThemePreference
  selectedCount: number
  defaults: ExportBootstrapResponse
  frontmatterValidationErrors: string[]
  linkTemplatePreviewPost: Pick<
    PostSummary,
    "blogKey" | "sourceId" | "postId" | "title" | "publishedAt" | "categoryName"
  > | null
  setActiveJobFilter: Dispatch<SetStateAction<JobFilter>>
  setCategorySearch: Dispatch<SetStateAction<string>>
  updateOptions: (updater: (current: ExportOptions) => ExportOptions) => void
  handleBlogInputChange: (value: string) => void
  handleBlogKeyChange: (value: string) => void
  handleOutputDirChange: (value: string) => void
  handleOutputDirBlur: () => void
  handleSelectAllCategories: () => void
  handleClearAllCategories: () => void
  handleCategoryToggle: (categoryId: number, checked: boolean) => void
  handleUploadProviderSettingsChange: (value: UploadProviderSettingsValue) => void
  handleUploadProviderSettingsReadyChange: (ready: boolean) => void
  handleTestUpload: (value: UploadProviderSettingsValue) => Promise<void> | void
  handleResumeExport: () => Promise<void> | void
  handleRetryBlockScan: () => Promise<void> | void
  handleBackFromBlockScan: () => void
  handleConfirmMarkdownReview: () => Promise<void> | void
}

export const AppStepView = ({
  currentStep,
  job,
  activeJobFilter,
  submitting,
  uploadProviders,
  uploadProviderError,
  uploadProviderStepMessage,
  testUploadSubmitting,
  testUploadResult,
  testUploadError,
  sourceInput,
  blogKey,
  outputDir,
  scanPending,
  blockScanJob,
  blockScanError,
  scanStatus,
  scanStatusTone,
  activeScanResult,
  selectedCategoryIds,
  categorySearch,
  categoryStatus,
  scopedPostCount,
  options,
  themePreference,
  selectedCount,
  defaults,
  frontmatterValidationErrors,
  linkTemplatePreviewPost,
  setActiveJobFilter,
  setCategorySearch,
  updateOptions,
  handleBlogInputChange,
  handleBlogKeyChange,
  handleOutputDirChange,
  handleOutputDirBlur,
  handleSelectAllCategories,
  handleClearAllCategories,
  handleCategoryToggle,
  handleUploadProviderSettingsChange,
  handleUploadProviderSettingsReadyChange,
  handleTestUpload,
  handleResumeExport,
  handleRetryBlockScan,
  handleBackFromBlockScan,
  handleConfirmMarkdownReview,
}: AppStepViewProps) => {
  const blockTemplateDefinitions = defaults.blockTemplateDefinitions ?? []
  const detectedBlockTemplateKeys = activeScanResult?.detectedBlockTemplateKeys
  const visibleBlockTemplateDefinitions = detectedBlockTemplateKeys
    ? blockTemplateDefinitions.filter((definition) =>
        detectedBlockTemplateKeys.includes(definition.key),
      )
    : blockTemplateDefinitions

  if (currentStep === "running" || currentStep === "upload" || currentStep === "result") {
    return (
      <JobResultsPanel
        mode={currentStep}
        job={job}
        activeJobFilter={activeJobFilter}
        resumeSubmitting={submitting}
        onFilterChange={setActiveJobFilter}
        onResumeExport={handleResumeExport}
      />
    )
  }

  if (currentStep === "blog-input") {
    return (
      <BlogInputPanel
        blogs={defaults.blogs}
        blogKey={blogKey}
        sourceInput={sourceInput}
        outputDir={outputDir}
        scanPending={scanPending}
        scanStatus={scanStatus}
        scanStatusTone={scanStatusTone}
        onSourceIdOrUrlChange={handleBlogInputChange}
        onBlogKeyChange={handleBlogKeyChange}
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

  if (currentStep === "block-scan") {
    const total = blockScanJob?.total ?? scopedPostCount
    const completed = blockScanJob?.completed ?? 0
    const failed = blockScanJob?.failed ?? 0
    const progressValue = total > 0 ? ((completed + failed) / total) * 100 : 100

    return (
      <Box
        sx={{
          display: "grid",
          gap: 3,
          border: "1px solid",
          borderColor: "border.default",
          borderRadius: 2,
          bg: "canvas.default",
          p: 3,
        }}
      >
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3 }}
          >
            <Text sx={{ color: "fg.default", fontSize: 1, fontWeight: 600 }}>
              {blockScanError ? "준비 실패" : "준비 중"}
            </Text>
            <Text sx={{ color: "fg.muted", fontSize: 1 }}>
              총 {total} / 완료 {completed} / 실패 {failed}
            </Text>
          </Box>
          <ProgressBar progress={progressValue} barSize="large" />
        </Box>
        {blockScanError ? (
          <Flash variant="danger">{blockScanError}</Flash>
        ) : (
          <Text sx={{ color: "fg.muted", fontSize: 1, lineHeight: "20px" }}>
            선택한 글에서 필요한 Markdown 옵션을 확인 중입니다.
          </Text>
        )}
        {blockScanError ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 2 }}>
            <Button type="button" onClick={handleBackFromBlockScan}>
              이전
            </Button>
            <Button type="button" variant="primary" onClick={() => void handleRetryBlockScan()}>
              재시도
            </Button>
          </Box>
        ) : null}
      </Box>
    )
  }

  if (currentStep === "markdown-review") {
    return (
      <>
        <ExportOptionsPanel
          step="markdown"
          outputDir={outputDir}
          options={options}
          themePreference={themePreference}
          optionDescriptions={defaults.optionDescriptions}
          blockTemplateDefinitions={visibleBlockTemplateDefinitions}
          frontmatterFieldOrder={defaults.frontmatterFieldOrder}
          frontmatterFieldMeta={defaults.frontmatterFieldMeta}
          frontmatterValidationErrors={frontmatterValidationErrors}
          linkTemplatePreviewPost={linkTemplatePreviewPost}
          onOptionsChange={updateOptions}
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 2 }}>
          <Button type="button" onClick={handleBackFromBlockScan}>
            이전
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleConfirmMarkdownReview()}
          >
            변환 시작
          </Button>
        </Box>
      </>
    )
  }

  if (currentStep === "upload-provider-options") {
    return (
      <UploadProviderOptionsStep
        uploadProviders={uploadProviders}
        uploadProviderError={uploadProviderError}
        stepMessage={uploadProviderStepMessage}
        testUploadSubmitting={testUploadSubmitting}
        testUploadResult={testUploadResult}
        testUploadError={testUploadError}
        onChange={handleUploadProviderSettingsChange}
        onReadyChange={handleUploadProviderSettingsReadyChange}
        onTestUpload={handleTestUpload}
      />
    )
  }

  return (
    <ExportOptionsPanel
      step={
        currentStep === "structure-options"
          ? "structure"
          : currentStep === "frontmatter-options"
            ? "frontmatter"
            : currentStep === "assets-options"
              ? "assets"
              : currentStep === "links-options"
                ? "links"
                : "diagnostics"
      }
      outputDir={outputDir}
      options={options}
      themePreference={themePreference}
      optionDescriptions={defaults.optionDescriptions}
      blockTemplateDefinitions={visibleBlockTemplateDefinitions}
      frontmatterFieldOrder={defaults.frontmatterFieldOrder}
      frontmatterFieldMeta={defaults.frontmatterFieldMeta}
      frontmatterValidationErrors={frontmatterValidationErrors}
      linkTemplatePreviewPost={linkTemplatePreviewPost}
      onOptionsChange={updateOptions}
    />
  )
}
