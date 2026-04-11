# Single-Post Audit Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable `blogId + logNo` verification workflow and canonical audit tracker so one public Naver post can be converted to Markdown, diagnosed, and recorded immediately during the 300-post audit.

**Architecture:** Reuse the existing fetch -> parse -> review -> render pipeline inside a dedicated single-post export module, then wrap it with a lightweight CLI that writes Markdown plus a JSON diagnostics report. Keep the manual browser audit loop separate from the code path by pairing the CLI with one canonical progress document and one runbook that define exactly how to inspect a post, compare the rendered Markdown, and record mismatches or conversion failures.

**Tech Stack:** TypeScript, Node.js, `tsx`, Vitest, existing `NaverBlogFetcher`, parser/reviewer/renderer modules, docs in `docs/`, browser-use for manual verification

---

**Repo constraints**
- Do not add worktree steps. This repo requires explicit user approval before using worktrees.
- Do not add commit steps. This repo forbids commits unless the user explicitly asks for them.
- Prefer focused `pnpm exec vitest run ... --silent` commands and only escalate verbosity when a failure needs inspection.

**Plan boundary**
- This plan covers the enabling workflow only: single-post export, diagnostics, tracker template, and docs.
- The actual 300-post execution should be split into follow-up batch plans after this workflow is implemented and verified.

## File Structure

### Create
- `src/modules/exporter/export-paths.ts`
  - Shared helpers for resolving a post category and building the Markdown output path.
- `src/modules/exporter/single-post-export.ts`
  - Reusable single-post fetch -> parse -> review -> render pipeline that returns Markdown plus diagnostics.
- `scripts/lib/single-post-cli.ts`
  - CLI argument parsing, usage text, and terminal summary rendering.
- `scripts/export-single-post.ts`
  - `tsx` entrypoint for direct `blogId + logNo` verification.
- `tests/export-single-post.test.ts`
  - Unit tests for the single-post export module with stubbed fetcher responses.
- `tests/single-post-cli.test.ts`
  - Unit tests for CLI argument parsing and summary formatting.
- `tests/naver.single-post-export.integration.test.ts`
  - Real-network integration test against one known public sample.
- `docs/runbooks/single-post-verification.md`
  - Runbook for browser inspection + single-post conversion + progress recording.
- `docs/naver-blog-300-audit-progress.md`
  - Canonical single-file progress tracker template for the 300-post audit.

### Modify
- `src/modules/exporter/naver-blog-exporter.ts`
  - Replace in-file path/category helpers with imports from `export-paths.ts`.
- `src/modules/exporter/asset-store.ts`
  - Accept a narrower downloader dependency so the single-post exporter can be unit-tested without a concrete `NaverBlogFetcher` instance.
- `docs/index.md`
  - Link the new runbook and the audit tracker.
- `.agents/knowledge/product/product-outline.md`
  - Document that the single-post CLI uses the same Markdown/export options as the exporter.
- `.agents/knowledge/engineering/validation.md`
  - Add the manual single-post verification command and where its outputs live.
- `docs/runbooks/browser-verification.md`
  - Point the manual browser loop at the new single-post CLI instead of only the UI export flow.

## Task 1: Extract Shared Export Helpers and Add the Single-Post Export Module

**Files:**
- Create: `src/modules/exporter/export-paths.ts`
- Create: `src/modules/exporter/single-post-export.ts`
- Modify: `src/modules/exporter/naver-blog-exporter.ts`
- Modify: `src/modules/exporter/asset-store.ts`
- Test: `tests/export-single-post.test.ts`

- [ ] **Step 1: Write the failing unit test for single-post export**

