import {
  getBlockOutputTemplates,
  getFrontmatterExportKey,
} from "@exitpress/domain/export-options/ExportOptions.js"
import { resolveParsedBlockAssetsForRender } from "@exitpress/engine/exporting/assets/ParsedBlockAssetResolver.js"
import { getOutputAdapter } from "@exitpress/engine/exporting/profiles/OutputAdapters.js"
import YAML from "yaml"

import type { CategoryInfo, PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type {
  AssetRecord,
  UploadCandidateKind,
} from "@exitpress/domain/export-job/schema/UploadState.js"
import type {
  ExportOptions,
  FrontmatterFieldName,
} from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { ParsedPost } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { OutputAdapter } from "@exitpress/engine/exporting/profiles/OutputAdapter.js"
import type { UnknownRecord } from "@exitpress/engine/shared/object/UnknownRecord.js"

import { renderBlockTemplates } from "./renderBlockTemplates.js"

const buildFrontmatter = ({
  fields,
  aliases,
  values,
}: {
  fields: Record<FrontmatterFieldName, boolean>
  aliases: Record<FrontmatterFieldName, string>
  values: Record<FrontmatterFieldName, unknown>
}) => {
  const frontmatter: UnknownRecord = {}

  for (const [key, enabled] of Object.entries(fields) as Array<[FrontmatterFieldName, boolean]>) {
    if (!enabled) {
      continue
    }

    const value = values[key]

    if (value === undefined || value === null) {
      continue
    }

    if (Array.isArray(value) && value.length === 0) {
      continue
    }

    const alias = getFrontmatterExportKey({
      fieldName: key,
      alias: aliases[key],
    })

    frontmatter[alias] = value
  }

  return frontmatter
}

const getFrontmatterPostId = (postId: string) => {
  const numericPostId = Number(postId)

  return Number.isSafeInteger(numericPostId) ? numericPostId : postId
}

// Builds the final markdown body, frontmatter, and asset records for one post.
export const renderMarkdownPost = async ({
  post,
  category,
  parsedPost,
  defaultBlockTemplates,
  markdownFilePath,
  options,
  resolveAsset,
  profile = "gfm",
  adapter = getOutputAdapter(profile),
}: {
  post: PostSummary
  category: CategoryInfo
  parsedPost: ParsedPost
  defaultBlockTemplates: Record<string, string>
  markdownFilePath: string
  options: ExportOptions
  profile?: ExportProfile
  adapter?: OutputAdapter
  resolveAsset: (input: {
    kind: UploadCandidateKind
    sourceUrl: string
    markdownFilePath: string
  }) => Promise<AssetRecord>
}) => {
  const assetRecords: AssetRecord[] = []
  let postListThumbnailPath: string | null = null
  let firstBodyThumbnailPath: string | null = null

  const resolveAssetPath = async ({
    kind,
    sourceUrl,
  }: {
    kind: UploadCandidateKind
    sourceUrl: string
  }): Promise<string | null> => {
    try {
      const assetRecord = await resolveAsset({
        kind,
        sourceUrl,
        markdownFilePath,
      })

      if (
        !assetRecords.some(
          (existing) =>
            existing.reference === assetRecord.reference &&
            existing.storageMode === assetRecord.storageMode,
        )
      ) {
        assetRecords.push(assetRecord)
      }

      return assetRecord.reference
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.assets.downloadFailureMode === "fail") {
        throw new Error(`자산 다운로드 실패: ${sourceUrl} (${message})`)
      }

      return options.assets.downloadFailureMode === "omit" ? null : sourceUrl
    }
  }

  if (options.assets.thumbnailSource === "post-list-first" && post.thumbnailUrl) {
    postListThumbnailPath = await resolveAssetPath({
      kind: "thumbnail",
      sourceUrl: post.thumbnailUrl,
    })
  }

  const resolved = await resolveParsedBlockAssetsForRender({
    blocks: parsedPost.blocks,
    resolveAsset: async ({ role, sourceUrl }) => {
      const reference =
        (await resolveAssetPath({
          kind: role,
          sourceUrl,
        })) ?? ""

      if (!reference) {
        return {
          reference: "",
          record: {
            kind: role,
            sourceUrl,
            reference: "",
            relativePath: null,
            storageMode: "remote",
            uploadCandidate: null,
          },
        }
      }

      const record = assetRecords.find(
        (asset) => asset.kind === role && asset.sourceUrl === sourceUrl,
      ) ?? {
        kind: role,
        sourceUrl,
        reference,
        relativePath: reference === sourceUrl ? null : reference,
        storageMode: reference === sourceUrl ? ("remote" as const) : ("relative" as const),
        uploadCandidate: null,
      }

      if (!firstBodyThumbnailPath && role === "image" && reference) {
        firstBodyThumbnailPath = reference
      }

      return {
        reference,
        record,
      }
    },
  })
  const customBlockTemplates = getBlockOutputTemplates(options, profile)
  const getBlockTemplate = (block: ParsedBlock) => {
    const template = customBlockTemplates[block.blockId] ?? defaultBlockTemplates[block.blockId]

    if (template === undefined) {
      throw new Error(`Parser block template is missing: ${block.blockId}`)
    }

    return template
  }
  const body = renderBlockTemplates(
    resolved.blocks.map((block) => ({
      template: getBlockTemplate(block),
      props: adapter.prepareBlockProps(block.props),
    })),
  )

  const thumbnailPath =
    options.assets.thumbnailSource === "none"
      ? null
      : options.assets.thumbnailSource === "first-body-image"
        ? firstBodyThumbnailPath
        : (postListThumbnailPath ?? firstBodyThumbnailPath)

  const frontmatterValues: Record<FrontmatterFieldName, unknown> = {
    title: post.title,
    source: post.source,
    blogKey: post.blogKey,
    sourceId: post.sourceId,
    postId: getFrontmatterPostId(post.postId),
    publishedAt: post.publishedAt,
    category: category.name,
    categoryPath: category.path,
    tags: parsedPost.tags,
    thumbnail: thumbnailPath,
    exportedAt: new Date().toISOString(),
    assetPaths: assetRecords
      .map((asset) => asset.relativePath)
      .filter((assetPath): assetPath is string => Boolean(assetPath)),
  }

  const frontmatter = options.frontmatter.enabled
    ? buildFrontmatter({
        fields: options.frontmatter.fields,
        aliases: options.frontmatter.aliases,
        values: frontmatterValues,
      })
    : null

  const markdown = adapter.renderDocument({
    frontmatter: frontmatter ? YAML.stringify(frontmatter) : null,
    body,
  })

  return {
    markdown,
    assetRecords,
  }
}
