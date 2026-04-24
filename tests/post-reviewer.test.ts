import { describe, expect, it } from "vitest"

import { reviewParsedPost } from "../src/modules/reviewer/post-reviewer.js"
import type { ParsedPost } from "../src/shared/types.js"

const createParsedPost = (overrides?: Partial<ParsedPost>): ParsedPost => ({
  editorVersion: 4,
  tags: [],
  videos: [],
  warnings: [],
  blocks: [{ type: "paragraph", text: "ok" }],
  ...overrides,
})

describe("reviewParsedPost", () => {
  it("keeps parser warnings and adds fallback html diagnostics", () => {
    const reviewed = reviewParsedPost(
      createParsedPost({
        warnings: ["parser warning"],
        blocks: [
          { type: "paragraph", text: "body" },
        ],
        body: [
          {
            kind: "fallbackHtml",
            html: "<div>raw</div>",
            reason: "fallback",
            warnings: [],
          },
          { kind: "block", block: { type: "paragraph", text: "body" } },
        ],
      }),
    )

    expect(reviewed.warnings).toEqual([
      "parser warning",
      "fallback HTML 블록을 원본 HTML로 보존했습니다: fallback",
      "fallback HTML 블록 1개가 포함됩니다.",
    ])
  })

  it("warns when the parsed body is empty", () => {
    const reviewed = reviewParsedPost(
      createParsedPost({
        blocks: [],
      }),
    )

    expect(reviewed.warnings).toContain("본문 블록이 비어 있습니다.")
  })
})