```ts
import path from "node:path"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import { exportSinglePost } from "../src/modules/exporter/single-post-export.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type { CategoryInfo, PostSummary } from "../src/shared/types.js"

const category: CategoryInfo = {
  id: 84,
  name: "PS 알고리즘, 팁",
  parentId: null,
  postCount: 1,
  isDivider: false,
  isOpen: true,
  path: ["PS 알고리즘, 팁"],
  depth: 0,
}

const post: PostSummary = {
  blogId: "mym0404",
  logNo: "223034929697",
  title: "테스트 글",
  publishedAt: "2023-03-04T13:00:00+09:00",
  categoryId: 84,
  categoryName: "PS 알고리즘, 팁",
  source: "https://blog.naver.com/mym0404/223034929697",
  editorVersion: 4,
  thumbnailUrl: null,
}

const se4Html = `
  <script>var data = { smartEditorVersion: 4 }</script>
  <div id="viewTypeSelector">
    <div class="se-component se-text">
      <script class="__se_module_data" data-module-v2='{"type":"v2_text"}'></script>
      <p class="se-text-paragraph">본문입니다.</p>
    </div>
  </div>
`

describe("exportSinglePost", () => {
  it("renders one public post and returns diagnostics", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-export-"))
    const options = defaultExportOptions()

    options.assets.assetPathMode = "remote"
    options.assets.downloadImages = false
    options.assets.downloadThumbnails = false

    const result = await exportSinglePost({
      blogId: "mym0404",
      logNo: "223034929697",
      outputDir,
      options,
      createFetcher: () => ({
        scanBlog: async () => ({
          blogId: "mym0404",
          totalPostCount: 1,
          categories: [category],
        }),
        getAllPosts: async () => [post],
        fetchPostHtml: async () => se4Html,
        downloadBinary: async () => undefined,
      }),
    })

    expect(result.editorVersion).toBe(4)
    expect(result.blockTypes).toEqual(["paragraph"])
    expect(result.parserWarnings).toEqual([])
    expect(result.reviewerWarnings).toEqual([])
    expect(result.renderWarnings).toEqual([])
    expect(result.markdown).toContain("본문입니다.")
    expect(result.markdownFilePath).toMatch(/223034929697.*\\.md$/)
    expect(await readFile(result.markdownFilePath!, "utf8")).toContain("본문입니다.")
  })

  it("fails with a clear message when the post metadata does not exist", async () => {
    const options = defaultExportOptions()

    await expect(
      exportSinglePost({
        blogId: "mym0404",
        logNo: "999999999999",
        outputDir: path.join(tmpdir(), "single-post-missing"),
        options,
        createFetcher: () => ({
          scanBlog: async () => ({
            blogId: "mym0404",
            totalPostCount: 0,
            categories: [],
          }),
          getAllPosts: async () => [],
          fetchPostHtml: async () => "",
          downloadBinary: async () => undefined,
        }),
      }),
    ).rejects.toThrow("공개 글 메타데이터를 찾을 수 없습니다: mym0404/999999999999")
  })
})
```

- [ ] **Step 2: Run the targeted test and confirm the missing-module failure**

Run:

```bash
pnpm exec vitest run tests/export-single-post.test.ts --silent
```

Expected:

```text
FAIL  tests/export-single-post.test.ts
Error: Failed to load url ../src/modules/exporter/single-post-export.js
```

- [ ] **Step 3: Implement the shared path helpers and the reusable single-post exporter**

`src/modules/exporter/export-paths.ts`

```ts
import path from "node:path"

import type { CategoryInfo, ExportOptions, PostSummary } from "../../shared/types.js"
import {
  getDateSlug,
  sanitizeCategoryName,
  sanitizePathSegment,
  slugifyTitle,
} from "../../shared/utils.js"

export const getCategoryForPost = ({
  categories,
  categoryId,
  categoryName,
}: {
  categories: Map<number, CategoryInfo>
  categoryId: number
  categoryName: string
}) => {
  const matchedCategory = categories.get(categoryId)

  if (matchedCategory) {
    return matchedCategory
  }

  return {
    id: categoryId,
    name: sanitizeCategoryName(categoryName) || "Uncategorized",
    parentId: null,
    postCount: 0,
    isDivider: false,
    isOpen: true,
    path: [sanitizeCategoryName(categoryName) || "Uncategorized"],
    depth: 0,
  } satisfies CategoryInfo
}

export const buildMarkdownFilePath = ({
  outputDir,
  post,
  category,
  options,
}: {
  outputDir: string
  post: PostSummary
  category: CategoryInfo
  options: ExportOptions
}) => {
  const segments = [outputDir, options.structure.postDirectoryName]

  if (options.structure.folderStrategy === "category-path") {
    const categorySegments = (category.path.length > 0 ? category.path : [category.name]).map(
      sanitizePathSegment,
    )

    segments.push(...categorySegments)
  }

  const nameParts: string[] = []

  if (options.structure.includeDateInFilename) {
    nameParts.push(getDateSlug(post.publishedAt))
  }

  if (options.structure.includeLogNoInFilename) {
    nameParts.push(post.logNo)
  }

  nameParts.push(
    options.structure.slugStyle === "kebab"
      ? slugifyTitle(post.title)
      : sanitizePathSegment(post.title),
  )

  return path.join(...segments, `${nameParts.filter(Boolean).join("-") || post.logNo}.md`)
}
```

