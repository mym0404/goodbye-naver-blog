import { describe, expect, it } from "vitest"

import {
  cloneExportOptions,
  frontmatterFieldMeta,
  getFrontmatterExportKey,
  optionDescriptions,
  validateFrontmatterAliases,
} from "../src/shared/export-options.js"

describe("export options", () => {
  it("merges frontmatter aliases with defaults", () => {
    const options = cloneExportOptions({
      frontmatter: {
        aliases: {
          title: "postTitle",
        },
      },
    })

    expect(options.frontmatter.aliases.title).toBe("postTitle")
    expect(options.frontmatter.aliases.source).toBe("")
    expect(options.frontmatter.fields.title).toBe(true)
    expect(options.assets.stickerAssetMode).toBe("ignore")
    expect(options.assets.imageContentMode).toBe("path")
    expect(options.markdown.formulaInlineWrapperOpen).toBe("$")
    expect(options.markdown.formulaBlockWrapperOpen).toBe("$$")
    expect(options.structure.includeDateInFilename).toBe(true)
    expect(options.structure.includeLogNoInFilename).toBe(false)
  })

  it("drops removed legacy markdown options while keeping supported fields", () => {
    const legacyOptions = JSON.parse(`{
      "markdown": {
        "linkStyle": "referenced",
        "headingLevelOffset": 1,
        "linkCardStyle": "quote",
        "videoStyle": "link-only"
      }
    }`) as Parameters<typeof cloneExportOptions>[0]

    const options = cloneExportOptions(legacyOptions)

    expect(options.markdown.linkStyle).toBe("referenced")
    expect(options.markdown.headingLevelOffset).toBe(1)
    expect("linkCardStyle" in options.markdown).toBe(false)
    expect("videoStyle" in options.markdown).toBe(false)
  })

  it("returns field name when alias is blank", () => {
    expect(
      getFrontmatterExportKey({
        fieldName: "title",
        alias: "  ",
      }),
    ).toBe("title")
  })

  it("detects invalid alias format and collisions only for enabled fields", () => {
    const errors = validateFrontmatterAliases({
      enabled: true,
      fields: {
        title: true,
        source: true,
        blogId: false,
        logNo: false,
        publishedAt: false,
        category: false,
        categoryPath: false,
        editorVersion: false,
        visibility: false,
        tags: false,
        thumbnail: false,
        video: false,
        warnings: false,
        exportedAt: false,
        assetPaths: false,
      },
      aliases: {
        title: "9bad",
        source: "dup",
        blogId: "",
        logNo: "",
        publishedAt: "",
        category: "",
        categoryPath: "",
        editorVersion: "",
        visibility: "",
        tags: "",
        thumbnail: "",
        video: "",
        warnings: "",
        exportedAt: "",
        assetPaths: "dup",
      },
    })

    expect(errors).toEqual([
      "title alias는 영문자 또는 _로 시작하고 영문자, 숫자, -, _만 사용할 수 있습니다.",
    ])
  })

  it("exposes label, description and default alias metadata for each field", () => {
    expect(frontmatterFieldMeta.title).toEqual({
      label: "title",
      description: "글 제목을 기록합니다.",
      defaultAlias: "title",
    })
    expect(frontmatterFieldMeta.assetPaths.defaultAlias).toBe("assetPaths")
  })

  it("exposes option descriptions for newly added export controls", () => {
    expect(optionDescriptions["assets-stickerAssetMode"]).toContain("네이버 스티커")
    expect(optionDescriptions["assets-imageContentMode"]).toContain("base64")
    expect(optionDescriptions["markdown-formulaBlockWrapperOpen"]).toContain("$$")
  })
})
