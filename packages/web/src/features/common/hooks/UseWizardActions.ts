import { useCallback } from "react"

import type { UseWizardActionsArgs } from "./schema/WizardActions.js"

import { getNextSetupStep, getPreviousSetupStep } from "../shell/WizardFlow.js"

import { useWizardResumeActions } from "./UseWizardResumeActions.js"
import { useWizardScanActions } from "./UseWizardScanActions.js"

export const useWizardActions = (args: UseWizardActionsArgs) => {
  const {
    isSetupStep,
    setupStep,
    setupStepIndex,
    activeScanResult,
    uploadProviderSettingsReady,
    options,
    frontmatterValidationErrors,
    startBlockScan,
    setCategoryStatus,
    setUploadProviderStepMessage,
    setSetupStep,
    setActiveJobFilter,
  } = args

  const {
    ensureScanResult,
    handleBlogInputChange,
    handleBlogKeyChange,
    handleOutputDirChange,
    handleOutputDirBlur,
    handleCategoryToggle,
    handleSelectAllCategories,
    handleClearAllCategories,
  } = useWizardScanActions(args)
  const { handleRestoreResume, handleResumeExport, handleResetResume } = useWizardResumeActions({
    ...args,
    ensureScanResult,
  })

  const handleSubmit = useCallback(async () => {
    if (!activeScanResult) {
      setCategoryStatus("스캔을 먼저 완료하세요.")
      return
    }

    if (frontmatterValidationErrors.length > 0) {
      setSetupStep("frontmatter-options")
      setCategoryStatus("Frontmatter 별칭 오류를 먼저 해결하세요.")
      return
    }

    setActiveJobFilter("all")
    await startBlockScan()
  }, [
    activeScanResult,
    frontmatterValidationErrors.length,
    setActiveJobFilter,
    setCategoryStatus,
    setSetupStep,
    startBlockScan,
  ])

  const goToPreviousStep = useCallback(() => {
    if (!isSetupStep || setupStepIndex <= 0) {
      return
    }

    setSetupStep(
      getPreviousSetupStep({
        setupStep,
        imageHandlingMode: options.assets.imageHandlingMode,
      }),
    )
  }, [isSetupStep, options.assets.imageHandlingMode, setSetupStep, setupStep, setupStepIndex])

  const goToNextStep = useCallback(async () => {
    if (!isSetupStep) {
      return
    }

    if (setupStep === "blog-input") {
      await ensureScanResult()
      return
    }

    if (setupStep === "category-selection") {
      setSetupStep("structure-options")
      return
    }

    if (setupStep === "diagnostics-options") {
      await handleSubmit()
      return
    }

    if (setupStep === "upload-provider-options" && !uploadProviderSettingsReady) {
      setUploadProviderStepMessage("이미지 업로드 설정을 먼저 입력해야 합니다.")
      return
    }

    setSetupStep(
      getNextSetupStep({
        setupStep,
        imageHandlingMode: options.assets.imageHandlingMode,
      }),
    )
  }, [
    ensureScanResult,
    handleSubmit,
    isSetupStep,
    options.assets.imageHandlingMode,
    setSetupStep,
    setUploadProviderStepMessage,
    setupStep,
    uploadProviderSettingsReady,
  ])

  return {
    ensureScanResult,
    handleBlogInputChange,
    handleBlogKeyChange,
    handleOutputDirChange,
    handleOutputDirBlur,
    handleCategoryToggle,
    handleSelectAllCategories,
    handleClearAllCategories,
    handleRestoreResume,
    handleResumeExport,
    handleResetResume,
    goToPreviousStep,
    goToNextStep,
  }
}
