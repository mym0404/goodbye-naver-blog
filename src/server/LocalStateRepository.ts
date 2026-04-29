import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  cloneExportOptions,
  sanitizePersistedExportOptions,
  type PartialExportOptions,
} from "../shared/ExportOptions.js"
import type { EditorBlockOutputDefinition, ScanCacheMap, ThemePreference } from "../shared/Types.js"

const readFileWithFallback = async ({
  filePath,
  legacyFilePath,
}: {
  filePath: string
  legacyFilePath?: string
}) => {
  try {
    return await readFile(filePath, "utf8")
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      legacyFilePath &&
      legacyFilePath !== filePath
    ) {
      return readFile(legacyFilePath, "utf8")
    }

    throw error
  }
}

export const readScanCacheFile = async ({
  scanCachePath,
  legacyScanCachePath,
}: {
  scanCachePath: string
  legacyScanCachePath?: string
}) => {
  try {
    const raw = await readFileWithFallback({
      filePath: scanCachePath,
      legacyFilePath: legacyScanCachePath,
    })
    const parsed = JSON.parse(raw) as {
      scans?: ScanCacheMap
    }

    return parsed.scans && typeof parsed.scans === "object" ? parsed.scans : {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {}
    }

    throw error
  }
}

export const writeScanCacheFile = async ({
  scanCachePath,
  scans,
}: {
  scanCachePath: string
  scans: ScanCacheMap
}) => {
  await mkdir(path.dirname(scanCachePath), { recursive: true })
  await writeFile(
    scanCachePath,
    JSON.stringify(
      {
        scans,
      },
      null,
      2,
    ),
    "utf8",
  )
}

export const readPersistedUiState = async ({
  settingsPath,
  legacySettingsPath,
  defaultOutputDir,
  defaultThemePreference,
  blockOutputDefinitions,
}: {
  settingsPath: string
  legacySettingsPath?: string
  defaultOutputDir: string
  defaultThemePreference: ThemePreference
  blockOutputDefinitions?: EditorBlockOutputDefinition[]
}) => {
  try {
    const raw = await readFileWithFallback({
      filePath: settingsPath,
      legacyFilePath: legacySettingsPath,
    })
    const parsed = JSON.parse(raw) as {
      options?: PartialExportOptions
      lastOutputDir?: string
      themePreference?: ThemePreference
    }

    return {
      options: cloneExportOptions(
        sanitizePersistedExportOptions(
          parsed &&
            typeof parsed === "object" &&
            parsed.options &&
            typeof parsed.options === "object" &&
            !Array.isArray(parsed.options)
            ? parsed.options
            : undefined,
          { blockOutputDefinitions },
        ),
        { blockOutputDefinitions },
      ),
      lastOutputDir:
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.lastOutputDir === "string" &&
        parsed.lastOutputDir.trim()
          ? parsed.lastOutputDir.trim()
          : defaultOutputDir,
      themePreference:
        parsed &&
        typeof parsed === "object" &&
        (parsed.themePreference === "dark" || parsed.themePreference === "light")
          ? parsed.themePreference
          : defaultThemePreference,
    }
  } catch {
    return {
      options: cloneExportOptions(undefined, { blockOutputDefinitions }),
      lastOutputDir: defaultOutputDir,
      themePreference: defaultThemePreference,
    }
  }
}

export const writePersistedUiState = async ({
  settingsPath,
  input,
  legacySettingsPath,
  defaultOutputDir,
  defaultThemePreference,
  blockOutputDefinitions,
}: {
  settingsPath: string
  input: {
    options?: PartialExportOptions
    lastOutputDir?: string
    themePreference?: ThemePreference
  }
  legacySettingsPath?: string
  defaultOutputDir: string
  defaultThemePreference: ThemePreference
  blockOutputDefinitions?: EditorBlockOutputDefinition[]
}) => {
  const current = await readPersistedUiState({
    settingsPath,
    legacySettingsPath,
    defaultOutputDir,
    defaultThemePreference,
    blockOutputDefinitions,
  })

  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        options: sanitizePersistedExportOptions(input.options ?? current.options, {
          blockOutputDefinitions,
        }),
        lastOutputDir: input.lastOutputDir ?? current.lastOutputDir,
        themePreference: input.themePreference ?? current.themePreference,
      },
      null,
      2,
    ),
    "utf8",
  )
}