`src/modules/exporter/single-post-export.ts`

```ts
import { writeFile } from "node:fs/promises"
import path from "node:path"

import type { BlockType, ExportOptions, PostSummary } from "../../shared/types.js"
import { ensureDir, unique } from "../../shared/utils.js"
import { NaverBlogFetcher } from "../blog-fetcher/naver-blog-fetcher.js"
import { renderMarkdownPost } from "../converter/markdown-renderer.js"
import { parsePostHtml } from "../parser/post-parser.js"
import { reviewParsedPost } from "../reviewer/post-reviewer.js"
import { AssetStore } from "./asset-store.js"
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"

type SinglePostFetcher = Pick<
  NaverBlogFetcher,
  "scanBlog" | "getAllPosts" | "fetchPostHtml" | "downloadBinary"
>

export const exportSinglePost = async ({
  blogId,
  logNo,
  outputDir,
  options,
  createFetcher = ({ blogId: nextBlogId }: { blogId: string }) => new NaverBlogFetcher({ blogId: nextBlogId }),
}: {
  blogId: string
  logNo: string
  outputDir: string
  options: ExportOptions
  createFetcher?: (input: { blogId: string }) => SinglePostFetcher
}) => {
  const fetcher = createFetcher({ blogId })
  const [scan, posts] = await Promise.all([fetcher.scanBlog(), fetcher.getAllPosts()])
  const post = posts.find((item) => item.logNo === logNo)

  if (!post) {
    throw new Error(`공개 글 메타데이터를 찾을 수 없습니다: ${blogId}/${logNo}`)
  }

  const categoryMap = new Map(scan.categories.map((category) => [category.id, category]))
  const category = getCategoryForPost({
    categories: categoryMap,
    categoryId: post.categoryId,
    categoryName: post.categoryName,
  })
  const resolvedOutputDir = path.resolve(outputDir)
  const markdownFilePath = buildMarkdownFilePath({
    outputDir: resolvedOutputDir,
    post,
    category,
    options,
  })
  const html = await fetcher.fetchPostHtml(logNo)
  const parsedPost = parsePostHtml({
    html,
    sourceUrl: post.source,
    options: {
      markdown: options.markdown,
    },
  })
  const reviewed = reviewParsedPost(parsedPost)
  const assetStore = new AssetStore({
    outputDir: resolvedOutputDir,
    fetcher,
    options,
  })
  const rendered = await renderMarkdownPost({
    post,
    category,
    parsedPost,
    markdownFilePath,
    reviewedWarnings: reviewed.warnings,
    options,
    resolveAsset: (input) => assetStore.saveAsset(input),
  })

  await ensureDir(path.dirname(markdownFilePath))
  await writeFile(markdownFilePath, rendered.markdown, "utf8")

  return {
    post,
    markdown: rendered.markdown,
    markdownFilePath,
    editorVersion: parsedPost.editorVersion,
    blockTypes: unique(parsedPost.blocks.map((block) => block.type as BlockType)),
    parserWarnings: parsedPost.warnings,
    reviewerWarnings: reviewed.warnings,
    renderWarnings: rendered.warnings,
    assetPaths: rendered.assetRecords.map((asset) => asset.relativePath),
  }
}
```

`src/modules/exporter/asset-store.ts`

