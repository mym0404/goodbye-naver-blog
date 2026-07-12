import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import type { SinglePostBlogRuntime } from "./SinglePostBlogRuntime.js"

import { createTestPath, createTestTempDir } from "../../tests/support/test-paths.js"

import { runSinglePostCli } from "./export-single-post.js"
import { parseSinglePostCliArgs, singlePostCliUsage } from "./SinglePostArgs.js"
import { renderSinglePostInspectSummary, renderSinglePostSummary } from "./SinglePostSummary.js"

const testOutputDir = createTestPath("single-post-cli", "output")
const testExporterMarkdownFilePath = createTestPath(
  "single-post-cli",
  "output",
  "posts",
  "my-blog.md",
)

const createMockBlogRuntime = ({
  exportSinglePost = vi.fn(),
  inspectSinglePost = vi.fn(),
}: Partial<Pick<SinglePostBlogRuntime, "exportSinglePost" | "inspectSinglePost">> = {}) => ({
  exportSinglePost,
  inspectSinglePost,
  createFetcher: vi.fn(async () => ({
    scanBlog: async () => ({
      blogKey: "naver",
      sourceId: "my-blog",
      totalPostCount: 0,
      categories: [],
    }),
    getAllPosts: async () => [],
    fetchPostHtml: async () => "<div />",
    downloadBinary: async () => {},
    fetchBinary: async () => ({
      bytes: Buffer.from("asset"),
      contentType: "image/png",
    }),
  })),
})

const createGetBlogRuntime = (runtime: SinglePostBlogRuntime) =>
  vi.fn((blogKey: string) => {
    if (blogKey !== "naver") {
      throw new Error(`Unsupported blogKey: ${blogKey}`)
    }

    return runtime
  })

