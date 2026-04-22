import { describe, expect, it } from "vitest"

import { defaultExportOptions } from "../src/shared/export-options.js"
import type { ExportManifest, ExportRequest } from "../src/shared/types.js"
import { JobStore } from "../src/server/job-store.js"

const request: ExportRequest = {
  blogIdOrUrl: "mym0404",
  outputDir: "./output",
  profile: "gfm",
  options: defaultExportOptions(),
}

const manifest: ExportManifest = {
  blogId: "mym0404",
  profile: "gfm",
  options: defaultExportOptions(),
  selectedCategoryIds: [101],
  startedAt: "2026-04-21T00:00:00.000Z",
  finishedAt: "2026-04-21T00:00:05.000Z",
  totalPosts: 1,
  successCount: 1,
  failureCount: 0,
  warningCount: 0,
  upload: {
    status: "not-requested",
    eligiblePostCount: 0,
    candidateCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  categories: [],
  posts: [
    {
      logNo: "223034929697",
      title: "테스트 글",
      source: "https://blog.naver.com/mym0404/223034929697",
      category: {
        id: 101,
        name: "NestJS",
        path: ["NestJS"],
      },
      editorVersion: 4,
      status: "success",
      outputPath: "posts/first/index.md",
      assetPaths: [],
      upload: {
        eligible: false,
        candidateCount: 0,
        uploadedCount: 0,
        failedCount: 0,
        candidates: [],
        uploadedUrls: [],
        rewriteStatus: "pending",
        rewrittenAt: null,
      },
      warnings: [],
      warningCount: 0,
      error: null,
    },
  ],
  job: {
    id: "job-resume",
    phase: "result",
    request,
    status: "completed",
    createdAt: "2026-04-21T00:00:00.000Z",
    startedAt: "2026-04-21T00:00:01.000Z",
    finishedAt: "2026-04-21T00:00:05.000Z",
    updatedAt: "2026-04-21T00:00:06.000Z",
    progress: {
      total: 1,
      completed: 1,
      failed: 0,
      warnings: 0,
    },
    upload: {
      status: "not-requested",
      eligiblePostCount: 0,
      candidateCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      terminalReason: null,
    },
    error: null,
    scanResult: {
      blogId: "mym0404",
      totalPostCount: 1,
    },
    summary: {
      status: "completed",
      outputDir: "./output",
      totalPosts: 1,
      completedCount: 1,
      failedCount: 0,
      uploadCandidateCount: 0,
      uploadedCount: 0,
    },
  },
}

describe("JobStore", () => {
  it("hydrates runtime items from manifest posts and resets persisted logs", () => {
    const store = new JobStore()

    const hydrated = store.hydrate(manifest)

    expect(hydrated.logs).toEqual([])
    expect(hydrated.items).toHaveLength(1)
    expect(hydrated.items[0]).toMatchObject({
      id: "posts/first/index.md",
      outputPath: "posts/first/index.md",
      updatedAt: "2026-04-21T00:00:06.000Z",
    })
  })
})
