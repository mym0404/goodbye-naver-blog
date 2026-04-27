import { describe, expect, it } from "vitest"

import { blogEditors, blogs } from "../src/modules/blog/BlogRegistry.js"
import { getParsedPostParserBlockIds } from "../src/modules/parser/ParserBlockUsage.js"

describe("parser block registry", () => {
  it("keeps editors owned by a blog with unique parser blocks", () => {
    const editorIds = new Set(blogEditors.map((editor) => editor.id))
    const parserBlockIds = blogEditors.flatMap((editor) => editor.supportedBlocks)

    expect(blogs).toEqual([
      {
        id: "naver",
        editors: ["naver.se2", "naver.se3", "naver.se4"],
      },
    ])
    expect(blogs.every((blog) => blog.editors.every((editorId) => editorIds.has(editorId)))).toBe(true)
    expect(parserBlockIds).toHaveLength(new Set(parserBlockIds).size)
    expect(parserBlockIds.some((parserBlockId) => parserBlockId.includes("rawHtml"))).toBe(false)
  })

  it("reports parser block ids from structured body nodes only", () => {
    const parserBlockIds = getParsedPostParserBlockIds({
      editorId: "naver.se3",
      editorVersion: 3,
      tags: [],
      warnings: ["SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: se_component se_oglink"],
      videos: [],
      blocks: [
        { type: "paragraph", text: "intro" },
        { type: "divider" },
      ],
      body: [
        { kind: "block", parserBlockId: "naver.se3.text", block: { type: "paragraph", text: "intro" } },
        { kind: "fallbackHtml", html: "<div>fallback</div>", reason: "se3:unknown", warnings: [] },
      ],
    })

    expect(parserBlockIds).toEqual(["naver.se3.text"])
  })
})
