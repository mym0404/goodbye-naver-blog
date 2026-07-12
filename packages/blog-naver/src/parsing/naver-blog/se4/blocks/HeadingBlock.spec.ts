import {
  expectBlockTemplateDefinition,
  parseSe4Blocks,
  parseSe4BlocksWithOptions,
} from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe4HeadingBlock", () => {
  it("parses section title components into heading blocks", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-sectionTitle">
        <div class="se-module-text"><span>Section title</span></div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:heading",
        props: {
          level: 2,
          text: "Section title",
        },
      },
    ])
  })

  it("skips empty section title components", () => {
    const parsed = parseSe4Blocks(`
        <div class="se-component se-sectionTitle">
          <div class="se-module-text"><br /></div>
        </div>
      `)

    expect(parsed.blocks).toEqual([])
  })

  it("throws when a section title has no text module", () => {
    expect(() =>
      parseSe4Blocks(`
        <div class="se-component se-sectionTitle"></div>
      `),
    ).toThrow("SE4 heading block parsing failed.")
  })

  it("matches the heading template contract", () => {
    expectBlockTemplateDefinition({
      editorType: "naver-se4",
      blockId: "heading",
      parse: (blockOutputs) =>
        parseSe4BlocksWithOptions({
          blockOutputs,
          components: [
            '<div class="se-component se-sectionTitle"><div class="se-module-text">Title</div></div>',
          ],
        }),
    })
  })
})
