import { useEffect } from "react"

import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { MutableRefObject } from "react"

import { postJsonNoContent } from "../../../lib/Api.js"
import { getPersistedUiStateSignature } from "../shell/WizardFlow.js"

const exportSettingsSaveDelayMs = 300

export const useExportSettingsSync = ({
  hasLoadedDefaultsRef,
  persistedUiStateSignature,
  persistedUiStateSignatureRef,
  latestPersistedOptionsRef,
  latestThemePreferenceRef,
  profile,
}: {
  hasLoadedDefaultsRef: MutableRefObject<boolean>
  persistedUiStateSignature: string
  persistedUiStateSignatureRef: MutableRefObject<string | null>
  latestPersistedOptionsRef: MutableRefObject<PartialExportOptions>
  latestThemePreferenceRef: MutableRefObject<ThemePreference>
  profile: ExportProfile
}) => {
  useEffect(() => {
    if (!hasLoadedDefaultsRef.current) {
      return
    }

    if (persistedUiStateSignature === persistedUiStateSignatureRef.current) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      const nextThemePreference = latestThemePreferenceRef.current
      const nextOptions = latestPersistedOptionsRef.current
      const nextPersistedSignature = getPersistedUiStateSignature({
        options: nextOptions,
        themePreference: nextThemePreference,
        profile,
      })

      void postJsonNoContent("/api/export-settings", {
        options: nextOptions,
        themePreference: nextThemePreference,
        profile,
      })
        .then(() => {
          if (cancelled) {
            return
          }

          persistedUiStateSignatureRef.current = nextPersistedSignature
        })
        .catch(() => {})
    }, exportSettingsSaveDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    hasLoadedDefaultsRef,
    latestPersistedOptionsRef,
    latestThemePreferenceRef,
    persistedUiStateSignature,
    persistedUiStateSignatureRef,
    profile,
  ])
}
