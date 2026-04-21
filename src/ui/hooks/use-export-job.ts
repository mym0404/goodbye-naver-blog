import { useEffect, useRef, useState } from "react"

import type {
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
const defaultPollMs = 1000
const fastPollMs = 250
const uploadBurstPollMs = 200
const uploadBurstAttempts = 12
const uploadCompletionHoldMs = 3000

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
  const completionHoldTimeoutRef = useRef<number | null>(null)

  const commitObservedJob = (nextJob: ExportJobState) => {
    const previousJob = displayedJobRef.current
    const shouldHoldUploadCompletion =
      nextJob.status === "upload-completed" &&
      nextJob.upload.candidateCount > 0 &&
      nextJob.upload.uploadedCount > 0 &&
      (previousJob?.status === "upload-ready" || previousJob?.status === "uploading")

    if (completionHoldTimeoutRef.current !== null) {
      window.clearTimeout(completionHoldTimeoutRef.current)
      completionHoldTimeoutRef.current = null
    }

    if (shouldHoldUploadCompletion) {
      const heldJob: ExportJobState = {
        ...nextJob,
        status: "uploading",
        upload: {
          ...nextJob.upload,
          status: "uploading",
        },
      }

      displayedJobRef.current = heldJob
      setJob(heldJob)
      completionHoldTimeoutRef.current = window.setTimeout(() => {
        displayedJobRef.current = nextJob
        setJob(nextJob)
        completionHoldTimeoutRef.current = null
      }, uploadCompletionHoldMs)
      return
    }

    displayedJobRef.current = nextJob
    setJob(nextJob)
  }

  useEffect(() => {
    if (!jobId) {
      return
    }

    let cancelled = false
    let timeoutId: number | null = null
    const shouldLoadImmediately = !restartPollingRef.current

    restartPollingRef.current = false

    const scheduleNextLoad = (status: ExportJobState["status"] | null | undefined) => {
      const nextDelay = fastPollingStatuses.has(status ?? "") ? fastPollMs : defaultPollMs

      timeoutId = window.setTimeout(() => {
        void load()
      }, nextDelay)
    }

    const load = async () => {
      const nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)

      if (cancelled || !nextJob) {
        return
      }

      commitObservedJob(nextJob)

      if (terminalStatuses.has(nextJob.status)) {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
        }
        return
      }

      scheduleNextLoad(nextJob.status)
    }

    if (shouldLoadImmediately) {
      void load()
    } else {
      scheduleNextLoad(job?.status)
    }

    return () => {
      cancelled = true
      if (completionHoldTimeoutRef.current !== null) {
        window.clearTimeout(completionHoldTimeoutRef.current)
        completionHoldTimeoutRef.current = null
      }
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

      for (let attempt = 0; attempt < uploadBurstAttempts; attempt += 1) {
        nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)
        commitObservedJob(nextJob)

        const shouldKeepBurstPolling =
          nextJob.status === "upload-ready" ||
          (nextJob.status === "uploading" &&
            nextJob.upload.uploadedCount <= 0 &&
            nextJob.upload.candidateCount > 0)

        if (!shouldKeepBurstPolling) {
          break
        }

        await wait(uploadBurstPollMs)
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

  return {
    job,
    jobId,
    submitting,
    uploadSubmitting,
    setJob,
    startJob,
    startUpload,
  }
}
