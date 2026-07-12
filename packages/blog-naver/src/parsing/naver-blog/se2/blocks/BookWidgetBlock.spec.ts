import { parseSe2Blocks } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

describe("NaverSe2BookWidgetBlock", () => {
  it("parses wrapped classic book widgets and following review paragraphs", () => {
    const parsed = parseSe2Blocks(`
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
        blockId: "naver-se2:image",
        props: {
          url: "https://bookthumb-phinf.pstatic.net/cover/136/172/13617242.jpg?type=w150&udate=20180619",
          alt: "섬네일",
          caption: null,
        },
        assets: {
          url: {
            role: "image",
            sourceUrl:
              "https://bookthumb-phinf.pstatic.net/cover/136/172/13617242.jpg?type=w150&udate=20180619",
            required: true,
          },
        },
      },
      {
        blockId: "naver-se2:paragraph",
        props: {
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
      },
      {
        blockId: "naver-se2:paragraph",
        props: {
          text: "[리뷰보기](http://book.naver.com/bookdb/book_detail.php?bid=13617242)",
        },
      },
      {
        blockId: "naver-se2:paragraph",
        props: {
          text: "나의 두 번째 안드로이드 서적이다.",
        },
      },
      {
        blockId: "naver-se2:paragraph",
        props: {
          text: "원본이 아닌 번역본이지만, 워낙 짜임새 있는 구성으로 공부하기에 좋다.",
        },
      },
    ])
  })

  it("parses title fallback and link-only book widgets", () => {
    const parsed = parseSe2Blocks(`
      <div class="__se_object" s_type="db" s_subtype="book">
        <p><a class="con_link" href="https://example.com/book">Fallback Book</a></p>
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se2:paragraph",
        props: {
          text: "**Fallback Book**",
        },
      },
      {
        blockId: "naver-se2:paragraph",
        props: {
          text: "[Fallback Book](https://example.com/book)",
        },
      },
    ])
  })

  it("uses an empty alt for book cover images without alt text", () => {
    const parsed = parseSe2Blocks(`
      <div class="__se_object" s_type="db" s_subtype="book">
        <img src="https://example.com/book.png" />
      </div>
    `)

    expect(parsed.blocks).toEqual([
      {
        blockId: "naver-se2:image",
        props: {
          url: "https://example.com/book.png",
          alt: "",
          caption: null,
        },
        assets: {
          url: {
            role: "image",
            sourceUrl: "https://example.com/book.png",
            required: true,
          },
        },
      },
    ])
  })

  it("ignores empty detail nodes and throws when a matched book widget has no content", () => {
    expect(() =>
      parseSe2Blocks(`
        <div class="__se_object" s_type="db" s_subtype="book">
          <dl>
            <dt></dt>
            <span>ignored</span>
          </dl>
        </div>
      `),
    ).toThrow("SE2 book widget block parsing failed.")
  })
})
