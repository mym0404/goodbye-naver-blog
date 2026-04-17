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
    expect(options.assets.imageHandlingMode).toBe("download")
    expect(options.assets.compressionEnabled).toBe(false)
    expect(options.assets.imageContentMode).toBe("path")
    expect(options.markdown.formulaInlineWrapperOpen).toBe("$")
    expect(options.markdown.formulaBlockWrapperOpen).toBe("$$")
    expect(options.structure.groupByCategory).toBe(true)
    expect(options.structure.includeDateInPostFolderName).toBe(true)
    expect(options.structure.includeLogNoInPostFolderName).toBe(false)
    expect(Object.hasOwn(options.structure, "postDirectoryName")).toBe(false)
    expect(Object.hasOwn(options.assets, "assetPathMode")).toBe(false)
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

  it("forces local downloads for download-and-upload mode", () => {
    const options = cloneExportOptions({
      assets: {
        imageHandlingMode: "download-and-upload",
        downloadImages: false,
        downloadThumbnails: false,
      },
    })

    expect(options.assets.imageHandlingMode).toBe("download-and-upload")
    expect(options.assets.downloadImages).toBe(true)
    expect(options.assets.downloadThumbnails).toBe(true)
  })

  it("coerces base64 image content away from upload mode", () => {
    const options = cloneExportOptions({
      assets: {
        imageHandlingMode: "download-and-upload",
        imageContentMode: "base64",
        downloadImages: false,
      },
    })

    expect(options.assets.imageHandlingMode).toBe("download")
    expect(options.assets.imageContentMode).toBe("base64")
    expect(options.assets.downloadImages).toBe(true)
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
    expect(optionDescriptions["structure-groupByCategory"]).toContain("카테고리 경로")
    expect(optionDescriptions["assets-imageHandlingMode"]).toContain("업로드")
    expect(optionDescriptions["assets-compressionEnabled"]).toContain("압축")
    expect(optionDescriptions["assets-stickerAssetMode"]).toContain("네이버 스티커")
    expect(optionDescriptions["assets-imageContentMode"]).toContain("base64")
    expect(optionDescriptions["markdown-formulaBlockWrapperOpen"]).toContain("$$")
    expect(optionDescriptions["assets-assetPathMode"]).toBeUndefined()
  })
})
