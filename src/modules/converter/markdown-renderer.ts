import YAML from "yaml"

import { convertHtmlToMarkdown } from "./html-fragment-converter.js"

import type {
  AssetRecord,
  BlockOutputSelection,
  CategoryInfo,
  ExportOptions,
  FrontmatterFieldName,
  ImageData,
  UnknownRecord,
  ParsedPostFallbackHtmlBodyNode,
  ParsedPost,
  PostSummary,
  StructuredAstBlock,
} from "../../shared/types.js"
import { resolveBlockOutputSelection } from "../../shared/block-registry.js"
import {
  buildDiagnosticsSection,
  createLinkFormatter,
  getDividerMarker,
  getHeadingLevelOffset,
  getHtmlConversionOptions,
  type RenderDiagnostic,
  renderCodeBlock,
  renderFormula,
  renderGfmTable,
  renderImageBlockMarkdown,
  renderLinkCardBlock,
  renderParagraph,
  renderQuote,
} from "../../shared/block-markdown.js"
import { getFrontmatterExportKey } from "../../shared/export-options.js"
import { getParserCapabilityId } from "../../shared/parser-capabilities.js"
import { unique } from "../../shared/utils.js"
import {
  getFallbackHtmlBodyNodeWarnings,
  getParsedPostBodyNodes,
} from "../parser/blocks/body-node-utils.js"

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