describe("single-post cli", () => {
  it("parses required and optional flags", () => {
    expect(
      parseSinglePostCliArgs([
        "--blogKey",
        "naver",
        "--sourceId",
        "my-blog",
        "--postId",
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
      blogKey: "naver",
      sourceId: "my-blog",
      postId: "123456789012",
      outputDir: testOutputDir,
      reportPath: "./report.json",
      manualReviewMarkdownPath: "./post.md",
      metadataCachePath: "./metadata-cache.json",
      optionsPath: "./options.json",
      inspect: false,
      stdout: true,
    })
  })

  it("parses inspect flags without outputDir", () => {
    expect(
      parseSinglePostCliArgs([
        "--inspect",
        "--blogKey",
        "naver",
        "--sourceId",
        "my-blog",
        "--postId",
        "123456789012",
        "--report",
        "./inspect.json",
        "--options",
        "./options.json",
        "--stdout",
      ]),
    ).toEqual({
      blogKey: "naver",
      sourceId: "my-blog",
      postId: "123456789012",
      outputDir: null,
      reportPath: "./inspect.json",
      manualReviewMarkdownPath: null,
      metadataCachePath: null,
      optionsPath: "./options.json",
      inspect: true,
      stdout: true,
    })
  })

  it("throws the usage string when required flags are missing", () => {
    expect(() =>
      parseSinglePostCliArgs([
        "--blogKey",
        "naver",
        "--sourceId",
        "my-blog",
        "--outputDir",
        testOutputDir,
      ]),
    ).toThrow(singlePostCliUsage())
  })

  it("shows the real pnpm exec entrypoint in the usage string", () => {
    expect(singlePostCliUsage()).toBe(
      "Usage: bun scripts/single-post/export-single-post.ts --blogKey naver --sourceId my-blog --postId 123456789012 --outputDir ./output [--report ./output/report.json] [--manualReviewMarkdownPath ./output/post.md] [--metadataCachePath ./output/metadata-cache.json] [--options ./config/single-post.json] [--stdout]\nInspect: bun scripts/single-post/export-single-post.ts --inspect --blogKey naver --sourceId my-blog --postId 123456789012 [--report ./inspect.json] [--options ./config/single-post.json] [--stdout]",
    )
  })

  it("renders a concise summary with markdown path", () => {
    expect(
      renderSinglePostSummary({
        blogKey: "naver",
        sourceId: "my-blog",
        postId: "123456789012",
        blockIds: ["paragraph", "code"],
        exporterMarkdownFilePath: testExporterMarkdownFilePath,
        manualReviewMarkdownFilePath: "/tmp/manual-review/post.md",
        metadataCachePath: "/tmp/manual-review/metadata-cache.json",
      }),
    ).toBe(
      [
        "blogKey: naver",
        "sourceId: my-blog",
        "postId: 123456789012",
        "blockIds: paragraph, code",
        `exporterMarkdownFilePath: ${testExporterMarkdownFilePath}`,
        "manualReviewMarkdownFilePath: /tmp/manual-review/post.md",
        "metadataCachePath: /tmp/manual-review/metadata-cache.json",
      ].join("\n"),
    )
  })

  it("renders stdout-only summary when markdown is not written", () => {
    expect(
      renderSinglePostSummary({
        blogKey: "naver",
        sourceId: "my-blog",
        postId: "123456789012",
        blockIds: [],
        exporterMarkdownFilePath: testExporterMarkdownFilePath,
        manualReviewMarkdownFilePath: null,
        metadataCachePath: null,
      }),
    ).toBe(
      [
        "blogKey: naver",
        "sourceId: my-blog",
        "postId: 123456789012",
        "blockIds: (none)",
        `exporterMarkdownFilePath: ${testExporterMarkdownFilePath}`,
        "manualReviewMarkdownFilePath: (not provided)",
        "metadataCachePath: (not provided)",
      ].join("\n"),
    )
  })

  it("renders inspect summary with unsupported nodes", () => {
    expect(
      renderSinglePostInspectSummary({
        reportPath: "/tmp/inspect.json",
        diagnostics: {
          blogKey: "naver",
          sourceId: "my-blog",
          postId: "123456789012",
          sourceUrl: "https://blog.naver.com/my-blog/123456789012",
          editor: {
            type: "naver-se4",
            label: "SmartEditor 4",
          },
          parse: {
            status: "failed",
            error: "파싱 가능한 naver-se4 block이 없습니다: div",
          },
          nodes: [],
          unsupportedNodes: [
            {
              path: "0",
              tagName: "div",
              unsupported: true,
              className: "se-component se-file",
              moduleType: "v2_file",
              text: "첨부파일 demo.pdf 파일 다운로드",
              html: "<div>demo</div>",
            },
          ],
        },
      }),
    ).toBe(
      [
        "blogKey: naver",
        "sourceId: my-blog",
        "postId: 123456789012",
        "editor: naver-se4 (SmartEditor 4)",
        "parse: failed",
        "error: 파싱 가능한 naver-se4 block이 없습니다: div",
        "unsupportedCount: 1",
        "inspectReportPath: /tmp/inspect.json",
        "  - path: 0",
        '    node: div class="se-component se-file" moduleType="v2_file"',
        "    text: 첨부파일 demo.pdf 파일 다운로드",
        "    html: <div>demo</div>",
      ].join("\n"),
    )
  })

  it("writes a report file and keeps stdout empty when --stdout is omitted", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
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
          templates: {
            "naver-se4:image": "{{ `![${alt}](${url})` }}",
          },
        },
      }),
      "utf8",
    )

    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const exportSinglePost = vi.fn(async ({ options }) => ({
      post: {
        blogKey: "naver",
        sourceId: "my-blog",
        postId: "123456789012",
        title: "Single post",
        publishedAt: "2024-01-02T03:04:05+09:00",
        categoryId: 11,
        categoryName: "JavaScript",
        source: "https://blog.naver.com/my-blog/123456789012",
        thumbnailUrl: null,
      },
      markdown: "# hello\n",
      markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
      blockIds: ["paragraph"],
      assetPaths: [],
      options,
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--blogKey",
          "naver",
          "--sourceId",
          "my-blog",
          "--postId",
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
        getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
        stdoutWrite,
        stderrWrite,
      })

      expect(exportSinglePost).toHaveBeenCalledTimes(1)
      expect(
        exportSinglePost.mock.calls[0][0].options.blockOutputs.templates.gfm?.["naver-se4:image"],
      ).toBe("{{ `![${alt}](${url})` }}")
      expect(stdoutWrite).not.toHaveBeenCalled()
      expect(stderrWrite).toHaveBeenCalledWith(
        [
          "blogKey: naver",
          "sourceId: my-blog",
          "postId: 123456789012",
          "blockIds: paragraph",
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

  it("runs inspect mode without export outputDir", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const reportPath = path.join(rootDir, "inspect.json")
    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const exportSinglePost = vi.fn()
    const inspectSinglePost = vi.fn(async () => ({
      blogKey: "naver",
      sourceId: "my-blog",
      postId: "123456789012",
      sourceUrl: "https://blog.naver.com/my-blog/123456789012",
      editor: {
        type: "naver-se4",
        label: "SmartEditor 4",
      },
      parse: {
        status: "failed" as const,
        error: "파싱 가능한 naver-se4 block이 없습니다: div",
      },
      nodes: [],
      unsupportedNodes: [
        {
          path: "0",
          tagName: "div",
          unsupported: true,
          text: "",
          html: "<div></div>",
        },
      ],
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--inspect",
          "--blogKey",
          "naver",
          "--sourceId",
          "my-blog",
          "--postId",
          "123456789012",
          "--report",
          reportPath,
          "--stdout",
        ],
        getBlogRuntime: createGetBlogRuntime(
          createMockBlogRuntime({ exportSinglePost, inspectSinglePost }),
        ),
        stdoutWrite,
        stderrWrite,
      })

      expect(exportSinglePost).not.toHaveBeenCalled()
      expect(inspectSinglePost).toHaveBeenCalledTimes(1)
      expect(inspectSinglePost).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "my-blog",
          postId: "123456789012",
        }),
      )
      expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"unsupportedNodes"'))
      expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("parse: failed"))

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        unsupportedNodes: unknown[]
      }

      expect(report.unsupportedNodes).toHaveLength(1)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("writes markdown to stdout when --stdout is present", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")

    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const exportSinglePost = vi.fn(async () => ({
      post: {
        blogKey: "naver",
        sourceId: "my-blog",
        postId: "123456789012",
        title: "Single post",
        publishedAt: "2024-01-02T03:04:05+09:00",
        categoryId: 11,
        categoryName: "JavaScript",
        source: "https://blog.naver.com/my-blog/123456789012",
        thumbnailUrl: null,
      },
      markdown: "# stdout markdown",
      markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
      blockIds: ["paragraph"],
      assetPaths: [],
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--blogKey",
          "naver",
          "--sourceId",
          "my-blog",
          "--postId",
          "123456789012",
          "--outputDir",
          outputDir,
          "--stdout",
        ],
        getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
        stdoutWrite,
        stderrWrite,
      })

      expect(stdoutWrite).toHaveBeenCalledWith("# stdout markdown\n")
      expect(stderrWrite).toHaveBeenCalledWith(
        [
          "blogKey: naver",
          "sourceId: my-blog",
          "postId: 123456789012",
          "blockIds: paragraph",
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
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({
        blockOutputs: {
          templates: {
            "naver-se4:formula": 1,
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
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("Invalid --options JSON")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when block output templates use unsupported fields", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({
        blockOutputs: {
          templates: {
            image: "{{ `![${alt}](${url})` }}",
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
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("blockOutputs.templates contains unsupported keys: image")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("passes frontmatter aliases through options JSON", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(
      optionsPath,
      JSON.stringify({
        frontmatter: { aliases: { title: "postTitle", publishedAt: "published_on" } },
      }),
      "utf8",
    )

    const exportSinglePost = vi.fn(async ({ options }) => ({
      post: {
        blogKey: "naver",
        sourceId: "my-blog",
        postId: "123456789012",
        title: "Single post",
        publishedAt: "2024-01-02T03:04:05+09:00",
        categoryId: 11,
        categoryName: "JavaScript",
        source: "https://blog.naver.com/my-blog/123456789012",
        thumbnailUrl: null,
      },
      markdown: "# hello\n",
      markdownFilePath: path.join(outputDir, "posts", "single-post.md"),
      blockIds: ["paragraph"],
      assetPaths: [],
      options,
    }))

    try {
      await runSinglePostCli({
        argv: [
          "--blogKey",
          "naver",
          "--sourceId",
          "my-blog",
          "--postId",
          "123456789012",
          "--outputDir",
          outputDir,
          "--options",
          optionsPath,
        ],
        getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
        stdoutWrite: vi.fn(),
        stderrWrite: vi.fn(),
      })

      expect(exportSinglePost).toHaveBeenCalledTimes(1)
      expect(exportSinglePost.mock.calls[0][0].options.frontmatter.aliases.title).toBe("postTitle")
      expect(exportSinglePost.mock.calls[0][0].options.frontmatter.aliases.publishedAt).toBe(
        "published_on",
      )
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when a removed markdown option container is present in options JSON", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ markdown: { videoStyle: "link-only" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("root contains unsupported keys: markdown")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when removed structure classic keys are present in options JSON", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ structure: { folderStrategy: "flat" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
          stdoutWrite: vi.fn(),
          stderrWrite: vi.fn(),
        }),
      ).rejects.toThrow("structure contains unsupported keys: folderStrategy")

      expect(exportSinglePost).not.toHaveBeenCalled()
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when removed asset classic keys are present in options JSON", async () => {
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, JSON.stringify({ assets: { assetPathMode: "remote" } }), "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
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
    const rootDir = await createTestTempDir("single-post-cli-")
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
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
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
    const rootDir = await createTestTempDir("single-post-cli-")
    const outputDir = path.join(rootDir, "output")
    const optionsPath = path.join(rootDir, "options.json")

    await mkdir(outputDir, { recursive: true })
    await writeFile(optionsPath, '{"markdown":', "utf8")

    const exportSinglePost = vi.fn()

    try {
      await expect(
        runSinglePostCli({
          argv: [
            "--blogKey",
            "naver",
            "--sourceId",
            "my-blog",
            "--postId",
            "123456789012",
            "--outputDir",
            outputDir,
            "--options",
            optionsPath,
          ],
          getBlogRuntime: createGetBlogRuntime(createMockBlogRuntime({ exportSinglePost })),
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
