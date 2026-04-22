import { describe, expect, it } from "vitest"

import { renderMarkdownPost } from "../src/modules/converter/markdown-renderer.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type { AssetRecord, CategoryInfo, ParsedPost, PostSummary } from "../src/shared/types.js"
import { createTestPath } from "./helpers/test-paths.js"

const testMarkdownFilePath = createTestPath("markdown-renderer", "output", "posts", "Algorithm", "test.md")

const category: CategoryInfo = {
  id: 84,
  name: "PS 알고리즘, 팁",
  parentId: 79,
  postCount: 49,
  isDivider: false,
  isOpen: true,
  path: ["Algorithm", "PS 알고리즘, 팁"],
  depth: 1,
}

const post: PostSummary = {
  blogId: "mym0404",
  logNo: "223034929697",
  title: "테스트 글",
  publishedAt: "2023-03-04T13:00:00+09:00",
  categoryId: 84,
  categoryName: "PS 알고리즘, 팁",
  source: "https://blog.naver.com/mym0404/223034929697",
  editorVersion: 4,
  thumbnailUrl: "https://example.com/thumb.png",
}

const publicImagePath = "../../public/hash-image.png"
const publicThumbnailPath = "../../public/hash-thumbnail.png"
const publicVideoThumbnailPath = "../../public/hash-video-thumbnail.png"

const createAssetRecord = ({
  kind,
  sourceUrl,
  relativePath,
  reference,
  storageMode = "relative",
}: {
  kind: "image" | "thumbnail"
  sourceUrl: string
  relativePath: string | null
  reference?: string
  storageMode?: "relative" | "remote"
}) =>
  ({
    kind,
    sourceUrl,
    reference: reference ?? relativePath ?? sourceUrl,
    relativePath,
    storageMode,
    uploadCandidate:
      storageMode === "relative" && relativePath
        ? {
            kind,
            sourceUrl,
            localPath: `Algorithm/test/${relativePath}`,
            markdownReference: relativePath,
          }
        : null,
  }) satisfies AssetRecord

const parsedPost: ParsedPost = {
  editorVersion: 4,
  tags: ["algo"],
  warnings: [],
  videos: [
    {
      title: "Demo",
      thumbnailUrl: "https://example.com/video-thumb.png",
      sourceUrl: "https://blog.naver.com/mym0404/223034929697",
      vid: "vid",
      inkey: "inkey",
      width: 640,
      height: 360,
    },
  ],
  blocks: [
    { type: "heading", level: 2, text: "섹션" },
    { type: "paragraph", text: "본문입니다." },
    { type: "formula", formula: "f(n)=n+1", display: true },
    { type: "formula", formula: "g(n)=n-1", display: false },
    { type: "code", language: "ts", code: "const a = 1" },
    {
      type: "imageGroup",
      images: [
        {
          sourceUrl: "https://example.com/image-1.png",
          originalSourceUrl: null,
          alt: "one",
          caption: null,
          mediaKind: "image",
        },
        {
          sourceUrl: "https://example.com/image-2.png",
          originalSourceUrl: null,
          alt: "two",
          caption: "caption",
          mediaKind: "image",
        },
      ],
    },
    {
      type: "table",
      complex: false,
      html: "<table><tr><td>a</td></tr></table>",
      rows: [
        [
          {
            text: "col",
            html: "col",
            colspan: 1,
            rowspan: 1,
            isHeader: true,
          },
        ],
        [
          {
            text: "value",
            html: "value",
            colspan: 1,
            rowspan: 1,
            isHeader: false,
          },
        ],
      ],
    },
    {
      type: "linkCard",
      card: {
        title: "External article",
        description: "preview text",
        url: "https://example.com/article",
        imageUrl: "https://example.com/cover.png",
      },
    },
    {
      type: "video",
      video: {
        title: "Demo",
        thumbnailUrl: "https://example.com/video-thumb.png",
        sourceUrl: "https://blog.naver.com/mym0404/223034929697",
        vid: "vid",
        inkey: "inkey",
        width: 640,
        height: 360,
      },
    },
  ],
}

