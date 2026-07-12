import { describe, expect, it } from "vitest"

import {
  cloneExportOptions,
  frontmatterFieldMeta,
  getFrontmatterExportKey,
  optionDescriptions,
  sanitizePersistedExportOptions,
  validateFrontmatterAliases,
} from "./ExportOptions.js"

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
    expect(Object.hasOwn(options.frontmatter.fields, "visibility")).toBe(false)
    expect(Object.hasOwn(options.frontmatter.fields, "video")).toBe(false)
    expect(Object.hasOwn(options.frontmatter.aliases, "visibility")).toBe(false)
    expect(Object.hasOwn(options.frontmatter.aliases, "video")).toBe(false)
    expect(options.assets.stickerAssetMode).toBe("ignore")
    expect(options.assets.imageHandlingMode).toBe("download-and-upload")
    expect(options.assets.compressionEnabled).toBe(true)
    expect(options.assets.downloadFailureMode).toBe("fail")
    expect(options.assets.includeImageCaptions).toBe(false)
    expect(options.links.sameBlogPostMode).toBe("keep-source")
    expect(options.links.sameBlogPostCustomUrlTemplate).toBe("")
    expect(options.blockOutputs.templates).toEqual({ gfm: {}, fumadocs: {} })
    expect(options.structure.groupByCategory).toBe(true)
    expect(options.structure.slugStyle).toBe("snake")
    expect(options.structure.slugWhitespace).toBe("underscore")
    expect(options.structure.postFolderNameTemplate).toBe("{{ date }}-{{ slug }}")
    expect(Object.hasOwn(options.structure, "postDirectoryName")).toBe(false)
    expect(Object.hasOwn(options.structure, "postFolderNameMode")).toBe(false)
    expect(Object.hasOwn(options.structure, "includeDateInPostFolderName")).toBe(false)
    expect(Object.hasOwn(options.structure, "includePostIdInPostFolderName")).toBe(false)
    expect(Object.hasOwn(options.assets, "assetPathMode")).toBe(false)
  })

  it("stores block output templates as plain strings", () => {
    const options = cloneExportOptions({
      blockOutputs: {
        templates: {
          fumadocs: {
            "blog:image": "{{ `![${alt}](${url})` }}",
          },
        },
      },
    })

    expect(options.blockOutputs.templates).toEqual({
      gfm: {},
      fumadocs: {
        "blog:image": "{{ `![${alt}](${url})` }}",
      },
    })
  })

  it("keeps block output templates from persisted options", () => {
    const sanitized = sanitizePersistedExportOptions(
      JSON.parse(
        JSON.stringify({
          blockOutputs: {
            templates: {
              fumadocs: {
                "blog:image": "{{ `![${alt}](${url})` }}",
                "blog:code": 123,
              },
            },
          },
        }),
      ),
    )

    expect(sanitized.blockOutputs?.templates).toEqual({
      fumadocs: {
        "blog:image": "{{ `![${alt}](${url})` }}",
      },
    })
  })

  it("drops unsupported frontmatter field keys from persisted options", () => {
    const sanitized = sanitizePersistedExportOptions(
      JSON.parse(`{
        "frontmatter": {
          "fields": {
            "title": false,
            "visibility": true,
            "video": true,
            "removedField": true
          },
          "aliases": {
            "title": "postTitle",
            "visibility": "visible",
            "video": "videos",
            "removedField": "removed"
          }
        }
      }`),
    )

    expect(sanitized.frontmatter?.fields).toEqual({
      title: false,
    })
    expect(sanitized.frontmatter?.aliases).toEqual({
      title: "postTitle",
    })
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
        postFolderNameTemplate: "{{ date }}-{{ slug }}",
      },
    })

    expect(sanitized.structure).toEqual({
      slugStyle: "kebab",
      slugWhitespace: "dash",
      postFolderNameTemplate: "{{ date }}-{{ slug }}",
    })
  })

  it("infers classic slug whitespace from stored slug style", () => {
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
        blogKey: false,
        sourceId: false,
        postId: false,
        publishedAt: false,
        category: false,
        categoryPath: false,
        tags: false,
        thumbnail: false,
        exportedAt: false,
        assetPaths: false,
      },
      aliases: {
        title: "9bad",
        source: "dup",
        blogKey: "",
        sourceId: "",
        postId: "",
        publishedAt: "",
        category: "",
        categoryPath: "",
        tags: "",
        thumbnail: "",
        exportedAt: "",
        assetPaths: "dup",
      },
    })

    expect(errors).toEqual([
      "title alias는 영문자 또는 _로 시작해야 하며 영문자, 숫자, -, _만 사용할 수 있습니다.",
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
    expect(optionDescriptions["structure-postFolderNameTemplate"]).toContain("{{ slug }}")
    expect(optionDescriptions["assets-imageHandlingMode"]).toContain("업로드")
    expect(optionDescriptions["assets-compressionEnabled"]).toContain("압축")
    expect(optionDescriptions["assets-downloadFailureMode"]).toContain("원본 URL")
    expect(optionDescriptions["assets-stickerAssetMode"]).toContain("플랫폼 스티커")
    expect(optionDescriptions["links-sameBlogPostMode"]).toContain("같은 블로그")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{{ slug }}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{{ category }}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{{ title }}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{{ date }}")
    expect(optionDescriptions["links-sameBlogPostCustomUrlTemplate"]).toContain("{{ YYYY }}")
    expect(optionDescriptions["structure-postFolderNameTemplate"]).toContain("{{ MM }}")
    expect(optionDescriptions["assets-assetPathMode"]).toBeUndefined()
  })
})
