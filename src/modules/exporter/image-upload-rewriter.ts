import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"

import type { ExportJobItem, ExportManifest, PostManifestEntry } from "../../shared/types.js"
import type { ImageUploadResult } from "./image-upload-phase.js"

type FileOps = Pick<typeof fs, "readFile" | "writeFile" | "rename" | "rm">

type RewrittenPostResult = {
  markdownPath: string
  post: PostManifestEntry
  item: ExportJobItem
}

type RewriteResult = {
  manifest: ExportManifest
  items: ExportJobItem[]
}

const ensureHttpUrl = (value: string) => {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    throw new Error("Image upload result must be an absolute http(s) URL.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Image upload result must be an absolute http(s) URL.")
  }

  if (parsed.username || parsed.password) {
    throw new Error("Image upload result must not include URL credentials.")
  }

  for (const [key] of parsed.searchParams.entries()) {
    if (/(^x-amz-|token|sig|signature|credential|expires|policy|key-pair-id|googleaccessid)/i.test(key)) {
      throw new Error("Image upload result must not include signed or secret-bearing query params.")
    }
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

const writeFileAtomically = async ({
  finalPath,
  content,
  fileOps,
}: {
  finalPath: string
  content: string
  fileOps: FileOps
}) => {
  const tempPath = `${finalPath}.${randomUUID()}.tmp`
  const backupPath = `${finalPath}.${randomUUID()}.bak`

  await fileOps.writeFile(tempPath, content, "utf8")

  try {
    await fileOps.rename(finalPath, backupPath)

    try {
      await fileOps.rename(tempPath, finalPath)
    } catch (error) {
      await fileOps.rename(backupPath, finalPath)
      throw error
    }

    await fileOps.rm(backupPath, { force: true })
  } catch (error) {
    await fileOps.rm(tempPath, { force: true })
    throw error
  }
}

const buildUploadResultByLocalPath = (uploadResults: ImageUploadResult[]) =>
  new Map(uploadResults.map((result) => [result.candidate.localPath, result]))

export const rewriteImageUploadPost = async ({
  outputDir,
  post,
  item,
  uploadResults,
  rewrittenAt = new Date().toISOString(),
  fileOps = fs,
}: {
  outputDir: string
  post: PostManifestEntry
  item: ExportJobItem
  uploadResults: ImageUploadResult[]
  rewrittenAt?: string
  fileOps?: FileOps
}): Promise<RewrittenPostResult> => {
  if (!post.outputPath || !item.outputPath) {
    throw new Error(`Missing output path for ${post.logNo}.`)
  }

  const uploadResultByLocalPath = buildUploadResultByLocalPath(uploadResults)
  const markdownPath = path.join(outputDir, post.outputPath)
  const markdown = await fileOps.readFile(markdownPath, "utf8")
  let rewrittenMarkdown = markdown
  const resultByReference = new Map<string, string>()
  const uploadedUrls: string[] = []

  for (const candidate of post.upload.candidates) {
    const matchedResult = uploadResultByLocalPath.get(candidate.localPath)

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
    uploadedUrls.push(matchedResult.uploadedUrl)
  }

  await writeFileAtomically({
    finalPath: markdownPath,
    content: rewrittenMarkdown,
    fileOps,
  })

  return {
    markdownPath,
    post: {
      ...post,
      assetPaths: post.assetPaths.map((assetPath) => resultByReference.get(assetPath) ?? assetPath),
      upload: {
        ...post.upload,
        uploadedCount: post.upload.candidateCount,
        failedCount: 0,
        uploadedUrls,
        rewriteStatus: "completed",
        rewrittenAt,
      },
    },
    item: {
      ...item,
      assetPaths: item.assetPaths.map((assetPath) => resultByReference.get(assetPath) ?? assetPath),
      upload: {
        ...item.upload,
        uploadedCount: item.upload.candidateCount,
        failedCount: 0,
        uploadedUrls,
        rewriteStatus: "completed",
        rewrittenAt,
      },
      updatedAt: rewrittenAt,
    },
  }
}

export const writeImageUploadManifestSnapshot = async ({
  outputDir,
  manifest,
  fileOps = fs,
}: {
  outputDir: string
  manifest: ExportManifest
  fileOps?: FileOps
}) => {
  await writeFileAtomically({
    finalPath: path.join(outputDir, "manifest.json"),
    content: JSON.stringify(manifest, null, 2),
    fileOps,
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
  uploadResults: ImageUploadResult[]
  fileOps?: FileOps
}): Promise<RewriteResult> => {
  const normalizedItems =
    items.length > 0
      ? items
      : manifest.posts.map((post) => ({
          id: post.outputPath ?? `failed:${post.logNo}`,
          logNo: post.logNo,
          title: post.title,
          source: post.source,
          category: post.category,
          editorVersion: post.editorVersion,
          status: post.status,
          outputPath: post.outputPath,
          assetPaths: post.assetPaths,
          upload: post.upload,
          warnings: post.warnings,
          warningCount: post.warningCount,
          error: post.error,
          updatedAt: new Date().toISOString(),
        }))
  let nextManifest = {
    ...manifest,
    posts: [...manifest.posts],
  }
  let nextItems = [...normalizedItems]
  const itemById = new Map(nextItems.map((item) => [item.outputPath ?? `failed:${item.logNo}`, item]))

  for (const post of nextManifest.posts) {
    if (!post.outputPath || post.upload.candidateCount === 0) {
      continue
    }

    const item = itemById.get(post.outputPath)

    if (!item) {
      continue
    }

    const rewritten = await rewriteImageUploadPost({
      outputDir,
      post,
      item,
      uploadResults,
      fileOps,
    })

    nextManifest = {
      ...nextManifest,
      posts: nextManifest.posts.map((currentPost) =>
        currentPost.outputPath === rewritten.post.outputPath ? rewritten.post : currentPost,
      ),
    }
    nextItems = nextItems.map((currentItem) =>
      currentItem.outputPath === rewritten.item.outputPath ? rewritten.item : currentItem,
    )
  }

  nextManifest = {
    ...nextManifest,
    upload: {
      ...nextManifest.upload,
      status: "upload-completed",
      uploadedCount: nextManifest.upload.candidateCount,
      failedCount: 0,
      terminalReason: null,
    },
  }

  await writeImageUploadManifestSnapshot({
    outputDir,
    manifest: nextManifest,
    fileOps,
  })

  return {
    manifest: nextManifest,
    items: nextItems,
  }
}
