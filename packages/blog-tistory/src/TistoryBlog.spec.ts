import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { describe, expect, it, vi } from "vitest"

import { createTistoryBlog } from "./TistoryBlog.js"

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>https://sample.tistory.com/42</loc></url>
  <url><loc>https://sample.tistory.com/m/42</loc></url>
  <url><loc>https://sample.tistory.com/entry/second-post</loc></url>
  <url><loc>https://sample.tistory.com/category/test</loc></url>
</urlset>`

const postHtml = ({ title, category }: { title: string; category: string }) => `<!doctype html>
<html>
  <head>
    <meta property="og:title" content="${title}" />
    <meta property="article:published_time" content="2024-01-02T03:04:05.000Z" />
    <meta property="article:section" content="${category}" />
    <meta property="og:image" content="https://sample.tistory.com/thumb.png" />
    <meta property="article:tag" content="tag-a" />
  </head>
  <body><article><div class="tt_article_useless_p_margin"><p>${title} body.</p></div></article></body>
</html>`

const createFetchText = () =>
  vi.fn(async (url: string) => {
    if (url.endsWith("/sitemap.xml")) {
      return sitemap
    }

    return postHtml({
      title: url.endsWith("/42") ? "First Post" : "Second Post",
      category: url.endsWith("/42") ? "Development" : "Writing",
    })
  })

describe("createTistoryBlog", () => {
  it("parses a Tistory source URL", () => {
    expect(createTistoryBlog().parseSource("https://sample.tistory.com/42")).toEqual({
      blogKey: "tistory",
      sourceId: "sample.tistory.com",
      displayName: "sample.tistory.com",
      input: "https://sample.tistory.com/42",
    })
  })

  it("scans canonical sitemap posts and metadata", async () => {
    const fetchText = createFetchText()
    const blog = createTistoryBlog({ fetchText })
    const source = blog.parseSource("https://sample.tistory.com")
    const scan = await blog.scan(source)

    expect(scan.totalPostCount).toBe(2)
    expect(
      scan.posts.map(({ postId, title, categoryName }) => ({ postId, title, categoryName })),
    ).toEqual([
      { postId: "42", title: "First Post", categoryName: "Development" },
      { postId: "second-post", title: "Second Post", categoryName: "Writing" },
    ])
    expect(scan.categories).toEqual([
      {
        id: 0,
        name: "Development",
        parentId: undefined,
        postCount: 1,
        path: ["Development"],
        depth: 0,
      },
      { id: 1, name: "Writing", parentId: undefined, postCount: 1, path: ["Writing"], depth: 0 },
    ])
    expect(fetchText).not.toHaveBeenCalledWith("https://sample.tistory.com/m/42", undefined)
  })

  it("uses the shared post HTML cache during scan and load", async () => {
    const fetchText = createFetchText()
    const cache = {
      getPostHtml: vi.fn(async ({ postId }: { postId: string }) =>
        postId === "42" ? postHtml({ title: "Cached Post", category: "Cache" }) : null,
      ),
      setPostHtml: vi.fn(async () => undefined),
    }
    const blog = createTistoryBlog({ fetchText })
    const source = blog.parseSource("https://sample.tistory.com")
    const scan = await blog.scan(source, { cache })
    const content = await blog.loadPostContent({ source, post: scan.posts[0]!, cache })

    expect(scan.posts[0]?.title).toBe("Cached Post")
    expect(content.kind).toBe("html")
    expect(fetchText).not.toHaveBeenCalledWith("https://sample.tistory.com/42", undefined)
    expect(cache.setPostHtml).toHaveBeenCalledTimes(1)
  })

  it("builds category hierarchy from Tistory entry metadata", async () => {
    const fetchText = vi.fn(async (url: string) =>
      url.endsWith("/sitemap.xml")
        ? "<urlset><url><loc>https://sample.tistory.com/42</loc></url></urlset>"
        : `<script>window.T.entryInfo = {"entryId":42,"categoryLabel":"HOW TO/WEB FLOW"};</script>
           <article><div class="tt_article_useless_p_margin"><p>Body</p></div></article>`,
    )
    const blog = createTistoryBlog({ fetchText })
    const scan = await blog.scan(blog.parseSource("https://sample.tistory.com"))

    expect(scan.categories).toEqual([
      {
        id: 0,
        name: "HOW TO",
        parentId: undefined,
        postCount: 1,
        path: ["HOW TO"],
        depth: 0,
      },
      {
        id: 1,
        name: "WEB FLOW",
        parentId: 0,
        postCount: 1,
        path: ["HOW TO", "WEB FLOW"],
        depth: 1,
      },
    ])
    expect(scan.posts[0]).toMatchObject({ categoryId: 1, categoryName: "WEB FLOW" })
  })

  it("keeps sitemap posts when one metadata request fails", async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) {
        return sitemap
      }

      if (url.endsWith("/42")) {
        throw new Error("temporary failure")
      }

      return postHtml({ title: "Second Post", category: "Writing" })
    })
    const blog = createTistoryBlog({ fetchText })
    const scan = await blog.scan(blog.parseSource("https://sample.tistory.com"))

    expect(scan.posts).toHaveLength(2)
    expect(scan.posts[0]).toMatchObject({ postId: "42", title: "42" })
  })

  it("stops scanning when Tistory rate-limits requests", async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) {
        return sitemap
      }

      throw new Error(`Tistory fetch failed: 429 ${url}`)
    })
    const blog = createTistoryBlog({ fetchText })

    await expect(blog.scan(blog.parseSource("https://sample.tistory.com"))).rejects.toThrow(
      "Tistory fetch failed: 429",
    )
  })

  it("parses loaded HTML through Tistory block parsers", async () => {
    const blog = createTistoryBlog({ fetchText: createFetchText() })
    const source = blog.parseSource("https://sample.tistory.com")
    const scan = await blog.scan(source)
    const content = await blog.loadPostContent({ source, post: scan.posts[0]! })
    const options = defaultExportOptions()
    const parsed = blog.parseContent({
      source,
      post: scan.posts[0]!,
      content,
      options,
    })

    expect(parsed.tags).toEqual(["tag-a"])
    expect(parsed.blocks).toEqual([
      { blockId: "tistory:paragraph", props: { text: "First Post body." } },
    ])
  })

  it("resolves numeric and entry post links", () => {
    const blog = createTistoryBlog()

    expect(blog.resolvePostLinkIdentity?.("https://sample.tistory.com/42")).toEqual({
      blogKey: "tistory",
      sourceId: "sample.tistory.com",
      postId: "42",
    })
    expect(
      blog.resolvePostLinkIdentity?.("https://sample.tistory.com/category/dev"),
    ).toBeUndefined()
  })

  it("exposes every Tistory block template", () => {
    const keys = createTistoryBlog()
      .getBlockTemplateDefinitions()
      .map(({ key }) => key)

    expect(keys).toEqual([
      "tistory:ignore",
      "tistory:tableOfContents",
      "tistory:linkCard",
      "tistory:file",
      "tistory:media",
      "tistory:code",
      "tistory:table",
      "tistory:divider",
      "tistory:image",
      "tistory:heading",
      "tistory:quote",
      "tistory:list",
      "tistory:paragraph",
      "tistory:container",
      "tistory:inline",
    ])
  })

  it("exposes Fumadocs-safe image and table templates", () => {
    const templates = createTistoryBlog().getOutputBlockTemplates?.("fumadocs")

    expect(templates?.["tistory:image"]).toContain("unoptimized")
    expect(templates?.["tistory:table"]).not.toContain("complex ? html")
  })

  it("exposes Docusaurus admonition and inline TOC templates", () => {
    const templates = createTistoryBlog().getOutputBlockTemplates?.("docusaurus")

    expect(templates?.["tistory:quote"]).toContain(":::note")
    expect(templates?.["tistory:tableOfContents"]).toBe("<TOCInline toc={toc} />")
  })

  it("exposes Nextra component and image templates", () => {
    const templates = createTistoryBlog().getOutputBlockTemplates?.("nextra")

    expect(templates?.["tistory:quote"]).toContain("<Callout>")
    expect(templates?.["tistory:image"]).toContain("<img")
  })
})
