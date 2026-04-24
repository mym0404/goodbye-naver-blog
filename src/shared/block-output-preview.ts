import type {
  AstBlock,
  BlockOutputSelection,
  DividerBlockOutputSelection,
  ExportOptions,
  ImageBlockOutputSelection,
} from "./types.js"
import {
  composeSnippetWithReferences,
  createLinkFormatter,
  getDividerMarker,
  getHeadingLevelOffset,
  renderCodeBlock,
  renderFormula,
  renderGfmTable,
  renderImageBlockMarkdown,
  renderLinkCardBlock,
  renderParagraph,
  renderQuote,
} from "./block-markdown.js"

const toPreviewAssetPath = (sourceUrl: string) => {
  const pathname = (() => {
    try {
      return new URL(sourceUrl).pathname
    } catch {
      return sourceUrl
    }
  })()
  const filename = pathname.split("/").filter(Boolean).at(-1) || "image.png"

  return `../../public/${filename}`
}

const getPreviewImageReference = ({
  sourceUrl,
  imageHandlingMode,
}: {
  sourceUrl: string
  imageHandlingMode: ExportOptions["assets"]["imageHandlingMode"]
}) => (imageHandlingMode === "remote" ? sourceUrl : toPreviewAssetPath(sourceUrl))

const getPreviewSelection = ({
  block,
  fallbackSelection,
}: {
  block: AstBlock
  fallbackSelection?: BlockOutputSelection
}) => {
  if ("outputSelection" in block && block.outputSelection) {
    return block.outputSelection
  }

  return fallbackSelection
}

const getImagePreviewSelection = ({
  block,
  fallbackSelection,
}: {
  block: Extract<AstBlock, { type: "image" }>
  fallbackSelection?: BlockOutputSelection
}) => {
  const selection = getPreviewSelection({
    block,
    fallbackSelection,
  })

  if (!selection) {
    throw new Error("image preview selection is missing")
  }

  return selection as ImageBlockOutputSelection
}

const getDividerPreviewSelection = ({
  block,
  fallbackSelection,
}: {
  block: Extract<AstBlock, { type: "divider" }>
  fallbackSelection?: BlockOutputSelection
}) => {
  const selection = getPreviewSelection({
    block,
    fallbackSelection,
  })

  if (!selection) {
    throw new Error("divider preview selection is missing")
  }

  return selection as DividerBlockOutputSelection
}

const renderResolvedPreviewBlock = ({
  block,
  fallbackSelection,
  includeImageCaptions,
  imageHandlingMode,
  linkFormatter,
}: {
  block: AstBlock
  fallbackSelection?: BlockOutputSelection
  includeImageCaptions: boolean
  imageHandlingMode: ExportOptions["assets"]["imageHandlingMode"]
  linkFormatter: ReturnType<typeof createLinkFormatter>
}) => {
  if (block.type === "paragraph") {
    return renderParagraph(block.text)
  }

  if (block.type === "divider") {
    return getDividerMarker(
      getDividerPreviewSelection({
        block,
        fallbackSelection,
      }),
    )
  }

  if (block.type === "image") {
    return renderImageBlockMarkdown({
      image: block.image,
      assetPath: getPreviewImageReference({
        sourceUrl: block.image.sourceUrl,
        imageHandlingMode,
      }),
      selection: getImagePreviewSelection({
        block,
        fallbackSelection,
      }),
      formatLink: linkFormatter.formatLink,
      includeImageCaptions,
    })
  }

  if (block.type === "video") {
    return linkFormatter.formatLink({
      label: block.video.title || block.video.sourceUrl,
      url: block.video.sourceUrl,
    })
  }

  if (block.type === "linkCard") {
    return renderLinkCardBlock({
      block,
      formatLink: linkFormatter.formatLink,
    })
  }

  throw new Error(`unsupported preview block type: ${block.type}`)
}

