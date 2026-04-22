import { useEffect, useRef, useState } from "react"

import type {
  ExportJobPollingConfig,
  ExportJobState,
  ExportOptions,
  ScanResult,
  UploadProviderValue,
} from "../../shared/types.js"

import { fetchJson, postJson, postUploadJson } from "../lib/api.js"

type UploadProviderInput = {
  providerKey: string
  providerFields: Record<string, UploadProviderValue>
}

const terminalStatuses = new Set([
  "completed",
  "upload-completed",
  "upload-failed",
  "failed",
])
const fastPollingStatuses = new Set(["uploading"])
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

export const setExportJobPollingConfig = (config?: Partial<ExportJobPollingConfig>) => {
  if (!config) {
    activeJobPollingConfig = defaultJobPollingConfig
    return
  }

  activeJobPollingConfig = {
    defaultPollMs: normalizePositiveInteger(config.defaultPollMs, defaultJobPollingConfig.defaultPollMs),
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

export const useExportJob = () => {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ExportJobState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [pollVersion, setPollVersion] = useState(0)
  const restartPollingRef = useRef(false)
  const displayedJobRef = useRef<ExportJobState | null>(null)

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
      const nextDelay = fastPollingStatuses.has(status ?? "")
        ? activeJobPollingConfig.fastPollMs
        : activeJobPollingConfig.defaultPollMs

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

      if (terminalStatuses.has(nextJob.status) || nextJob.resumeAvailable) {
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
      scheduleNextLoad(job?.status)
    }

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [jobId, pollVersion])

  const startJob = async ({
    blogIdOrUrl,
    outputDir,
    options,
    scanResult,
  }: {
    blogIdOrUrl: string
    outputDir: string
    options: ExportOptions
    scanResult?: ScanResult | null
  }) => {
    setSubmitting(true)
    setUploadSubmitting(false)
    displayedJobRef.current = null
    setJob(null)

    try {
      const response = await postJson<{ jobId: string }>("/api/export", {
        blogIdOrUrl,
        outputDir,
        options,
        scanResult,
      })

      setJobId(response.jobId)
      return response.jobId
    } finally {
      setSubmitting(false)
    }
  }

  const startUpload = async ({ providerKey, providerFields }: UploadProviderInput) => {
    if (!jobId) {
      throw new Error("업로드할 작업이 없습니다.")
    }

    const previousJob = job
    let uploadAccepted = false

    setUploadSubmitting(true)
    setJob((current) =>
      current
        ? {
            ...current,
            status: "uploading",
            upload: {
              ...current.upload,
              status: "uploading",
            },
          }
        : current,
    )
    displayedJobRef.current =
      previousJob
        ? {
            ...previousJob,
            status: "uploading",
            resumeAvailable: false,
            upload: {
              ...previousJob.upload,
              status: "uploading",
            },
          }
        : previousJob

    try {
      const response = await postUploadJson<{ jobId: string; status: string }>(
        `/api/export/${jobId}/upload`,
        {
          providerKey,
          providerFields,
        },
      )
      uploadAccepted = true
      restartPollingRef.current = true
      setPollVersion((current) => current + 1)
      let nextJob: ExportJobState | null = null

      for (let attempt = 0; attempt < activeJobPollingConfig.uploadBurstAttempts; attempt += 1) {
        nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)
        displayedJobRef.current = nextJob
        setJob(nextJob)

        const shouldKeepBurstPolling =
          nextJob.status === "upload-ready" ||
          (nextJob.status === "uploading" &&
            nextJob.upload.uploadedCount <= 0 &&
            nextJob.upload.candidateCount > 0)

        if (!shouldKeepBurstPolling) {
          break
        }

        await wait(activeJobPollingConfig.uploadBurstPollMs)
      }

      return response
    } catch (error) {
      if (!uploadAccepted) {
        displayedJobRef.current = previousJob
        setJob(previousJob)
      }
      throw error
    } finally {
      setUploadSubmitting(false)
    }
  }

  const resumeJob = async () => {
    if (!jobId) {
      throw new Error("재개할 작업이 없습니다.")
    }

    setSubmitting(true)
    setJob((current) =>
      current
        ? {
            ...current,
            resumeAvailable: false,
          }
        : current,
    )

    try {
      const response = await postJson<{ jobId: string; status: string }>(`/api/export/${jobId}/resume`, {})
      restartPollingRef.current = true
      setPollVersion((current) => current + 1)
      return response
    } finally {
      setSubmitting(false)
    }
  }

  const hydrateJob = (nextJob: ExportJobState | null) => {
    displayedJobRef.current = nextJob
    setJob(nextJob)
    setJobId(nextJob?.id ?? null)
  }

  return {
    job,
    jobId,
    submitting,
    uploadSubmitting,
    hydrateJob,
    resumeJob,
    setJob,
    startJob,
    startUpload,
  }
}
