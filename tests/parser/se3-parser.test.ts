import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { parseSe3Post } from "../../src/modules/parser/se3-parser.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}

const createSe3Html = (...components: string[]) =>
  `<div id="viewTypeSelector"><div class="se_component_wrap sect_dsc">${components.join("")}</div></div>`

const parseSe3Fixture = (...components: string[]) =>
  parseSe3Post({
    $: load(createSe3Html(...components)),
    tags: ["daily", "daily", "legacy"],
    options: parserOptions,
  })

describe("parseSe3Post", () => {
  it("parses text components into paragraph blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_text">
        <div class="se_textarea">Alpha <strong>beta</strong></div>
        <div class="se_textarea">Gamma</div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { type: "paragraph", text: "Alpha **beta**" },
      { type: "paragraph", text: "Gamma" },
    ])
    expect(parsed.tags).toEqual(["daily", "legacy"])
  })

  it("parses quote components into quote blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_quote">
        <blockquote><p>Quoted <strong>SE3</strong></p></blockquote>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "quote", text: "Quoted **SE3**" }])
  })

  it("parses code components into code blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_code">
        <pre>const legacy = true
console.log(legacy)
</pre>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: null,
        code: "const legacy = true\nconsole.log(legacy)",
      },
    ])
  })

  it("parses table components into table blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_table">
        <table>
          <tr><th>h</th><th>v</th></tr>
          <tr><td>a</td><td>1</td></tr>
        </table>
      </div>
    `)

    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.blocks[0]).toMatchObject({
      type: "table",
      complex: false,
      rows: [
        [
          { text: "h", isHeader: true },
          { text: "v", isHeader: true },
        ],
        [
          { text: "a", isHeader: false },
          { text: "1", isHeader: false },
        ],
      ],
    })
  })

  it("parses standalone image components into image blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_image">
        <img src="https://example.com/se3-image.png" alt="se3 image" />
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://example.com/se3-image.png",
          originalSourceUrl: null,
          alt: "se3 image",
          caption: null,
          mediaKind: "image",
        },
      },
    ])
  })

  it("parses multiple standalone images into imageGroup blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_image">
        <img src="https://example.com/one.png" alt="one" />
        <img src="https://example.com/two.png" alt="two" />
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "imageGroup",
        images: [
          {
            sourceUrl: "https://example.com/one.png",
            originalSourceUrl: null,
            alt: "one",
            caption: null,
            mediaKind: "image",
          },
          {
            sourceUrl: "https://example.com/two.png",
            originalSourceUrl: null,
            alt: "two",
            caption: null,
            mediaKind: "image",
          },
        ],
      },
    ])
  })

  it("falls back to markdown paragraphs for unsupported blocks with content", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_unknown">
        <div><strong>Fallback</strong> block</div>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "**Fallback** block" }])
    expect(parsed.warnings).toContain(
      "SE3 블록을 구조화하지 못해 텍스트로 변환했습니다: se_component se_unknown",
    )
  })

  it("warns and skips unsupported empty blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_unknown"></div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.warnings).toContain(
      "SE3 블록을 해석하지 못해 건너뛰었습니다: se_component se_unknown",
    )
  })
})
