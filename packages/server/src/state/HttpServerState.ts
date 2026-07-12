import { getScanCacheKey } from "@exitpress/domain/blog/schema/BlogScan.js"
import {
  cloneExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "@exitpress/domain/export-options/ExportOptions.js"

import type { ScanCacheMap, ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportManifest } from "@exitpress/domain/export-job/schema/ExportManifest.js"
import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import type { JobStore } from "../jobs/JobStore.js"

import { readExportManifest } from "../jobs/ExportJobManifest.js"
import { isTemporaryResumeOutputDir } from "../routes/LocalFileService.js"

import {
  readPersistedUiState,
  readScanCacheFile,
  writePersistedUiState,
  writeScanCacheFile,
} from "./LocalStateRepository.js"
import {
  getJobActivityTimestamp,
  getManifestJobTimestamp,
  resolveResumedScanResult,
} from "./ResumeStateResolver.js"

export type HttpServerState = ReturnType<typeof createHttpServerState>

export const createHttpServerState = ({
  jobStore,
  scanCachePath,
  settingsPath,
  defaultOutputDir,
  defaultThemePreference,
  blockTemplateDefinitions,
  blogs,
}: {
  jobStore: JobStore
  scanCachePath: string
  settingsPath: string
  defaultOutputDir: string
  defaultThemePreference: ThemePreference
  blockTemplateDefinitions: BlockTemplateDefinition[]
  blogs: { key: string; label: string }[]
}) => {
  let scanCachePromise: Promise<ScanCacheMap> | null = null
  const jobScanResults = new Map<string, ScanResult | null>()

  const ensureScanCache = () => {
    if (!scanCachePromise) {
      scanCachePromise = readScanCacheFile({
        scanCachePath,
      })
    }

    return scanCachePromise
  }

  const updateScanCache = async ({ scanResult }: { scanResult: ScanResult }) => {
    const current = await ensureScanCache()
    const next = {
      ...current,
      [getScanCacheKey(scanResult)]: scanResult,
    }

    await writeScanCacheFile({
      scanCachePath,
      scans: next,
    })
    scanCachePromise = Promise.resolve(next)
  }

  const hydrateJobFromManifest = ({
    manifest,
    scanResult,
  }: {
    manifest: ExportManifest
    scanResult: ScanResult | null
  }) => {
    if (!manifest.job) {
      return null
    }

    const existingJob = jobStore.get(manifest.job.id)

    if (
      existingJob &&
      getJobActivityTimestamp(existingJob) >= getManifestJobTimestamp(manifest.job.updatedAt)
    ) {
      return existingJob
    }

    jobScanResults.set(manifest.job.id, scanResult)
    return jobStore.hydrate(manifest)
  }

  const loadResumedJob = async ({
    outputDir,
    cachedScans,
  }: {
    outputDir: string
    cachedScans: ScanCacheMap
  }) => {
    if (isTemporaryResumeOutputDir(outputDir)) {
      return null
    }

    const manifest = await readExportManifest(outputDir)

    if (!manifest?.job) {
      return null
    }

    const resumedScanResult = resolveResumedScanResult({
      manifestSourceId: manifest.sourceId,
      manifestBlogKey: manifest.blogKey,
      manifestCategories: manifest.categories,
      manifestTotalPosts: manifest.totalPosts,
      manifestScanResult: manifest.job.scanResult,
      cachedScans,
    })
    const resumedJob = hydrateJobFromManifest({
      manifest,
      scanResult: resumedScanResult,
    })

    if (!resumedJob) {
      return null
    }

    return {
      job: resumedJob,
      summary: manifest.job.summary,
      scanResult: resumedScanResult,
    }
  }

  const buildBootstrapResponse = async () => {
    const persistedUiState = await readPersistedUiState({
      settingsPath,
      defaultOutputDir,
      defaultThemePreference,
      blockTemplateDefinitions,
    })
    const cachedScans = await ensureScanCache()
    const resumed = await loadResumedJob({
      outputDir: persistedUiState.lastOutputDir,
      cachedScans,
    })

    return {
      profile: persistedUiState.profile,
      options: persistedUiState.options,
      lastOutputDir: persistedUiState.lastOutputDir,
      themePreference: persistedUiState.themePreference,
      resumedJob: resumed?.job ?? null,
      resumeSummary: resumed?.summary ?? null,
      resumedScanResult: resumed?.scanResult ?? null,
      frontmatterFieldOrder,
      frontmatterFieldMeta,
      optionDescriptions,
      blockTemplateDefinitions,
      blogs,
    }
  }

  const buildResumeLookupResponse = async ({
    outputDir,
    persistLastOutputDir = false,
  }: {
    outputDir: string
    persistLastOutputDir?: boolean
  }) => {
    const cachedScans = await ensureScanCache()
    const resumed = await loadResumedJob({
      outputDir,
      cachedScans,
    })

    if (persistLastOutputDir && resumed?.job) {
      await writeLastOutputDir(outputDir)
    }

    return {
      resumedJob: resumed?.job ?? null,
      resumeSummary: resumed?.summary ?? null,
      resumedScanResult: resumed?.scanResult ?? null,
    }
  }

  const writeLastOutputDir = (lastOutputDir: string) =>
    writePersistedUiState({
      settingsPath,
      input: {
        lastOutputDir,
      },
      defaultOutputDir,
      defaultThemePreference,
      blockTemplateDefinitions,
    })

  return {
    buildBootstrapResponse,
    buildResumeLookupResponse,
    blockTemplateDefinitions,
    cloneOptions: (options: PartialExportOptions | undefined) => cloneExportOptions(options),
    defaultOutputDir,
    ensureScanCache,
    jobScanResults,
    updateScanCache,
    writeLastOutputDir,
    writeUiState: (input: Parameters<typeof writePersistedUiState>[0]["input"]) =>
      writePersistedUiState({
        settingsPath,
        input,
        defaultOutputDir,
        defaultThemePreference,
        blockTemplateDefinitions,
      }),
  }
}
