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
      },
      warnings: [],
      warningCount: 0,
      error: null,
      externalPreviewUrl: "https://markdownviewer.pages.dev/#share=test",
    },
  ],
}

describe("JobStore", () => {
  it("preserves externalPreviewUrl when rebuilding items from manifest posts", () => {
    const store = new JobStore()
    const job = store.create(request)

    store.completeExport(job.id, manifest)

    expect(store.get(job.id)?.items[0]?.externalPreviewUrl).toBe(
      "https://markdownviewer.pages.dev/#share=test",
    )
  })
})
