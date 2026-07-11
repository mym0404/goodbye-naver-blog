import { readdir } from "node:fs/promises"
import path from "node:path"

import { createNaverBlog } from "@exitpress/blog-naver/NaverBlog.js"
import { createTistoryBlog } from "@exitpress/blog-tistory/TistoryBlog.js"
import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { createBlogRegistry } from "@exitpress/engine/blog/BlogRegistry.js"
import { renderMarkdownPost } from "@exitpress/engine/markdown/util/renderMarkdownPost.js"
import { parse as parseYaml } from "yaml"

import type { BlogPostContentCache } from "@exitpress/engine/blog/Blog.js"

import { ensureHarnessDir, pathExists, readUtf8, repoPath, writeUtf8 } from "./e2e/paths.js"

const blogRegistry = createBlogRegistry([createNaverBlog(), createTistoryBlog()])

type SampleFixtureEntry = {
  id: string
  blogKey: string
  sourceId: string
  postId: string
  expectedError?: string
  post: {
    title: string
    publishedAt: string
    categoryId: number
    categoryName: string
    categoryPath: string[]
    thumbnailUrl: string | null
    source: string
  }
}

type ExpectedFrontmatter = {
  blogKey: string
  title: string
  source: string
  sourceId: string
  postId: string
  publishedAt: string
  category: string
  categoryPath: string[]
  thumbnail?: string | null
  error?: string
}

const getSampleFixtureDir = (sampleId: string) => repoPath("tests", "fixtures", "samples", sampleId)

const getSampleFixtureRoot = () => repoPath("tests", "fixtures", "samples")

const getSampleExpectedMarkdownPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "expected.md")

const getSampleExpectedErrorPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "expected-error.md")

const assertString = (value: unknown, key: string) => {
  if (typeof value !== "string") {
    throw new Error(`sample fixture frontmatter ${key} must be a string`)
  }

  return value
}

const parseExpectedFrontmatter = (markdown: string): ExpectedFrontmatter => {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(markdown)

  if (!frontmatterMatch) {
    throw new Error("sample fixture expected.md must start with YAML frontmatter")
  }

  const parsed = parseYaml(frontmatterMatch[1])

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("sample fixture frontmatter must be a YAML object")
  }

  const frontmatter = parsed as Record<string, unknown>

  const categoryPath = frontmatter.categoryPath

  if (
    !Array.isArray(categoryPath) ||
    !categoryPath.every((entry): entry is string => typeof entry === "string")
  ) {
    throw new Error("sample fixture frontmatter categoryPath must be a string array")
  }

  return {
    blogKey: assertString(frontmatter.blogKey, "blogKey"),
    title: assertString(frontmatter.title, "title"),
    source: assertString(frontmatter.source, "source"),
    sourceId: assertString(frontmatter.sourceId, "sourceId"),
    postId: String(frontmatter.postId),
    publishedAt: assertString(frontmatter.publishedAt, "publishedAt"),
    category: assertString(frontmatter.category, "category"),
    categoryPath,
    thumbnail: typeof frontmatter.thumbnail === "string" ? frontmatter.thumbnail : null,
    error: typeof frontmatter.error === "string" ? frontmatter.error : undefined,
  }
}

const createSamplePostHtmlCache = (cacheDir: string): BlogPostContentCache => {
  const getCachePath = ({
    blogKey,
    sourceId,
    postId,
  }: {
    blogKey: string
    sourceId: string
    postId: string
  }) =>
    path.join(
      cacheDir,
      `${encodeURIComponent(blogKey)}-${encodeURIComponent(sourceId)}-${encodeURIComponent(postId)}.html`,
    )

  return {
    getPostHtml: async (input) => {
      const cachePath = getCachePath(input)

      return (await pathExists(cachePath)) ? readUtf8(cachePath) : null
    },
    setPostHtml: async ({ html, ...input }) => {
      await writeUtf8({
        targetPath: getCachePath(input),
        content: html,
      })
    },
  }
}

const readSampleFixtureEntry = async (sampleId: string): Promise<SampleFixtureEntry> => {
  const expectedMarkdownPath = getSampleExpectedMarkdownPath(sampleId)
  const expectedErrorPath = getSampleExpectedErrorPath(sampleId)
  const hasExpectedError = await pathExists(expectedErrorPath)
  const expectedMarkdown = await readUtf8(
    hasExpectedError ? expectedErrorPath : expectedMarkdownPath,
  )
  const frontmatter = parseExpectedFrontmatter(expectedMarkdown)

  if (hasExpectedError && !frontmatter.error) {
    throw new Error(`sample fixture ${sampleId} expected-error.md must include error`)
  }

  return {
    id: sampleId,
    blogKey: frontmatter.blogKey,
    sourceId: frontmatter.sourceId,
    postId: frontmatter.postId,
    expectedError: frontmatter.error,
    post: {
      title: frontmatter.title,
      publishedAt: frontmatter.publishedAt,
      categoryId: 0,
      categoryName: frontmatter.category,
      categoryPath: frontmatter.categoryPath,
      thumbnailUrl: frontmatter.thumbnail ?? null,
      source: frontmatter.source,
    },
  }
}

