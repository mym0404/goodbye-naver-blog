import { describe, expect, it } from "vitest"

import { resolveBlockOutputSelection } from "../src/shared/block-registry.js"
import {
  cloneExportOptions,
  frontmatterFieldMeta,
  getFrontmatterExportKey,
  optionDescriptions,
  sanitizePersistedExportOptions,
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
    expect(options.assets.imageHandlingMode).toBe("download-and-upload")
    expect(options.assets.compressionEnabled).toBe(true)
    expect(options.assets.downloadFailureMode).toBe("warn-and-use-source")
    expect(options.links.sameBlogPostMode).toBe("keep-source")
    expect(options.links.sameBlogPostCustomUrlTemplate).toBe("")
    expect(options.markdown.linkStyle).toBe("inlined")
    expect(options.blockOutputs.defaults.formula?.params?.inlineWrapper).toBe("$")
    expect(options.blockOutputs.defaults.formula?.params?.blockWrapper).toBe("$$")
    expect(Object.hasOwn(options, "unsupportedBlockCases")).toBe(false)
    expect(options.structure.groupByCategory).toBe(true)
    expect(options.structure.includeDateInPostFolderName).toBe(true)
    expect(options.structure.includeLogNoInPostFolderName).toBe(false)
    expect(options.structure.slugStyle).toBe("snake")
    expect(options.structure.slugWhitespace).toBe("underscore")
    expect(options.structure.postFolderNameMode).toBe("preset")
    expect(options.structure.postFolderNameCustomTemplate).toBe("")
    expect(Object.hasOwn(options.structure, "postDirectoryName")).toBe(false)
    expect(Object.hasOwn(options.assets, "assetPathMode")).toBe(false)
    expect(Object.hasOwn(options.assets, "imageContentMode")).toBe(false)
  })

  it("drops removed legacy markdown block output options while keeping supported fields", () => {
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
    expect("headingLevelOffset" in options.markdown).toBe(false)
    expect("linkCardStyle" in options.markdown).toBe(false)
    expect("videoStyle" in options.markdown).toBe(false)
  })

  it("merges block output defaults and capability overrides", () => {
    const options = cloneExportOptions({
      blockOutputs: {
        defaults: {
          code: {
            variant: "tilde-fence",
          },
          formula: {
            variant: "math-fence",
            params: {
              inlineWrapper: "\\(...\\)",
            },
          },
        },
        overrides: {
          "se4-formula": {
            variant: "wrapper",
            params: {
              blockWrapper: "\\[...\\]",
            },
          },
        },
      },
    })

    expect(options.blockOutputs.defaults.code?.variant).toBe("tilde-fence")
    expect(options.blockOutputs.defaults.formula?.variant).toBe("math-fence")
    expect(options.blockOutputs.defaults.formula?.params?.inlineWrapper).toBe("\\(...\\)")
    expect(options.blockOutputs.overrides["se4-formula"]?.variant).toBe("wrapper")
    expect(options.blockOutputs.overrides["se4-formula"]?.params?.inlineWrapper).toBe("\\(...\\)")
    expect(options.blockOutputs.overrides["se4-formula"]?.params?.blockWrapper).toBe("\\[...\\]")
  })

  it("ignores legacy unsupported block representative-case selections", () => {
    const options = cloneExportOptions(
      JSON.parse(`{
        "unsupportedBlockCases": {
          "se2-inline-gif-video": {
            "candidateId": "poster-image-only",
            "confirmed": true
          },
          "se3-oglink-og_bSize": {
            "candidateId": "not-a-real-candidate",
            "confirmed": true
          }
        }
      }`),
    )

    expect(Object.hasOwn(options, "unsupportedBlockCases")).toBe(false)
  })

  it("normalizes legacy formula open/close params into wrapper params", () => {
    const options = cloneExportOptions({
      blockOutputs: {
        defaults: {
          formula: {
            variant: "wrapper",
            params: {
              inlineOpen: "\\(",
              inlineClose: "\\)",
            },
          },
        },
      },
    })

    const selection = resolveBlockOutputSelection({
      blockType: "formula",
      blockOutputs: options.blockOutputs,
    })

    expect(selection.params?.inlineWrapper).toBe("\\(...\\)")
    expect(selection.params?.blockWrapper).toBe("$$")
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

  it("drops removed legacy image content mode while keeping upload mode", () => {
    const legacyOptions = JSON.parse(`{
      "assets": {
        "imageHandlingMode": "download-and-upload",
        "downloadImages": false,
        "imageContentMode": "base64"
      }
    }`) as Parameters<typeof cloneExportOptions>[0]

    const options = cloneExportOptions(legacyOptions)

    expect(options.assets.imageHandlingMode).toBe("download-and-upload")
    expect(options.assets.downloadImages).toBe(true)
    expect(Object.hasOwn(options.assets, "imageContentMode")).toBe(false)
  })

  it("removes category ids from persisted options while keeping other scope fields", () => {
    const sanitized = sanitizePersistedExportOptions({
      scope: {
        categoryIds: [101, 202],
        categoryMode: "exact-selected",
        dateFrom: "2026-04-01",
        dateTo: null,
      },
      structure: {
        groupByCategory: false,
      },
    })

    expect(sanitized.scope).toEqual({
      categoryMode: "exact-selected",
      dateFrom: "2026-04-01",
      dateTo: null,
    })
    expect(sanitized.structure).toEqual({
      groupByCategory: false,
    })
  })

  it("keeps new slug structure fields in persisted options", () => {
    const sanitized = sanitizePersistedExportOptions({
      structure: {
        slugStyle: "kebab",
        slugWhitespace: "dash",
        postFolderNameMode: "custom-template",
        postFolderNameCustomTemplate: "{date}-{slug}",
      },
    })

    expect(sanitized.structure).toEqual({
      slugStyle: "kebab",
      slugWhitespace: "dash",
      postFolderNameMode: "custom-template",
      postFolderNameCustomTemplate: "{date}-{slug}",
    })
  })

  it("drops legacy unsupported block case selections from persisted options", () => {
    const sanitized = sanitizePersistedExportOptions(
      JSON.parse(`{
        "unsupportedBlockCases": {
          "se3-horizontal-line-default": {
            "candidateId": "html-default-hr",
            "confirmed": true
          }
        }
      }`),
    )

    expect(Object.hasOwn(sanitized, "unsupportedBlockCases")).toBe(false)
  })

  it("infers legacy slug whitespace from stored slug style", () => {
    expect(
      cloneExportOptions({
        structure: {
          slugStyle: "kebab",
        },
      }).structure.slugWhitespace,
    ).toBe("dash")

    expect(
      cloneExportOptions({
        structure: {
          slugStyle: "keep-title",
        },
      }).structure.slugWhitespace,
    ).toBe("keep-space")
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
    expect(optionDescriptions["structure-slugStyle"]).toContain("snake_case")
    expect(optionDescriptions["structure-slugStyle"]).toContain("카테고리")
    expect(optionDescriptions["structure-slugWhitespace"]).toContain("공백")
    expect(optionDescriptions["structure-slugWhitespace"]).toContain("카테고리")
    expect(optionDescriptions["structure-postFolderNameMode"]).toContain("커스텀 템플릿")
    expect(optionDescriptions["structure-postFolderNameCustomTemplate"]).toContain("{slug}")
    expect(optionDescriptions["assets-imageHandlingMode"]).toContain("업로드")
    expect(optionDescriptions["assets-compressionEnabled"]).toContain("압축")
    expect(optionDescriptions["assets-downloadFailureMode"]).toContain("원본 URL")
    expect(optionDescriptions["assets-stickerAssetMode"]).toContain("네이버 스티커")
    expect(optionDescriptions["links-sameBlogPostMode"]).toContain("같은 블로그")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{slug}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{category}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{title}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{date}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{YYYY}")
    expect(optionDescriptions["structure-postFolderNameCustomTemplate"]).toContain("{MM}")
    expect(optionDescriptions["assets-imageContentMode"]).toBeUndefined()
    expect(optionDescriptions["markdown-linkStyle"]).toContain("reference")
    expect(optionDescriptions["assets-assetPathMode"]).toBeUndefined()
  })
})
