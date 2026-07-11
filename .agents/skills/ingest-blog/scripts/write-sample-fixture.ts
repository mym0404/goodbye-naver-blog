#!/usr/bin/env bun

import { access, writeFile } from "node:fs/promises"
import path from "node:path"

import { ensureDir, resolveRepoPath } from "@exitpress/engine/infra/node/FilePaths.js"

import type { AssetRecord } from "../../../../packages/domain/src/export-job/schema/UploadState.js"

import { createNaverBlog } from "../../../../packages/blog-naver/src/NaverBlog.js"
import { createTistoryBlog } from "../../../../packages/blog-tistory/src/TistoryBlog.js"
import { defaultExportOptions } from "../../../../packages/domain/src/export-options/ExportOptions.js"
import { createBlogRegistry } from "../../../../packages/engine/src/blog/BlogRegistry.js"
import {
  mapBlogCategory,
  mapBlogPost,
} from "../../../../packages/engine/src/exporting/blog/BlogPostExportUnit.js"
import { getCategoryForPost } from "../../../../packages/engine/src/exporting/paths/ExportPaths.js"
import { renderMarkdownPost } from "../../../../packages/engine/src/markdown/util/renderMarkdownPost.js"
import { toErrorMessage } from "../../../../packages/engine/src/shared/error/util/toErrorMessage.js"
import { createPostHtmlCache } from "../../../../packages/server/src/state/PostHtmlCache.js"

type FixtureArgs = {
  blogKey: string
  sourceInput: string
  postId: string
  id: string
  force: boolean
}

const usage = () => `Usage:
  bun .agents/skills/ingest-blog/scripts/write-sample-fixture.ts --blogKey <blogKey> --sourceInput <sourceInput> --postId <postId> --id <fixtureId> [--force]

Creates tests/fixtures/samples/<id>/expected.md with remote asset references and no image downloads.`

const readValue = (args: string[], index: number) => {
  const value = args[index + 1]

  if (!value || value.startsWith("--")) {
    throw new Error(usage())
  }

  return value
}

const parseArgs = (args: string[]): FixtureArgs | "help" => {
  let blogKey: string | undefined
  let sourceInput: string | undefined
  let postId: string | undefined
  let id: string | undefined
  let force = false

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg === "--help" || arg === "-h") {
      return "help"
    }

    if (arg === "--blogKey") {
      blogKey = readValue(args, index)
      index++
      continue
    }

    if (arg === "--sourceInput") {
      sourceInput = readValue(args, index)
      index++
      continue
    }

    if (arg === "--postId") {
      postId = readValue(args, index)
      index++
      continue
    }

    if (arg === "--id") {
      id = readValue(args, index)
      index++
      continue
    }

    if (arg === "--force") {
      force = true
      continue
    }

    throw new Error(usage())
  }

  if (!blogKey || !sourceInput || !postId || !id) {
    throw new Error(usage())
  }

  return {
    blogKey,
    sourceInput,
    postId,
    id,
    force,
  }
}

const createFixtureOptions = () => {
  const options = defaultExportOptions()

  options.assets.imageHandlingMode = "remote"
  options.assets.compressionEnabled = false
  options.assets.downloadImages = false
  options.assets.downloadThumbnails = false
  options.frontmatter.fields.exportedAt = false

  return options
}

const resolveSampleFixtureLinkUrl = (url: string) => {
  const volatileDownloadUrl =
    /^https:\/\/download\.blog\.naver\.com\/open\/.+\/([^/?#]+)([?#].*)?$/.exec(url)

  return volatileDownloadUrl
    ? `https://download.blog.naver.com/open/${volatileDownloadUrl[1]}`
    : url
}

const normalizeFixtureMarkdown = (markdown: string) =>
  markdown.replace(
    /https:\/\/[^\s)]+\.kakaocdn\.net\/[^\s)?]+(?:\?[^\s)]*)?/g,
    (url) => `${url.split("?")[0]}?credential=normalized`,
  )

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const assertFixtureId = (id: string) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error("fixture id must use lowercase letters, digits, and hyphens")
  }
}

const run = async () => {
  const args = parseArgs(process.argv.slice(2))

  if (args === "help") {
    console.log(usage())
    return
  }

  assertFixtureId(args.id)

  const blog = createBlogRegistry([createNaverBlog(), createTistoryBlog()]).require(args.blogKey)
  const source = blog.parseSource(args.sourceInput)
  const cache = createPostHtmlCache({
    cacheDir: resolveRepoPath(path.join("tmp", "harness", "ingest-blog", "fixture-html-cache")),
  })
  const scan = await blog.scan(source, { cache })
  const post = scan.posts.find((entry) => entry.postId === args.postId)

  if (!post) {
    throw new Error(`public post metadata not found: ${source.sourceId}/${args.postId}`)
  }

  const categoryMap = new Map(
    scan.categories.map((category) => [category.id, mapBlogCategory(category)]),
  )
  const category = getCategoryForPost({
    categories: categoryMap,
    categoryId: post.categoryId,
    categoryName: post.categoryName,
  })
  const options = createFixtureOptions()
  const fixtureDir = resolveRepoPath(path.join("tests", "fixtures", "samples", args.id))
  const expectedMarkdownPath = path.join(fixtureDir, "expected.md")
  const expectedErrorPath = path.join(fixtureDir, "expected-error.md")

  if (
    !args.force &&
    ((await pathExists(expectedMarkdownPath)) || (await pathExists(expectedErrorPath)))
  ) {
    throw new Error(
      `fixture already exists: ${fixtureDir}. Re-run with --force to overwrite expected.md.`,
    )
  }

  const content = await blog.loadPostContent({ source, post, cache })
  const parsedPost = blog.parseContent({
    source,
    post,
    content,
    options: { ...options, resolveLinkUrl: resolveSampleFixtureLinkUrl },
  })
  const mappedPost = mapBlogPost(post)
  const rendered = await renderMarkdownPost({
    post: args.blogKey === "tistory" ? { ...mappedPost, thumbnailUrl: null } : mappedPost,
    category,
    parsedPost,
    defaultBlockTemplates: Object.fromEntries(
      blog
        .getBlockTemplateDefinitions()
        .map((definition) => [definition.key, definition.presets[0].template]),
    ),
    markdownFilePath: expectedMarkdownPath,
    options,
    resolveAsset: async ({ kind, sourceUrl }) =>
      ({
        kind,
        sourceUrl,
        reference: sourceUrl,
        relativePath: null,
        storageMode: "remote",
        uploadCandidate: null,
      }) satisfies AssetRecord,
  })

  await ensureDir(fixtureDir)
  const markdown = normalizeFixtureMarkdown(rendered.markdown)
  await writeFile(
    expectedMarkdownPath,
    markdown.endsWith("\n") ? markdown : `${markdown}\n`,
    "utf8",
  )

  console.log(
    [
      `fixtureId: ${args.id}`,
      `expectedMarkdownPath: ${expectedMarkdownPath}`,
      `blogKey: ${args.blogKey}`,
      `sourceId: ${source.sourceId}`,
      `postId: ${post.postId}`,
      `blockIds: ${parsedPost.blocks.map((block) => block.blockId).join(", ") || "(none)"}`,
      `assetRecordCount: ${rendered.assetRecords.length}`,
      `downloadedAssetFileCount: 0`,
    ].join("\n"),
  )
}

try {
  await run()
} catch (error) {
  console.error(toErrorMessage(error))
  process.exitCode = 1
}
