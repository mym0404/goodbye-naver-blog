import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { allExportProfiles } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import { isExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import {
  cloneExportOptions,
  sanitizePersistedExportOptions,
} from "@exitpress/domain/export-options/ExportOptions.js"
import { renderTemplateExpressions } from "@exitpress/domain/template/util/renderTemplateExpressions.js"

import type { ScanCacheMap } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type {
  BlockTemplateDefinition,
  TemplatePropDefinition,
} from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { TemplateValue } from "@exitpress/domain/template/schema/TemplateValue.js"

const getSampleTemplateValue = (prop: TemplatePropDefinition): TemplateValue => {
  if (prop.type.startsWith("number")) {
    return 1
  }

  if (prop.type.startsWith("boolean")) {
    return true
  }

  if (prop.type.startsWith("array")) {
    return []
  }

  if (prop.type.startsWith("object")) {
    return {}
  }

  return "value"
}

const templateMatchesDefinition = ({
  template,
  definition,
}: {
  template: string
  definition: BlockTemplateDefinition
}) => {
  const props = Object.fromEntries(
    Object.entries(definition.props).map(([key, prop]) => [key, getSampleTemplateValue(prop)]),
  )

  try {
    renderTemplateExpressions({ template, props })
  } catch {
    return false
  }

  return true
}

const filterBlockOutputTemplates = ({
  options,
  blockTemplateDefinitions,
}: {
  options: PartialExportOptions
  blockTemplateDefinitions?: BlockTemplateDefinition[]
}) => {
  if (!options.blockOutputs?.templates || !blockTemplateDefinitions) {
    return options
  }

  const definitionByKey: Record<string, BlockTemplateDefinition> = Object.fromEntries(
    blockTemplateDefinitions.map((definition) => [definition.key, definition]),
  )
  const templates = Object.fromEntries(
    allExportProfiles.flatMap((profile) => {
      const profileTemplates = Object.fromEntries(
        Object.entries(options.blockOutputs?.templates?.[profile] ?? {}).filter(
          (entry): entry is [string, string] => {
            const [key, template] = entry
            const definition = definitionByKey[key]

            return typeof template === "string" && definition
              ? templateMatchesDefinition({ template, definition })
              : false
          },
        ),
      )

      return Object.keys(profileTemplates).length > 0 ? [[profile, profileTemplates]] : []
    }),
  )

  return {
    ...options,
    blockOutputs: {
      ...options.blockOutputs,
      templates,
    },
  }
}

export const readScanCacheFile = async ({ scanCachePath }: { scanCachePath: string }) => {
  try {
    const raw = await readFile(scanCachePath, "utf8")
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
  defaultOutputDir,
  defaultThemePreference,
  blockTemplateDefinitions,
}: {
  settingsPath: string
  defaultOutputDir: string
  defaultThemePreference: ThemePreference
  blockTemplateDefinitions?: BlockTemplateDefinition[]
}) => {
  try {
    const raw = await readFile(settingsPath, "utf8")
    const parsed = JSON.parse(raw) as {
      options?: PartialExportOptions
      lastOutputDir?: string
      themePreference?: ThemePreference
      profile?: ExportProfile
    }

    return {
      options: cloneExportOptions(
        filterBlockOutputTemplates({
          options: sanitizePersistedExportOptions(
            parsed &&
              typeof parsed === "object" &&
              parsed.options &&
              typeof parsed.options === "object" &&
              !Array.isArray(parsed.options)
              ? parsed.options
              : undefined,
          ),
          blockTemplateDefinitions,
        }),
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
      profile: isExportProfile(parsed.profile) ? parsed.profile : "gfm",
    }
  } catch {
    return {
      options: cloneExportOptions(),
      lastOutputDir: defaultOutputDir,
      themePreference: defaultThemePreference,
      profile: "gfm" as const,
    }
  }
}

export const writePersistedUiState = async ({
  settingsPath,
  input,
  defaultOutputDir,
  defaultThemePreference,
  blockTemplateDefinitions,
}: {
  settingsPath: string
  input: {
    options?: PartialExportOptions
    lastOutputDir?: string
    themePreference?: ThemePreference
    profile?: ExportProfile
  }
  defaultOutputDir: string
  defaultThemePreference: ThemePreference
  blockTemplateDefinitions?: BlockTemplateDefinition[]
}) => {
  const current = await readPersistedUiState({
    settingsPath,
    defaultOutputDir,
    defaultThemePreference,
    blockTemplateDefinitions,
  })

  await mkdir(path.dirname(settingsPath), { recursive: true })
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        options: filterBlockOutputTemplates({
          options: sanitizePersistedExportOptions(input.options ?? current.options),
          blockTemplateDefinitions,
        }),
        lastOutputDir: input.lastOutputDir ?? current.lastOutputDir,
        themePreference: input.themePreference ?? current.themePreference,
        profile: input.profile ?? current.profile,
      },
      null,
      2,
    ),
    "utf8",
  )
}
