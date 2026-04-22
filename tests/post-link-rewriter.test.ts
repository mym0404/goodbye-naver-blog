import { describe, expect, it } from "vitest"

import {
  buildPostLinkTargets,
  createSameBlogPostLinkResolver,
  extractNaverBlogPostIdentity,
} from "../src/modules/exporter/post-link-rewriter.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type { CategoryInfo, PostSummary } from "../src/shared/types.js"

const categories: CategoryInfo[] = [
  {
    id: 10,
    name: "NestJS",
    parentId: null,
    postCount: 2,
    isDivider: false,
    isOpen: true,
    path: ["NestJS"],
    depth: 0,
  },
]

const posts: PostSummary[] = [
  {
    blogId: "mym0404",
    logNo: "223034929697",
    title: "첫 글",
    publishedAt: "2026-04-11T04:00:00.000Z",
    categoryId: 10,
    categoryName: "NestJS",
    source: "https://blog.naver.com/mym0404/223034929697",
    editorVersion: 4,
    thumbnailUrl: null,
  },
  {
    blogId: "mym0404",
    logNo: "223034929698",
    title: "둘째 글",
    publishedAt: "2026-04-12T04:00:00.000Z",
    categoryId: 10,
    categoryName: "NestJS",
    source: "https://blog.naver.com/mym0404/223034929698",
    editorVersion: 4,
    thumbnailUrl: null,
  },
]

describe("post-link-rewriter", () => {
  it("extracts blogId and logNo from multiple Naver post URL shapes", () => {
    expect(extractNaverBlogPostIdentity("https://blog.naver.com/mym0404/223034929697")).toEqual({
      blogId: "mym0404",
      logNo: "223034929697",
    })
    expect(extractNaverBlogPostIdentity("http://blog.naver.com/mym0404/223034929697?viewType=pc")).toEqual({
      blogId: "mym0404",
      logNo: "223034929697",
    })
    expect(
      extractNaverBlogPostIdentity("https://m.blog.naver.com/PostView.naver?blogId=mym0404&logNo=223034929697"),
    ).toEqual({
      blogId: "mym0404",
      logNo: "223034929697",
    })
    expect(extractNaverBlogPostIdentity("/PostView.naver?blogId=mym0404&logNo=223034929697")).toEqual({
      blogId: "mym0404",
      logNo: "223034929697",
    })
    expect(extractNaverBlogPostIdentity("https://m.blog.naver.com/PostList.naver?blogId=mym0404")).toBeNull()
  })

  it("rewrites matched same-blog links to relative file paths", () => {
    const options = defaultExportOptions()
    const targets = buildPostLinkTargets({
      outputDir: "/tmp/export",
      posts,
      categories,
      options,
    })
    const resolveLinkUrl = createSameBlogPostLinkResolver({
      blogId: "mym0404",
      markdownFilePath: "/tmp/export/nestjs/2026-04-11-첫_글/index.md",
      options: {
        links: {
          sameBlogPostMode: "relative-filepath",
          sameBlogPostCustomUrlTemplate: "",
        },
      },
      targets,
    })

    expect(resolveLinkUrl("https://m.blog.naver.com/mym0404/223034929698")).toBe("../2026-04-12-둘째_글/index.md")
    expect(resolveLinkUrl("https://blog.naver.com/other/1")).toBe("https://blog.naver.com/other/1")
  })

  it("rewrites matched same-blog links to custom slug URLs and keeps unmatched links as-is", () => {
    const options = defaultExportOptions()
    const targets = buildPostLinkTargets({
      outputDir: "/tmp/export",
      posts,
      categories,
      options,
    })
    const resolveLinkUrl = createSameBlogPostLinkResolver({
      blogId: "mym0404",
      markdownFilePath: "/tmp/export/nestjs/2026-04-11-first/index.md",
      options: {
        links: {
          sameBlogPostMode: "custom-url",
          sameBlogPostCustomUrlTemplate: "https://myblog/{category}/{title}/{YYYY}/{MM}/{DD}/{YY}/{M}/{D}/{blogId}/{logNo}/{slug}",
        },
      },
      targets,
    })

    expect(resolveLinkUrl("https://blog.naver.com/mym0404/223034929698")).toBe(
      "https://myblog/nestjs/둘째-글/2026/04/12/26/4/12/mym0404/223034929698/둘째_글",
    )
    expect(resolveLinkUrl("https://blog.naver.com/mym0404/999999999999")).toBe(
      "https://blog.naver.com/mym0404/999999999999",
    )
  })

  it("uses custom post folder name templates for relative export paths", () => {
    const options = defaultExportOptions()

    options.structure.postFolderNameMode = "custom-template"
    options.structure.postFolderNameCustomTemplate = "{year}_{month}_{logNo}_{slug}"

    const targets = buildPostLinkTargets({
      outputDir: "/tmp/export",
      posts,
      categories,
      options,
    })
    const resolveLinkUrl = createSameBlogPostLinkResolver({
      blogId: "mym0404",
      markdownFilePath: "/tmp/export/nestjs/2026_04_223034929697_첫_글/index.md",
      options: {
        links: {
          sameBlogPostMode: "relative-filepath",
          sameBlogPostCustomUrlTemplate: "",
        },
      },
      targets,
    })

    expect(resolveLinkUrl("https://m.blog.naver.com/mym0404/223034929698")).toBe(
      "../2026_04_223034929698_둘째_글/index.md",
    )
  })
})
