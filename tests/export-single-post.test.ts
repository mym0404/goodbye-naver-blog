import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import { exportSinglePost } from "../src/modules/exporter/single-post-export.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

const blogId = "mym0404"
const logNo = "223034929697"
const sourceUrl = `https://blog.naver.com/${blogId}/${logNo}`
const inputBlogUrl = `https://blog.naver.com/${blogId}`

const createFetcher = ({
  blogId: resolvedBlogId,
  posts,
  html,
}: {
  blogId: string
  posts: Array<{
    blogId: string
    logNo: string
    title: string
    publishedAt: string
    categoryId: number
    categoryName: string
    source: string
    editorVersion: 2 | 3 | 4 | null
    thumbnailUrl: string | null
  }>
  html: string
}) => ({
  scanBlog: async () => ({
    blogId: resolvedBlogId,
    totalPostCount: posts.length,
    categories: [
      {
        id: 10,
        name: "Tech",
        parentId: null,
        postCount: 1,
        isDivider: false,
        isOpen: true,
        path: ["Tech"],
        depth: 0,
      },
      {
        id: 11,
        name: "JavaScript",
        parentId: 10,
        postCount: 1,
        isDivider: false,
        isOpen: true,
        path: ["Tech", "JavaScript"],
        depth: 1,
      },
    ],
  }),
  getAllPosts: async () => posts,
  fetchPostHtml: async (requestedLogNo: string) => {
    if (requestedLogNo !== logNo) {
      throw new Error(`unexpected logNo: ${requestedLogNo}`)
    }

    return html
  },
  downloadBinary: async ({ destinationPath }: { sourceUrl: string; destinationPath: string }) => {
    await mkdir(path.dirname(destinationPath), { recursive: true })
    await writeFile(destinationPath, "asset", "utf8")
  },
  fetchBinary: async () => ({
    bytes: Buffer.from("asset"),
    contentType: "image/png",
  }),
})

