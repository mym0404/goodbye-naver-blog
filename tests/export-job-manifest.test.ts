import { describe, expect, it } from "vitest"

import { defaultExportOptions } from "../src/shared/export-options.js"
import type { ExportJobState, ScanResult } from "../src/shared/types.js"
import { buildResumableExportManifest } from "../src/server/export-job-manifest.js"

const scanResult: ScanResult = {
  blogId: "mym0404",
  totalPostCount: 2,
  categories: [
    {
      id: 17,
      name: "M2JAM",
      parentId: null,
      postCount: 2,
      isDivider: false,
      isOpen: true,
      path: ["M2JAM"],
      depth: 0,
    },
  ],
  posts: [
    {
      blogId: "mym0404",
      logNo: "220971999345",
      title: "post-1",
      publishedAt: "2017-03-31T00:00:00+09:00",
      categoryId: 17,
      categoryName: "M2JAM",
      source: "https://blog.naver.com/mym0404/220971999345",
      editorVersion: 4,
      thumbnailUrl: null,
    },
    {
      blogId: "mym0404",
      logNo: "220971956932",
      title: "post-2",
      publishedAt: "2017-03-31T00:00:00+09:00",
      categoryId: 17,
      categoryName: "M2JAM",
      source: "https://blog.naver.com/mym0404/220971956932",
      editorVersion: 4,
      thumbnailUrl: null,
    },
  ],
}

const job: ExportJobState = {
  id: "job-resume",
  request: {
    blogIdOrUrl: "mym0404",
    outputDir: "./output",
    profile: "gfm",
    options: defaultExportOptions(),
  },
  status: "running",
  resumeAvailable: true,
  logs: [
    {
      timestamp: "2026-04-22T07:43:23.550Z",
      message: "이전 진행 상태 복구: 완료 1개, 남음 1개",
    },
  ],
  createdAt: "2026-04-22T07:40:00.000Z",
  startedAt: "2026-04-22T07:40:01.000Z",
  finishedAt: null,
  progress: {
    total: 2,
    completed: 1,
    failed: 0,
    warnings: 1,
  },
  upload: {
    status: "not-requested",
    eligiblePostCount: 0,
    candidateCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    terminalReason: null,
  },
  items: [
    {
      id: "posts/post-1/index.md",
      logNo: "220971999345",
      title: "post-1",
      source: "https://blog.naver.com/mym0404/220971999345",
      category: {
        id: 17,
        name: "M2JAM",
        path: ["M2JAM"],
      },
      editorVersion: 4,
      status: "success",
      outputPath: "posts/post-1/index.md",
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
      warnings: ["warn-1"],
      warningCount: 1,
      error: null,
      externalPreviewUrl: "https://markdownviewer.pages.dev/#share=test",
      updatedAt: "2026-04-22T07:43:23.550Z",
    },
  ],
  manifest: null,
  error: null,
}

describe("buildResumableExportManifest", () => {
  it("strips heavy resume-only fields from the persisted job snapshot", () => {
    const manifest = buildResumableExportManifest({
      job,
      scanResult,
    })

    expect(manifest.posts[0]?.warnings).toEqual(["warn-1"])
    expect(manifest.posts[0]?.externalPreviewUrl).toBe("https://markdownviewer.pages.dev/#share=test")
    expect(manifest.job?.items[0]?.warnings).toEqual([])
    expect(manifest.job?.items[0]?.externalPreviewUrl).toBeNull()
    expect(manifest.job?.scanResult?.posts).toBeUndefined()
  })
})
