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
