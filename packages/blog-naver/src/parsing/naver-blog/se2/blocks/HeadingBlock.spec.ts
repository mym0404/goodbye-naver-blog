import { expectBlockTemplateDefinition, parseSe2Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe2HeadingBlock", () => {
  it("parses heading tags into heading blocks", () => {
    const parsed = parseSe2Blocks("<h3>Classic heading</h3>")

    expect(parsed.blocks).toEqual([
      { blockId: "naver-se2:heading", props: { level: 3, text: "Classic heading" } },
    ])
  })

  it("throws when a heading has no text", () => {
    expect(() => parseSe2Blocks("<h2><br /></h2>")).toThrow(
      "SE2 heading block parsing failed: <h2>",
    )
  })

  it("throws when a heading has no html", () => {
    expect(() => parseSe2Blocks("<h2></h2>")).toThrow("SE2 heading block parsing failed: <h2>")
  })

  it("matches the heading template contract", () => {
    expectBlockTemplateDefinition({
      editorType: "naver-se2",
      blockId: "heading",
      parse: (blockOutputs) => parseSe2Blocks("<h3>Classic heading</h3>", { blockOutputs }),
    })
  })
})
