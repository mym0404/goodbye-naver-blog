import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"

import type { ExportJobItem, ExportManifest, PostManifestEntry } from "../../shared/types.js"
import type { PicGoUploadResult } from "./picgo-upload-phase.js"

type RewriteResult = {
  manifest: ExportManifest
  items: ExportJobItem[]
}

type FileOps = Pick<typeof fs, "readFile" | "writeFile" | "rename" | "rm">

const ensureHttpUrl = (value: string) => {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error("PicGo upload result must be an absolute http(s) URL.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("PicGo upload result must be an absolute http(s) URL.")
  }
}

const replaceAll = ({
  content,
  search,
  replacement,
}: {
  content: string
  search: string
  replacement: string
}) => content.split(search).join(replacement)

const buildUpdatedPost = ({
  outputDir,
  post,
  uploadResults,
  fileOps,
}: {
  outputDir: string
  post: PostManifestEntry
  uploadResults: PicGoUploadResult[]
  fileOps: FileOps
}) => {
  if (!post.outputPath) {
    return null
  }

  const markdownPath = path.join(outputDir, post.outputPath)

  return fileOps.readFile(markdownPath, "utf8").then((markdown) => {
    let rewrittenMarkdown = markdown
    const resultByReference = new Map<string, string>()

    for (const candidate of post.upload.candidates) {
      const matchedResult = uploadResults.find(
        (result) => result.candidate.localPath === candidate.localPath,
      )

      if (!matchedResult) {
        throw new Error(`Missing upload result for ${candidate.localPath}.`)
      }

      ensureHttpUrl(matchedResult.uploadedUrl)

      if (!rewrittenMarkdown.includes(candidate.markdownReference)) {
        throw new Error(`Missing markdown reference for ${candidate.localPath}.`)
      }

      rewrittenMarkdown = replaceAll({
        content: rewrittenMarkdown,
        search: candidate.markdownReference,
        replacement: matchedResult.uploadedUrl,
      })
      resultByReference.set(candidate.markdownReference, matchedResult.uploadedUrl)
    }

    return {
      markdownPath,
      rewrittenMarkdown,
      post: {
        ...post,
        assetPaths: post.assetPaths.map((assetPath) => resultByReference.get(assetPath) ?? assetPath),
        upload: {
          ...post.upload,
          uploadedCount: post.upload.candidateCount,
          failedCount: 0,
        },
      } satisfies PostManifestEntry,
    }
  })
}

export const rewriteUploadedAssets = async ({
  outputDir,
  manifest,
  items,
  uploadResults,
  fileOps = fs,
}: {
  outputDir: string
  manifest: ExportManifest
  items: ExportJobItem[]
  uploadResults: PicGoUploadResult[]
  fileOps?: FileOps
}): Promise<RewriteResult> => {
  const rewrittenPosts = await Promise.all(
    manifest.posts.map(async (post) => {
      if (!post.outputPath || post.upload.candidateCount === 0) {
        return null
      }

      return buildUpdatedPost({
        outputDir,
        post,
        uploadResults,
        fileOps,
      })
    }),
  )
  const postByOutputPath = new Map(
    rewrittenPosts
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => [entry.post.outputPath!, entry]),
  )

  const nextManifest: ExportManifest = {
    ...manifest,
    upload: {
      status: "upload-completed",
      eligiblePostCount: manifest.upload.eligiblePostCount,
      candidateCount: manifest.upload.candidateCount,
      uploadedCount: manifest.upload.candidateCount,
      failedCount: 0,
      terminalReason: null,
    },
    posts: manifest.posts.map((post) => postByOutputPath.get(post.outputPath ?? "")?.post ?? post),
  }
  const nextItems = items.map((item) => {
    const rewritten = item.outputPath ? postByOutputPath.get(item.outputPath) : null

    if (!rewritten) {
      return item
    }

    return {
      ...item,
      assetPaths: rewritten.post.assetPaths,
      upload: rewritten.post.upload,
      updatedAt: new Date().toISOString(),
    } satisfies ExportJobItem
  })

  const stagedFiles = [
    ...rewrittenPosts
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => ({
        finalPath: entry.markdownPath,
        tempPath: `${entry.markdownPath}.${randomUUID()}.tmp`,
        backupPath: `${entry.markdownPath}.${randomUUID()}.bak`,
        content: entry.rewrittenMarkdown,
      })),
    {
      finalPath: path.join(outputDir, "manifest.json"),
      tempPath: path.join(outputDir, `manifest.json.${randomUUID()}.tmp`),
      backupPath: path.join(outputDir, `manifest.json.${randomUUID()}.bak`),
      content: JSON.stringify(nextManifest, null, 2),
    },
  ]

  for (const file of stagedFiles) {
    await fileOps.writeFile(file.tempPath, file.content, "utf8")
  }

  const applied: typeof stagedFiles = []

  try {
    for (const file of stagedFiles) {
      await fileOps.rename(file.finalPath, file.backupPath)

      try {
        await fileOps.rename(file.tempPath, file.finalPath)
      } catch (error) {
        await fileOps.rename(file.backupPath, file.finalPath)
        throw error
      }

      applied.push(file)
    }

    await Promise.all(applied.map((file) => fileOps.rm(file.backupPath, { force: true })))
  } catch (error) {
    await Promise.all(
      stagedFiles.map((file) => fileOps.rm(file.tempPath, { force: true })),
    )

    for (const file of [...applied].reverse()) {
      await fileOps.rm(file.finalPath, { force: true })
      await fileOps.rename(file.backupPath, file.finalPath)
    }

    throw error
  }

  return {
    manifest: nextManifest,
    items: nextItems,
  }
}
