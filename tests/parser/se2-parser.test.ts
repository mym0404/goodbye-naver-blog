import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { parseSe2Post } from "../../src/modules/parser/se2-parser.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}

const createSe2Html = (content: string) => `<div id="viewTypeSelector">${content}</div>`

const parseSe2Fixture = (content: string) =>
  parseSe2Post({
    $: load(createSe2Html(content)),
    tags: ["legacy", "legacy", "archive"],
    options: parserOptions,
  })

describe("parseSe2Post", () => {
  it("parses direct text nodes into paragraph blocks", () => {
    const parsed = parseSe2Fixture("plain legacy text")

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "plain legacy text" }])
    expect(parsed.tags).toEqual(["legacy", "archive"])
  })

  it("parses heading tags into heading blocks", () => {
    const parsed = parseSe2Fixture("<h3>Legacy heading</h3>")

    expect(parsed.blocks).toEqual([{ type: "heading", level: 3, text: "Legacy heading" }])
  })

  it("parses blockquote tags into quote blocks", () => {
    const parsed = parseSe2Fixture("<blockquote><p>Legacy <strong>quote</strong></p></blockquote>")

    expect(parsed.blocks).toEqual([{ type: "quote", text: "Legacy **quote**" }])
  })

  it("parses pre tags into code blocks", () => {
    const parsed = parseSe2Fixture(`<pre>const oldSchool = true
console.log(oldSchool)
</pre>`)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: null,
        code: "const oldSchool = true\nconsole.log(oldSchool)",
      },
    ])
  })

  it("parses hr tags into divider blocks", () => {
    const parsed = parseSe2Fixture("<hr />")

    expect(parsed.blocks).toEqual([{ type: "divider" }])
  })

  it("parses table tags into table blocks", () => {
    const parsed = parseSe2Fixture(`
      <table>
        <tr><th>name</th><th>value</th></tr>
        <tr><td colspan="2">merged</td></tr>
      </table>
    `)

    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.blocks[0]).toMatchObject({
      type: "table",
      complex: true,
      rows: [
        [
          { text: "name", isHeader: true },
          { text: "value", isHeader: true },
        ],
        [{ text: "merged", colspan: 2, isHeader: false }],
      ],
    })
  })

  it("parses standalone image wrappers into image blocks", () => {
    const parsed = parseSe2Fixture(`
      <p><img src="https://example.com/se2-image.png" alt="legacy image" /></p>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://example.com/se2-image.png",
          originalSourceUrl: null,
          alt: "legacy image",
          caption: null,
          mediaKind: "image",
        },
      },
    ])
  })

  it("parses multiple standalone images into imageGroup blocks", () => {
    const parsed = parseSe2Fixture(`
      <div>
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

  it("parses legacy thumburl image groups inside nested wrappers", () => {
    const parsed = parseSe2Fixture(`
      <div style="font-size:12pt;">
        <p>
          <span class="_img _inl fx" thumburl="https://mblogthumb-phinf.pstatic.net/one.png?type="></span>
          <br />
          <br />
          <span class="_img _inl fx" thumburl="https://mblogthumb-phinf.pstatic.net/two.png?type="></span>&nbsp;
        </p>
        <p><br /></p>
        <p>블렌더 어렵다</p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "imageGroup",
        images: [
          {
            sourceUrl: "https://mblogthumb-phinf.pstatic.net/one.png?type=w800",
            originalSourceUrl: null,
            alt: "",
            caption: null,
            mediaKind: "image",
          },
          {
            sourceUrl: "https://mblogthumb-phinf.pstatic.net/two.png?type=w800",
            originalSourceUrl: null,
            alt: "",
            caption: null,
            mediaKind: "image",
          },
        ],
      },
      { type: "paragraph", text: "블렌더 어렵다" },
    ])
  })

  it("parses wrapped legacy book widgets and following review paragraphs", () => {
    const parsed = parseSe2Fixture(`
      <div style="font-size:12pt;">
        <div align="">
          <div class="__se_object" s_type="db" s_subtype="book">
            <div class="thumb">
              <img src="https://bookthumb-phinf.pstatic.net/cover/136/172/13617242.jpg?type=w150&udate=20180619" alt="섬네일" />
            </div>
            <div class="txt">
              <div class="txt_align">
                <strong class="ell tit">코틀린을 이용한 안드로이드 개발</strong>
                <dl>
                  <dt>작가</dt>
                  <dd class="ell">마르친 모스칼라, 이고르 워다</dd>
                  <dt>출판</dt>
                  <dd class="ell">에이콘출판</dd>
                  <dt>발매</dt>
                  <dd class="ell">2018.05.31.</dd>
                </dl>
              </div>
            </div>
            <a href="http://book.naver.com/bookdb/book_detail.php?bid=13617242" class="link">리뷰보기</a>
          </div>
        </div>
        <p><br /></p>
        <p>나의 두 번째 안드로이드 서적이다.</p>
        <p><br /></p>
        <p>원본이 아닌 번역본이지만, 워낙 짜임새 있는 구성으로 공부하기에 좋다.</p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://bookthumb-phinf.pstatic.net/cover/136/172/13617242.jpg?type=w150&udate=20180619",
          originalSourceUrl: null,
          alt: "섬네일",
          caption: null,
          mediaKind: "image",
        },
      },
      {
        type: "paragraph",
        text: [
          "**코틀린을 이용한 안드로이드 개발**",
          "작가",
          "마르친 모스칼라, 이고르 워다",
          "출판",
          "에이콘출판",
          "발매",
          "2018.05.31.",
        ].join("  \n"),
      },
      {
        type: "paragraph",
        text: "[리뷰보기](http://book.naver.com/bookdb/book_detail.php?bid=13617242)",
      },
      {
        type: "paragraph",
        text: "나의 두 번째 안드로이드 서적이다.",
      },
      {
        type: "paragraph",
        text: "원본이 아닌 번역본이지만, 워낙 짜임새 있는 구성으로 공부하기에 좋다.",
      },
    ])
  })

  it("falls back to markdown paragraphs for convertible html", () => {
    const parsed = parseSe2Fixture("<div><strong>Fallback</strong> html</div>")

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "**Fallback** html" }])
  })

  it("keeps empty unsupported html as rawHtml blocks", () => {
    const parsed = parseSe2Fixture("<section></section>")

    expect(parsed.blocks).toEqual([
      {
        type: "rawHtml",
        html: "<section></section>",
        reason: "se2:section",
      },
    ])
    expect(parsed.warnings).toContain("SE2 블록을 해석하지 못해 raw HTML로 남겼습니다: <section>")
  })

  it("skips empty styled spacer paragraphs instead of keeping rawHtml", () => {
    const parsed = parseSe2Fixture(`
      <p style="" _foo="MsoNormal"><span lang="EN-US" style="font-size:12pt;">&nbsp;</span></p>
      <p><br></p>
      <div><br></div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.warnings).toEqual([])
  })

  it("flattens single-column layout tables into paragraph blocks", () => {
    const parsed = parseSe2Fixture(`
      <table>
        <tr><td><p>첫 줄<br>둘째 줄</p></td></tr>
        <tr><td><p>셋째 줄</p></td></tr>
      </table>
    `)

    expect(parsed.blocks).toEqual([
      { type: "paragraph", text: "첫 줄  \n둘째 줄" },
      { type: "paragraph", text: "셋째 줄" },
    ])
  })
})
