import { useCallback } from "react"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"

import type { ExportResumeLookupResponse } from "../../../lib/Api.js"

import type { WizardScanActionsArgs } from "./schema/WizardActions.js"

import { toast } from "../../../components/primer/PrimerToast.js"
import { postJson } from "../../../lib/Api.js"
import {
  defaultCategoryStatus,
  defaultScanLoadingStatus,
  defaultScanStatus,
  forceScanLoadingStatus,
  normalizeOutputDir,
  readyCategoryStatus,
  resolveScopedCategoryIds,
  resumeLookupErrorStatus,
} from "../../scan/ScanStatus.js"

import { useWizardCategoryActions } from "./UseWizardCategoryActions.js"

export const useWizardScanActions = ({
  currentScanTarget,
  blogKey,
  outputDir,
  outputDirBaseline,
  activeScanResult,
  scanCache,
  updateOptions,
  setResumeDialog,
  setScanCache,
  setScanPending,
  setCategoryStatus,
  setCategorySearch,
  setSetupStep,
  setSourceIdOrUrl,
  setBlogKey,
  setOutputDir,
  setNeutralScanStatus,
  setErrorScanStatus,
  setOptions,
}: WizardScanActionsArgs) => {
  const categoryActions = useWizardCategoryActions({
    outputDirBaseline,
    activeScanResult,
    updateOptions,
    setOutputDir,
  })

  const ensureScanResult = useCallback(
    async ({
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
        setCategoryStatus("출력 경로에서 manifest.json을 확인하는 중입니다.")

        try {
          const resumed = await postJson<ExportResumeLookupResponse>("/api/export-resume/lookup", {
            outputDir: normalizedOutputDir,
          })
          const nextResumeDialog =
            resumed.resumedJob && resumed.resumeSummary
              ? {
                  source: "before-scan" as const,
                  resumedJob: resumed.resumedJob,
                  resumeSummary: resumed.resumeSummary,
                  resumedScanResult: resumed.resumedScanResult,
                }
              : null

          if (nextResumeDialog) {
            setResumeDialog(nextResumeDialog)
            setNeutralScanStatus("이 경로에 이어서 불러올 작업이 있습니다.")
            setCategoryStatus("작업을 초기화하거나 불러오세요.")
            return false
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setErrorScanStatus(message)
          setCategoryStatus(resumeLookupErrorStatus)
          toast.error("작업 상태 확인에 실패했습니다.", {
            description: message,
          })
          return false
        } finally {
          setScanPending(false)
        }
      }

      if (activeScanResult && !forceRefresh) {
        setNeutralScanStatus(`${activeScanResult.sourceId} 스캔 결과를 다시 사용합니다.`)
        setCategoryStatus(readyCategoryStatus)
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
      setNeutralScanStatus(forceRefresh ? forceScanLoadingStatus : defaultScanLoadingStatus)
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
          blogKey,
          sourceInput: currentScanTarget,
          forceRefresh,
        })

        setScanCache((current) => ({
          ...current,
          [currentScanTarget]: nextScanResult,
        }))
        setNeutralScanStatus(`${nextScanResult.sourceId} 스캔 완료`)
        setCategoryStatus(
          `카테고리 스캔이 끝났습니다. ${nextScanResult.totalPostCount}개 글과 ${nextScanResult.categories.length}개 카테고리를 불러왔습니다.`,
        )
        setCategorySearch("")
        setOptions((current) => ({
          ...current,
          scope: {
            ...current.scope,
            categoryIds: nextScanResult.categories.map((category) => category.id),
          },
        }))
        setSetupStep("category-selection")
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
    },
    [
      activeScanResult,
      blogKey,
      currentScanTarget,
      outputDir,
      setCategorySearch,
      setCategoryStatus,
      setErrorScanStatus,
      setNeutralScanStatus,
      setOptions,
      setResumeDialog,
      setScanCache,
      setScanPending,
      setSetupStep,
    ],
  )

  const handleBlogInputChange = useCallback(
    (value: string) => {
      setSourceIdOrUrl(value)
      setSetupStep("blog-input")

      if (value.trim() && scanCache[value.trim()]) {
        setNeutralScanStatus("저장된 카테고리를 다시 사용할 수 있습니다.")
        setCategoryStatus(readyCategoryStatus)
        return
      }

      setNeutralScanStatus(
        value.trim() ? "블로그가 바뀌었습니다. 다음 단계에서 다시 스캔합니다." : defaultScanStatus,
      )
      setCategoryStatus(defaultCategoryStatus)
      setCategorySearch("")
      setOptions((current) => ({
        ...current,
        scope: {
          ...current.scope,
          categoryIds: [],
        },
      }))
    },
    [
      scanCache,
      setSourceIdOrUrl,
      setCategorySearch,
      setCategoryStatus,
      setNeutralScanStatus,
      setOptions,
      setSetupStep,
    ],
  )

  const handleBlogKeyChange = useCallback(
    (value: string) => {
      setBlogKey(value)
      setSetupStep("blog-input")
      setNeutralScanStatus(
        currentScanTarget
          ? "블로그가 바뀌었습니다. 다음 단계에서 다시 스캔합니다."
          : defaultScanStatus,
      )
      setCategoryStatus(defaultCategoryStatus)
      setCategorySearch("")
      setOptions((current) => ({
        ...current,
        scope: { ...current.scope, categoryIds: [] },
      }))
    },
    [
      currentScanTarget,
      setBlogKey,
      setCategorySearch,
      setCategoryStatus,
      setNeutralScanStatus,
      setOptions,
      setSetupStep,
    ],
  )

  return {
    ensureScanResult,
    handleBlogInputChange,
    handleBlogKeyChange,
    ...categoryActions,
  }
}
