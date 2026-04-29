#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { cloneExportOptions } from "../src/shared/ExportOptions.js"
import { exportSinglePost } from "../src/modules/exporter/SinglePostExport.js"
import { createSinglePostMetadataCachingFetcher } from "./lib/single-post-metadata-cache.js"
import {
  parseSinglePostCliArgs,
  readSinglePostOptions,
  renderSinglePostSummary,
} from "./lib/single-post-cli.js"

export type RunSinglePostCliDeps = {
  argv?: string[]
  readFile?: typeof readFile
  writeFile?: typeof writeFile
  mkdir?: typeof mkdir
  exportSinglePost?: typeof exportSinglePost
  stdoutWrite?: (text: string) => void
  stderrWrite?: (text: string) => void
}

export const runSinglePostCli = async ({
  argv = process.argv.slice(2),
  readFile: readFileImpl = readFile,
  writeFile: writeFileImpl = writeFile,
  mkdir: mkdirImpl = mkdir,
  exportSinglePost: exportSinglePostImpl = exportSinglePost,
  stdoutWrite = (text) => {
    process.stdout.write(text)
  },
  stderrWrite = (text) => {
    console.error(text)
  },
}: RunSinglePostCliDeps = {}) => {
  const {
    blogId,
    logNo,
    outputDir,
    reportPath,
    manualReviewMarkdownPath,
    metadataCachePath,
    optionsPath,
    stdout,
  } =
    parseSinglePostCliArgs(argv)
  const resolvedManualReviewMarkdownPath = manualReviewMarkdownPath
    ? path.resolve(manualReviewMarkdownPath)
    : null
  const resolvedMetadataCachePath = metadataCachePath ? path.resolve(metadataCachePath) : null

  const options = cloneExportOptions(
    optionsPath ? await readSinglePostOptions({ optionsPath, readFile: readFileImpl }) : undefined,
  )
  const diagnostics = await exportSinglePostImpl({
    blogId,
    logNo,
    outputDir,
    options,
    createFetcher: resolvedMetadataCachePath
      ? async (input) =>
          createSinglePostMetadataCachingFetcher({
            blogId: input.blogId,
            cachePath: resolvedMetadataCachePath,
            readFile: readFileImpl,
            writeFile: writeFileImpl,
          })
      : undefined,
  })

  if (reportPath) {
    await mkdirImpl(path.dirname(reportPath), { recursive: true })
    await writeFileImpl(
      reportPath,
      `${JSON.stringify(
        {
          ...diagnostics,
          exporterMarkdownFilePath: diagnostics.markdownFilePath,
          manualReviewMarkdownFilePath: resolvedManualReviewMarkdownPath,
          metadataCachePath: resolvedMetadataCachePath,
        },
        null,
        2,
      )}\n`,
      "utf8",
    )
  }

  if (resolvedManualReviewMarkdownPath) {
    await mkdirImpl(path.dirname(resolvedManualReviewMarkdownPath), { recursive: true })
    await writeFileImpl(
      resolvedManualReviewMarkdownPath,
      diagnostics.markdown.endsWith("\n") ? diagnostics.markdown : `${diagnostics.markdown}\n`,
      "utf8",
    )
  }

  stderrWrite(
    renderSinglePostSummary({
      blogId: diagnostics.post.blogId,
      logNo: diagnostics.post.logNo,
      blockTypes: diagnostics.blockTypes,
      exporterMarkdownFilePath: diagnostics.markdownFilePath,
      manualReviewMarkdownFilePath: resolvedManualReviewMarkdownPath,
      parserWarnings: diagnostics.parserWarnings,
      reviewerWarnings: diagnostics.reviewerWarnings,
      renderWarnings: diagnostics.renderWarnings,
      metadataCachePath: resolvedMetadataCachePath,
    }),
  )

  if (stdout) {
    stdoutWrite(diagnostics.markdown.endsWith("\n") ? diagnostics.markdown : `${diagnostics.markdown}\n`)
  }
}

const run = async () => {
  try {
    await runSinglePostCli()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  }
}

const isMainModule = path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)

if (isMainModule) {
  void run()
}

export { run as runSinglePostExportCli }
