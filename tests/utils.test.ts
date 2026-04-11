import { describe, expect, it } from "vitest"

import {
  delay,
  extractBlogId,
  mapConcurrent,
  normalizeAssetUrl,
  sanitizePathSegment,
  slugifyTitle,
  toErrorMessage,
} from "../src/shared/utils.js"

describe("shared utils", () => {
  it("extracts blog ids from supported inputs and rejects blank values", () => {
    expect(extractBlogId("https://blog.naver.com/mym0404")).toBe("mym0404")
    expect(extractBlogId("PostList.naver?blogId=query-blog&categoryNo=1")).toBe("query-blog")
    expect(extractBlogId("  plain-blog-id  ")).toBe("plain-blog-id")
    expect(() => extractBlogId("   ")).toThrow("blogId 또는 blog URL을 입력해야 합니다.")
  })

  it("sanitizes path segments and falls back for empty slugs", () => {
    expect(sanitizePathSegment('- invalid:/\\\\name?*  ')).toBe("invalid name")
    expect(sanitizePathSegment(":::")).toBe("untitled")
    expect(slugifyTitle("Hello   World")).toBe("hello-world")
    expect(slugifyTitle(":::")).toBe("untitled")
  })

  it("normalizes asset urls and preserves invalid inputs", () => {
    expect(normalizeAssetUrl("https://mblogthumb-phinf.pstatic.net/a.png")).toBe(
      "https://mblogthumb-phinf.pstatic.net/a.png?type=w800",
    )
    expect(normalizeAssetUrl("https://mblogthumb-phinf.pstatic.net/a.png?type=w2")).toBe(
      "https://mblogthumb-phinf.pstatic.net/a.png?type=w2",
    )
    expect(normalizeAssetUrl("  not-a-url  ")).toBe("not-a-url")
    expect(normalizeAssetUrl("   ")).toBe("")
  })

  it("formats errors and preserves item order in concurrent mapping", async () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom")
    expect(toErrorMessage("plain")).toBe("plain")

    await delay(0)

    const results = await mapConcurrent({
      items: [30, 0, 10],
      concurrency: 2,
      mapper: async (ms, index) => {
        await delay(ms)
        return `${index}:${ms}`
      },
    })

    expect(results).toEqual(["0:30", "1:0", "2:10"])
  })
})
