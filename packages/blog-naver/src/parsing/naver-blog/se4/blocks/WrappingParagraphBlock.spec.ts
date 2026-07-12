import { parseSe4Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe4WrappingParagraphBlock", () => {
  it("parses right wrapping paragraph components into image and paragraph blocks", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-big-right">
        <div class="se-component-content">
          <div class="se-component-slot se-component-slot-float">
            <div class="se-section se-section-image se-l-default se-section-align-">
              <a
                class="se-module se-module-image __se_image_link __se_link"
                data-linktype="img"
                data-linkdata='{"src":"https://example.com/wrapped.png"}'
              >
                <img
                  src="https://example.com/wrapped.png?type=w80_blur"
                  data-lazy-src="https://example.com/wrapped.png?type=w800"
                  alt="wrapped"
                  class="se-image-resource"
                />
              </a>
            </div>
          </div>
          <div class="se-component-slot">
            <div class="se-section se-section-text se-l-default">
              <div class="se-module se-module-text">
                <p class="se-text-paragraph">Wrapped <strong>text</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:image",
        props: {
          url: "https://example.com/wrapped.png",
          alt: "wrapped",
          caption: null,
        },
        assets: {
          url: {
            role: "image",
            sourceUrl: "https://example.com/wrapped.png",
            required: true,
          },
        },
      },
      { blockId: "naver-se4:paragraph", props: { text: "Wrapped **text**" } },
    ])
  })

  it("parses compact right wrapping paragraph components", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-right">
        <div class="se-component-slot">
          <div class="se-module se-module-text">
            <p class="se-text-paragraph"><span>작은 오른쪽 감싼 문단</span></p>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { blockId: "naver-se4:paragraph", props: { text: "작은 오른쪽 감싼 문단" } },
    ])
  })

  it("parses left wrapping paragraph components into image and paragraph blocks", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-big-left">
        <div class="se-component-content">
          <div class="se-component-slot se-component-slot-float">
            <div class="se-section se-section-image">
              <div class="se-module se-module-image">
                <a class="se-module-image-link __se_image_link" data-linkdata='{"src":"https://example.com/left.png"}'>
                  <img src="https://example.com/left.png?type=w80_blur" data-lazy-src="https://example.com/left.png?type=w800" alt="left" />
                </a>
              </div>
            </div>
          </div>
          <div class="se-component-slot">
            <div class="se-section se-section-text">
              <div class="se-module se-module-text">
                <p class="se-text-paragraph"><span>첫 문단</span></p>
                <p class="se-text-paragraph"><span><b>둘째 문단</b></span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:image",
        props: {
          url: "https://example.com/left.png",
          alt: "left",
          caption: null,
        },
        assets: {
          url: {
            role: "image",
            sourceUrl: "https://example.com/left.png",
            required: true,
          },
        },
      },
      { blockId: "naver-se4:paragraph", props: { text: "첫 문단" } },
      { blockId: "naver-se4:paragraph", props: { text: "**둘째 문단**" } },
    ])
  })

  it("parses compact left wrapping paragraph components", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-left">
        <div class="se-component-slot">
          <div class="se-module se-module-text">
            <p class="se-text-paragraph"><span>작은 왼쪽 감싼 문단</span></p>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { blockId: "naver-se4:paragraph", props: { text: "작은 왼쪽 감싼 문단" } },
    ])
  })

  it("handles text-only wrapping paragraph components", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-big-left">
        <div class="se-component-slot">
          <div class="se-module se-module-text">
            <p class="se-text-paragraph"><span>본문만 있는 감싼 문단</span></p>
          </div>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      { blockId: "naver-se4:paragraph", props: { text: "본문만 있는 감싼 문단" } },
    ])
  })

  it("handles image-only wrapping paragraph components", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-wrappingParagraph se-l-inner-big-left">
        <div class="se-component-slot se-component-slot-float">
          <a class="se-module-image-link __se_image_link" data-linkdata='{"src":"https://example.com/image-only.png"}'>
            <img src="https://example.com/image-only.png" alt="" />
          </a>
        </div>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:image",
        props: {
          url: "https://example.com/image-only.png",
          alt: "",
          caption: null,
        },
        assets: {
          url: {
            role: "image",
            sourceUrl: "https://example.com/image-only.png",
            required: true,
          },
        },
      },
    ])
  })

  it("throws when wrapping paragraph image markup is not parseable", () => {
    expect(() =>
      parseSe4Blocks(`
        <div class="se-component se-wrappingParagraph se-l-inner-big-right">
          <div class="se-component-slot se-component-slot-float">
            <a class="se-module se-module-image __se_image_link"><img alt="" /></a>
          </div>
        </div>
      `),
    ).toThrow("SE4 wrapping paragraph image parsing failed.")
  })
})
