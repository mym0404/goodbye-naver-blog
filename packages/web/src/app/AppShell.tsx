import { Box, Button, PageLayout } from "@primer/react"

import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { ReactNode, RefObject } from "react"

import type { SetupStep, WizardStep } from "../features/common/shell/WizardFlow.js"
import type { ResumeDialogState } from "../features/resume/ResumeState.js"

import { primerPageMaxWidth } from "../components/primer/PrimerPage.js"
import { PrimerToastViewport } from "../components/primer/PrimerToast.js"
import { stepMeta } from "../features/common/shell/WizardFlow.js"
import { WizardHeader } from "../features/common/shell/WizardHeader.js"
import { ResumeDialogPanel } from "../features/resume/ResumeDialogPanel.js"

import { BootstrapLoadingOverlay } from "./BootstrapLoadingOverlay.js"

type AppShellProps = {
  themePreference: ThemePreference
  bootstrapping: boolean
  resumeDialog: ResumeDialogState | null
  resettingResume: boolean
  restoringResume: boolean
  currentStep: WizardStep
  isSetupStep: boolean
  setupStep: SetupStep
  setupStepIndex: number
  stepViewRef: RefObject<HTMLElement | null>
  headerStatus: ReturnType<typeof import("../features/common/shell/WizardFlow.js").getHeaderStatus>
  summaryCards: ReturnType<
    typeof import("../features/common/shell/WizardFlow.js").buildSummaryCards
  >
  currentScanTarget: string
  scanPending: boolean
  exportDisabled: boolean
  nextDisabled: boolean
  submitting: boolean
  nextButtonLabel: string
  children: ReactNode
  onThemeChange: (value: ThemePreference) => void
  onResetResume: () => void
  onRestoreResume: () => void
  onPrevious: () => void
  onForceScan: () => void
  onNext: () => void
}

const WizardStepActions = ({
  isSetupStep,
  setupStep,
  setupStepIndex,
  currentScanTarget,
  scanPending,
  exportDisabled,
  nextDisabled,
  submitting,
  nextButtonLabel,
  onPrevious,
  onForceScan,
  onNext,
}: {
  isSetupStep: boolean
  setupStep: SetupStep
  setupStepIndex: number
  currentScanTarget: string
  scanPending: boolean
  exportDisabled: boolean
  nextDisabled: boolean
  submitting: boolean
  nextButtonLabel: string
  onPrevious: () => void
  onForceScan: () => void
  onNext: () => void
}) => {
  if (!isSetupStep) {
    return null
  }

  return (
    <Box
      data-step-actions
      sx={{
        display: "flex",
        flexDirection: ["column", "row"],
        flexWrap: "wrap",
        alignItems: ["stretch", "center"],
        justifyContent: "flex-end",
        gap: 2,
        pt: 3,
        borderTop: "1px solid",
        borderColor: "border.default",
      }}
    >
      {setupStepIndex > 0 ? (
        <Button type="button" variant="default" onClick={onPrevious}>
          이전
        </Button>
      ) : null}

      {setupStep === "blog-input" ? (
        <Button
          type="button"
          id="force-scan-button"
          variant="default"
          title="캐시 비우기"
          disabled={!currentScanTarget || scanPending}
          onClick={onForceScan}
        >
          새로 불러오기
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
        disabled={
          setupStep === "diagnostics-options"
            ? exportDisabled || submitting || nextDisabled
            : nextDisabled
        }
        onClick={onNext}
        variant="primary"
      >
        {nextButtonLabel}
      </Button>
    </Box>
  )
}

export const AppShell = ({
  themePreference,
  bootstrapping,
  resumeDialog,
  resettingResume,
  restoringResume,
  currentStep,
  isSetupStep,
  setupStep,
  setupStepIndex,
  stepViewRef,
  headerStatus,
  summaryCards,
  currentScanTarget,
  scanPending,
  exportDisabled,
  nextDisabled,
  submitting,
  nextButtonLabel,
  children,
  onThemeChange,
  onResetResume,
  onRestoreResume,
  onPrevious,
  onForceScan,
  onNext,
}: AppShellProps) => (
  <Box
    aria-busy={bootstrapping || undefined}
    sx={{
      minHeight: "100vh",
      bg: "canvas.default",
      color: "fg.default",
      display: "flex",
      flexDirection: "column",
      overflowX: "clip",
      position: "relative",
    }}
  >
    <ResumeDialogPanel
      resumeDialog={resumeDialog}
      resettingResume={resettingResume}
      restoringResume={restoringResume}
      onReset={onResetResume}
      onRestore={onRestoreResume}
    />

    {bootstrapping ? <BootstrapLoadingOverlay /> : null}

    <Box
      sx={{
        bg: "canvas.subtle",
        borderBottom: "1px solid",
        borderColor: "border.default",
        width: "100%",
      }}
    >
      <Box
        sx={{
          maxWidth: primerPageMaxWidth,
          mx: "auto",
          px: [3, 4],
        }}
      >
        <WizardHeader
          title={stepMeta[currentStep].title}
          themePreference={themePreference}
          headerStatus={headerStatus}
          summaryCards={summaryCards}
          onThemeChange={onThemeChange}
        />
      </Box>
    </Box>

    <PageLayout
      containerWidth="medium"
      padding="normal"
      rowGap="normal"
      columnGap="normal"
      sx={{ width: "100%", flex: "1 0 auto", py: [3, 4] }}
    >
      <PageLayout.Content as="main" width="full" padding="none">
        <Box
          data-workflow-shell
          sx={{
            display: "grid",
            gap: 3,
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <Box
            as="section"
            id="step-view"
            ref={stepViewRef}
            data-step-view={currentStep}
            sx={{
              display: "grid",
              gap: 3,
              alignContent: "start",
              minWidth: 0,
            }}
          >
            {children}
          </Box>

          <WizardStepActions
            isSetupStep={isSetupStep}
            setupStep={setupStep}
            setupStepIndex={setupStepIndex}
            currentScanTarget={currentScanTarget}
            scanPending={scanPending}
            exportDisabled={exportDisabled}
            nextDisabled={nextDisabled}
            submitting={submitting}
            nextButtonLabel={nextButtonLabel}
            onPrevious={onPrevious}
            onForceScan={onForceScan}
            onNext={onNext}
          />
        </Box>
      </PageLayout.Content>
    </PageLayout>
    <PrimerToastViewport />
  </Box>
)