```ts
import type { ExportOptions } from "../../shared/types.js"

type BinaryDownloader = {
  downloadBinary: (input: {
    sourceUrl: string
    destinationPath: string
  }) => Promise<void>
}

export class AssetStore {
  readonly fetcher: BinaryDownloader

  constructor({
    outputDir,
    fetcher,
    options,
  }: {
    outputDir: string
    fetcher: BinaryDownloader
    options: Pick<ExportOptions, "assets" | "structure">
  }) {
    this.outputDir = outputDir
    this.fetcher = fetcher
    this.options = options
  }
}
```

`src/modules/exporter/naver-blog-exporter.ts`

```ts
import { buildMarkdownFilePath, getCategoryForPost } from "./export-paths.js"

const category = getCategoryForPost({
  categories: categoryMap,
  categoryId: post.categoryId,
  categoryName: post.categoryName,
})

const markdownFilePath = buildMarkdownFilePath({
  outputDir,
  post,
  category,
  options,
})
```

- [ ] **Step 4: Run the focused unit test and make sure it passes**

Run:

```bash
pnpm exec vitest run tests/export-single-post.test.ts --silent
```

Expected:

```text
PASS  tests/export-single-post.test.ts
```

## Task 2: Add the CLI Helper Layer and the `export-single-post` Entry Script

**Files:**
- Create: `scripts/lib/single-post-cli.ts`
- Create: `scripts/export-single-post.ts`
- Test: `tests/single-post-cli.test.ts`

- [ ] **Step 1: Write the failing test for CLI argument parsing and summary rendering**

```ts
import { describe, expect, it } from "vitest"

import {
  parseSinglePostCliArgs,
  renderSinglePostSummary,
} from "../scripts/lib/single-post-cli.js"

describe("single-post-cli helpers", () => {
  it("parses required args plus stdout and report switches", () => {
    expect(
      parseSinglePostCliArgs([
        "--blogId",
        "mym0404",
        "--logNo",
        "223034929697",
        "--outputDir",
        "tmp/audit/223034929697",
        "--report",
        "tmp/audit/223034929697/report.json",
        "--stdout",
      ]),
    ).toEqual({
      blogId: "mym0404",
      logNo: "223034929697",
      outputDir: "tmp/audit/223034929697",
      reportPath: "tmp/audit/223034929697/report.json",
      optionsPath: null,
      stdout: true,
    })
  })

  it("renders a compact diagnostics summary", () => {
    const summary = renderSinglePostSummary({
      blogId: "mym0404",
      logNo: "223034929697",
      editorVersion: 4,
      blockTypes: ["paragraph", "code"],
      parserWarnings: ["parser warning"],
      reviewerWarnings: ["review warning"],
      renderWarnings: ["render warning"],
      markdownFilePath: "/tmp/post.md",
      assetPaths: ["https://example.com/image.png"],
    })

    expect(summary).toContain("blogId: mym0404")
    expect(summary).toContain("blockTypes: paragraph, code")
    expect(summary).toContain("renderWarnings: 1")
    expect(summary).toContain("/tmp/post.md")
  })
})
```

- [ ] **Step 2: Run the CLI helper test and confirm it fails because the helper module does not exist yet**

Run:

```bash
pnpm exec vitest run tests/single-post-cli.test.ts --silent
```

Expected:

```text
FAIL  tests/single-post-cli.test.ts
Error: Failed to load url ../scripts/lib/single-post-cli.js
```

- [ ] **Step 3: Implement the CLI helper module and the executable script**

`scripts/lib/single-post-cli.ts`

