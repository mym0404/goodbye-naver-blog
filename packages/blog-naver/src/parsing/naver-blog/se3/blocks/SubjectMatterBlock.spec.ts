import { parseSe3Blocks } from "@tests/support/parser-test-utils.js"
import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import { NaverBlogSE3Editor } from "../NaverBlogSe3Editor.js"

import { NaverSe3SubjectMatterBlock } from "./SubjectMatterBlock.js"

const imageAsset = (sourceUrl: string) => ({
  role: "image",
  sourceUrl,
  required: true,
})

describe("NaverSe3SubjectMatterBlock", () => {
  it("parses book subject matter components", () => {
    const parsed = parseSe3Blocks(`
      <div class="se_component se_subjectMatter subjectMatter_book ">
        <div class="subjectMatterArea">
          <div class="subjectMatter_thumb __se_material_thumbnail_wrapper">
            <img src="https://bookthumb-phinf.pstatic.net/cover/108/442/10844211.jpg?type=w150&amp;udate=20160809" class="__se_material_thumbnail">
          </div>
          <div class="subjectMatter_info_wrap">
            <dl class="subjectMatter_info">
              <dt class="subjectMatter_title">
                <strong class="subjectMatter_title_text __se_material_title">캐스터브리지의 시장 </strong>
              </dt>
              <dd class="subjectMatter_info_detail">
                <p class="subjectMatter_info_item __se_material_labelname_author">
                  <strong class="subjectMatter_info_title __se_material_label">저자</strong>
                  <span class="subjectMatter_info_text __se_material_value">토마스 하디</span>
                </p>
                <p class="subjectMatter_info_item __se_material_labelname_publisher">
                  <strong class="subjectMatter_info_title __se_material_label">출판</strong>
                  <span class="subjectMatter_info_text __se_material_value">문학과지성사</span>
                </p>
                <p class="subjectMatter_info_item __se_material_labelname_publishDay">
                  <strong class="subjectMatter_info_title __se_material_label">발매</strong>
                  <span class="subjectMatter_info_text __se_material_value">2016.07.15.</span>
                </p>
              </dd>
            </dl>
          </div>
        </div>
        <a class="subjectMatter_item_link __se_material_link" href="http://book.naver.com/bookdb/book_detail.php?bid=10844211" target="_blank">
          <span class="blind">상세보기</span>
        </a>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se3:image",
        props: {
          url: "https://bookthumb-phinf.pstatic.net/cover/108/442/10844211.jpg?type=w150&udate=20160809",
          alt: "",
          caption: null,
        },
        assets: {
          url: imageAsset(
            "https://bookthumb-phinf.pstatic.net/cover/108/442/10844211.jpg?type=w150&udate=20160809",
          ),
        },
      },
      {
        blockId: "naver-se3:paragraph",
        props: {
          text: [
            "**캐스터브리지의 시장**",
            "저자: 토마스 하디",
            "출판: 문학과지성사",
            "발매: 2016.07.15.",
          ].join("  \n"),
        },
      },
      {
        blockId: "naver-se3:paragraph",
        props: {
          text: "[상세보기](http://book.naver.com/bookdb/book_detail.php?bid=10844211)",
        },
      },
    ])
  })

  it("throws when a matched subject matter component has no content", () => {
    expect(() =>
      parseSe3Blocks(`
        <div class="se_component se_subjectMatter subjectMatter_book "></div>
      `),
    ).toThrow("SE3 subject matter block parsing failed.")
  })

  it("uses lazy images, skips incomplete details, and resolves detail links", () => {
    const $ = load(`
      <div class="se_component se_subjectMatter subjectMatter_book ">
        <div class="subjectMatter_thumb">
          <img data-lazy-src="https://example.com/lazy.png" src="https://example.com/fallback.png" alt="cover">
        </div>
        <strong class="subjectMatter_title_text">Fallbacks</strong>
        <p class="subjectMatter_info_item">
          <strong class="subjectMatter_info_title">저자</strong>
        </p>
        <a class="subjectMatter_item_link" href="https://example.com/book"></a>
      </div>
    `)
    const $node = $(".se_component").first()
    const block = new NaverSe3SubjectMatterBlock()

    const blocks = block.convert({
      $,
      $node,
      node: $node[0]!,
      blockId: "naver-se3:subjectMatter",
      path: "0",
      tags: [],
      options: {
        blockOutputs: {
          templates: {},
        },
        resolveLinkUrl: (url) => `resolved:${url}`,
      },
      matchLeafNode: () => false,
      matchNode: () => [],
    })

    expect(blocks).toEqual([
      {
        blockId: "naver-se3:image",
        props: {
          url: "https://example.com/lazy.png",
          alt: "cover",
          caption: null,
        },
        assets: {
          url: imageAsset("https://example.com/lazy.png"),
        },
      },
      {
        blockId: "naver-se3:paragraph",
        props: {
          text: "**Fallbacks**",
        },
      },
      {
        blockId: "naver-se3:paragraph",
        props: {
          text: "[상세보기](resolved:https://example.com/book)",
        },
      },
    ])
  })

  it("reports subject matter support in editor inspection", () => {
    const editor = new NaverBlogSE3Editor()
    const $ = load(`
      <div id="viewTypeSelector">
        <div class="se_component_wrap sect_dsc">
          <div class="se_component se_subjectMatter subjectMatter_book ">
            <strong class="subjectMatter_title_text">캐스터브리지의 시장</strong>
          </div>
        </div>
      </div>
    `)

    expect(
      editor.inspect({
        $,
        tags: [],
        options: {
          blockOutputs: {
            templates: {},
          },
        },
      }),
    ).toMatchObject([
      {
        matchedBlockId: "subjectMatter",
        unsupported: false,
      },
    ])
  })
})