describe("renderMarkdownPost", () => {
  it("renders frontmatter, formula wrappers, and asset paths", async () => {
    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost,
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: sourceUrl.includes("video")
            ? publicVideoThumbnailPath
            : sourceUrl.includes("thumb")
              ? publicThumbnailPath
              : publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("title: 테스트 글")
    expect(rendered.markdown).toContain("## 섹션")
    expect(rendered.markdown).toContain("$$\nf(n)=n+1\n$$")
    expect(rendered.markdown).toContain("$g(n)=n-1$")
    expect(rendered.markdown).toContain(`![one](${publicImagePath})`)
    expect(rendered.markdown).toContain("| col |")
    expect(rendered.markdown).toContain("[External article](https://example.com/article)")
    expect(rendered.markdown).toContain("[Demo](https://blog.naver.com/mym0404/223034929697)")
    expect(rendered.markdown).not.toContain("**Video:** Demo")
    expect(rendered.markdown).not.toContain("preview text")
    expect(rendered.assetRecords).toHaveLength(2)
  })

  it("renders custom formula wrappers and image asset references", async () => {
    const options = defaultExportOptions()

    options.blockOutputs.defaults.formula = {
      variant: "wrapper",
      params: {
        inlineWrapper: "\\(...\\)",
        blockWrapper: "\\[...\\]",
      },
    }

    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost,
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options,
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("\\[\nf(n)=n+1\n\\]")
    expect(rendered.markdown).toContain("\\(g(n)=n-1\\)")
    expect(rendered.markdown).toContain(`![one](${publicImagePath})`)
    expect(rendered.assetRecords.every((asset) => asset.storageMode === "relative")).toBe(true)
  })

  it("preserves hard breaks inside paragraph markdown", async () => {
    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        blocks: [{ type: "paragraph", text: "**파이썬 웹 프로그래밍**  \n작가  \n김석훈" }],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("**파이썬 웹 프로그래밍**  \n작가  \n김석훈")
  })

  it("ignores stickers by default without adding diagnostics", async () => {
    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        warnings: ["parser warning"],
        blocks: [
          {
            type: "image",
            image: {
              sourceUrl: "https://example.com/sticker-preview.png",
              originalSourceUrl: "https://example.com/sticker-original.gif",
              alt: "",
              caption: null,
              mediaKind: "sticker",
            },
          },
          {
            type: "rawHtml",
            html: "<div><strong>raw</strong> text</div>",
            reason: "fallback",
          },
        ],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: ["review warning"],
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("## Export Diagnostics")
    expect(rendered.markdown).toContain("> ⚠️ Warning: parser warning")
    expect(rendered.markdown).toContain("> ⚠️ Warning: review warning")
    expect(rendered.markdown).toContain("> **raw** text")
    expect(rendered.markdown).not.toContain("sticker-original.gif")
    expect(rendered.markdown).not.toContain("스티커 asset 옵션이 ignore라서 본문에서 스티커를 생략했습니다.")
    expect(rendered.warnings).toEqual([
      "parser warning",
      "review warning",
      "raw HTML 블록을 생략했습니다: fallback",
    ])
  })

  it("renders frontmatter keys with configured aliases", async () => {
    const options = defaultExportOptions()

    options.frontmatter.aliases.title = "postTitle"
    options.frontmatter.aliases.publishedAt = "published_on"
    options.frontmatter.fields.source = false

    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost,
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options,
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("postTitle: 테스트 글")
    expect(rendered.markdown).toContain("published_on: 2023-03-04T13:00:00+09:00")
    expect(rendered.markdown).not.toContain("\nsource: https://blog.naver.com/mym0404/223034929697")
  })

  it("renders referenced links, quotes, and plain video links without frontmatter", async () => {
    const options = defaultExportOptions()

    options.frontmatter.enabled = false
    options.markdown.linkStyle = "referenced"
    options.blockOutputs.defaults.image = {
      variant: "source-only",
    }

    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        blocks: [
          { type: "quote", text: "인용문\n둘째 줄" },
          {
            type: "image",
            image: {
              sourceUrl: "https://example.com/source-only.png",
              originalSourceUrl: null,
              alt: "source only",
              caption: null,
              mediaKind: "image",
            },
          },
          {
            type: "video",
            video: {
              title: "Reference Demo",
              thumbnailUrl: null,
              sourceUrl: "https://example.com/watch",
              vid: null,
              inkey: null,
              width: null,
              height: null,
            },
          },
        ],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options,
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("> 인용문")
    expect(rendered.markdown).toContain("> 둘째 줄")
    expect(rendered.markdown).toContain("[source only][ref-1]")
    expect(rendered.markdown).toContain("[Reference Demo][ref-2]")
    expect(rendered.markdown).toContain(`[ref-1]: ${publicImagePath}`)
    expect(rendered.markdown).toContain("[ref-2]: https://example.com/watch")
    expect(rendered.markdown).not.toContain("---\n")
  })

  it("renders fallback warnings for image-group and table edge cases while keeping videos as plain links", async () => {
    const options = defaultExportOptions()

    options.blockOutputs.defaults.formula = {
      variant: "math-fence",
      params: {
        inlineWrapper: "$",
      },
    }
    options.blockOutputs.defaults.code = {
      variant: "tilde-fence",
    }
    options.blockOutputs.defaults.divider = {
      variant: "asterisk-rule",
    }
    options.blockOutputs.defaults.table = {
      variant: "html-only",
    }

    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        blocks: [
          { type: "divider" },
          { type: "code", language: null, code: "plain" },
          { type: "formula", formula: "x+y", display: true },
          {
            type: "imageGroup",
            images: [
              {
                sourceUrl: "https://example.com/group.png",
                originalSourceUrl: null,
                alt: "group",
                caption: null,
                mediaKind: "image",
              },
            ],
          },
          {
            type: "video",
            video: {
              title: "HTML Demo",
              thumbnailUrl: "https://example.com/video-thumb.png",
              sourceUrl: "https://example.com/watch-html",
              vid: null,
              inkey: null,
              width: null,
              height: null,
            },
          },
          {
            type: "table",
            complex: true,
            html: "<table><tr><td>cell</td></tr></table>",
            rows: [],
          },
          {
            type: "rawHtml",
            html: "<iframe src=\"https://example.com/embed\"></iframe>",
            reason: "iframe-only",
          },
        ],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options,
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("***")
    expect(rendered.markdown).toContain("~~~")
    expect(rendered.markdown).toContain("```math\nx+y\n```")
    expect(rendered.markdown).toContain("[HTML Demo](https://example.com/watch-html)")
    expect(rendered.markdown).not.toContain("![HTML Demo]")
    expect(rendered.markdown).not.toContain("Open Original Post")
    expect(rendered.markdown).toContain("<table><tr><td>cell</td></tr></table>")
    expect(rendered.markdown).toContain("> ❌ Error: raw HTML 블록을 생략했습니다: iframe-only")
  })

  it("keeps description only for non-preview link cards without duplicating bare urls", async () => {
    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        blocks: [
          {
            type: "linkCard",
            card: {
              title: "Docs",
              description: "Useful reference\nhttps://example.com/docs",
              url: "https://example.com/docs",
              imageUrl: null,
            },
          },
        ],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          relativePath: publicImagePath,
        }),
    })

    expect(rendered.markdown).toContain("[Docs](https://example.com/docs)")
    expect(rendered.markdown).toContain("Useful reference")
    expect(rendered.markdown).not.toContain("\nhttps://example.com/docs\n")
  })

  it("omits images when asset download fails and the asset option requests omission", async () => {
    const options = defaultExportOptions()

    options.assets.downloadFailureMode = "warn-and-omit"

    const rendered = await renderMarkdownPost({
      post,
      category,
      parsedPost: {
        ...parsedPost,
        blocks: [
          {
            type: "image",
            image: {
              sourceUrl: "https://example.com/failing-image.png",
              originalSourceUrl: null,
              alt: "broken",
              caption: "caption",
              mediaKind: "image",
            },
          },
        ],
      },
      markdownFilePath: testMarkdownFilePath,
      reviewedWarnings: [],
      options,
      resolveAsset: async () => {
        throw new Error("network timeout")
      },
    })

    expect(rendered.markdown).not.toContain("![broken](")
    expect(rendered.markdown).not.toContain("_caption_")
    expect(rendered.warnings).toContain(
      "자산 다운로드 실패: https://example.com/failing-image.png (network timeout)",
    )
  })
})
