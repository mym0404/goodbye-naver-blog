import { useEffect, useRef, useState } from "react"

import type { ExportJobState, ExportOptions, ScanResult } from "../../shared/types.js"

import { fetchJson, postJson, postUploadJson } from "../lib/api.js"

type UploadProviderInput = {
  providerKey: string
  providerFields: Record<string, string>
}

const terminalStatuses = new Set([
  "completed",
  "upload-completed",
  "upload-failed",
  "failed",
])

export const useExportJob = () => {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ExportJobState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [pollVersion, setPollVersion] = useState(0)
  const restartPollingRef = useRef(false)

  useEffect(() => {
    if (!jobId) {
      return
    }

    let cancelled = false
    let intervalId: number | null = null
    const shouldLoadImmediately = !restartPollingRef.current

    restartPollingRef.current = false

    const load = async () => {
      const nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)

      if (cancelled) {
        return
      }

      setJob(nextJob)

      if (terminalStatuses.has(nextJob.status) && intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }

    if (shouldLoadImmediately) {
      void load()
    }
    intervalId = window.setInterval(() => {
      void load()
    }, 1000)

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
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
      const nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)

      setJob(nextJob)

      return response
    } catch (error) {
      if (!uploadAccepted) {
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
