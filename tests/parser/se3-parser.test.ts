import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { NaverBlogSE3Editor } from "../../src/modules/parser/editors/naver-blog-se3-editor.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}
const se3Editor = new NaverBlogSE3Editor()

const createSe3Html = (...components: string[]) =>
  `<div id="viewTypeSelector"><div class="se_component_wrap sect_dsc">${components.join("")}</div></div>`

const parseSe3Fixture = (...components: string[]) =>
  se3Editor.parse({
    $: load(createSe3Html(...components)),
    tags: ["daily", "daily", "legacy"],
    options: parserOptions,
  })

const parseSe3FixtureWithOptions = ({
  components,
  options,
}: {
  components: string[]
  options: typeof parserOptions
}) =>
  se3Editor.parse({
    $: load(createSe3Html(...components)),
    tags: ["daily", "daily", "legacy"],
    options,
  })

describe("NaverBlogSE3Editor", () => {
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

  it("preserves hard breaks inside text components", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_text">
        <div class="se_textarea">첫 줄<br>둘째 줄</div>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "첫 줄  \n둘째 줄" }])
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

  it("keeps unsupported blocks with content as fallback html", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_unknown">
        <div><strong>Fallback</strong> block</div>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "se3:se_component se_unknown",
      warnings: ["SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: se_component se_unknown"],
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain("<strong>Fallback</strong>")
    expect(parsed.warnings).toContain(
      "SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: se_component se_unknown",
    )
  })

  it("captures horizontal line fallback blocks as fallback html", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_horizontalLine line5">
        <div class="se_horizontalLineView">
          <div class="se_hr"><hr></div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "se3:se_component se_horizontalLine line5",
      warnings: ["SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_horizontalLine line5"],
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain("<hr>")
  })

  it("captures oglink fallback blocks as fallback html", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_oglink og_bSize ">
        <div class="se_viewArea se_og_wrap">
          <a class="se_og_box" href="https://blog.naver.com/is02019/221072284462" target="_blank">
            <div class="se_og_thumb">
              <img src="https://dthumb-phinf.pstatic.net/sample.jpg?type=ff500_300" alt="">
            </div>
            <div class="se_og_txt">
              <div class="se_og_tit">비타는 삶이다</div>
              <div class="se_og_desc">PS Vita 리뷰</div>
              <div class="se_og_cp">blog.naver.com</div>
            </div>
          </a>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "se3:se_component se_oglink og_bSize ",
      warnings: ["SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: se_component se_oglink og_bSize "],
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain("비타는 삶이다")
  })

  it("ignores oglink unsupported candidate selections and keeps fallback html", () => {
    const parsed = parseSe3FixtureWithOptions({
      components: [`
        <div class="se_component se_oglink og_bSize ">
          <div class="se_viewArea se_og_wrap">
            <a class="se_og_box" href="https://blog.naver.com/is02019/221072284462" target="_blank">
              <div class="se_og_thumb">
                <img src="https://dthumb-phinf.pstatic.net/sample.jpg?type=ff500_300" alt="">
              </div>
              <div class="se_og_txt">
                <div class="se_og_tit">비타는 삶이다</div>
                <div class="se_og_desc">PS Vita 리뷰</div>
                <div class="se_og_cp">blog.naver.com</div>
              </div>
            </a>
          </div>
        </div>
      `],
      options: {
        markdown: defaultExportOptions().markdown,
      },
    })

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "se3:se_component se_oglink og_bSize ",
    })
  })

  it("warns and skips unsupported empty blocks", () => {
    const parsed = parseSe3Fixture(`
      <div class="se_component se_unknown"></div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.warnings).toContain(
      "SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: se_component se_unknown",
    )
  })
})