export const listSampleFixtures = async () => {
  const entries = await readdir(getSampleFixtureRoot(), {
    withFileTypes: true,
  })
  const sampleIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const fixtureEntries = await Promise.all(
    sampleIds.map(async (sampleId) => {
      const hasExpectedMarkdown = await pathExists(getSampleExpectedMarkdownPath(sampleId))
      const hasExpectedError = await pathExists(getSampleExpectedErrorPath(sampleId))

      if (!hasExpectedMarkdown && !hasExpectedError) {
        throw new Error(`sample fixture ${sampleId} must include expected output`)
      }

      if (hasExpectedMarkdown && hasExpectedError) {
        throw new Error(
          `sample fixture ${sampleId} must not include both expected.md and expected-error.md`,
        )
      }

      return readSampleFixtureEntry(sampleId)
    }),
  )

  return fixtureEntries
}

const normalizeMarkdownFixture = (markdown: string) =>
  `${markdown
    .replace(/\r\n/g, "\n")
    .replace(/([?&]type=)w\d+/g, "$1w")
    .replace(
      /https:\/\/[^\s)]+\.kakaocdn\.net\/[^\s)?]+(?:\?[^\s)]*)?/g,
      (url) => `${url.split("?")[0]}?credential=normalized`,
    )
    .replace(/\n+$/g, "")}\n`

const resolveSampleFixtureLinkUrl = (url: string) => {
  const volatileDownloadUrl =
    /^https:\/\/download\.blog\.naver\.com\/open\/.+\/([^/?#]+)([?#].*)?$/.exec(url)

  return volatileDownloadUrl
    ? `https://download.blog.naver.com/open/${volatileDownloadUrl[1]}`
    : url
}

export const renderSampleFixture = async ({
  sample,
  html,
}: {
  sample: SampleFixtureEntry
  html: string
}) => {
  const options = defaultExportOptions()
  options.assets.imageHandlingMode = "remote"
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false
  options.frontmatter.fields.exportedAt = false

  const markdownFilePath = path.join(await ensureHarnessDir("samples"), `${sample.id}.md`)
  const blog = blogRegistry.require(sample.blogKey)
  const source = blog.parseSource(sample.post.source)
  const post = {
    blogKey: sample.blogKey,
    sourceId: sample.sourceId,
    postId: sample.postId,
    title: sample.post.title,
    sourceUrl: sample.post.source,
    publishedAt: sample.post.publishedAt,
    categoryId: sample.post.categoryId,
    categoryName: sample.post.categoryName,
    thumbnailUrl: sample.post.thumbnailUrl ?? undefined,
  }
  const parsedPost = blog.parseContent({
    source,
    post,
    content: { kind: "html", html, sourceUrl: sample.post.source, tags: [] },
    options: { ...options, resolveLinkUrl: resolveSampleFixtureLinkUrl },
  })
  const rendered = await renderMarkdownPost({
    post: {
      blogKey: sample.blogKey,
      sourceId: sample.sourceId,
      postId: sample.postId,
      title: sample.post.title,
      publishedAt: sample.post.publishedAt,
      categoryId: sample.post.categoryId,
      categoryName: sample.post.categoryName,
      source: sample.post.source,
      thumbnailUrl: sample.post.thumbnailUrl,
    },
    category: {
      id: sample.post.categoryId,
      name: sample.post.categoryName,
      parentId: null,
      postCount: 0,
      isDivider: false,
      isOpen: true,
      path: sample.post.categoryPath,
      depth: Math.max(sample.post.categoryPath.length - 1, 0),
    },
    parsedPost,
    defaultBlockTemplates: Object.fromEntries(
      blog
        .getBlockTemplateDefinitions()
        .map((definition) => [definition.key, definition.presets[0].template]),
    ),
    markdownFilePath,
    options,
    resolveAsset: async ({ kind, sourceUrl }) => ({
      kind,
      sourceUrl,
      reference: sourceUrl,
      relativePath: null,
      storageMode: "remote",
      uploadCandidate: null,
    }),
  })
  return {
    parsedPost,
    rendered,
    normalizedMarkdown: normalizeMarkdownFixture(rendered.markdown),
  }
}

export const loadSampleFixture = async (sample: SampleFixtureEntry) => ({
  html: await (async () => {
    const blog = blogRegistry.require(sample.blogKey)
    const source = blog.parseSource(sample.post.source)
    const content = await blog.loadPostContent({
      source,
      post: {
        blogKey: sample.blogKey,
        sourceId: sample.sourceId,
        postId: sample.postId,
        title: sample.post.title,
        sourceUrl: sample.post.source,
        publishedAt: sample.post.publishedAt,
        categoryId: sample.post.categoryId,
        categoryName: sample.post.categoryName,
        thumbnailUrl: sample.post.thumbnailUrl ?? undefined,
      },
      cache:
        process.env.CI === "true"
          ? undefined
          : createSamplePostHtmlCache(await ensureHarnessDir("sample-post-html-cache")),
    })

    if (content.kind !== "html") {
      throw new Error(`sample fixture requires HTML content: ${sample.id}`)
    }

    return content.html
  })(),
  expectedMarkdown: sample.expectedError
    ? undefined
    : normalizeMarkdownFixture(await readUtf8(getSampleExpectedMarkdownPath(sample.id))),
  expectedError: sample.expectedError,
})
