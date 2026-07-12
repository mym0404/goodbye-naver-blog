import { describe, expect, it } from "vitest"

import { createNaverBlog } from "./NaverBlog.js"

describe("createNaverBlog", () => {
  it("parses a Naver Blog URL source", () => {
    const blog = createNaverBlog()

    expect(blog.parseSource("https://blog.naver.com/mym0404")).toEqual({
      blogKey: "naver",
      sourceId: "mym0404",
      displayName: "mym0404",
      input: "https://blog.naver.com/mym0404",
    })
  })

  it("exposes Naver Blog block template definitions", () => {
    const blog = createNaverBlog()
    const definitionKeys = blog.getBlockTemplateDefinitions().map((definition) => definition.key)

    expect(definitionKeys).toContain("naver-se4:paragraph")
    expect(definitionKeys).toContain("naver-se4:image")
  })

  it("exposes Fumadocs-safe image and formula templates", () => {
    const templates = createNaverBlog().getOutputBlockTemplates?.("fumadocs")

    expect(templates?.["naver-se4:image"]).toContain("unoptimized")
    expect(templates?.["naver-se4:formula"]).toContain("latex")
  })

  it("exposes Docusaurus admonition and table templates", () => {
    const templates = createNaverBlog().getOutputBlockTemplates?.("docusaurus")

    expect(templates?.["naver-se4:quote"]).toContain(":::note")
    expect(templates?.["naver-se4:table"]).not.toContain("complex ? html")
  })

  it("exposes Nextra component and image templates", () => {
    const templates = createNaverBlog().getOutputBlockTemplates?.("nextra")

    expect(templates?.["naver-se4:quote"]).toContain("<Callout>")
    expect(templates?.["naver-se4:image"]).toContain("<img")
  })

  it("resolves a Naver post URL identity", () => {
    const blog = createNaverBlog()

    expect(blog.resolvePostLinkIdentity?.("https://blog.naver.com/mym0404/223034929697")).toEqual({
      blogKey: "naver",
      sourceId: "mym0404",
      postId: "223034929697",
    })
  })
})
