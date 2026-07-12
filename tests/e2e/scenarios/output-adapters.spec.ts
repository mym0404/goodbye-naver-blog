import { readFile, rm } from "node:fs/promises"
import path from "node:path"

import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { BlogExportWorkflow } from "@exitpress/engine/exporting/blog/BlogExportWorkflow.js"
import { expect, test } from "@playwright/test"
import { createMarkdownMockBlog } from "@tests/support/blog/MockBlogs.js"
import { createTestTempDir } from "@tests/support/test-paths.js"

import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { Blog } from "@exitpress/engine/blog/Blog.js"

const createOptions = () => {
  const options = defaultExportOptions()

  options.assets.imageHandlingMode = "remote"

  return options
}

const runExport = async ({ profile, blog }: { profile: ExportProfile; blog: Blog }) => {
  const outputDir = await createTestTempDir(`output-adapter-${profile}-`)

  try {
    const manifest = await new BlogExportWorkflow({
      blog,
      request: {
        blogKey: blog.key,
        sourceInput: "mock-blog",
        outputDir,
        profile,
        options: createOptions(),
      },
      onProgress: () => {},
    }).run()

    return { manifest, outputDir, cleanup: async () => rm(outputDir, { recursive: true }) }
  } catch (error) {
    await rm(outputDir, { recursive: true, force: true })
    throw error
  }
}

test("gfm output adapter exports a markdown bundle", async () => {
  const { manifest, outputDir, cleanup } = await runExport({
    profile: "gfm",
    blog: createMarkdownMockBlog(),
  })

  try {
    const post = manifest.posts[0]

    expect(manifest.profile).toBe("gfm")
    expect(manifest.successCount).toBe(1)
    expect(post.outputPath).toMatch(/index\.md$/)
    expect(post.outputPath).not.toContain("content/docs/")

    const markdown = await readFile(path.join(outputDir, post.outputPath ?? ""), "utf8")
    const manifestFile = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"))

    expect(markdown).toContain("Hello from markdown blog")
    expect(markdown).toContain("postId: mock-post-1")
    expect(manifestFile.profile).toBe("gfm")
  } finally {
    await cleanup()
  }
})

test("fumadocs output adapter exports an MDX content bundle", async () => {
  const mockBlog = createMarkdownMockBlog()
  const blog: Blog = {
    ...mockBlog,
    getOutputBlockTemplates: (profile) =>
      profile === "fumadocs"
        ? { "mock:paragraph": "<Steps>\n<Step>{{ text }}</Step>\n</Steps>" }
        : {},
  }
  const { manifest, outputDir, cleanup } = await runExport({ profile: "fumadocs", blog })

  try {
    const post = manifest.posts[0]

    expect(manifest.profile).toBe("fumadocs")
    expect(manifest.successCount).toBe(1)
    expect(post.outputPath).toMatch(/^content\/docs\/.+\/index\.mdx$/)

    const mdx = await readFile(path.join(outputDir, post.outputPath ?? ""), "utf8")
    const meta = JSON.parse(await readFile(path.join(outputDir, "content/docs/meta.json"), "utf8"))
    const manifestFile = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"))

    expect(mdx).toContain("import { Step, Steps } from 'fumadocs-ui/components/steps';")
    expect(mdx).toContain("<Steps>\n<Step>Hello from markdown blog</Step>\n</Steps>")
    expect(meta.pages).toEqual(["mock_category"])
    expect(manifestFile.profile).toBe("fumadocs")
  } finally {
    await cleanup()
  }
})

test("docusaurus output adapter exports an MDX docs bundle", async () => {
  const mockBlog = createMarkdownMockBlog()
  const blog: Blog = {
    ...mockBlog,
    getOutputBlockTemplates: (profile) =>
      profile === "docusaurus"
        ? { "mock:paragraph": "<TOCInline toc={toc} />\n\n:::note[원문 인용]\n{{ text }}\n:::" }
        : {},
  }
  const { manifest, outputDir, cleanup } = await runExport({ profile: "docusaurus", blog })

  try {
    const post = manifest.posts[0]

    expect(manifest.profile).toBe("docusaurus")
    expect(manifest.successCount).toBe(1)
    expect(post.outputPath).toMatch(/^docs\/.+\/index\.mdx$/)

    const mdx = await readFile(path.join(outputDir, post.outputPath ?? ""), "utf8")
    const category = JSON.parse(
      await readFile(path.join(outputDir, "docs/mock_category/_category_.json"), "utf8"),
    )
    const manifestFile = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"))

    expect(mdx).toContain("import TOCInline from '@theme/TOCInline';")
    expect(mdx).toContain(":::note[원문 인용]\nHello from markdown blog\n:::")
    expect(category).toEqual({ label: "Mock Category" })
    expect(manifestFile.profile).toBe("docusaurus")
  } finally {
    await cleanup()
  }
})

test("nextra output adapter exports an MDX content bundle", async () => {
  const mockBlog = createMarkdownMockBlog()
  const blog: Blog = {
    ...mockBlog,
    getOutputBlockTemplates: (profile) =>
      profile === "nextra" ? { "mock:paragraph": "<Callout>{{ text }}</Callout>" } : {},
  }
  const { manifest, outputDir, cleanup } = await runExport({ profile: "nextra", blog })

  try {
    const post = manifest.posts[0]

    expect(manifest.profile).toBe("nextra")
    expect(manifest.successCount).toBe(1)
    expect(post.outputPath).toMatch(/^content\/.+\/index\.mdx$/)

    const mdx = await readFile(path.join(outputDir, post.outputPath ?? ""), "utf8")
    const index = await readFile(path.join(outputDir, "content/index.mdx"), "utf8")
    const rootMeta = await readFile(path.join(outputDir, "content/_meta.js"), "utf8")
    const categoryMeta = await readFile(
      path.join(outputDir, "content/mock_category/_meta.js"),
      "utf8",
    )
    const manifestFile = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8"))

    expect(mdx).toContain("asIndexPage: true")
    expect(mdx).toContain("import { Callout } from 'nextra/components';")
    expect(mdx).toContain("<Callout>Hello from markdown blog</Callout>")
    expect(index).toContain("# mock-blog")
    expect(rootMeta).toContain('"index": "mock-blog"')
    expect(rootMeta).toContain('"mock_category": "Mock Category"')
    expect(categoryMeta).toContain('"2026-06-10-mock_markdown_post": "Mock markdown post"')
    expect(manifestFile.profile).toBe("nextra")
  } finally {
    await cleanup()
  }
})
