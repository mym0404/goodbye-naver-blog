import { Button } from "./ui/button.js"

export const WizardDock = ({
  isSetupStep,
  setupStep,
  setupStepIndex,
  currentScanTarget,
  scanPending,
  exportDisabled,
  submitting,
  nextButtonLabel,
  nextActionIcon,
  onPrevious,
  onForceScan,
  onNext,
}: {
  isSetupStep: boolean
  setupStep: string
  setupStepIndex: number
  currentScanTarget: string
  scanPending: boolean
  exportDisabled: boolean
  submitting: boolean
  nextButtonLabel: string
  nextActionIcon: import("react").ReactNode
  onPrevious: () => void
  onForceScan: () => void
  onNext: () => void
}) => {
  if (!isSetupStep) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:pb-5 xl:px-6">
      <div className="mx-auto flex w-full max-w-6xl justify-center">
        <div className="floating-dock flex min-h-16 w-full max-w-fit flex-wrap items-center justify-end gap-2.5 rounded-[1.4rem] px-3 py-3">
          {setupStepIndex > 0 ? (
            <Button type="button" variant="surface" className="h-10 rounded-xl px-4" onClick={onPrevious}>
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
              onClick={onForceScan}
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
            onClick={onNext}
          >
            {nextActionIcon}
            <span>{nextButtonLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