```ts
export const parseSinglePostCliArgs = (argv: string[]) => {
  let blogId: string | null = null
  let logNo: string | null = null
  let outputDir: string | null = null
  let reportPath: string | null = null
  let optionsPath: string | null = null
  let stdout = false

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "--blogId") {
      blogId = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (value === "--logNo") {
      logNo = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (value === "--outputDir") {
      outputDir = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (value === "--report") {
      reportPath = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (value === "--options") {
      optionsPath = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (value === "--stdout") {
      stdout = true
      continue
    }
  }

  if (!blogId || !logNo || !outputDir) {
    throw new Error(
      "Usage: pnpm exec tsx scripts/export-single-post.ts --blogId mym0404 --logNo 223034929697 --outputDir tmp/manual-audit/223034929697 [--report tmp/manual-audit/223034929697/report.json] [--options tmp/manual-audit/options.json] [--stdout]",
    )
  }

  return {
    blogId,
    logNo,
    outputDir,
    reportPath,
    optionsPath,
    stdout,
  }
}

export const renderSinglePostSummary = ({
  blogId,
  logNo,
  editorVersion,
  blockTypes,
  parserWarnings,
  reviewerWarnings,
  renderWarnings,
  markdownFilePath,
  assetPaths,
}: {
  blogId: string
  logNo: string
  editorVersion: number
  blockTypes: string[]
  parserWarnings: string[]
  reviewerWarnings: string[]
  renderWarnings: string[]
  markdownFilePath: string | null
  assetPaths: string[]
}) =>
  [
    `blogId: ${blogId}`,
    `logNo: ${logNo}`,
    `editorVersion: ${editorVersion}`,
    `blockTypes: ${blockTypes.join(", ") || "(none)"}`,
    `parserWarnings: ${parserWarnings.length}`,
    `reviewerWarnings: ${reviewerWarnings.length}`,
    `renderWarnings: ${renderWarnings.length}`,
    `assetPaths: ${assetPaths.length}`,
    `markdownFilePath: ${markdownFilePath ?? "(stdout only)"}`,
  ].join("\n")
```

`scripts/export-single-post.ts`

```ts
import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"

import { exportSinglePost } from "../src/modules/exporter/single-post-export.js"
import { cloneExportOptions } from "../src/shared/export-options.js"
import type { ExportOptions } from "../src/shared/types.js"
import { parseSinglePostCliArgs, renderSinglePostSummary } from "./lib/single-post-cli.js"

const run = async () => {
  const cli = parseSinglePostCliArgs(process.argv.slice(2))
  const optionOverrides = cli.optionsPath
    ? (JSON.parse(await readFile(cli.optionsPath, "utf8")) as Partial<ExportOptions>)
    : undefined
  const result = await exportSinglePost({
    blogId: cli.blogId,
    logNo: cli.logNo,
    outputDir: cli.outputDir,
    options: cloneExportOptions(optionOverrides),
  })

  if (cli.reportPath) {
    await mkdir(path.dirname(cli.reportPath), {
      recursive: true,
    })
    await writeFile(
      cli.reportPath,
      JSON.stringify(
        {
          blogId: cli.blogId,
          logNo: cli.logNo,
          editorVersion: result.editorVersion,
          blockTypes: result.blockTypes,
          parserWarnings: result.parserWarnings,
          reviewerWarnings: result.reviewerWarnings,
          renderWarnings: result.renderWarnings,
          markdownFilePath: result.markdownFilePath,
          assetPaths: result.assetPaths,
        },
        null,
        2,
      ),
      "utf8",
    )
  }

  process.stderr.write(`${renderSinglePostSummary(result)}\n`)

  if (cli.stdout) {
    process.stdout.write(`${result.markdown}\n`)
  }
}

void run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
```

- [ ] **Step 4: Run the helper test, then smoke-test the CLI usage output**

Run:

```bash
pnpm exec vitest run tests/single-post-cli.test.ts --silent
pnpm exec tsx scripts/export-single-post.ts
```

Expected:

```text
PASS  tests/single-post-cli.test.ts
Usage: pnpm exec tsx scripts/export-single-post.ts --blogId mym0404 --logNo 223034929697 --outputDir tmp/manual-audit/223034929697 [--report tmp/manual-audit/223034929697/report.json] [--options tmp/manual-audit/options.json] [--stdout]
```

## Task 3: Add a Real-Network Integration Test for the One-Post Workflow

**Files:**
- Create: `tests/naver.single-post-export.integration.test.ts`

- [ ] **Step 1: Write the failing integration test against a known public sample**

