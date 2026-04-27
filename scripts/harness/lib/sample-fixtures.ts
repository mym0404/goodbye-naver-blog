import path from "node:path"
import { readdir } from "node:fs/promises"
import { parse as parseYaml } from "yaml"

import { renderMarkdownPost } from "../../../src/modules/converter/MarkdownRenderer.js"
import { parsePostHtml } from "../../../src/modules/parser/PostParser.js"
import { reviewParsedPost } from "../../../src/modules/reviewer/PostReviewer.js"
import { defaultExportOptions } from "../../../src/shared/ExportOptions.js"
import type {
  CategoryInfo,
  ExportOptions,
  PostSummary,
} from "../../../src/shared/Types.js"
import { ensureHarnessDir, pathExists, readUtf8, repoPath } from "./paths.js"

type SampleFixtureEntry = {
  id: string
  blogId: string
  logNo: string
  editorVersion: number
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
  title: string
  source: string
  blogId: string
  logNo: string
  publishedAt: string
  category: string
  categoryPath: string[]
  editorVersion: number
  thumbnail?: string | null
}

export const getSampleFixtureDir = (sampleId: string) =>
  repoPath("tests", "fixtures", "samples", sampleId)

export const getSampleFixtureRoot = () => repoPath("tests", "fixtures", "samples")

export const getSampleSourceHtmlPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "source.html")

export const getSampleExpectedMarkdownPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "expected.md")

const assertString = (value: unknown, key: string) => {
  if (typeof value !== "string") {
    throw new Error(`sample fixture frontmatter ${key} must be a string`)
  }

  return value
}

const assertStringArray = (value: unknown, key: string) => {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`sample fixture frontmatter ${key} must be a string array`)
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
  const editorVersion = Number(frontmatter.editorVersion)

  if (!Number.isFinite(editorVersion)) {
    throw new Error("sample fixture frontmatter editorVersion must be a number")
  }

  return {
    title: assertString(frontmatter.title, "title"),
    source: assertString(frontmatter.source, "source"),
    blogId: assertString(frontmatter.blogId, "blogId"),
    logNo: String(frontmatter.logNo),
    publishedAt: assertString(frontmatter.publishedAt, "publishedAt"),
    category: assertString(frontmatter.category, "category"),
    categoryPath: assertStringArray(frontmatter.categoryPath, "categoryPath"),
    editorVersion,
    thumbnail:
      typeof frontmatter.thumbnail === "string"
        ? frontmatter.thumbnail
        : null,
  }
}

export const readSampleFixtureEntry = async (sampleId: string): Promise<SampleFixtureEntry> => {
  const expectedMarkdown = await readUtf8(getSampleExpectedMarkdownPath(sampleId))
  const frontmatter = parseExpectedFrontmatter(expectedMarkdown)

  return {
    id: sampleId,
    blogId: frontmatter.blogId,
    logNo: frontmatter.logNo,
    editorVersion: frontmatter.editorVersion,
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
      const hasSource = await pathExists(getSampleSourceHtmlPath(sampleId))
      const hasExpected = await pathExists(getSampleExpectedMarkdownPath(sampleId))

      if (!hasSource || !hasExpected) {
        throw new Error(`sample fixture ${sampleId} must include source.html and expected.md`)
      }

      return readSampleFixtureEntry(sampleId)
    }),
  )

  return fixtureEntries
}

export const createSampleVerificationOptions = (): ExportOptions => {
  const options = defaultExportOptions()

  options.assets.imageHandlingMode = "remote"
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false
  options.frontmatter.fields.exportedAt = false

  return options
}

export const buildSamplePostSummary = (sample: SampleFixtureEntry): PostSummary => ({
  blogId: sample.blogId,
  logNo: sample.logNo,
  title: sample.post.title,
  publishedAt: sample.post.publishedAt,
  categoryId: sample.post.categoryId,
  categoryName: sample.post.categoryName,
  source: sample.post.source,
  editorVersion: sample.editorVersion,
  thumbnailUrl: sample.post.thumbnailUrl,
})

export const buildSampleCategory = (sample: SampleFixtureEntry): CategoryInfo => ({
  id: sample.post.categoryId,
  name: sample.post.categoryName,
  parentId: null,
  postCount: 0,
  isDivider: false,
  isOpen: true,
  path: sample.post.categoryPath,
  depth: Math.max(sample.post.categoryPath.length - 1, 0),
})

export const normalizeMarkdownFixture = (markdown: string) =>
  `${markdown.replace(/\r\n/g, "\n").replace(/\n+$/g, "")}\n`

export const renderSampleFixture = async ({
  sample,
  html,
}: {
  sample: SampleFixtureEntry
  html: string
}) => {
  const options = createSampleVerificationOptions()
  const markdownFilePath = path.join(await ensureHarnessDir("samples"), `${sample.id}.md`)
  const parsedPostBeforeNormalization = parsePostHtml({
    html,
    sourceUrl: sample.post.source,
    options,
  })
  const parsedPost = parsedPostBeforeNormalization
  const review = reviewParsedPost(parsedPost)
  const rendered = await renderMarkdownPost({
    post: buildSamplePostSummary(sample),
    category: buildSampleCategory(sample),
    parsedPost,
    markdownFilePath,
    reviewedWarnings: review.warnings,
    options,
    resolveAsset: async ({
      kind,
      sourceUrl,
    }) => ({
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
    reviewWarnings: review.warnings,
    rendered,
    normalizedMarkdown: normalizeMarkdownFixture(rendered.markdown),
  }
}

export const loadSampleFixture = async (sample: SampleFixtureEntry) => ({
  html: await readUtf8(getSampleSourceHtmlPath(sample.id)),
  expectedMarkdown: normalizeMarkdownFixture(
    await readUtf8(getSampleExpectedMarkdownPath(sample.id)),
  ),
})
