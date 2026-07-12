import { parseSe4Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe4TalkTalkBlock", () => {
  it("parses TalkTalk components into TalkTalk blocks", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-talktalk se-l-default">
        <a class="se-module se-module-talktalk" href="https://talk.naver.com/w42cwy?frm=mblog">
          <span class="se-talktalk-banner-text">
            <span class="se-blind">궁금할 땐 네이버 톡톡하세요!</span>
          </span>
        </a>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:talkTalk",
        props: {
          title: "궁금할 땐 네이버 톡톡하세요!",
          url: "https://talk.naver.com/w42cwy?frm=mblog",
        },
      },
    ])
  })

  it("falls back to url title when banner text is empty", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-talktalk se-l-default">
        <a class="se-module se-module-talktalk" href="https://talk.naver.com/w42cwy?frm=mblog"></a>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:talkTalk",
        props: {
          title: "https://talk.naver.com/w42cwy?frm=mblog",
          url: "https://talk.naver.com/w42cwy?frm=mblog",
        },
      },
    ])
  })

  it("throws when a TalkTalk component has no url", () => {
    expect(() =>
      parseSe4Blocks(`
        <div class="se-component se-talktalk se-l-default"></div>
      `),
    ).toThrow("SE4 TalkTalk block parsing failed.")
  })
})
