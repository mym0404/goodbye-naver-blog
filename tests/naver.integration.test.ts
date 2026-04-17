import { describe, expect, it } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { parsePostHtml } from "../src/modules/parser/post-parser.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}

describe("naver blog integration", () => {
  it("collects all public posts from mym0404", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const totalCount = await fetcher.getPostCount()
    const posts = await fetcher.getAllPosts()

    expect(posts).toHaveLength(totalCount)
    expect(posts.at(0)?.logNo).toBe("224056819985")
    expect(posts.at(-1)?.logNo).toBe("220496669802")
  }, 60_000)

  it("parses video and table blocks from old SE4 post", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const html = await fetcher.fetchPostHtml("221302086471")
    const parsed = parsePostHtml({
      html,
      sourceUrl: "https://blog.naver.com/mym0404/221302086471",
      options: parserOptions,
    })

    expect(parsed.editorVersion).toBe(4)
    expect(parsed.blocks.some((block) => block.type === "video")).toBe(true)
    expect(parsed.blocks.some((block) => block.type === "table")).toBe(true)
  }, 30_000)

  it("parses formula, code, and link cards from algorithm post", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const html = await fetcher.fetchPostHtml("223034929697")
    const parsed = parsePostHtml({
      html,
      sourceUrl: "https://blog.naver.com/mym0404/223034929697",
      options: parserOptions,
    })

    expect(parsed.editorVersion).toBe(4)
    expect(parsed.blocks.some((block) => block.type === "formula")).toBe(true)
    expect(parsed.blocks.some((block) => block.type === "code")).toBe(true)
    expect(parsed.blocks.some((block) => block.type === "linkCard")).toBe(true)
  }, 30_000)

  it("parses SE2 post into markdown blocks", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const html = await fetcher.fetchPostHtml("220496669802")
    const parsed = parsePostHtml({
      html,
      sourceUrl: "https://blog.naver.com/mym0404/220496669802",
      options: parserOptions,
    })

    expect(parsed.editorVersion).toBe(2)
    expect(parsed.blocks.some((block) => block.type === "paragraph")).toBe(true)
  }, 30_000)

  it("parses Color Scripter blocks from SE2 posts as code blocks", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const html = await fetcher.fetchPostHtml("221008605391")
    const parsed = parsePostHtml({
      html,
      sourceUrl: "https://blog.naver.com/mym0404/221008605391",
      options: parserOptions,
    })
    const codeBlocks = parsed.blocks.filter(
      (block): block is Extract<typeof parsed.blocks[number], { type: "code" }> =>
        block.type === "code",
    )

    expect(parsed.editorVersion).toBe(2)
    expect(codeBlocks.some((block) => block.code.includes("void ListInit(List * plist);"))).toBe(
      true,
    )
    expect(codeBlocks.some((block) => block.code.includes("typedef struct _node"))).toBe(true)
    expect(parsed.blocks.some((block) => block.type === "table")).toBe(false)
    expect(parsed.warnings).not.toContain("SE2 블록을 해석하지 못해 raw HTML로 남겼습니다: <br>")
  }, 30_000)

  it("parses SE3 post without blog chrome", async () => {
    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })
    const html = await fetcher.fetchPostHtml("221236891086")
    const parsed = parsePostHtml({
      html,
      sourceUrl: "https://blog.naver.com/mym0404/221236891086",
      options: parserOptions,
    })
    const paragraphText = parsed.blocks
      .filter((block): block is Extract<typeof parsed.blocks[number], { type: "paragraph" }> => block.type === "paragraph")
      .map((block) => block.text)
      .join("\n")

    expect(parsed.editorVersion).toBe(3)
    expect(paragraphText).toContain("힘들다그냥")
    expect(paragraphText).not.toContain("이웃추가")
    expect(paragraphText).not.toContain("공유하기")
  }, 30_000)
})