```ts
import path from "node:path"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import { exportSinglePost } from "../src/modules/exporter/single-post-export.js"
import { defaultExportOptions } from "../src/shared/export-options.js"

describe("single-post export integration", () => {
  it("exports one public post to markdown with diagnostics", async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), "single-post-live-"))
    const options = defaultExportOptions()

    options.assets.assetPathMode = "remote"
    options.assets.downloadImages = false
    options.assets.downloadThumbnails = false

    const result = await exportSinglePost({
      blogId: "mym0404",
      logNo: "223034929697",
      outputDir,
      options,
    })

    expect(result.editorVersion).toBe(4)
    expect(result.blockTypes).toContain("code")
    expect(result.blockTypes).toContain("formula")
    expect(result.markdown).toContain("```")
    expect(await readFile(result.markdownFilePath!, "utf8")).toContain(result.markdown.trim())

    await rm(outputDir, {
      recursive: true,
      force: true,
    })
  }, 60_000)
})
```

- [ ] **Step 2: Run the integration test and inspect the first real failure**

Run:

```bash
pnpm exec vitest run tests/naver.single-post-export.integration.test.ts --silent
```

Expected:

```text
FAIL  tests/naver.single-post-export.integration.test.ts
```

Expected first failure modes:
- fetcher metadata lookup fails
- Markdown file path is not written
- diagnostics shape does not match the test assertions

- [ ] **Step 3: Fix the gap exposed by the integration test without changing the contract**

Use these checkpoints while editing:

```ts
// keep the result shape stable
expect(result.editorVersion).toBe(4)
expect(result.blockTypes).toContain("code")
expect(result.blockTypes).toContain("formula")
expect(result.markdownFilePath).toMatch(/\\.md$/)
```

If the integration test shows a path mismatch, align `single-post-export.ts` with `buildMarkdownFilePath(...)` instead of inventing a second filename rule.

- [ ] **Step 4: Re-run the integration test and confirm the live workflow passes**

Run:

```bash
pnpm exec vitest run tests/naver.single-post-export.integration.test.ts --silent
```

Expected:

```text
PASS  tests/naver.single-post-export.integration.test.ts
```

## Task 4: Create the Canonical Audit Tracker and the Single-Post Verification Runbook

**Files:**
- Create: `docs/naver-blog-300-audit-progress.md`
- Create: `docs/runbooks/single-post-verification.md`
- Modify: `docs/index.md`
- Modify: `.agents/knowledge/product/product-outline.md`
- Modify: `.agents/knowledge/engineering/validation.md`
- Modify: `docs/runbooks/browser-verification.md`

- [ ] **Step 1: Add the single-file audit tracker template**

`../../naver-blog-300-audit-progress.md`

```md
# Naver Blog 300 Audit Progress

## Rules
- 공개 글만 기록한다.
- 각 행은 browser inspection과 Markdown conversion 결과를 함께 기록한다.
- `markdownResult`는 `as-expected`, `mismatch`, `error`, `not-checked`만 사용한다.
- `followUp`는 `parse-edge`, `render-edge`, `option-gap`, `test-gap`, `none`만 사용한다.

## Summary
- target: 300
- reviewed: 0
- excluded: 0
- mismatch: 0
- error: 0

## Table
| seq | status | blogId | logNo | url | editor | observedBlocks | markdownResult | suspectedIssues | notes | followUp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | candidate |  |  |  |  |  | not-checked |  |  | none |
```

- [ ] **Step 2: Document the manual verification loop and connect it from the docs index**

`../../runbooks/single-post-verification.md`

```md
# Single Post Verification Runbook

## 목적
공개 네이버 블로그 글 1건을 브라우저로 확인한 직후 같은 글을 Markdown으로 변환해 비교하고, 결과를 진행 문서에 기록한다.

## Command
~~~bash
pnpm exec tsx scripts/export-single-post.ts \
  --blogId mym0404 \
  --logNo 223034929697 \
  --outputDir tmp/manual-audit/223034929697 \
  --report tmp/manual-audit/223034929697/report.json \
  --stdout > tmp/manual-audit/223034929697/post.md
~~~

