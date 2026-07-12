import { expectBlockTemplateDefinition, parseSe2Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe2EmbeddedVideoBlock", () => {
  it("parses standalone outer video iframes into video blocks", () => {
    const parsed = parseSe2Blocks(`
      <p style="text-align: center;" align="center">
        <style>@media all and (min-width:679px){#_video1 iframe{width:639px !important;height:360px !important}}</style>
        <span id="_video1" class="_outerVideo">
          <iframe
            src="http://videofarm.daum.net/controller/video/viewer/Video.html?vid=v855c4MLyyLL5LLBiB5MB4L&amp;play_loc=undefined&amp;__authenticIframe=true"
            width="260"
            height="190"
            frameborder="0"
            allowfullscreen=""
          ></iframe>
        </span>&nbsp;
      </p>
    `)

    const video = {
      title: "Video",
      thumbnailUrl: null,
      url: "http://videofarm.daum.net/controller/video/viewer/Video.html?vid=v855c4MLyyLL5LLBiB5MB4L&play_loc=undefined&__authenticIframe=true",
      vid: "v855c4MLyyLL5LLBiB5MB4L",
      width: 260,
      height: 190,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("parses multiple outer video iframes from one classic paragraph", () => {
    const parsed = parseSe2Blocks(`
      <p style="text-align: center;" align="center">
        <style>@media all and (min-width:116px){#_video1 iframe{width:76px !important;height:90px !important}}</style>
        <span id="_video1" class="_outerVideo">
          <iframe src="https://example.com/embed-a" width="76" height="90"></iframe>
        </span>
        &nbsp;&nbsp;
        <style>@media all and (min-width:116px){#_video2 iframe{width:76px !important;height:90px !important}}</style>
        <span id="_video2" class="_outerVideo">
          <iframe src="https://example.com/embed-b" width="76" height="90"></iframe>
        </span>
      </p>
    `)

    const firstVideo = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://example.com/embed-a",
      vid: null,
      width: 76,
      height: 90,
    }
    const secondVideo = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://example.com/embed-b",
      vid: null,
      width: 76,
      height: 90,
    }

    expect(parsed.blocks).toEqual([
      { blockId: "naver-se2:video", props: firstVideo },
      { blockId: "naver-se2:video", props: secondVideo },
    ])
  })

  it("does not parse outer video iframes mixed with text", () => {
    const parsed = parseSe2Blocks(`
      <p>
        caption
        <span class="_outerVideo">
          <iframe src="https://example.com/embed" width="260" height="190"></iframe>
        </span>
      </p>
    `)

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:paragraph", props: { text: "caption" } }])
  })

  it("uses null metadata when iframe omits optional values", () => {
    const parsed = parseSe2Blocks(`
      <p>
        <span class="_outerVideo">
          <iframe src="https://example.com/embed" frameborder="0"></iframe>
        </span>
      </p>
    `)

    const video = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://example.com/embed",
      vid: null,
      width: null,
      height: null,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("parses unwrapped outer video spans into video blocks", () => {
    const parsed = parseSe2Blocks(`
      <span class="_outerVideo">
        <iframe src="https://example.com/embed" width="260" height="190"></iframe>
      </span>
    `)

    const video = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://example.com/embed",
      vid: null,
      width: 260,
      height: 190,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("parses naver video spans wrapped in classic paragraphs", () => {
    const parsed = parseSe2Blocks(`
      <p align="center">
        <style>@media all and (min-width:600px){#_video1 iframe{width:560px !important;height:315px !important}}</style>
        <span id="_video1" class="_naverVideo">
          <iframe
            src="https://serviceapi.rmcnmv.naver.com/flash/outKeyPlayer.nhn?vid=6E6ABC05CE7148D8961A0A965B71796E09EB&amp;outKey=V1284d549da3f65ddf4e7"
            width="260"
            height="190"
          ></iframe>
        </span>
      </p>
    `)

    const video = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://serviceapi.rmcnmv.naver.com/flash/outKeyPlayer.nhn?vid=6E6ABC05CE7148D8961A0A965B71796E09EB&outKey=V1284d549da3f65ddf4e7",
      vid: "6E6ABC05CE7148D8961A0A965B71796E09EB",
      width: 260,
      height: 190,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("parses direct video iframes into video blocks", () => {
    const parsed = parseSe2Blocks(`
      <iframe
        src="https://www.youtube-nocookie.com/embed/sample?__authenticIframe=true"
        width="260"
        height="190"
        title="Sample video"
      ></iframe>
    `)

    const video = {
      title: "Sample video",
      thumbnailUrl: null,
      url: "https://www.youtube-nocookie.com/embed/sample?__authenticIframe=true",
      vid: null,
      width: 260,
      height: 190,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("parses direct video iframes wrapped in classic paragraphs", () => {
    const parsed = parseSe2Blocks(`
      <p>
        <iframe
          src="https://photocast.cloud.naver.com/inlineplayer/2;sample;83295?blog&amp;__authenticIframe=true"
          width="260"
          height="190"
          frameborder="0"
          allowfullscreen=""
        ></iframe>&nbsp;
      </p>
    `)

    const video = {
      title: "Video",
      thumbnailUrl: null,
      url: "https://photocast.cloud.naver.com/inlineplayer/2;sample;83295?blog&__authenticIframe=true",
      vid: null,
      width: 260,
      height: 190,
    }

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:video", props: video }])
  })

  it("does not parse direct video iframes mixed with text", () => {
    const parsed = parseSe2Blocks(`
      <p>
        caption
        <iframe src="https://example.com/embed" width="260" height="190"></iframe>
      </p>
    `)

    expect(parsed.blocks).toEqual([{ blockId: "naver-se2:paragraph", props: { text: "caption" } }])
  })

  it("keeps invalid iframe source strings without video metadata", () => {
    const parsed = parseSe2Blocks(`
      <p>
        <span class="_outerVideo">
          <iframe src="https://%" frameborder="0"></iframe>
        </span>
      </p>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se2:video",
        props: {
          title: "Video",
          thumbnailUrl: null,
          url: "https://%",
          vid: null,
          width: null,
          height: null,
        },
      },
    ])
  })

  it("does not parse outer video iframes mixed with other media", () => {
    expect(() =>
      parseSe2Blocks(`
        <p>
          <span class="_outerVideo">
            <iframe src="https://example.com/embed"></iframe>
          </span>
          <iframe src="https://example.com/other"></iframe>
        </p>
      `),
    ).toThrow("파싱 가능한 naver-se2 block이 없습니다: p")
  })

  it("does not parse outer video iframes without a source", () => {
    expect(() =>
      parseSe2Blocks(`
        <p>
          <span class="_outerVideo">
            <iframe src=""></iframe>
          </span>
        </p>
      `),
    ).toThrow("파싱 가능한 naver-se2 block이 없습니다: p")
  })

  it("does not parse outer video containers without a source iframe", () => {
    expect(() =>
      parseSe2Blocks(`
        <p>
          <span class="_outerVideo">
            <iframe></iframe>
          </span>
        </p>
      `),
    ).toThrow("파싱 가능한 naver-se2 block이 없습니다: p")
  })

  it("matches the video template contract", () => {
    expectBlockTemplateDefinition({
      editorType: "naver-se2",
      blockId: "video",
      parse: (blockOutputs) =>
        parseSe2Blocks('<iframe src="https://example.com/video" title="Video"></iframe>', {
          blockOutputs,
        }),
    })
  })
})
