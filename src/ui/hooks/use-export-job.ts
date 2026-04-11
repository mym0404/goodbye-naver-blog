import { useEffect, useState } from "react"

import type { ExportJobState, ExportOptions } from "../../shared/types.js"

import { fetchJson, postJson } from "../lib/api.js"

export const useExportJob = () => {
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ExportJobState | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

      if ((nextJob.status === "completed" || nextJob.status === "failed") && intervalId !== null) {
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

  return {
    job,
    jobId,
    submitting,
    setJob,
    startJob,
  }
}