export const renderMarkdownPost = async ({
  post,
  category,
  parsedPost,
  markdownFilePath,
  reviewedWarnings,
  options,
  resolveAsset,
  resolveLinkUrl,
}: {
  post: PostSummary
  category: CategoryInfo
  parsedPost: ParsedPost
  markdownFilePath: string
  reviewedWarnings: string[]
  options: ExportOptions
  resolveAsset: (input: {
    kind: "image" | "thumbnail"
    sourceUrl: string
    markdownFilePath: string
  }) => Promise<AssetRecord>
  resolveLinkUrl?: (url: string) => string
}) => {
  const bodyNodes = getParsedPostBodyNodes(parsedPost)
  const fallbackHtmlWarnings = bodyNodes.flatMap((node) =>
    node.kind === "fallbackHtml" ? getFallbackHtmlBodyNodeWarnings(node) : [],
  )
  const initialWarnings = unique([...parsedPost.warnings, ...reviewedWarnings, ...fallbackHtmlWarnings])
  const warnings: string[] = [...initialWarnings]
  const diagnostics: RenderDiagnostic[] = initialWarnings.map((warning) => ({
    level: "warning",
    message: warning,
  }))
  const assetRecords: AssetRecord[] = []
  const sections: string[] = []
  const linkFormatter = createLinkFormatter({
    style: options.markdown.linkStyle,
    resolveLinkUrl,
  })
  const htmlConversionOptions = getHtmlConversionOptions({
    linkStyle: options.markdown.linkStyle,
    dividerSelection: resolveBlockOutputSelection({
      blockType: "divider",
      blockOutputs: options.blockOutputs,
    }),
  })
  const renderedVideos: Array<{
    title: string
    sourceUrl: string
    thumbnail: string | null
  }> = []
  let postListThumbnailPath: string | null = null
  let firstBodyThumbnailPath: string | null = null

  const resolveAssetPath = async ({
    kind,
    sourceUrl,
  }: {
    kind: "image" | "thumbnail"
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
      const warning = `자산 다운로드 실패: ${sourceUrl} (${message})`
      const shouldWarn =
        options.assets.downloadFailureMode === "warn-and-use-source" ||
        options.assets.downloadFailureMode === "warn-and-omit"

      if (shouldWarn) {
        warnings.push(warning)
        diagnostics.push({
          level: "warning",
          message: warning,
        })
      }

      return options.assets.downloadFailureMode === "warn-and-omit" ||
        options.assets.downloadFailureMode === "omit"
        ? null
        : sourceUrl
    }
  }

  if (options.assets.thumbnailSource === "post-list-first" && post.thumbnailUrl) {
    postListThumbnailPath = await resolveAssetPath({
      kind: "thumbnail",
      sourceUrl: post.thumbnailUrl,
    })
  }

  const maybeRecordBodyThumbnail = (pathValue: string | null) => {
    if (!firstBodyThumbnailPath && pathValue) {
      firstBodyThumbnailPath = pathValue
    }
  }

  const getRenderableImageSource = (image: ImageData) => {
    if (image.mediaKind === "sticker") {
      if (options.assets.stickerAssetMode === "ignore") {
        return null
      }

      return image.originalSourceUrl || image.sourceUrl
    }

    return image.sourceUrl
  }

  const renderImageWithSelection = async ({
    image,
    selection,
  }: {
    image: ImageData
    selection: BlockOutputSelection<"image">
  }) => {
    const renderableSourceUrl = getRenderableImageSource(image)

    if (!renderableSourceUrl) {
      return ""
    }

    const assetPath = await resolveAssetPath({
      kind: "image",
      sourceUrl: renderableSourceUrl,
    })

    if (!assetPath) {
      return ""
    }

    maybeRecordBodyThumbnail(assetPath)
    return renderImageBlockMarkdown({
      image: {
        ...image,
        originalSourceUrl: image.originalSourceUrl ?? renderableSourceUrl,
      },
      assetPath,
      selection,
      formatLink: linkFormatter.formatLink,
      includeImageCaptions: options.assets.includeImageCaptions,
    })
  }

  const renderFallbackHtmlBodyNode = (node: ParsedPostFallbackHtmlBodyNode) => node.html.trim()

  const renderVideoBlock = async (block: Extract<StructuredAstBlock, { type: "video" }>) => {
    renderedVideos.push({
      title: block.video.title,
      sourceUrl: block.video.sourceUrl,
      thumbnail: block.video.thumbnailUrl,
    })

    return linkFormatter.formatLink({
      label: block.video.title || block.video.sourceUrl,
      url: block.video.sourceUrl,
    })
  }

  const renderTableBlock = (block: Extract<StructuredAstBlock, { type: "table" }>) => {
    const capabilityId = getParserCapabilityId({
      editorVersion: parsedPost.editorVersion,
      blockType: "table",
    })
    const selection = resolveBlockOutputSelection({
      blockType: "table",
      capabilityId,
      blockOutputs: options.blockOutputs,
    })

    if (selection.variant === "html-only") {
      return block.html
    }

    if (block.rows.length > 0) {
      return renderGfmTable(block)
    }

    return convertHtmlToMarkdown({
      html: block.html,
      options: htmlConversionOptions,
      resolveLinkUrl,
    })
  }

  for (const bodyNode of bodyNodes) {
    if (bodyNode.kind === "fallbackHtml") {
      sections.push(renderFallbackHtmlBodyNode(bodyNode))
      continue
    }

    const block = bodyNode.block

    if (block.type === "paragraph") {
      sections.push(renderParagraph(block.text))
      continue
    }

    if (block.type === "heading") {
      const selection = resolveBlockOutputSelection({
        blockType: "heading",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "heading",
        }),
        blockOutputs: options.blockOutputs,
      })
      const adjustedLevel = Math.min(
        Math.max(block.level + getHeadingLevelOffset(selection), 1),
        6,
      )

      sections.push(`${"#".repeat(adjustedLevel)} ${block.text}`)
      continue
    }

    if (block.type === "quote") {
      sections.push(renderQuote(block.text))
      continue
    }

    if (block.type === "divider") {
      const selection = resolveBlockOutputSelection({
        blockType: "divider",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "divider",
        }),
        blockOutputs: options.blockOutputs,
      })
      sections.push(getDividerMarker(block.outputSelection ?? selection))
      continue
    }

    if (block.type === "code") {
      const selection = resolveBlockOutputSelection({
        blockType: "code",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "code",
        }),
        blockOutputs: options.blockOutputs,
      })
      sections.push(
        renderCodeBlock({
          language: block.language,
          code: block.code,
          variant: selection.variant,
        }),
      )
      continue
    }

    if (block.type === "formula") {
      const selection = resolveBlockOutputSelection({
        blockType: "formula",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "formula",
        }),
        blockOutputs: options.blockOutputs,
      })
      sections.push(
        renderFormula({
          formula: block.formula,
          display: block.display,
          selection,
        }),
      )
      continue
    }

    if (block.type === "image") {
      const selection = resolveBlockOutputSelection({
        blockType: "image",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "image",
        }),
        blockOutputs: options.blockOutputs,
      })
      sections.push(
        await renderImageWithSelection({
          image: block.image,
          selection: block.outputSelection ?? selection,
        }),
      )
      continue
    }

    if (block.type === "imageGroup") {
      const groupSections: string[] = []
      const imageSelection = resolveBlockOutputSelection({
        blockType: "image",
        capabilityId: getParserCapabilityId({
          editorVersion: parsedPost.editorVersion,
          blockType: "image",
        }),
        blockOutputs: options.blockOutputs,
      })

      for (const image of block.images) {
        groupSections.push(
          await renderImageWithSelection({
            image,
            selection: imageSelection,
          }),
        )
      }

      sections.push(groupSections.join("\n\n"))
      continue
    }

    if (block.type === "video") {
      sections.push(await renderVideoBlock(block))
      continue
    }

    if (block.type === "linkCard") {
      sections.push(
        renderLinkCardBlock({
          block,
          formatLink: linkFormatter.formatLink,
        }),
      )
      continue
    }

    if (block.type === "table") {
      sections.push(renderTableBlock(block))
      continue
    }

  }

  const thumbnailPath =
    options.assets.thumbnailSource === "none"
      ? null
      : options.assets.thumbnailSource === "first-body-image"
        ? firstBodyThumbnailPath
        : postListThumbnailPath ?? firstBodyThumbnailPath

  const frontmatterValues: Record<FrontmatterFieldName, unknown> = {
    title: post.title,
    source: post.source,
    blogId: post.blogId,
    logNo: Number(post.logNo),
    publishedAt: post.publishedAt,
    category: category.name,
    categoryPath: category.path,
    editorVersion: parsedPost.editorVersion,
    visibility: "public",
    tags: parsedPost.tags,
    thumbnail: thumbnailPath,
    video: renderedVideos,
    warnings: unique(warnings),
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

  const bodySections = sections.filter(Boolean).join("\n\n").trim()
  const diagnosticsSection = buildDiagnosticsSection(diagnostics)
  const referenceSection = linkFormatter.renderReferenceSection()
  const body = [diagnosticsSection, bodySections, referenceSection].filter(Boolean).join("\n\n")

  const markdown = frontmatter
    ? `---\n${YAML.stringify(frontmatter)}---\n\n${body}\n`
    : `${body}\n`

  return {
    markdown,
    assetRecords,
    warnings: unique(warnings),
  }
}
