import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { NaverBlogSE4Editor } from "../../src/modules/parser/editors/naver-blog-se4-editor.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"

const parserOptions = {
  markdown: defaultExportOptions().markdown,
}

const sourceUrl = "https://blog.naver.com/mym0404/123456789"
const se4Editor = new NaverBlogSE4Editor()

const createModuleScript = (module: Record<string, unknown>) =>
  `<script class="__se_module_data" data-module-v2='${JSON.stringify(module)}'></script>`

const createSe4Html = (...components: string[]) =>
  `<div id="viewTypeSelector">${components.join("")}</div>`

const parseSe4Fixture = (...components: string[]) =>
  se4Editor.parse({
    $: load(createSe4Html(...components)),
    sourceUrl,
    tags: ["algo", "algo", "math"],
    options: parserOptions,
  })

describe("NaverBlogSE4Editor", () => {
  it("parses text components into paragraph blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-text">
        ${createModuleScript({ type: "v2_text" })}
        <p class="se-text-paragraph">First <strong>block</strong></p>
        <p class="se-text-paragraph">Second <a href="https://example.com">link</a></p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { type: "paragraph", text: "First **block**" },
      { type: "paragraph", text: "Second [link](https://example.com)" },
    ])
    expect(parsed.tags).toEqual(["algo", "math"])
  })

  it("preserves hard breaks inside text paragraphs", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-text">
        ${createModuleScript({ type: "v2_text" })}
        <p class="se-text-paragraph">첫 줄<br>둘째 줄</p>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "paragraph", text: "첫 줄  \n둘째 줄" }])
  })

  it("groups recommendation panel text dumps into a compact markdown list", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-text">
        ${createModuleScript({ type: "v2_text" })}
        <p class="se-text-paragraph"><span class="__se-hash-tag">#오늘의트렌드</span> <span class="__se-hash-tag">#케이크토퍼</span></p>
        <p class="se-text-paragraph">추천트렌드 새로보기현재 추천아이템 판1추천아이템 판 총 갯수8</p>
        <p class="se-text-paragraph">이런 상품 어때요2단형3단형</p>
        <p class="se-text-paragraph">케이크토퍼 영어 한글 자유문구나무픽</p>
        <p class="se-text-paragraph"><span class="__se-hash-tag">#파티용품</span></p>
        <p class="se-text-paragraph">여름잠옷 원피스 여성잠옷 반팔 면 파자마 나시 홈웨어 세트</p>
        <p class="se-text-paragraph"><span class="__se-hash-tag">#엘제이룸홈웨어</span> <span class="__se-hash-tag">#공주잠옷</span></p>
        <p class="se-text-paragraph">CGS 캘리포니아 제너럴 스토어 스트라이프 티셔츠</p>
        <p class="se-text-paragraph"><span class="__se-hash-tag">#티셔츠</span> <span class="__se-hash-tag">#스트라이프티셔츠</span></p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { type: "paragraph", text: "#오늘의트렌드 #케이크토퍼" },
      {
        type: "paragraph",
        text: [
          "- 케이크토퍼 영어 한글 자유문구나무픽 #파티용품",
          "- 여름잠옷 원피스 여성잠옷 반팔 면 파자마 나시 홈웨어 세트 #엘제이룸홈웨어 #공주잠옷",
          "- CGS 캘리포니아 제너럴 스토어 스트라이프 티셔츠 #티셔츠 #스트라이프티셔츠",
        ].join("\n"),
      },
    ])
  })

  it("parses section title components into heading blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-sectionTitle">
        <div class="se-module-text"><span>Section title</span></div>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "heading", level: 2, text: "Section title" }])
  })

  it("parses quotation components into quote blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-quotation">
        <blockquote class="se-quotation-container"><p>Quoted <strong>text</strong></p></blockquote>
      </div>
    `)

    expect(parsed.blocks).toEqual([{ type: "quote", text: "Quoted **text**" }])
  })

  it("parses formula components into formula blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-math">
        ${createModuleScript({ type: "v2_formula", data: { latex: "$x^2 + y^2 = z^2$" } })}
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "formula",
        formula: "x^2 + y^2 = z^2",
        display: true,
      },
    ])
  })

  it("marks inline formula components as display false", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-math se-inline-math">
        ${createModuleScript({ type: "v2_formula", data: { latex: "$x+y$" } })}
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "formula",
        formula: "x+y",
        display: false,
      },
    ])
  })

  it("parses code components with language metadata", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-code">
        ${createModuleScript({ type: "v2_code" })}
        <pre class="__se_code_view language-typescript">const value = 1
console.log(value)
</pre>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "code",
        language: "typescript",
        code: "const value = 1\nconsole.log(value)",
      },
    ])
  })

  it("parses oglink components into link cards", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-oglink">
        <a class="se-oglink-info" href="https://example.com/article"></a>
        <strong class="se-oglink-title">External article</strong>
        <p class="se-oglink-summary">preview text</p>
        <a class="se-oglink-thumbnail" href="https://example.com/article">
          <img class="se-oglink-thumbnail-resource" src="https://example.com/cover.png" />
        </a>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "linkCard",
        card: {
          title: "External article",
          description: "preview text",
          url: "https://example.com/article",
          imageUrl: "https://example.com/cover.png",
        },
      },
    ])
  })

  it("parses oembed components into link cards", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-oembed">
        ${createModuleScript({
          type: "v2_oembed",
          data: {
            title: "Video embed",
            description: "embedded preview",
            inputUrl: "https://youtu.be/demo",
            thumbnailUrl: "https://example.com/oembed.png",
          },
        })}
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "linkCard",
        card: {
          title: "Video embed",
          description: "embedded preview",
          url: "https://youtu.be/demo",
          imageUrl: "https://example.com/oembed.png",
        },
      },
    ])
  })

  it("parses video components and exposes collected videos", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-video">
        ${createModuleScript({
          type: "v2_video",
          data: {
            thumbnail: "https://example.com/video-thumb.png",
            vid: "vid-1",
            inkey: "inkey-1",
            width: "640",
            height: "360",
            mediaMeta: { title: "Demo video" },
          },
        })}
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "video",
        video: {
          title: "Demo video",
          thumbnailUrl: "https://example.com/video-thumb.png",
          sourceUrl,
          vid: "vid-1",
          inkey: "inkey-1",
          width: 640,
          height: 360,
        },
      },
    ])
    expect(parsed.videos).toEqual([
      {
        title: "Demo video",
        thumbnailUrl: "https://example.com/video-thumb.png",
        sourceUrl,
        vid: "vid-1",
        inkey: "inkey-1",
        width: 640,
        height: 360,
      },
    ])
  })

  it("parses simple table components into table blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-table">
        ${createModuleScript({ type: "v2_table" })}
        <table>
          <tr><th>name</th><th>value</th></tr>
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
          { text: "name", colspan: 1, rowspan: 1, isHeader: true },
          { text: "value", colspan: 1, rowspan: 1, isHeader: true },
        ],
        [
          { text: "a", colspan: 1, rowspan: 1, isHeader: false },
          { text: "1", colspan: 1, rowspan: 1, isHeader: false },
        ],
      ],
    })
  })

  it("keeps table fallback as ordered fallback html when a table component has no table element", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-table">
        ${createModuleScript({ type: "v2_table" })}
        <div class="se-table-placeholder"></div>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "table-fallback",
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain(
      '<div class="se-table-placeholder"></div>',
    )
    expect(parsed.warnings).toContain("표 블록을 표로 해석하지 못해 원본 HTML로 보존했습니다.")
  })

  it("parses material components into link cards", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-material">
        <a
          class="se-module-material"
          href="https://example.com/material"
          data-linkdata='{"thumbnail":"https://example.com/material.png","title":"Fallback title"}'
        >
          <strong class="se-material-title">Reference card</strong>
          <img class="se-material-thumbnail-resource" src="https://example.com/material.png" />
          <div class="se-material-detail">
            <div class="se-material-detail-title">Author</div>
            <div class="se-material-detail-description">mj</div>
            <div class="se-material-detail-title">Type</div>
            <div class="se-material-detail-description">note</div>
          </div>
        </a>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "linkCard",
        card: {
          title: "Reference card",
          description: "Author: mj / Type: note",
          url: "https://example.com/material",
          imageUrl: "https://example.com/material.png",
        },
      },
    ])
  })

  it("parses image components into image blocks with captions", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-image">
        <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/image.png"}'>
          <img src="https://example.com/image.png" alt="diagram" />
        </a>
        <p class="se-image-caption">image caption</p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://example.com/image.png",
          originalSourceUrl: "https://example.com/image.png",
          alt: "diagram",
          caption: "image caption",
          mediaKind: "image",
        },
      },
    ])
  })

  it("parses image components that use __se_image_link markup", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-image se-l-default">
        <div class="se-component-content se-component-content-fit">
          <div class="se-section se-section-image se-l-default se-section-align-">
            <a
              href="#"
              class="se-module se-module-image __se_image_link __se_link"
              data-linktype="img"
              data-linkdata='{"src":"https://example.com/legacy-se4.png"}'
            >
              <img
                src="https://example.com/legacy-se4.png?type=w80_blur"
                data-lazy-src="https://example.com/legacy-se4.png?type=w800"
                alt=""
                class="se-image-resource"
              />
            </a>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://example.com/legacy-se4.png",
          originalSourceUrl: "https://example.com/legacy-se4.png",
          alt: "",
          caption: null,
          mediaKind: "image",
        },
      },
    ])
  })

  it("parses image strip components into imageGroup blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-imageStrip se-imageStrip2 se-l-default">
        <div class="se-module se-module-image">
          <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/strip-1.png"}'>
            <img src="https://example.com/strip-1.png?type=w80_blur" alt="" />
          </a>
        </div>
        <div class="se-module se-module-image">
          <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/strip-2.png"}'>
            <img src="https://example.com/strip-2.png?type=w80_blur" alt="" />
          </a>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "imageGroup",
        images: [
          {
            sourceUrl: "https://example.com/strip-1.png",
            originalSourceUrl: "https://example.com/strip-1.png",
            alt: "",
            caption: null,
            mediaKind: "image",
          },
          {
            sourceUrl: "https://example.com/strip-2.png",
            originalSourceUrl: "https://example.com/strip-2.png",
            alt: "",
            caption: null,
            mediaKind: "image",
          },
        ],
      },
    ])
  })

  it("parses sticker components into image blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-sticker se-l-default">
        <div class="se-module se-module-sticker">
          <a class="__se_sticker_link" data-linkdata='{"src":"https://example.com/sticker.png","width":"370","height":"320"}'>
            <img class="se-sticker-image" src="https://example.com/sticker.png?type=p100_100" alt="" />
          </a>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "image",
        image: {
          sourceUrl: "https://example.com/sticker.png?type=p100_100",
          originalSourceUrl: "https://example.com/sticker.png",
          alt: "",
          caption: null,
          mediaKind: "sticker",
        },
      },
    ])
  })

  it("parses places map components into place link cards", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-placesMap se-l-default">
        <div class="se-module se-module-map-image">
          <img src="https://example.com/map.png" alt="" />
        </div>
        <div class="se-module se-module-map-text">
          <a
            class="se-map-info"
            href="#"
            data-linkdata='{"placeId":"13491802","name":"첨성대","address":"경상북도 경주시 인왕동 839-1","bookingUrl":null}'
          >
            <strong class="se-map-title">첨성대</strong>
            <p class="se-map-address">경상북도 경주시 인왕동 839-1</p>
          </a>
        </div>
        <div class="se-module se-module-map-text">
          <a
            class="se-map-info"
            href="#"
            data-linkdata='{"placeId":"1712968835","name":"외가 황리단길본점","address":"경상북도 경주시 사정로57번길 7 외가","bookingUrl":"https://booking.naver.com/booking/6/bizes/899193"}'
          >
            <strong class="se-map-title">외가 황리단길본점</strong>
            <p class="se-map-address">경상북도 경주시 사정로57번길 7 외가</p>
          </a>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "linkCard",
        card: {
          title: "첨성대",
          description: "경상북도 경주시 인왕동 839-1",
          url: "https://map.naver.com/p/search/%EC%B2%A8%EC%84%B1%EB%8C%80",
          imageUrl: null,
        },
      },
      {
        type: "linkCard",
        card: {
          title: "외가 황리단길본점",
          description: "경상북도 경주시 사정로57번길 7 외가",
          url: "https://booking.naver.com/booking/6/bizes/899193",
          imageUrl: null,
        },
      },
    ])
  })

  it("parses image group components into imageGroup blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-image-group">
        ${createModuleScript({ type: "v2_imageGroup" })}
        <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/one.png"}'>
          <img src="https://example.com/one.png" alt="one" />
        </a>
        <a class="se-module-image-link" data-linkdata='{"src":"https://example.com/two.png"}'>
          <img src="https://example.com/two.png" alt="two" />
        </a>
        <p class="se-image-caption">shared caption</p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        type: "imageGroup",
        images: [
          {
            sourceUrl: "https://example.com/one.png",
            originalSourceUrl: "https://example.com/one.png",
            alt: "one",
            caption: "shared caption",
            mediaKind: "image",
          },
          {
            sourceUrl: "https://example.com/two.png",
            originalSourceUrl: "https://example.com/two.png",
            alt: "two",
            caption: "shared caption",
            mediaKind: "image",
          },
        ],
      },
    ])
  })

  it("parses horizontal line components into divider blocks", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-horizontalLine"></div>
    `)

    expect(parsed.blocks).toEqual([{ type: "divider" }])
  })

  it("keeps unsupported components with content as fallback html", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-unsupported">
        <p>Unsupported <strong>content</strong></p>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "unsupported:se-component se-unsupported",
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain(
      "Unsupported <strong>content</strong>",
    )
    expect(parsed.warnings).toContain(
      "지원하지 않는 SE4 블록을 원본 HTML로 보존했습니다: se-component se-unsupported",
    )
  })

  it("keeps unsupported empty components as fallback html", () => {
    const parsed = parseSe4Fixture(`
      <div class="se-component se-empty">
        <div></div>
      </div>
    `)

    expect(parsed.blocks).toEqual([])
    expect(parsed.body?.[0]).toMatchObject({
      kind: "fallbackHtml",
      reason: "unsupported:se-component se-empty",
    })
    expect(parsed.body?.[0]?.kind === "fallbackHtml" ? parsed.body[0].html : "").toContain("<div></div>")
    expect(parsed.warnings).toContain(
      "지원하지 않는 SE4 블록을 원본 HTML로 보존했습니다: se-component se-empty",
    )
  })
})
