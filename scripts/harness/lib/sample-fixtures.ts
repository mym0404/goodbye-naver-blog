import path from "node:path"

import { renderMarkdownPost } from "../../../src/modules/converter/markdown-renderer.js"
import { parsePostHtml } from "../../../src/modules/parser/post-parser.js"
import { reviewParsedPost } from "../../../src/modules/reviewer/post-reviewer.js"
import { defaultExportOptions } from "../../../src/shared/export-options.js"
import { getParserCapabilityLookupIds } from "../../../src/shared/parser-capabilities.js"
import type {
  CategoryInfo,
  ExportOptions,
  PostSummary,
  SampleCorpusEntry,
} from "../../../src/shared/types.js"
import { unique } from "../../../src/shared/utils.js"
import { ensureHarnessDir, readUtf8, repoPath, writeUtf8 } from "./paths.js"

export const getSampleFixtureDir = (sampleId: string) =>
  repoPath("tests", "fixtures", "samples", sampleId)

export const getSampleSourceHtmlPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "source.html")

export const getSampleExpectedMarkdownPath = (sampleId: string) =>
  path.join(getSampleFixtureDir(sampleId), "expected.md")

export const createSampleVerificationOptions = (): ExportOptions => {
  const options = defaultExportOptions()

  options.assets.imageHandlingMode = "remote"
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false
  options.frontmatter.fields.exportedAt = false

  return options
}

export const buildSamplePostSummary = (sample: SampleCorpusEntry): PostSummary => ({
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

export const buildSampleCategory = (sample: SampleCorpusEntry): CategoryInfo => ({
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
  sample: SampleCorpusEntry
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
  const observedCapabilityLookupIds = unique([
    ...getParserCapabilityLookupIds({
      editorVersion: parsedPostBeforeNormalization.editorVersion,
      blocks: parsedPostBeforeNormalization.blocks,
      warnings: parsedPostBeforeNormalization.warnings,
    }),
    ...getParserCapabilityLookupIds({
      editorVersion: parsedPost.editorVersion,
      blocks: parsedPost.blocks,
      warnings: parsedPost.warnings,
    }),
  ])

  return {
    parsedPost,
    reviewWarnings: review.warnings,
    rendered,
    observedCapabilityLookupIds,
    normalizedMarkdown: normalizeMarkdownFixture(rendered.markdown),
  }
}

export const loadSampleFixture = async (sample: SampleCorpusEntry) => ({
  html: await readUtf8(getSampleSourceHtmlPath(sample.id)),
  expectedMarkdown: normalizeMarkdownFixture(
    await readUtf8(getSampleExpectedMarkdownPath(sample.id)),
  ),
})

export const writeSampleFixture = async ({
  sample,
  html,
  markdown,
}: {
  sample: SampleCorpusEntry
  html: string
  markdown: string
}) => {
  await writeUtf8({
    targetPath: getSampleSourceHtmlPath(sample.id),
    content: html,
  })
  await writeUtf8({
    targetPath: getSampleExpectedMarkdownPath(sample.id),
    content: normalizeMarkdownFixture(markdown),
  })
}
