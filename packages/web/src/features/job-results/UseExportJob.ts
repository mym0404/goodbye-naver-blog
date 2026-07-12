import { isTerminalJobStatus, JOB_STATUSES } from "@exitpress/domain/export-job/ExportJobState.js"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobPollingConfig } from "@exitpress/domain/export-job/schema/ExportJobPollingConfig.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { UploadProviderFields } from "@exitpress/domain/upload/schema/UploadProvider.js"

import { fetchJson, postJson } from "../../lib/Api.js"

type UploadProviderInput = {
  providerKey: string
  providerFields: UploadProviderFields
}

const defaultJobPollingConfig: ExportJobPollingConfig = {
  defaultPollMs: 1000,
  fastPollMs: 250,
  uploadBurstPollMs: 200,
  uploadBurstAttempts: 12,
}

let activeJobPollingConfig = defaultJobPollingConfig

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const getExportJobPollingConfig = () => activeJobPollingConfig

export const setExportJobPollingConfig = (config?: Partial<ExportJobPollingConfig>) => {
  if (!config) {
    activeJobPollingConfig = defaultJobPollingConfig
    return
  }

  activeJobPollingConfig = {
    defaultPollMs: normalizePositiveInteger(
      config.defaultPollMs,
      defaultJobPollingConfig.defaultPollMs,
    ),
    fastPollMs: normalizePositiveInteger(config.fastPollMs, defaultJobPollingConfig.fastPollMs),
    uploadBurstPollMs: normalizePositiveInteger(
      config.uploadBurstPollMs,
      defaultJobPollingConfig.uploadBurstPollMs,
    ),
    uploadBurstAttempts: normalizePositiveInteger(
      config.uploadBurstAttempts,
      defaultJobPollingConfig.uploadBurstAttempts,
    ),
  }
}

export const useExportJob = () => {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ExportJobState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pollVersion, setPollVersion] = useState(0)
  const restartPollingRef = useRef(false)
  const displayedJobRef = useRef<ExportJobState | null>(null)
  const { defaultPollMs, fastPollMs } = getExportJobPollingConfig()

  useEffect(() => {
    if (!jobId) {
      return
    }

    let cancelled = false
    let timeoutId: number | null = null
    const shouldLoadImmediately =
      !restartPollingRef.current && !displayedJobRef.current?.resumeAvailable

    restartPollingRef.current = false

    const scheduleNextLoad = (status: ExportJobState["status"] | null | undefined) => {
      const nextDelay = status === JOB_STATUSES.UPLOADING ? fastPollMs : defaultPollMs

      timeoutId = window.setTimeout(() => {
        void load()
      }, nextDelay)
    }

    const load = async () => {
      const nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)

      if (cancelled || !nextJob) {
        return
      }

      displayedJobRef.current = nextJob
      setJob(nextJob)

      if (isTerminalJobStatus(nextJob.status) || nextJob.resumeAvailable) {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
        }
        return
      }

      scheduleNextLoad(nextJob.status)
    }

    if (shouldLoadImmediately) {
      void load()
    } else if (!displayedJobRef.current?.resumeAvailable) {
      scheduleNextLoad(displayedJobRef.current?.status)
    }

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [defaultPollMs, fastPollMs, jobId, pollVersion])

  const startJob = useCallback(
    async ({
      blogKey,
      sourceInput,
      outputDir,
      profile = "gfm",
      options,
      scanResult,
      uploadProvider,
    }: {
      blogKey: string
      sourceInput: string
      outputDir: string
      profile?: ExportProfile
      options: ExportOptions
      scanResult?: ScanResult | null
      uploadProvider?: UploadProviderInput
    }) => {
      setSubmitting(true)
      displayedJobRef.current = null
      setJob(null)

      try {
        const response = await postJson<{ jobId: string }>("/api/export", {
          blogKey,
          sourceInput,
          outputDir,
          profile,
          options,
          scanResult,
          ...(uploadProvider ? { uploadProvider } : {}),
        })

        setJobId(response.jobId)
        return response.jobId
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  const resumeJob = useCallback(async () => {
    if (!jobId) {
      throw new Error("재개할 작업이 없습니다.")
    }

    const previousJob = displayedJobRef.current
    const resumedJob = previousJob
      ? {
          ...previousJob,
          resumeAvailable: false,
        }
      : previousJob

    setSubmitting(true)
    displayedJobRef.current = resumedJob
    setJob(resumedJob)

    try {
      const response = await postJson<{ jobId: string; status: string }>(
        `/api/export/${jobId}/resume`,
        {},
      )
      restartPollingRef.current = true
      setPollVersion((current) => current + 1)
      return response
    } finally {
      setSubmitting(false)
    }
  }, [jobId])

  const hydrateJob = useCallback((nextJob: ExportJobState | null) => {
    displayedJobRef.current = nextJob
    setJob(nextJob)
    setJobId(nextJob?.id ?? null)
  }, [])

  return {
    job,
    jobId,
    submitting,
    hydrateJob,
    resumeJob,
    setJob,
    startJob,
  }
}
