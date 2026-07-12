import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { createTestPath } from "@tests/support/test-paths.js"
import { describe, expect, it } from "vitest"

import type { CategoryInfo, PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type {
  AssetRecord,
  UploadCandidateKind,
} from "@exitpress/domain/export-job/schema/UploadState.js"
import type { ParsedPost } from "@exitpress/domain/parser/schema/ParsedPost.js"

import { renderMarkdownPost } from "./renderMarkdownPost.js"

const markdownFilePath = createTestPath("markdown-renderer", "posts", "test.md")
const tableTemplate =
  "{{ rows.length > 0 ? `| ${rows[0].map((cell) => cell.text).join(' | ')} |\\n| ${rows[0].map((cell) => '---').join(' | ')} |\\n${rows.slice(1).map((row) => '| ' + row.map((cell) => cell.text).join(' | ') + ' |').join('\\n')}` : html }}"

const category: CategoryInfo = {
  id: 1,
  name: "Algorithm",
  parentId: null,
  postCount: 1,
  isDivider: false,
  isOpen: true,
  path: ["Algorithm"],
  depth: 0,
}

const post: PostSummary = {
  blogKey: "sample",
  sourceId: "mym0404",
  postId: "223034929697",
  title: "테스트 글",
  publishedAt: "2023-03-04T13:00:00+09:00",
  categoryId: 1,
  categoryName: "Algorithm",
  source: "https://example.com/source-a/223034929697",
  thumbnailUrl: "https://example.com/thumb.png",
}

const defaultBlockTemplates = {
  "blog:paragraph": "{{ text }}",
  "blog:quote": "> {{ text }}",
  "blog:image": "{{ `![${alt}](${url})` }}",
  "blog:video": "{{ `[${title}](${url})` }}",
  "blog:table": tableTemplate,
}

const createAssetRecord = ({
  kind,
  sourceUrl,
  reference,
}: {
  kind: UploadCandidateKind
  sourceUrl: string
  reference: string
}) =>
  ({
    kind,
    sourceUrl,
    reference,
    relativePath: reference === sourceUrl ? null : reference,
    storageMode: reference === sourceUrl ? ("remote" as const) : ("relative" as const),
    uploadCandidate: null,
  }) satisfies AssetRecord

const render = ({
  parsedPost,
  options = defaultExportOptions(),
  resolveAsset = async ({ kind, sourceUrl }: { kind: UploadCandidateKind; sourceUrl: string }) =>
    createAssetRecord({
      kind,
      sourceUrl,
      reference: sourceUrl.includes("thumb") ? "assets/thumb.png" : "assets/image.png",
    }),
}: {
  parsedPost: ParsedPost
  options?: ReturnType<typeof defaultExportOptions>
  resolveAsset?: (input: { kind: UploadCandidateKind; sourceUrl: string }) => Promise<AssetRecord>
}) =>
  renderMarkdownPost({
    post,
    category,
    parsedPost,
    defaultBlockTemplates,
    markdownFilePath,
    options,
    resolveAsset: async ({ kind, sourceUrl }) => resolveAsset({ kind, sourceUrl }),
  })

describe("renderMarkdownPost", () => {
  it("renders parsed blocks with default block templates", async () => {
    const rendered = await render({
      parsedPost: {
        tags: ["algo"],
        blocks: [
          { blockId: "blog:paragraph", props: { text: "본문입니다." } },
          { blockId: "blog:quote", props: { text: "인용문" } },
          {
            blockId: "blog:video",
            props: {
              title: "Demo",
              url: "https://example.com/video",
              thumbnailUrl: "https://example.com/video-thumb.png",
              width: 640,
              height: 360,
            },
          },
        ],
      },
    })

    expect(rendered.markdown).toContain("title: 테스트 글")
    expect(rendered.markdown).toContain("blogKey: sample")
    expect(rendered.markdown).toContain("postId: 223034929697")
    expect(rendered.markdown).toContain("본문입니다.")
    expect(rendered.markdown).toContain("> 인용문")
    expect(rendered.markdown).toContain("[Demo](https://example.com/video)")
    expect(rendered.markdown).not.toContain("\nvideo:")
  })

  it("uses custom templates by blockId", async () => {
    const options = defaultExportOptions()
    options.blockOutputs.templates.gfm!["blog:paragraph"] = "CUSTOM {{ text }}"

    const rendered = await render({
      options,
      parsedPost: {
        tags: [],
        blocks: [{ blockId: "blog:paragraph", props: { text: "본문" } }],
      },
    })

    expect(rendered.markdown).toContain("CUSTOM 본문")
  })

  it("allows an empty custom block template to omit a block", async () => {
    const options = defaultExportOptions()
    options.blockOutputs.templates.gfm!["blog:video"] = ""

    const rendered = await render({
      options,
      parsedPost: {
        tags: [],
        blocks: [
          {
            blockId: "blog:video",
            props: {
              title: "Demo",
              url: "https://example.com/video",
              thumbnailUrl: null,
              width: null,
              height: null,
            },
          },
        ],
      },
    })

    expect(rendered.markdown).not.toContain("Demo")
    expect(rendered.markdown).not.toContain("https://example.com/video")
  })

  it("preserves string post identifiers in frontmatter", async () => {
    const rendered = await renderMarkdownPost({
      post: { ...post, postId: "mock-post-1" },
      category,
      parsedPost: {
        tags: [],
        blocks: [{ blockId: "blog:paragraph", props: { text: "본문" } }],
      },
      defaultBlockTemplates,
      markdownFilePath,
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          reference: sourceUrl,
        }),
    })

    expect(rendered.markdown).toContain("postId: mock-post-1")
    expect(rendered.markdown).not.toContain(".nan")
  })

  it("preserves unsafe numeric post identifiers in frontmatter", async () => {
    const rendered = await renderMarkdownPost({
      post: { ...post, postId: "9007199254740993" },
      category,
      parsedPost: {
        tags: [],
        blocks: [{ blockId: "blog:paragraph", props: { text: "본문" } }],
      },
      defaultBlockTemplates,
      markdownFilePath,
      options: defaultExportOptions(),
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          reference: sourceUrl,
        }),
    })

    expect(rendered.markdown).toContain('postId: "9007199254740993"')
    expect(rendered.markdown).not.toContain("9007199254740992")
  })

  it("resolves block asset records into top-level props", async () => {
    const rendered = await render({
      parsedPost: {
        tags: [],
        blocks: [
          {
            blockId: "blog:image",
            props: {
              url: "https://example.com/image.png",
              alt: "image",
              caption: null,
            },
            assets: {
              url: {
                role: "image",
                sourceUrl: "https://example.com/image.png",
                required: true,
              },
            },
          },
        ],
      },
    })

    expect(rendered.markdown).toContain("![image](assets/image.png)")
    expect(rendered.assetRecords).toContainEqual(
      expect.objectContaining({
        kind: "image",
        sourceUrl: "https://example.com/image.png",
        reference: "assets/image.png",
      }),
    )
  })

  it("omits a block when a required asset resolves to an empty reference", async () => {
    const rendered = await render({
      parsedPost: {
        tags: [],
        blocks: [
          {
            blockId: "blog:image",
            props: {
              url: "https://example.com/missing.png",
              alt: "missing",
              caption: null,
            },
            assets: {
              url: {
                role: "image",
                sourceUrl: "https://example.com/missing.png",
                required: true,
              },
            },
          },
        ],
      },
      resolveAsset: async ({ kind, sourceUrl }) =>
        createAssetRecord({
          kind,
          sourceUrl,
          reference: "",
        }),
    })

    expect(rendered.markdown).not.toContain("missing")
  })

  it("fails clearly when a default template is missing", async () => {
    await expect(
      render({
        parsedPost: {
          tags: [],
          blocks: [{ blockId: "blog:unknown", props: { text: "본문" } }],
        },
      }),
    ).rejects.toThrow("Parser block template is missing: blog:unknown")
  })
})
