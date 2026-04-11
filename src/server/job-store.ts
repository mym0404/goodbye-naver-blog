import { randomUUID } from "node:crypto"

import type {
  ExportJobItem,
  ExportJobState,
  ExportManifest,
  ExportRequest,
} from "../shared/types.js"

export class JobStore {
  readonly jobs = new Map<string, ExportJobState>()

  create(request: ExportRequest) {
    const id = randomUUID()
    const state: ExportJobState = {
      id,
      request,
      status: "queued",
      logs: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        warnings: 0,
      },
      items: [],
      manifest: null,
      error: null,
    }

    this.jobs.set(id, state)

    return state
  }

  get(id: string) {
    return this.jobs.get(id) ?? null
  }

  start(id: string) {
    const job = this.mustGet(id)
    job.status = "running"
    job.startedAt = new Date().toISOString()
  }

  appendLog(id: string, message: string) {
    const job = this.mustGet(id)

    job.logs.push({
      timestamp: new Date().toISOString(),
      message,
    })
  }

  updateProgress(
    id: string,
    progress: {
      total: number
      completed: number
      failed: number
      warnings: number
    },
  ) {
    const job = this.mustGet(id)
    job.progress = progress
  }

  appendItem(id: string, item: ExportJobItem) {
    const job = this.mustGet(id)
    const existingItemIndex = job.items.findIndex((existing) => existing.id === item.id)

    if (existingItemIndex >= 0) {
      job.items[existingItemIndex] = item
      return
    }

    job.items.push(item)
  }

  complete(id: string, manifest: ExportManifest) {
    const job = this.mustGet(id)
    job.status = "completed"
    job.finishedAt = new Date().toISOString()
    job.manifest = manifest
    job.progress = {
      total: manifest.totalPosts,
      completed: manifest.successCount,
      failed: manifest.failureCount,
      warnings: manifest.warningCount,
    }
    job.items = job.items.length > 0 ? job.items : manifest.posts.map((post) => ({
      id: post.outputPath ?? `failed:${post.logNo}`,
      logNo: post.logNo,
      title: post.title,
      source: post.source,
      category: post.category,
      status: post.status,
      outputPath: post.outputPath,
      assetPaths: post.assetPaths,
      warnings: post.warnings,
      warningCount: post.warningCount,
      error: post.error,
      markdown: null,
      updatedAt: new Date().toISOString(),
    }))
  }

  fail(id: string, error: string) {
    const job = this.mustGet(id)
    job.status = "failed"
    job.finishedAt = new Date().toISOString()
    job.error = error
  }

  private mustGet(id: string) {
    const job = this.jobs.get(id)

    if (!job) {
      throw new Error(`job not found: ${id}`)
    }

    return job
  }
}