export const renderResolvedBlocksPreview = ({
  blocks,
  linkStyle,
  includeImageCaptions,
  imageHandlingMode,
}: {
  blocks: AstBlock[]
  linkStyle: ExportOptions["markdown"]["linkStyle"]
  includeImageCaptions: boolean
  imageHandlingMode: ExportOptions["assets"]["imageHandlingMode"]
}) => {
  const linkFormatter = createLinkFormatter({
    style: linkStyle,
  })
  const body = blocks
    .map((block) =>
      renderResolvedPreviewBlock({
        block,
        includeImageCaptions,
        imageHandlingMode,
        linkFormatter,
      }),
    )
    .filter(Boolean)
    .join("\n\n")

  return composeSnippetWithReferences({
    body,
    linkFormatter,
  })
}

export const renderBlockOutputPreview = ({
  block,
  selection,
  linkStyle,
  includeImageCaptions,
  imageHandlingMode,
}: {
  block: AstBlock
  selection: BlockOutputSelection
  linkStyle: ExportOptions["markdown"]["linkStyle"]
  includeImageCaptions: boolean
  imageHandlingMode: ExportOptions["assets"]["imageHandlingMode"]
}) => {
  const linkFormatter = createLinkFormatter({
    style: linkStyle,
  })

  if (block.type === "paragraph") {
    return renderParagraph(block.text)
  }

  if (block.type === "heading") {
    const headingSelection = selection as BlockOutputSelection<"heading">
    const adjustedLevel = Math.min(
      Math.max(block.level + getHeadingLevelOffset(headingSelection), 1),
      6,
    )

    return `${"#".repeat(adjustedLevel)} ${block.text}`
  }

  if (block.type === "quote") {
    return renderQuote(block.text)
  }

  if (block.type === "divider") {
    return getDividerMarker(
      getDividerPreviewSelection({
        block,
        fallbackSelection: selection,
      }),
    )
  }

  if (block.type === "code") {
    return renderCodeBlock({
      language: block.language,
      code: block.code,
      variant: selection.variant,
    })
  }

  if (block.type === "formula") {
    const formulaSelection = selection as BlockOutputSelection<"formula">

    return renderFormula({
      formula: block.formula,
      display: block.display,
      selection: formulaSelection,
    })
  }

  if (block.type === "image") {
    return composeSnippetWithReferences({
      body: renderImageBlockMarkdown({
        image: block.image,
        assetPath: getPreviewImageReference({
          sourceUrl: block.image.sourceUrl,
          imageHandlingMode,
        }),
        selection: getImagePreviewSelection({
          block,
          fallbackSelection: selection,
        }),
        formatLink: linkFormatter.formatLink,
        includeImageCaptions,
      }),
      linkFormatter,
    })
  }

  if (block.type === "imageGroup") {
    const imageSelection = selection as BlockOutputSelection<"image">

    return composeSnippetWithReferences({
      body: block.images
        .map((image) =>
          renderImageBlockMarkdown({
            image,
            assetPath: getPreviewImageReference({
              sourceUrl: image.sourceUrl,
              imageHandlingMode,
            }),
            selection: imageSelection,
            formatLink: linkFormatter.formatLink,
            includeImageCaptions,
          }),
        )
        .join("\n\n"),
      linkFormatter,
    })
  }

  if (block.type === "video") {
    return composeSnippetWithReferences({
      body: linkFormatter.formatLink({
        label: block.video.title || block.video.sourceUrl,
        url: block.video.sourceUrl,
      }),
      linkFormatter,
    })
  }

  if (block.type === "linkCard") {
    return composeSnippetWithReferences({
      body: renderLinkCardBlock({
        block,
        formatLink: linkFormatter.formatLink,
      }),
      linkFormatter,
    })
  }

  if (block.type === "table") {
    const tableSelection = selection as BlockOutputSelection<"table">

    return tableSelection.variant === "html-only" ? block.html : renderGfmTable(block)
  }

  return ""
}