describe("exportSinglePost", () => {
  it("writes one markdown file and returns export diagnostics", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()

    const post = {
      blogId,
      logNo,
      title: "Single post",
      publishedAt: "2024-01-02T03:04:05+09:00",
      categoryId: 11,
      categoryName: "JavaScript",
      source: sourceUrl,
      editorVersion: 4 as const,
      thumbnailUrl: null,
    }

    const html = `
      <div id="viewTypeSelector">
        <div class="se-component se-text">
          <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
          <p class="se-text-paragraph">Hello <strong>world</strong></p>
        </div>
        <div class="se-component se-image">
          <a class="se-module-image-link" href="https://example.com/original.png">
            <img src="https://example.com/image.png" alt="fixture image" />
          </a>
        </div>
      </div>
    `

    try {
      const expectedHash = createHash("sha256").update("asset").digest("hex")
      const diagnostics = await exportSinglePost({
        blogId: inputBlogUrl,
        logNo,
        outputDir,
        options,
        createFetcher: ({ blogId: normalizedBlogId }) => {
          expect(normalizedBlogId).toBe(blogId)

          return createFetcher({
            blogId: normalizedBlogId,
            posts: [
              {
                ...post,
                logNo: "000000000000",
                title: "Other",
                categoryId: 10,
                categoryName: "Tech",
                source: "https://blog.naver.com/mym0404/000000000000",
                editorVersion: 2,
                thumbnailUrl: null,
              },
              post,
            ],
            html,
          })
        },
      })

      const expectedMarkdownFilePath = path.join(
        outputDir,
        "tech",
        "javascript",
        "2024-01-02-single_post",
        "index.md",
      )

      const expectedAssetFilePath = path.resolve(
        path.dirname(diagnostics.markdownFilePath),
        diagnostics.assetPaths[0],
      )

      expect(diagnostics.post).toEqual(post)
      expect(diagnostics.markdownFilePath).toBe(expectedMarkdownFilePath)
      expect(diagnostics.editorVersion).toBe(4)
      expect(diagnostics.blockTypes).toEqual(["paragraph", "image"])
      expect(diagnostics.parserWarnings).toEqual([])
      expect(diagnostics.reviewerWarnings).toEqual([])
      expect(diagnostics.renderWarnings).toEqual([])
      expect(diagnostics.assetPaths).toHaveLength(1)
      expect(diagnostics.assetPaths[0]).toBe(`../../../public/${expectedHash}.png`)
      expect(diagnostics.markdown).toContain("title: Single post")
      expect(diagnostics.markdown).toContain("category: JavaScript")
      expect(diagnostics.markdown).toContain("Hello **world**")
      expect(diagnostics.markdown).toContain(`![fixture image](${diagnostics.assetPaths[0]})`)

      const writtenMarkdown = await readFile(expectedMarkdownFilePath, "utf8")
      expect(writtenMarkdown).toBe(diagnostics.markdown)
      expect(await readFile(expectedAssetFilePath, "utf8")).toBe("asset")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("normalizes unsupported representative cases before review and render", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()

    const post = {
      blogId,
      logNo,
      title: "Unsupported block post",
      publishedAt: "2024-01-02T03:04:05+09:00",
      categoryId: 11,
      categoryName: "JavaScript",
      source: sourceUrl,
      editorVersion: 2 as const,
      thumbnailUrl: null,
    }

    const html = `
      <script>var data = { smartEditorVersion: 2 }</script>
      <div id="viewTypeSelector">
        <p>인트로입니다.</p>
        <p>
          <video
            class="fx _postImage _gifmp4"
            src="https://example.com/123.mp4"
            data-gif-url="https://example.com/123.gif"
          ></video>
        </p>
      </div>
    `

    try {
      const diagnostics = await exportSinglePost({
        blogId: inputBlogUrl,
        logNo,
        outputDir,
        options,
        createFetcher: ({ blogId: normalizedBlogId }) =>
          createFetcher({
            blogId: normalizedBlogId,
            posts: [post],
            html,
          }),
      })

      expect(diagnostics.editorVersion).toBe(2)
      expect(diagnostics.blockTypes).toEqual(["paragraph"])
      expect(diagnostics.parserWarnings).toEqual([
        "SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다.",
      ])
      expect(diagnostics.reviewerWarnings).toEqual([
        "SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다.",
        "fallback HTML 블록 1개가 포함됩니다.",
      ])
      expect(diagnostics.renderWarnings).toEqual([])
      expect(diagnostics.markdown).toContain("인트로입니다.")
      expect(diagnostics.markdown).toContain("<video")
      expect(diagnostics.markdown).toContain("https://example.com/123.mp4")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("throws when the requested post metadata is missing", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const sentinelPath = path.join(outputDir, "keep.txt")

    await writeFile(sentinelPath, "keep", "utf8")

    try {
      await expect(
        exportSinglePost({
          blogId: inputBlogUrl,
          logNo,
          outputDir,
          options: defaultExportOptions(),
          createFetcher: ({ blogId: normalizedBlogId }) => {
            expect(normalizedBlogId).toBe(blogId)

            return createFetcher({
              blogId: normalizedBlogId,
              posts: [],
              html: "",
            })
          },
        }),
      ).rejects.toThrow(`공개 글 메타데이터를 찾을 수 없습니다: ${blogId}/${logNo}`)
      expect(await readFile(sentinelPath, "utf8")).toBe("keep")
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("throws when the requested post is outside category scope", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()
    options.scope.categoryIds = [10]
    options.scope.categoryMode = "exact-selected"

    try {
      await expect(
        exportSinglePost({
          blogId: inputBlogUrl,
          logNo,
          outputDir,
          options,
          createFetcher: ({ blogId: normalizedBlogId }) =>
            createFetcher({
              blogId: normalizedBlogId,
              posts: [
                {
                  blogId,
                  logNo,
                  title: "Single post",
                  publishedAt: "2024-01-02T03:04:05+09:00",
                  categoryId: 11,
                  categoryName: "JavaScript",
                  source: sourceUrl,
                  editorVersion: 4,
                  thumbnailUrl: null,
                },
              ],
              html: "<div />",
            }),
        }),
      ).rejects.toThrow(`요청한 글이 scope 범위 밖입니다: ${blogId}/${logNo}`)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  it("throws when the requested post is outside date scope", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()
    options.scope.dateFrom = "2024-01-03"

    try {
      await expect(
        exportSinglePost({
          blogId: inputBlogUrl,
          logNo,
          outputDir,
          options,
          createFetcher: ({ blogId: normalizedBlogId }) =>
            createFetcher({
              blogId: normalizedBlogId,
              posts: [
                {
                  blogId,
                  logNo,
                  title: "Single post",
                  publishedAt: "2024-01-02T03:04:05+09:00",
                  categoryId: 11,
                  categoryName: "JavaScript",
                  source: sourceUrl,
                  editorVersion: 4,
                  thumbnailUrl: null,
                },
              ],
              html: "<div />",
            }),
        }),
      ).rejects.toThrow(`요청한 글이 scope 범위 밖입니다: ${blogId}/${logNo}`)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
