import { useEffect, useState } from "react"

import type { ExportJobState, ExportOptions } from "../../shared/types.js"

import { fetchJson, postJson, postUploadJson } from "../lib/api.js"

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

  useEffect(() => {
    if (!jobId) {
      return
    }

    let cancelled = false
    let intervalId: number | null = null

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

    void load()
    intervalId = window.setInterval(() => {
      void load()
    }, 1000)

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [jobId])

  const startJob = async ({
    blogIdOrUrl,
    outputDir,
    options,
  }: {
    blogIdOrUrl: string
    outputDir: string
    options: ExportOptions
  }) => {
    setSubmitting(true)
    setUploadSubmitting(false)
    setJob(null)

    try {
      const response = await postJson<{ jobId: string }>("/api/export", {
        blogIdOrUrl,
        outputDir,
        options,
      })

      setJobId(response.jobId)
      return response.jobId
    } finally {
      setSubmitting(false)
    }
  }

  const startUpload = async ({
    uploaderKey,
    uploaderConfigJson,
  }: {
    uploaderKey: string
    uploaderConfigJson: string
  }) => {
    if (!jobId) {
      throw new Error("업로드할 작업이 없습니다.")
    }

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
      const response = await postUploadJson<{ jobId: string; status: string }>(`/api/export/${jobId}/upload`, {
        uploaderKey,
        uploaderConfigJson,
      })

      const nextJob = await fetchJson<ExportJobState>(`/api/export/${jobId}`)

      setJob(nextJob)
      return response
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
