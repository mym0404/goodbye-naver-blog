import {
  getTemplateExpressions,
  renderTemplateExpressions,
} from "@exitpress/domain/template/util/renderTemplateExpressions.js"
import { expectBlockTemplateCatalog } from "@tests/support/parser-test-utils.js"
import { describe, expect, it } from "vitest"

import { NaverBlog } from "./NaverBlog.js"

describe("parser block catalog", () => {
  it("keeps Naver editor instances and derives block templates by editor and block order", () => {
    const blog = new NaverBlog()
    const templateDefinitions = blog.getBlockTemplateDefinitions()

    expect(blog.editors).toHaveLength(3)
    expect(blog.editors.map((editor) => editor.type)).toEqual([
      "naver-se4",
      "naver-se3",
      "naver-se2",
    ])
    expect(templateDefinitions.map((definition) => definition.key)).toEqual([
      "naver-se4:documentTitle",
      "naver-se4:formula",
      "naver-se4:code",
      "naver-se4:linkCard",
      "naver-se4:file",
      "naver-se4:video",
      "naver-se4:oembed",
      "naver-se4:map",
      "naver-se4:schedule",
      "naver-se4:talkTalk",
      "naver-se4:table",
      "naver-se4:imageStrip",
      "naver-se4:imageGroup",
      "naver-se4:sticker",
      "naver-se4:image",
      "naver-se4:wrappingParagraph",
      "naver-se4:heading",
      "naver-se4:divider",
      "naver-se4:quote",
      "naver-se4:mrBlog",
      "naver-se4:paragraph",
      "naver-se4:material",
      "naver-se3:documentTitle",
      "naver-se3:divider",
      "naver-se3:table",
      "naver-se3:quote",
      "naver-se3:code",
      "naver-se3:linkCard",
      "naver-se3:map",
      "naver-se3:mapText",
      "naver-se3:video",
      "naver-se3:file",
      "naver-se3:subjectMatter",
      "naver-se3:imageStrip",
      "naver-se3:image",
      "naver-se3:paragraph",
      "naver-se2:style",
      "naver-se2:comment",
      "naver-se2:paragraph",
      "naver-se2:bookWidget",
      "naver-se2:code",
      "naver-se2:table",
      "naver-se2:container",
      "naver-se2:divider",
      "naver-se2:lineBreak",
      "naver-se2:quote",
      "naver-se2:heading",
      "naver-se2:inlineGifVideo",
      "naver-se2:poll",
      "naver-se2:video",
      "naver-se2:image",
      "naver-se2:spacer",
    ])
    expect(templateDefinitions.every((definition) => definition.presets.length >= 1)).toBe(true)
    expect(
      templateDefinitions.every((definition) => Object.keys(definition.props).length >= 0),
    ).toBe(true)
    expect(templateDefinitions.every((definition) => definition.presets[0]?.label !== "기본")).toBe(
      true,
    )
    expectBlockTemplateCatalog(templateDefinitions)
    expect(
      templateDefinitions.find((definition) => definition.key === "naver-se4:documentTitle"),
    ).toMatchObject({
      presets: [{ id: "ignore", label: "무시", template: "" }],
      props: {},
    })
  })

  it("keeps block preset interpolation inside double-brace expressions", () => {
    const templateDefinitions = new NaverBlog().getBlockTemplateDefinitions()

    templateDefinitions.forEach((definition) => {
      definition.presets.forEach((preset) => {
        const expressions = getTemplateExpressions(preset.template)

        if (Object.keys(definition.props).length > 0 && preset.template.trim()) {
          expect(
            expressions.length,
            `${definition.key}:${preset.id} should use {{ expression }} template syntax`,
          ).toBeGreaterThan(0)
        }

        Array.from(preset.template.matchAll(/\$\{/g)).forEach((match) => {
          const offset = match.index ?? -1

          expect(
            expressions.some(
              (expression) => expression.offset <= offset && offset < expression.endOffset,
            ),
            `${definition.key}:${preset.id} has unsupported interpolation outside {{ expression }}`,
          ).toBe(true)
        })
      })
    })
  })

  it("preserves source semantics in changed parser presets", () => {
    const definitions = new Map(
      new NaverBlog()
        .getBlockTemplateDefinitions()
        .map((definition) => [definition.key, definition]),
    )
    const render = (key: string, props: Parameters<typeof renderTemplateExpressions>[0]["props"]) =>
      definitions
        .get(key)!
        .presets.map(({ template }) => renderTemplateExpressions({ template, props }))

    expect(render("naver-se2:heading", { level: 3, text: "Heading" })).toEqual(["### Heading"])
    expect(render("naver-se4:formula", { formula: "x+y", display: false })).toEqual([
      "$x+y$",
      "$$\nx+y\n$$",
      "$x+y$",
      "```math\nx+y\n```",
    ])
    expect(
      render("naver-se4:image", {
        alt: "Alt",
        url: "https://example.com/image.png",
        caption: "Caption",
      }),
    ).toEqual(["![Alt](https://example.com/image.png)\nCaption"])

    const cardProps = {
      title: "Title",
      url: "https://example.com/card",
      description: "Description",
      thumbnailUrl: "https://example.com/thumb.png",
    }
    const cardOutputs = [
      "![Title](https://example.com/thumb.png)\n[Title](https://example.com/card)\nDescription",
      "[Title](https://example.com/card)",
      "[Title](https://example.com/card)\nDescription",
      "![Title](https://example.com/thumb.png)\n[Title](https://example.com/card)",
    ]

    expect(render("naver-se3:linkCard", cardProps)).toEqual(cardOutputs)
    expect(render("naver-se4:linkCard", cardProps)).toEqual(cardOutputs)
    expect(render("naver-se4:oembed", cardProps)).toEqual(cardOutputs.slice(0, 3))
    expect(render("naver-se4:material", cardProps)).toEqual(cardOutputs.slice(0, 3))
    expect(
      render("naver-se4:video", {
        title: "Video",
        url: "https://example.com/video",
        thumbnailUrl: "https://example.com/video.png",
        width: 640,
        height: 360,
        vid: "video-id",
      }),
    ).toEqual(["![Video](https://example.com/video.png)\n[Video](https://example.com/video)"])

    ;["naver-se2:quote", "naver-se3:quote", "naver-se4:quote", "naver-se4:mrBlog"].forEach((key) =>
      expect(render(key, { text: "First\nSecond" })).toEqual(["> First\n> Second"]),
    )

    const cell = (text: string, isHeader: boolean) => ({
      text,
      html: text,
      colspan: 1,
      rowspan: 1,
      isHeader,
    })
    const tableProps = {
      rows: [
        [cell("Name", true), cell("Value", true)],
        [cell("A", false), cell("1", false)],
      ],
      html: "<table>complex</table>",
      complex: false,
    }

    ;["naver-se2:table", "naver-se3:table", "naver-se4:table"].forEach((key) => {
      expect(render(key, tableProps)).toEqual(["| Name | Value |\n| --- | --- |\n| A | 1 |"])
      expect(render(key, { ...tableProps, complex: true })).toEqual(["<table>complex</table>"])
    })

    ;[
      "naver-se2:bookWidget",
      "naver-se2:container",
      "naver-se3:subjectMatter",
      "naver-se4:wrappingParagraph",
    ].forEach((key) => {
      expect(definitions.get(key)).toMatchObject({
        presets: [{ id: "children", label: "하위 블록", template: "" }],
        props: {},
      })
    })
  })
})
