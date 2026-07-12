import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import {
  baseScanResult,
  cleanupTestServerRoots,
  createTestHttpServer,
  startServer,
} from "@tests/support/server/HttpServerSpecHarness.js"
import { createTestTempDir } from "@tests/support/test-paths.js"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ScanResult } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportJobState } from "@exitpress/domain/export-job/schema/ExportJobState.js"
import type { ExportManifest } from "@exitpress/domain/export-job/schema/ExportManifest.js"

let activeServer: ReturnType<typeof createTestHttpServer> | null = null

afterEach(async () => {
  vi.restoreAllMocks()

  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
    activeServer = null
  }

  await cleanupTestServerRoots()
})

describe("http server resume defaults", () => {
  it("returns frontmatter metadata from export defaults", async () => {
    const rootDir = await createTestTempDir("export-defaults-")
    const settingsPath = path.join(rootDir, "export-ui-settings.json")
    const outputDir = path.join(rootDir, "output")

    try {
      await mkdir(outputDir, { recursive: true })
      await writeFile(
        settingsPath,
        JSON.stringify({
          lastOutputDir: outputDir,
        }),
      )

      activeServer = createTestHttpServer({
        settingsPath,
      })
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/export-defaults`)
      const body = (await response.json()) as {
        frontmatterFieldMeta: {
          title: {
            label: string
            description: string
            defaultAlias: string
          }
        }
        options: {
          frontmatter: {
            aliases: {
              title: string
            }
          }
          structure: {
            groupByCategory: boolean
            slugStyle: string
            slugWhitespace: string
            postFolderNameTemplate: string
          }
          blockOutputs: {
            templates: Record<string, string>
          }
          assets: {
            stickerAssetMode: string
          }
        }
        lastOutputDir: string
        resumedJob: ExportJobState | null
        optionDescriptions: Record<string, string>
      }

      expect(response.ok).toBe(true)
      expect(body.frontmatterFieldMeta.title).toEqual({
        label: "title",
        description: "글 제목을 기록합니다.",
        defaultAlias: "title",
      })
      expect(body.options.frontmatter.aliases.title).toBe("")
      expect(body.options.structure.groupByCategory).toBe(true)
      expect(body.options.structure.slugStyle).toBe("snake")
      expect(body.options.structure.slugWhitespace).toBe("underscore")
      expect(body.options.structure.postFolderNameTemplate).toBe("{{ date }}-{{ slug }}")
      expect(body.options.blockOutputs.templates).toEqual({
        gfm: {},
        fumadocs: {},
        docusaurus: {},
        nextra: {},
      })
      expect(body.options.assets.stickerAssetMode).toBe("ignore")
      expect(body.lastOutputDir).toBe(outputDir)
      expect(body.resumedJob).toBeNull()
      expect(body.optionDescriptions["assets-imageContentMode"]).toBeUndefined()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("hydrates resumed jobs from manifest.json", async () => {
    const rootDir = await createTestTempDir("export-manifest-resume-")
    const settingsPath = path.join(rootDir, "export-ui-settings.json")
    const outputDir = path.join(rootDir, "output")

    try {
      await mkdir(outputDir, { recursive: true })
      await writeFile(
        settingsPath,
        JSON.stringify({
          lastOutputDir: outputDir,
        }),
      )
      await writeFile(
        path.join(outputDir, "manifest.json"),
        JSON.stringify(
          {
            blogKey: "naver",
            sourceId: "mym0404",
            profile: "gfm",
            options: defaultExportOptions(),
            selectedCategoryIds: [84],
            startedAt: "2026-04-11T04:00:00.000Z",
            finishedAt: null,
            totalPosts: 3,
            successCount: 1,
            failureCount: 0,
            upload: {
              status: "not-requested",
              eligiblePostCount: 0,
              candidateCount: 0,
              uploadedCount: 0,
              failedCount: 0,
              terminalReason: null,
            },
            categories: baseScanResult.categories,
            posts: [],
            job: {
              id: "job-resume",
              phase: "export",
              request: {
                blogKey: "naver",
                sourceInput: "mym0404",
                outputDir,
                profile: "gfm",
                options: defaultExportOptions(),
              },
              status: "running",
              createdAt: "2026-04-11T04:00:00.000Z",
              startedAt: "2026-04-11T04:00:01.000Z",
              finishedAt: null,
              updatedAt: "2026-04-11T04:00:02.000Z",
              progress: {
                total: 3,
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
              error: null,
              scanResult: {
                blogKey: "naver",
                sourceId: baseScanResult.sourceId,
                totalPostCount: baseScanResult.totalPostCount,
              },
              summary: {
                status: "running",
                outputDir,
                totalPosts: 3,
                completedCount: 1,
                failedCount: 0,
                uploadCandidateCount: 0,
                uploadedCount: 0,
              },
            },
          } satisfies ExportManifest,
          null,
          2,
        ),
        "utf8",
      )

      activeServer = createTestHttpServer({
        settingsPath,
      })
      const baseUrl = await startServer(activeServer)

      const response = await fetch(`${baseUrl}/api/export-defaults`)
      const body = (await response.json()) as {
        resumedJob: ExportJobState | null
        resumeSummary: {
          status: string
          outputDir: string
        } | null
        resumedScanResult: ScanResult | null
      }

      expect(response.ok).toBe(true)
      expect(body.resumedJob?.id).toBe("job-resume")
      expect(body.resumedJob?.status).toBe("running")
      expect(body.resumedJob?.logs).toEqual([])
      expect(body.resumedJob?.request.outputDir).toBe(outputDir)
      expect(body.resumeSummary?.outputDir).toBe(outputDir)
      expect(body.resumedScanResult?.sourceId).toBe(baseScanResult.sourceId)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
