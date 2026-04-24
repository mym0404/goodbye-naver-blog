import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { NaverBlogSE2Editor } from "../../src/modules/parser/editors/naver-blog-se2-editor.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}
const se2Editor = new NaverBlogSE2Editor()

const createSe2Html = (content: string) => `<div id="viewTypeSelector">${content}</div>`

const parseSe2Fixture = (content: string) =>
  se2Editor.parse({
    $: load(createSe2Html(content)),
    tags: ["legacy", "legacy", "archive"],
    options: parserOptions,
  })

describe("NaverBlogSE2Editor", () => {
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

  it("parses Color Scripter tables into code blocks", () => {
    const parsed = parseSe2Fixture(`
      <div class="colorscripter-code" style="overflow:auto">
        <table class="colorscripter-code-table" style="margin:0; padding:0; border:none;" cellspacing="0" cellpadding="0">
          <tbody>
            <tr>
              <td style="padding:6px; border-right:2px solid #4f4f4f">
                <div><div>1</div><div>2</div><div>3</div><div>4</div></div>
              </td>
              <td style="padding:6px 0">
                <div>
                  <div style="padding:0 6px; white-space:pre">(리스트&nbsp;생성)</div>
                  <div style="padding:0 6px; white-space:pre"><span style="color:#ff3399">void</span>&nbsp;ListInit(List&nbsp;<span style="color:#ff3399">*</span>&nbsp;plist);</div>
                  <div style="padding:0 6px; white-space:pre">&nbsp;</div>
                  <div style="padding:0 6px; white-space:pre"><span style="color:#4be6fa">int</span>&nbsp;LCount(List&nbsp;<span style="color:#ff3399">*</span>plist);</div>
                </div>
              </td>
              <td style="vertical-align:bottom; padding:0 2px 4px 0">
                <a href="http://colorscripter.com/info#e" target="_blank" class="con_link">
                  <span style="font-size:9px;">cs</span>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: null,
        code: ["(리스트 생성)", "void ListInit(List * plist);", "", "int LCount(List *plist);"].join(
          "\n",
        ),
      },
    ])
    expect(parsed.warnings).toEqual([])
  })

  it("ignores Color Scripter footer markup when extracting code blocks", () => {
    const parsed = parseSe2Fixture(`
      <table class="colorscripter-code-table" style="margin:0; padding:0; border:none;" cellspacing="0" cellpadding="0">
        <tbody>
          <tr>
            <td style="padding:6px; border-right:2px solid #e5e5e5">
              <div><div>1</div><div>2</div></div>
            </td>
            <td style="padding:6px 0">
              <div>
                <div style="padding:0 6px; white-space:pre"><span style="color:#ff3399">typedef</span>&nbsp;<span style="color:#ff3399">struct</span>&nbsp;_node</div>
                <div style="padding:0 6px; white-space:pre">{</div>
              </div>
              <div style="text-align:right; margin-top:-13px; margin-right:5px; font-size:9px; font-style:italic">
                <a href="http://colorscripter.com/info#e" target="_blank" class="con_link">Colored by Color Scripter</a>
              </div>
            </td>
            <td style="vertical-align:bottom; padding:0 2px 4px 0">
              <p>
                <span style="font-size:9px;">
                  <a href="http://colorscripter.com/info#e" target="_blank" class="con_link"><br /></a>
                </span>
              </p>
              <p>
                <span style="font-size:9px;">
                  <a href="http://colorscripter.com/info#e" target="_blank" class="con_link">cs</a>
                </span>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: null,
        code: ["typedef struct _node", "{"].join("\n"),
      },
    ])
    expect(parsed.warnings).toEqual([])
  })

  it("parses mobile Color Scripter markup that stores styles in _foo", () => {
    const parsed = parseSe2Fixture(`
      <table class="colorscripter-code-table" cellspacing="0" cellpadding="0">
        <tr>
          <td><div><div>1</div><div>2</div></div></td>
          <td>
            <div _foo="margin: 0px; padding: 0px;">
              <div style="" _foo="padding:0 6px; white-space:pre"><span _foo="color:#ff3399">void</span>&nbsp;ListInit(List&nbsp;* plist);</div>
              <div style="" _foo="padding:0 6px; white-space:pre"><span _foo="color:#4be6fa">int</span>&nbsp;LCount(List&nbsp;*plist);</div>
            </div>
          </td>
          <td><a href="http://colorscripter.com/info#e" class="con_link">cs</a></td>
        </tr>
      </table>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: null,
        code: ["void ListInit(List * plist);", "int LCount(List *plist);"].join("\n"),
      },
    ])
    expect(parsed.warnings).toEqual([])
  })

  it("parses hr tags into divider blocks", () => {
    const parsed = parseSe2Fixture("<hr />")

    expect(parsed.blocks).toEqual([{ type: "divider" }])
  })

  it("skips standalone br tags instead of keeping rawHtml", () => {
    const parsed = parseSe2Fixture("<br /><br />")

    expect(parsed.blocks).toEqual([])
    expect(parsed.warnings).toEqual([])
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

  it("keeps unsupported html as ordered fallback body nodes", () => {
    const parsed = parseSe2Fixture("<section></section>")

    expect(parsed.blocks).toEqual([])
    expect(parsed.body).toEqual([
      {
        kind: "fallbackHtml",
        html: "<section></section>",
        reason: "se2:section",
        warnings: ["SE2 블록을 구조화하지 못해 원본 HTML로 보존했습니다: <section>"],
      },
    ])
    expect(parsed.warnings).toContain("SE2 블록을 구조화하지 못해 원본 HTML로 보존했습니다: <section>")
  })

  it("keeps inline gif video fallback as ordered fallback html", () => {
    const parsed = parseSe2Fixture(`
      <p>
        <video
          src="https://mblogvideo-phinf.pstatic.net/sample.gif?type=mp4w800"
          class="fx _postImage _gifmp4"
          data-gif-url="https://mblogthumb-phinf.pstatic.net/sample.gif?type=w210"
        ></video>&nbsp;
      </p>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "se2:inline-gif-video",
      warnings: ["SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다."],
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain("<video")
    expect(parsed.warnings).toEqual(["SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다."])
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

  it("skips empty inline spacer wrappers instead of keeping rawHtml", () => {
    const parsed = parseSe2Fixture(`
      <span style="" _foo="font-family: 나눔고딕, NanumGothic, sans-serif;"> </span>
      <span style="" _foo="font-family: 나눔고딕, NanumGothic, sans-serif;"><b> </b></span>
      <font><br /></font>
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

  it("traverses malformed inline wrappers that only contain nested block nodes", () => {
    const parsed = parseSe2Fixture(`
      <span>
        <div><p>첫 문단</p></div>
        <div><p>둘째 문단</p></div>
      </span>
    `)

    expect(parsed.blocks).toEqual([
      { type: "paragraph", text: "첫 문단" },
      { type: "paragraph", text: "둘째 문단" },
    ])
    expect(parsed.warnings).toEqual([])
  })
})
