import path from "node:path"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"

import { NaverBlogFetcher } from "../../src/modules/blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../../src/modules/converter/markdown-renderer.js"
import { parsePostHtml } from "../../src/modules/parser/post-parser.js"
import { reviewParsedPost } from "../../src/modules/reviewer/post-reviewer.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"
import { sampleCorpus } from "../../src/shared/sample-corpus.js"
import type { CategoryInfo, PostSummary } from "../../src/shared/types.js"
import { repoPath } from "./lib/paths.js"

type ExportFixture = {
  requiredSnippets: string[]
  forbiddenSnippets?: string[]
  minImageMarkdownCount?: number
}

const resolveCategory = ({
  categories,
  post,
}: {
  categories: CategoryInfo[]
  post: PostSummary
}) => {
  const matched = categories.find((category) => category.id === post.categoryId)

  if (matched) {
    return matched
  }

  return {
    id: post.categoryId,
    name: post.categoryName,
    parentId: null,
    postCount: 0,
    isDivider: false,
    isOpen: true,
    path: [post.categoryName],
    depth: 0,
  } satisfies CategoryInfo
}

const loadFixture = async (sampleId: string) => {
  const fixturePath = repoPath("tests", "fixtures", "exports", `${sampleId}.json`)
  const raw = await readFile(fixturePath, "utf8")

  return JSON.parse(raw) as ExportFixture
}

const run = async () => {
  const baseOutputDir = repoPath("tmp", "harness", "samples")
  await rm(baseOutputDir, {
    recursive: true,
    force: true,
  })
  await mkdir(baseOutputDir, {
    recursive: true,
  })

  const options = defaultExportOptions()
  options.assets.assetPathMode = "remote"
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false

  const grouped = sampleCorpus.reduce<Record<string, typeof sampleCorpus>>((state, sample) => {
    state[sample.blogId] ??= []
    state[sample.blogId].push(sample)
    return state
  }, {})
  const failures: string[] = []

  for (const [blogId, samples] of Object.entries(grouped)) {
    const fetcher = new NaverBlogFetcher({
      blogId,
    })
    const [scan, posts] = await Promise.all([
      fetcher.scanBlog(),
      fetcher.getAllPosts(),
    ])
    const postMap = new Map(posts.map((post) => [post.logNo, post]))

    for (const sample of samples) {
      const post = postMap.get(sample.logNo)

      if (!post) {
        failures.push(`${sample.id}: post metadata not found`)
        continue
      }

      const html = await fetcher.fetchPostHtml(sample.logNo)
      const parsed = parsePostHtml({
        html,
        sourceUrl: post.source,
        options: {
          markdown: options.markdown,
        },
      })
      const reviewed = reviewParsedPost(parsed)
      const markdownFilePath = path.join(baseOutputDir, `${sample.id}.md`)
      const rendered = await renderMarkdownPost({
        post,
        category: resolveCategory({
          categories: scan.categories,
          post,
        }),
        parsedPost: parsed,
        markdownFilePath,
        reviewedWarnings: reviewed.warnings,
        options,
        resolveAsset: async ({
          kind,
          sourceUrl,
        }) => ({
          kind,
          sourceUrl,
          relativePath: sourceUrl,
        }),
      })
      const fixture = await loadFixture(sample.id)
      const blockTypes = new Set(parsed.blocks.map((block) => block.type))

      for (const expectedBlockType of sample.expectedBlockTypes) {
        if (!blockTypes.has(expectedBlockType)) {
          failures.push(`${sample.id}: missing expected block type ${expectedBlockType}`)
        }
      }

      for (const snippet of fixture.requiredSnippets) {
        if (!rendered.markdown.includes(snippet)) {
          failures.push(`${sample.id}: missing required snippet ${snippet}`)
        }
      }

      for (const snippet of fixture.forbiddenSnippets ?? []) {
        if (rendered.markdown.includes(snippet)) {
          failures.push(`${sample.id}: contains forbidden snippet ${snippet}`)
        }
      }

      const imageMarkdownCount = rendered.markdown.match(/!\[[^\]]*]\([^)]+\)/g)?.length ?? 0

      if ((fixture.minImageMarkdownCount ?? 0) > imageMarkdownCount) {
        failures.push(
          `${sample.id}: expected at least ${fixture.minImageMarkdownCount} markdown images, got ${imageMarkdownCount}`,
        )
      }

      if (!markdownFilePath.endsWith(".md")) {
        failures.push(`${sample.id}: output path must end with .md`)
      }

      if (new Set(rendered.assetRecords.map((record) => record.relativePath)).size !== rendered.assetRecords.length) {
        failures.push(`${sample.id}: asset records must not contain duplicate paths`)
      }

      await writeFile(markdownFilePath, rendered.markdown)
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }

  console.log(`samples:verify passed (${sampleCorpus.length} samples)`)
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
