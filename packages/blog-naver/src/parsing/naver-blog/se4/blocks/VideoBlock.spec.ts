import { createSe4ModuleScript, parseSe4Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

const sourceUrl = "https://blog.naver.com/mym0404/123456789"

describe("NaverSe4VideoBlock", () => {
  it("parses video components and exposes collected videos", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-video">
        ${createSe4ModuleScript({
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
        blockId: "naver-se4:video",
        props: {
          title: "Demo video",
          thumbnailUrl: "https://example.com/video-thumb.png",
          url: sourceUrl,
          vid: "vid-1",
          width: 640,
          height: 360,
        },
      },
    ])
  })

  it("uses video metadata defaults when optional fields are missing", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-video">
        ${createSe4ModuleScript({ type: "v2_video", data: {} })}
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se4:video",
        props: {
          title: "Video",
          thumbnailUrl: null,
          url: sourceUrl,
          vid: null,
          width: null,
          height: null,
        },
      },
    ])
  })

  it("uses defaults when a class-only video has no metadata", () => {
    const parsed = parseSe4Blocks(`
      <div class="se-component se-video"></div>
    `)

    expect(parsed.blocks[0]).toMatchObject({
      blockId: "naver-se4:video",
      props: {
        title: "Video",
        thumbnailUrl: null,
        vid: null,
      },
    })
  })
})