## Manual Loop
1. `browser-use open https://blog.naver.com/mym0404/223034929697` 로 공개 글을 연다.
2. 본문 구조와 editor version을 기록한다.
3. 위 command로 Markdown과 diagnostics report를 생성한다.
4. 본문과 `post.md`, `report.json`을 비교한다.
5. `docs/naver-blog-300-audit-progress.md` 에 결과를 기록한다.
```

`docs/index.md`

```md
- [runbooks/single-post-verification.md](../../runbooks/single-post-verification.md)
- [naver-blog-300-audit-progress.md](../../naver-blog-300-audit-progress.md)
```

`.agents/knowledge/product/product-outline.md`

```md
## Manual Verification
- `scripts/export-single-post.ts` 는 exporter와 동일한 Markdown/export option 규칙으로 특정 글 1건을 바로 렌더링한다.
```

`.agents/knowledge/engineering/validation.md`

```md
## Manual Single-Post Check
- `pnpm exec tsx scripts/export-single-post.ts --blogId mym0404 --logNo 223034929697 --outputDir tmp/manual-audit/223034929697 --report tmp/manual-audit/223034929697/report.json --stdout > tmp/manual-audit/223034929697/post.md`
```

`docs/runbooks/browser-verification.md`

```md
## Single Post Cross-Check
UI smoke와 별개로 개별 글 검증이 필요하면 `scripts/export-single-post.ts` 로 같은 글의 Markdown과 diagnostics report를 생성해서 브라우저에서 본 구조와 비교한다.
```

- [ ] **Step 3: Review the new tracker and runbook links after the files are in place**

Check:

- `docs/runbooks/single-post-verification.md` and `docs/index.md` both point to the tracker and single-post flow correctly.
- The command examples still reference the current `scripts/export-single-post.ts` entry point and valid output paths.

## Task 5: Verify the Whole Workflow End-to-End

**Files:**
- Modify: `tests/export-single-post.test.ts`
- Modify: `tests/single-post-cli.test.ts`
- Modify: `tests/naver.single-post-export.integration.test.ts`
- Modify: `docs/naver-blog-300-audit-progress.md`

- [ ] **Step 1: Run the focused test suite and typecheck**

Run:

```bash
pnpm exec vitest run tests/export-single-post.test.ts tests/single-post-cli.test.ts tests/naver.single-post-export.integration.test.ts --silent
pnpm typecheck
```

Expected:

```text
PASS  tests/export-single-post.test.ts
PASS  tests/single-post-cli.test.ts
PASS  tests/naver.single-post-export.integration.test.ts
```

- [ ] **Step 2: Run the real one-post command and inspect the generated artifacts**

Run:

```bash
pnpm exec tsx scripts/export-single-post.ts \
  --blogId mym0404 \
  --logNo 223034929697 \
  --outputDir tmp/manual-audit/223034929697 \
  --report tmp/manual-audit/223034929697/report.json \
  --stdout > tmp/manual-audit/223034929697/post.md
```

Expected files:

```text
tmp/manual-audit/223034929697/post.md
tmp/manual-audit/223034929697/report.json
tmp/manual-audit/223034929697/posts/...
```

Expected stderr summary:

```text
blogId: mym0404
logNo: 223034929697
editorVersion: 4
blockTypes: ...
parserWarnings: 0
reviewerWarnings: 0
renderWarnings: 0
```

- [ ] **Step 3: Record one real sample row in the progress document using the generated report**

Append one concrete checked row to `docs/naver-blog-300-audit-progress.md`:

```md
| 001 | reviewed | mym0404 | 223034929697 | https://blog.naver.com/mym0404/223034929697 | 4 | paragraph,divider,image,formula,code,linkCard | as-expected | none | baseline single-post workflow verified | none |
```

- [ ] **Step 4: Re-read the seeded tracker and runbook after the sample row is added**

Check:

- The new row in `docs/naver-blog-300-audit-progress.md` is still consistent with the runbook field meanings.
- `docs/index.md` and `docs/runbooks/single-post-verification.md` still route readers to the same workflow without stale command names.

## Follow-Up Planning Note

Once this plan lands, write separate execution plans for the actual audit batches instead of stretching this document to 300 manual rows. Recommended split:

1. `001-050`
2. `051-100`
3. `101-150`
4. `151-200`
5. `201-250`
6. `251-300`

Each batch plan should reuse:
- `docs/runbooks/single-post-verification.md`
- `docs/naver-blog-300-audit-progress.md`
- `scripts/export-single-post.ts`
