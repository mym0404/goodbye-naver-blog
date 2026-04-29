import { describe, expect, it } from "vitest"

import { parsePostHtml } from "../../src/modules/parser/PostParser.js"
import { defaultExportOptions } from "../../src/shared/ExportOptions.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}

describe("post-parser routing", () => {
  it("routes SE4 html to the SE4 parser and extracts unique tags", () => {
    const parsed = parsePostHtml({
      html: `
        <div class="post_tag">
          <a href="/PostTagView.naver?tagName=algo">algo</a>
          <a href="/PostTagView.naver?tagName=algo">algo</a>
          <a href="/PostTagView.naver?tagName=math">math</a>
        </div>
        <script>var data = { smartEditorVersion: 4 }</script>
        <div id="viewTypeSelector">
          <div class="se-component se-text">
            <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
            <p class="se-text-paragraph">SE4 text</p>
          </div>
        </div>
      `,
      sourceUrl: "https://blog.naver.com/mym0404/1",
      options: parserOptions,
    })
    expect(parsed.tags).toEqual(["algo", "math"])
    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "SE4 text" }])
    expect(parsed.body).toEqual([
      {
        kind: "block",
        block: { type: "paragraph", text: "SE4 text" },
      },
    ])
  })

  it("rewrites same-blog links before paragraph markdown is finalized", () => {
    const parsed = parsePostHtml({
      html: `
        <script>var data = { smartEditorVersion: 4 }</script>
        <div id="viewTypeSelector">
          <div class="se-component se-text">
            <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
            <p class="se-text-paragraph"><a href="https://m.blog.naver.com/PostView.naver?blogId=mym0404&logNo=2">내부 글</a></p>
          </div>
        </div>
      `,
      sourceUrl: "https://blog.naver.com/mym0404/1",
      options: {
        ...parserOptions,
        resolveLinkUrl: (url) =>
          url === "https://m.blog.naver.com/PostView.naver?blogId=mym0404&logNo=2"
            ? "../other/index.md"
            : url,
      },
    })

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "[내부 글](../other/index.md)" }])
  })

  it("routes SE3 html to the SE3 parser", () => {
    const parsed = parsePostHtml({
      html: `
        <script>var data = { smartEditorVersion: 3 }</script>
        <div id="viewTypeSelector">
          <div class="se_component_wrap sect_dsc">
            <div class="se_component se_text">
              <div class="se_textarea">SE3 text</div>
            </div>
          </div>
        </div>
      `,
      sourceUrl: "https://blog.naver.com/mym0404/2",
      options: parserOptions,
    })
    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "SE3 text" }])
  })

  it("routes legacy html to the SE2 parser", () => {
    const parsed = parsePostHtml({
      html: `
        <div id="viewTypeSelector">
          <h2>SE2 title</h2>
        </div>
      `,
      sourceUrl: "https://blog.naver.com/mym0404/3",
      options: parserOptions,
    })
    expect(parsed.blocks).toEqual([{ type: "heading", level: 2, text: "SE2 title" }])
  })

})
