import { sanitizePersistedExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { useEffect } from "react"

import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"

import type { ExportBootstrapResponse } from "../../../lib/Api.js"

import { fetchJson } from "../../../lib/Api.js"
import { getPersistedUiStateSignature } from "../shell/WizardFlow.js"

export const useBootstrapDefaults = ({
  fallbackDefaults,
  applyBootstrapState,
  setBootstrapping,
  setErrorScanStatus,
  setExportJobPollingConfig,
  hasLoadedDefaultsRef,
  latestPersistedOptionsRef,
  latestThemePreferenceRef,
  persistedUiStateSignatureRef,
}: {
  fallbackDefaults: ExportBootstrapResponse
  applyBootstrapState: (defaults: ExportBootstrapResponse) => void
  setBootstrapping: (value: boolean) => void
  setErrorScanStatus: (message: string) => void
  setExportJobPollingConfig: (config?: {
    defaultPollMs?: number
    fastPollMs?: number
    uploadBurstPollMs?: number
    uploadBurstAttempts?: number
  }) => void
  hasLoadedDefaultsRef: { current: boolean }
  latestPersistedOptionsRef: { current: ReturnType<typeof sanitizePersistedExportOptions> }
  latestThemePreferenceRef: { current: ThemePreference }
  persistedUiStateSignatureRef: { current: string | null }
}) => {
  useEffect(() => {
    let cancelled = false

    const loadDefaults = async () => {
      try {
        const nextDefaults = await fetchJson<ExportBootstrapResponse>("/api/export-defaults")

        if (cancelled) {
          return
        }

        const normalizedDefaults: ExportBootstrapResponse = {
          ...nextDefaults,
          themePreference: nextDefaults.themePreference ?? fallbackDefaults.themePreference,
        }
        const nextPersistedOptions = sanitizePersistedExportOptions(normalizedDefaults.options)

        latestPersistedOptionsRef.current = nextPersistedOptions
        latestThemePreferenceRef.current = normalizedDefaults.themePreference
        setExportJobPollingConfig(normalizedDefaults.jobPolling)
        persistedUiStateSignatureRef.current = getPersistedUiStateSignature({
          options: normalizedDefaults.options,
          themePreference: normalizedDefaults.themePreference,
          profile: normalizedDefaults.profile,
        })
        hasLoadedDefaultsRef.current = true
        applyBootstrapState(normalizedDefaults)
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
          profile: fallbackDefaults.profile,
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
  }, [
    applyBootstrapState,
    fallbackDefaults,
    hasLoadedDefaultsRef,
    latestPersistedOptionsRef,
    latestThemePreferenceRef,
    persistedUiStateSignatureRef,
    setBootstrapping,
    setErrorScanStatus,
    setExportJobPollingConfig,
  ])
}
