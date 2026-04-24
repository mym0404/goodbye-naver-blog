import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown } from "../../../converter/html-fragment-converter.js"
import type { ParserBlock } from "../parser-node.js"
import type { ImageData, StructuredAstBlock } from "../../../../shared/types.js"
import { compactText, normalizeAssetUrl } from "../../../../shared/utils.js"

const parseBookWidgetBlocks = ({
  element,
  resolveLinkUrl,
}: {
  element: ReturnType<CheerioAPI>
  resolveLinkUrl?: (url: string) => string
}) => {
  const bookWidget = element.is('[s_type="db"][s_subtype="book"]') ? element : null

  if (!bookWidget || bookWidget.length === 0) {
    return null
  }

  const blocks: StructuredAstBlock[] = []
  const imageNode = bookWidget.find("img").first()
  const imageSource = imageNode.attr("src")?.trim()

  if (imageSource) {
    blocks.push({
      type: "image",
      image: {
        sourceUrl: normalizeAssetUrl(imageSource),
        originalSourceUrl: null,
        alt: imageNode.attr("alt")?.trim() ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData,
    })
  }

  const title =
    compactText(bookWidget.find("strong.tit").first().text()) ||
    compactText(bookWidget.find("p a.con_link").first().text())
  const detailLines = bookWidget
    .find("dl")
    .first()
    .children()
    .toArray()
    .map((node) => {
      const child = bookWidget.find(node)
      const tagName = node.tagName?.toLowerCase()
      const text = compactText(child.text())

      if (!text || (tagName !== "dt" && tagName !== "dd")) {
        return null
      }

      return text
    })
    .filter((text): text is string => Boolean(text))
  const summaryLines = [title ? `**${title}**` : "", ...detailLines].filter(Boolean)

  if (summaryLines.length > 0) {
    blocks.push({
      type: "paragraph",
      text: summaryLines.join("  \n"),
    })
  }

  const reviewLink = bookWidget.find("a.link, a.con_link").last()
  const reviewUrl = reviewLink.attr("href")?.trim() ?? ""
  const reviewLabel = compactText(reviewLink.text()) || "리뷰보기"

  if (reviewUrl) {
    blocks.push({
      type: "paragraph",
      text: `[${reviewLabel}](${resolveLinkUrl ? resolveLinkUrl(reviewUrl) : reviewUrl})`,
    })
  }

  return blocks.length > 0 ? blocks : null
}

export const se2TextNodeBlock: ParserBlock = {
  id: "se2-text-node",
  kind: "leaf",
  match: ({ node }) => node.type === "text",
  convert: ({ node }) => {
    const text = node.type === "text" ? compactText(node.data ?? "") : ""

    return text
      ? {
          status: "handled",
          blocks: [{ type: "paragraph", text }],
        }
      : { status: "skip" }
  },
}

export const se2BookWidgetBlock: ParserBlock = {
  id: "se2-book-widget",
  kind: "leaf",
  match: ({ node, $node }) => node.type === "tag" && $node.is('[s_type="db"][s_subtype="book"]'),
  convert: ({ $node, options }) => {
    const blocks = parseBookWidgetBlocks({
      element: $node,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return blocks ? { status: "handled", blocks } : { status: "skip" }
  },
}

export const se2TextElementBlock: ParserBlock = {
  id: "se2-text-element",
  kind: "leaf",
  match: ({ node, $node }) => {
    if (node.type !== "tag") {
      return false
    }

    if (compactText($node.text()) === "") {
      return false
    }

    return !["table", "hr", "br", "blockquote", "pre"].includes(node.tagName.toLowerCase())
  },
  convert: ({ $, $node, node, options }) => {
    if (node.type !== "tag") {
      return { status: "skip" }
    }

    const html = $.html($node) ?? ""
    const markdown = convertHtmlToMarkdown({
      html,
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    if (markdown) {
      return {
        status: "handled",
        blocks: [{ type: "paragraph", text: markdown }],
      }
    }

    const text = compactText($node.text())

    return text
      ? {
          status: "handled",
          blocks: [{ type: "paragraph", text }],
          warnings: [`SE2 블록을 구조화하지 못해 텍스트로 축약했습니다: <${node.tagName.toLowerCase()}>`],
        }
      : { status: "skip" }
  },
}
