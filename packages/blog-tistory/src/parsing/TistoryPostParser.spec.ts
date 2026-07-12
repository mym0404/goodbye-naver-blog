import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { renderTemplateExpressions } from "@exitpress/domain/template/util/renderTemplateExpressions.js"
import { renderBlockTemplates } from "@exitpress/engine/markdown/util/renderBlockTemplates.js"
import { expectBlockTemplateCatalog } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

import { getTistoryBlockTemplateDefinitions, parseTistoryPostHtml } from "./TistoryPostParser.js"

const options = defaultExportOptions()

const parse = (body: string) =>
  parseTistoryPostHtml({
    html: `<article><div class="tt_article_useless_p_margin">${body}</div></article>`,
    options,
  })

describe("parseTistoryPostHtml", () => {
  it("keeps all Tistory block template definitions valid", () => {
    const definitions = getTistoryBlockTemplateDefinitions()

    expect(definitions).toHaveLength(15)
    expectBlockTemplateCatalog(definitions)
  })

  it("parses user-visible Tistory content families and renders Markdown", () => {
    const parsed = parse(`
      <h2>Heading</h2>
      <p>Hello <strong>world</strong> and <a href="https://example.com">link</a>.</p>
      <ul><li>One<ol><li>Nested</li></ol></li></ul>
      <blockquote>Quoted text</blockquote>
      <figure data-ke-type="image"><img src="https://img.example/a.png" alt="A"><figcaption>Caption</figcaption></figure>
      <figure data-ke-type="opengraph"><a href="https://example.com/card"><strong class="og-title">Card</strong><p class="og-desc">Description</p></a></figure>
      <figure data-ke-type="file"><a href="https://example.com/attachment/a.zip" download="a.zip">Download</a></figure>
      <figure data-ke-type="video"><iframe src="https://video.example/embed/1" title="Video"></iframe></figure>
      <pre data-ke-language="typescript"><code>const value = 1</code></pre>
      <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>
      <hr>
      <nav class="quick-nav"><a href="#heading">Heading</a></nav>
    `)
    const definitions = new Map(
      getTistoryBlockTemplateDefinitions().map((definition) => [definition.key, definition]),
    )
    const markdown = renderBlockTemplates(
      parsed.blocks.map((block) => ({
        template: definitions.get(block.blockId)!.presets[0].template,
        props: block.props,
      })),
    )

    expect(parsed.blocks.map(({ blockId }) => blockId)).toEqual([
      "tistory:heading",
      "tistory:paragraph",
      "tistory:list",
      "tistory:quote",
      "tistory:image",
      "tistory:linkCard",
      "tistory:file",
      "tistory:media",
      "tistory:code",
      "tistory:table",
      "tistory:divider",
      "tistory:tableOfContents",
    ])
    expect(markdown).toContain("## Heading")
    expect(markdown).toContain("Hello **world** and [link](https://example.com).")
    expect(markdown).toContain("  1. Nested")
    expect(markdown).toContain("![A](https://img.example/a.png)\nCaption")
    expect(markdown).toContain("```typescript\nconst value = 1\n```")
    expect(markdown).toContain("| Name | Value |")
  })

  it("keeps inline text found in legacy posts", () => {
    expect(
      parse('<label>Label text</label><title>Legacy title</title><font color="red">Old font</font>')
        .blocks,
    ).toEqual([
      { blockId: "tistory:inline", props: { text: "Label text" } },
      { blockId: "tistory:inline", props: { text: "Legacy title" } },
      { blockId: "tistory:inline", props: { text: "Old font" } },
    ])
  })

  it("keeps every row when a table has no header cells", () => {
    expect(parse("<table><tr><td>A</td><td>1</td></tr></table>").blocks).toEqual([
      {
        blockId: "tistory:table",
        props: {
          headers: ["", ""],
          rows: [["A", "1"]],
          html: "<table><tbody><tr><td>A</td><td>1</td></tr></tbody></table>",
          complex: false,
        },
      },
    ])
  })

  it("keeps standalone list items found in malformed legacy posts", () => {
    expect(parse("<div><li>Legacy item</li></div>").blocks).toEqual([
      {
        blockId: "tistory:list",
        props: {
          items: [{ depth: 0, ordered: false, index: 1, text: "Legacy item" }],
        },
      },
    ])
  })

  it("reports an unsupported visible node with its path", () => {
    expect(() => parse("<canvas>Fallback</canvas>")).toThrow(
      "Unsupported Tistory node at 0: <canvas>",
    )
  })

  it("keeps normalized props and exact Markdown for nested Tistory blocks", () => {
    const definitions = new Map(
      getTistoryBlockTemplateDefinitions().map((definition) => [definition.key, definition]),
    )
    const render = (
      blockId: string,
      props: Parameters<typeof renderTemplateExpressions>[0]["props"],
    ) =>
      renderTemplateExpressions({
        template: definitions.get(blockId)!.presets[0]!.template,
        props,
      })

    const heading = parse("<h3>Title <em>em</em></h3>").blocks[0]!

    expect(heading).toEqual({
      blockId: "tistory:heading",
      props: { level: 3, text: "Title *em*" },
    })
    expect(render(heading.blockId, heading.props)).toBe("### Title *em*")

    const list = parse('<ol start="3"><li>Third<ul><li>Nested</li></ul></li></ol>').blocks[0]!

    expect(list).toEqual({
      blockId: "tistory:list",
      props: {
        items: [
          { depth: 0, ordered: true, index: 3, text: "Third" },
          { depth: 1, ordered: false, index: 1, text: "Nested" },
        ],
      },
    })
    expect(render(list.blockId, list.props)).toBe("3. Third\n  - Nested")

    expect(
      parse('<ol start="-2"><li>Negative</li><li value="4">Fourth</li></ol>').blocks[0],
    ).toEqual({
      blockId: "tistory:list",
      props: {
        items: [
          { depth: 0, ordered: true, index: -2, text: "Negative" },
          { depth: 0, ordered: true, index: 4, text: "Fourth" },
        ],
      },
    })

    const quote = parse(
      '<blockquote><p>Quoted <a href="https://example.com">link</a></p><p>Second</p></blockquote>',
    ).blocks[0]!

    expect(quote).toEqual({
      blockId: "tistory:quote",
      props: { text: "Quoted [link](https://example.com)\nSecond" },
    })
    expect(render(quote.blockId, quote.props)).toBe(
      "> Quoted [link](https://example.com)\n> Second",
    )

    const toc = parse(`
      <nav class="quick-nav">
        <ul><li><a href="#one">One</a><ul><li><a href="#two">Two</a></li></ul></li></ul>
      </nav>
    `).blocks[0]!

    expect(toc).toEqual({
      blockId: "tistory:tableOfContents",
      props: {
        items: [
          { depth: 0, text: "One", url: "#one" },
          { depth: 1, text: "Two", url: "#two" },
        ],
      },
    })
    expect(render(toc.blockId, toc.props)).toBe("- [One](#one)\n  - [Two](#two)")

    const card = parse(`
      <figure data-ke-type="opengraph">
        <a href="https://example.com/card">
          <img src="https://example.com/thumb.png">
          <strong class="og-title">Card</strong>
          <p class="og-desc">Description</p>
        </a>
      </figure>
    `).blocks[0]!

    expect(render(card.blockId, card.props)).toBe(
      "![Card](https://example.com/thumb.png)\n[Card](https://example.com/card)\nDescription",
    )

    const table = parse(
      '<table><tr><th rowspan="2">Name</th><th>Value</th></tr><tr><td><a href="https://example.com">Link</a></td></tr></table>',
    ).blocks[0]!

    expect(table).toMatchObject({
      blockId: "tistory:table",
      props: {
        headers: ["Name", "Value"],
        rows: [["[Link](https://example.com)", ""]],
        complex: true,
      },
    })
    expect(render(table.blockId, table.props)).toBe(table.props.html)
  })
})
