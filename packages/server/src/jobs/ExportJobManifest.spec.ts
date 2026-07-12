import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { createTestPath } from "@tests/support/test-paths.js"
import { describe, expect, it } from "vitest"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"

import { buildResumableExportManifest } from "./ExportJobManifest.js"

const testOutputDir = createTestPath("export-job-manifest", "output")
const jobOptions = defaultExportOptions()
jobOptions.blockOutputs.templates.gfm!["naver-se4:image"] = "{{ `![${alt}](${url})` }}"

const scanResult: ScanResult = {
  blogKey: "naver",
  sourceId: "mym0404",
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
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "220971999345",
      title: "post-1",
      publishedAt: "2017-03-31T00:00:00+09:00",
      categoryId: 17,
      categoryName: "M2JAM",
      source: "https://blog.naver.com/mym0404/220971999345",
      thumbnailUrl: null,
    },
    {
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "220971956932",
      title: "post-2",
      publishedAt: "2017-03-31T00:00:00+09:00",
      categoryId: 17,
      categoryName: "M2JAM",
      source: "https://blog.naver.com/mym0404/220971956932",
      thumbnailUrl: null,
    },
  ],
}

const job: ExportJobState = {
  id: "job-resume",
  request: {
    blogKey: "naver",
    sourceInput: "mym0404",
    outputDir: testOutputDir,
    profile: "gfm",
    options: jobOptions,
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
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "220971999345",
      title: "post-1",
      source: "https://blog.naver.com/mym0404/220971999345",
      category: {
        id: 17,
        name: "M2JAM",
        path: ["M2JAM"],
      },
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
      error: null,
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

    expect(manifest.posts[0]).not.toHaveProperty("externalPreviewUrl")
    expect(manifest.job).not.toHaveProperty("logs")
    expect(manifest.job).not.toHaveProperty("items")
    expect(manifest.job?.scanResult).toEqual({
      blogKey: scanResult.blogKey,
      sourceId: scanResult.sourceId,
      totalPostCount: scanResult.totalPostCount,
    })
    expect(manifest.options.blockOutputs.templates.gfm?.["naver-se4:image"]).toBe(
      "{{ `![${alt}](${url})` }}",
    )
    expect(manifest.job?.request.options.blockOutputs.templates.gfm).not.toHaveProperty("code")
  })
})
