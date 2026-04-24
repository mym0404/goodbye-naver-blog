import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it, vi } from "vitest"

import {
  parseSinglePostCliArgs,
  renderSinglePostSummary,
  singlePostCliUsage,
} from "../scripts/lib/single-post-cli.js"
import { type RunSinglePostCliDeps, runSinglePostCli } from "../scripts/export-single-post.js"
import { createTestPath } from "./helpers/test-paths.js"

type RunSinglePostExportFn = NonNullable<RunSinglePostCliDeps["exportSinglePost"]>
const testOutputDir = createTestPath("single-post-cli", "output")
const testExporterMarkdownFilePath = createTestPath("single-post-cli", "output", "posts", "my-blog.md")

describe("single-post cli", () => {
  it("parses required and optional flags", () => {
    expect(
      parseSinglePostCliArgs([
        "--blogId",
        "my-blog",
        "--logNo",
        "123456789012",
        "--outputDir",
        testOutputDir,
        "--report",
        "./report.json",
        "--manualReviewMarkdownPath",
        "./post.md",
        "--metadataCachePath",
        "./metadata-cache.json",
        "--options",
        "./options.json",
        "--stdout",
      ]),
    ).toEqual({
      blogId: "my-blog",
      logNo: "123456789012",
      outputDir: testOutputDir,
      reportPath: "./report.json",
      manualReviewMarkdownPath: "./post.md",
      metadataCachePath: "./metadata-cache.json",
      optionsPath: "./options.json",
      stdout: true,
    })
  })

  it("throws the usage string when required flags are missing", () => {
    expect(() =>
      parseSinglePostCliArgs(["--blogId", "my-blog", "--outputDir", testOutputDir]),
    ).toThrow(singlePostCliUsage())
  })

  it("shows the real pnpm exec entrypoint in the usage string", () => {
      expect(singlePostCliUsage()).toBe(
      "Usage: pnpm exec tsx scripts/export-single-post.ts --blogId my-blog --logNo 123456789012 --outputDir ./output [--report ./output/report.json] [--manualReviewMarkdownPath ./output/post.md] [--metadataCachePath ./output/metadata-cache.json] [--options ./config/single-post.json] [--stdout]",
      )
    })

  it("renders a concise summary with warning counts and markdown path", () => {
    expect(
      renderSinglePostSummary({
        blogId: "my-blog",
        logNo: "123456789012",
        editorVersion: 4,
        blockTypes: ["paragraph", "code"],
        exporterMarkdownFilePath: testExporterMarkdownFilePath,
        manualReviewMarkdownFilePath: "/tmp/manual-review/post.md",
        metadataCachePath: "/tmp/manual-review/metadata-cache.json",
        parserWarnings: ["parser 1", "parser 2"],
        reviewerWarnings: ["reviewer 1"],
        renderWarnings: [],
      }),
    ).toBe([
      "blogId: my-blog",
      "logNo: 123456789012",
      "editorVersion: 4",
      "blockTypes: paragraph, code",
      "parserWarnings: 2",
      "reviewerWarnings: 1",
      "renderWarnings: 0",
      `exporterMarkdownFilePath: ${testExporterMarkdownFilePath}`,
      "manualReviewMarkdownFilePath: /tmp/manual-review/post.md",
      "metadataCachePath: /tmp/manual-review/metadata-cache.json",
    ].join("\n"))
  })

  it("renders stdout-only summary when markdown is not written", () => {
    expect(
      renderSinglePostSummary({
        blogId: "my-blog",
        logNo: "123456789012",
        editorVersion: 4,
        blockTypes: [],
        exporterMarkdownFilePath: testExporterMarkdownFilePath,
        manualReviewMarkdownFilePath: null,
        metadataCachePath: null,
        parserWarnings: [],
        reviewerWarnings: [],
        renderWarnings: ["render 1"],
      }),
    ).toBe([
      "blogId: my-blog",
      "logNo: 123456789012",
      "editorVersion: 4",
      "blockTypes: (none)",
      "parserWarnings: 0",
      "reviewerWarnings: 0",
      "renderWarnings: 1",
      `exporterMarkdownFilePath: ${testExporterMarkdownFilePath}`,
      "manualReviewMarkdownFilePath: (not provided)",
      "metadataCachePath: (not provided)",
    ].join("\n"))
  })

  it("writes a report file and keeps stdout empty when --stdout is omitted", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const reportPath = path.join(rootDir, "report.json")
    const manualReviewMarkdownPath = path.join(rootDir, "post.md")
    const metadataCachePath = path.join(rootDir, "metadata-cache.json")
    const optionsPath = path.join(rootDir, "options.json")
    const markdownFilePath = path.join(outputDir, "posts", "single-post.md")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({
        blockOutputs: {
          defaults: {
            heading: {
              variant: "markdown-heading",
              params: {
                levelOffset: 2,
              },
            },
          },
        },
        unsupportedBlockCases: {
          "se3-oglink-og_bSize": {
            candidateId: "markdown-image-summary",
            confirmed: true,
          },
        },
      }),
      "utf8",
    )

    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const exportSinglePost = vi.fn(async ({ options }) => ({
      post: {
        blogId: "my-blog",
        logNo: "123456789012",
        title: "Single post",
        publishedAt: "2024-01-02T03:04:05+09:00",
        categoryId: 11,
        categoryName: "JavaScript",
        source: "https://blog.naver.com/my-blog/123456789012",
        editorVersion: 4,
        thumbnailUrl: null,
      },
      markdown: "# hello\n",
      markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
      editorVersion: 4,
      blockTypes: ["paragraph"],
      parserWarnings: ["parser warning"],
      reviewerWarnings: [],
      renderWarnings: ["render warning"],
      assetPaths: [],
      options,
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--blogId",
          "my-blog",
          "--logNo",
          "123456789012",
          "--outputDir",
          outputDir,
          "--report",
          reportPath,
          "--manualReviewMarkdownPath",
          manualReviewMarkdownPath,
          "--metadataCachePath",
          metadataCachePath,
          "--options",
          optionsPath,
        ],
        exportSinglePost: exportSinglePost as RunSinglePostExportFn,
        stdoutWrite,
        stderrWrite,
      })

      expect(exportSinglePost).toHaveBeenCalledTimes(1)
      expect(exportSinglePost.mock.calls[0][0].options.blockOutputs.defaults.heading?.params?.levelOffset).toBe(2)
      expect(Object.hasOwn(exportSinglePost.mock.calls[0][0].options, "unsupportedBlockCases")).toBe(false)
      expect(stdoutWrite).not.toHaveBeenCalled()
      expect(stderrWrite).toHaveBeenCalledWith(
        [
          "blogId: my-blog",
          "logNo: 123456789012",
          "editorVersion: 4",
          "blockTypes: paragraph",
          "parserWarnings: 1",
          "reviewerWarnings: 0",
          "renderWarnings: 1",
          `exporterMarkdownFilePath: ${markdownFilePath}`,
          `manualReviewMarkdownFilePath: ${manualReviewMarkdownPath}`,
          `metadataCachePath: ${metadataCachePath}`,
        ].join("\n"),
      )

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        markdownFilePath: string
        exporterMarkdownFilePath: string
        manualReviewMarkdownFilePath: string
        metadataCachePath: string
      }
      expect(report.markdownFilePath).toBe(markdownFilePath)
      expect(report.exporterMarkdownFilePath).toBe(markdownFilePath)
      expect(report.manualReviewMarkdownFilePath).toBe(manualReviewMarkdownPath)
      expect(report.metadataCachePath).toBe(metadataCachePath)
      expect(await readFile(manualReviewMarkdownPath, "utf8")).toBe("# hello\n")
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("writes markdown to stdout when --stdout is present", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")

    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()

    try {
      await runSinglePostCli({
        argv: [
          "--blogId",
          "my-blog",
          "--logNo",
          "123456789012",
          "--outputDir",
          outputDir,
          "--stdout",
        ],
        exportSinglePost: vi.fn(async () => ({
          post: {
            blogId: "my-blog",
            logNo: "123456789012",
            title: "Single post",
            publishedAt: "2024-01-02T03:04:05+09:00",
            categoryId: 11,
            categoryName: "JavaScript",
            source: "https://blog.naver.com/my-blog/123456789012",
            editorVersion: 4,
            thumbnailUrl: null,
          },
          markdown: "# stdout markdown",
          markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
          editorVersion: 4,
          blockTypes: ["paragraph"],
          parserWarnings: [],
          reviewerWarnings: [],
          renderWarnings: [],
          assetPaths: [],
        })) as RunSinglePostExportFn,
        stdoutWrite,
        stderrWrite,
      })

      expect(stdoutWrite).toHaveBeenCalledWith("# stdout markdown\n")
      expect(stderrWrite).toHaveBeenCalledWith(
        [
          "blogId: my-blog",
          "logNo: 123456789012",
          "editorVersion: 4",
          "blockTypes: paragraph",
          "parserWarnings: 0",
          "reviewerWarnings: 0",
          "renderWarnings: 0",
          `exporterMarkdownFilePath: ${path.join(outputDir, "posts", "single-post.md")}`,
          "manualReviewMarkdownFilePath: (not provided)",
          "metadataCachePath: (not provided)",
        ].join("\n"),
      )
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when options JSON has the wrong nested type", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({
        blockOutputs: {
          defaults: {
            heading: {
              params: {
                levelOffset: "bad",
              },
            },
          },
        },
      }),
      "utf8",
    )

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("Invalid --options JSON")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("passes frontmatter aliases through options JSON", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({ frontmatter: { aliases: { title: "postTitle", publishedAt: "published_on" } } }),
      "utf8",
    )

    const exportSinglePost = vi.fn(async ({ options }) => ({
      post: {
        blogId: "my-blog",
        logNo: "123456789012",
        title: "Single post",
        publishedAt: "2024-01-02T03:04:05+09:00",
        categoryId: 11,
        categoryName: "JavaScript",
        source: "https://blog.naver.com/my-blog/123456789012",
        editorVersion: 4,
        thumbnailUrl: null,
      },
      markdown: "# hello\n",
      markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
      editorVersion: 4,
      blockTypes: ["paragraph"],
      parserWarnings: [],
      reviewerWarnings: [],
      renderWarnings: [],
      assetPaths: [],
      options,
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--blogId",
          "my-blog",
          "--logNo",
          "123456789012",
          "--outputDir",
          outputDir,
          "--options",
          optionsPath,
        ],
        exportSinglePost: exportSinglePost as RunSinglePostExportFn,
        stdoutWrite: vi.fn(),
        stderrWrite: vi.fn(),
      })

      expect(exportSinglePost).toHaveBeenCalledTimes(1)
      expect(exportSinglePost.mock.calls[0][0].options.frontmatter.aliases.title).toBe("postTitle")
      expect(exportSinglePost.mock.calls[0][0].options.frontmatter.aliases.publishedAt).toBe("published_on")
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when removed markdown options are present in options JSON", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ markdown: { videoStyle: "link-only" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("markdown contains unsupported keys: videoStyle")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when removed structure legacy keys are present in options JSON", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ structure: { folderStrategy: "flat" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("structure contains unsupported keys: folderStrategy")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when removed asset legacy keys are present in options JSON", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ assets: { assetPathMode: "remote" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("assets contains unsupported keys: assetPathMode")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when frontmatter aliases collide", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({ frontmatter: { aliases: { title: "post", source: "post" } } }),
      "utf8",
    )

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow('title와 source가 같은 alias "post"를 사용하고 있습니다.')

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when options JSON is malformed", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cli-"))
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, "{\"markdown\":", "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogId",
            "my-blog",
            "--logNo",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          exportSinglePost: exportSinglePost as RunSinglePostExportFn,
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("Invalid --options JSON")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
