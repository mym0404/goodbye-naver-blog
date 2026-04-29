import { describe, expect, it } from "vitest"

import { NaverBlog } from "../src/modules/blog/NaverBlog.js"

describe("parser block catalog", () => {
  it("keeps Naver editor instances and derives selectable output options by editor and block order", () => {
    const blog = new NaverBlog()
    const outputDefinitions = blog.getBlockOutputDefinitions()
    const getDefaultOption = (definition: (typeof outputDefinitions)[number]) =>
      definition.options.find((option) => option.isDefault) ?? definition.options[0]

    expect(blog.editors).toHaveLength(3)
    expect(blog.editors.map((editor) => editor.type)).toEqual(["naver-se4", "naver-se3", "naver-se2"])
    expect(outputDefinitions.map((definition) => definition.key)).toEqual([
      "naver-se4:formula",
      "naver-se4:code",
      "naver-se4:table",
      "naver-se4:image",
      "naver-se4:divider",
      "naver-se3:table",
      "naver-se3:code",
      "naver-se3:image",
      "naver-se2:table",
      "naver-se2:divider",
      "naver-se2:code",
      "naver-se2:image",
    ])
    expect(outputDefinitions.every((definition) => definition.options.length >= 2)).toBe(true)
    expect(outputDefinitions.some((definition) => String(definition.key) === getDefaultOption(definition)?.preview.type)).toBe(false)
    expect(outputDefinitions.filter((definition) => getDefaultOption(definition)?.preview.type === "code").map((definition) => definition.key)).toEqual([
      "naver-se4:code",
      "naver-se3:code",
      "naver-se2:code",
    ])
  })
})
