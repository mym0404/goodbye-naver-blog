import type { AnyNode } from "domhandler"
import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown, sanitizeHtmlFragment } from "../converter/html-fragment-converter.js"
import type { AstBlock, ExportOptions, ImageData, ParsedPost } from "../../shared/types.js"
import { compactText, normalizeAssetUrl, unique } from "../../shared/utils.js"
import { parseHtmlTable } from "./table-parser.js"

const standaloneImageSelector = "img, [thumburl]"
const nestedBlockTags = new Set([
  "p",
  "div",
  "table",
  "blockquote",
  "hr",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
])

const getStandaloneImages = ({
  $,
  element,
}: {
  $: CheerioAPI
  element: ReturnType<CheerioAPI>
}) => {
  const images = $(element)
    .find(standaloneImageSelector)
    .toArray()
    .map((imageNode): ImageData | null => {
      const $image = $(imageNode)
      const sourceUrl = normalizeAssetUrl($image.attr("src") ?? $image.attr("thumburl") ?? "")

      if (!sourceUrl) {
        return null
      }

      return {
        sourceUrl,
        originalSourceUrl: null,
        alt: $image.attr("alt") ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData
    })
    .filter((image): image is ImageData => image !== null)

  const textWithoutImages = compactText(
    $(element)
      .clone()
      .find(standaloneImageSelector)
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
}

const shouldTraverseNestedBlocks = ({
  element,
  tagName,
}: {
  element: ReturnType<CheerioAPI>
  tagName: string
}) => {
  if (tagName !== "div") {
    return false
  }

  const childNodes = element.contents().toArray()
  const hasMeaningfulDirectText = childNodes.some(
    (node) => node.type === "text" && compactText(node.data ?? "") !== "",
  )

  if (hasMeaningfulDirectText) {
    return false
  }

  return childNodes.some(
    (node) => node.type === "tag" && nestedBlockTags.has(node.tagName.toLowerCase()),
  )
}

const isSpacerBlock = ({
  element,
  tagName,
}: {
  element: ReturnType<CheerioAPI>
  tagName: string
}) => {
  if (tagName !== "p" && tagName !== "div") {
    return false
  }

  const clone = element.clone()

  clone.find("br").remove()

  if (clone.find("img,iframe,video,table").length > 0) {
    return false
  }

  return compactText(clone.text()) === ""
}

const parseSingleColumnTableAsParagraphs = ({
  parsedTable,
  options,
}: {
  parsedTable: ReturnType<typeof parseHtmlTable>
  options: Pick<ExportOptions, "markdown">
}) => {
  const isSingleColumn =
    !parsedTable.complex &&
    parsedTable.rows.length > 0 &&
    parsedTable.rows.every(
      (row) => row.length === 1 && row[0]?.colspan === 1 && row[0]?.rowspan === 1,
    )

  if (!isSingleColumn) {
    return null
  }

  const paragraphs = parsedTable.rows
    .map((row) =>
      convertHtmlToMarkdown({
        html: row[0]?.html ?? "",
        options,
      }),
    )
    .map((text) => text.trim())
    .filter(Boolean)
    .map(
      (text) =>
        ({
          type: "paragraph",
          text,
        }) satisfies AstBlock,
    )

  return paragraphs.length > 0 ? paragraphs : null
}

const parseBookWidgetBlocks = ({
  element,
}: {
  element: ReturnType<CheerioAPI>
}) => {
  const bookWidget = element.is('[s_type="db"][s_subtype="book"]') ? element : null

  if (!bookWidget || bookWidget.length === 0) {
    return null
  }

  const blocks: AstBlock[] = []
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
      },
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
      text: `[${reviewLabel}](${reviewUrl})`,
    })
  }

  return blocks.length > 0 ? blocks : null
}

export const parseSe2Post = ({
  $,
  tags,
  options,
}: {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown">
}) => {
  const warnings: string[] = []
  const blocks: AstBlock[] = []
  const container = $("#viewTypeSelector").first()

  const appendBlocksFromNode = (node: AnyNode) => {
    if (node.type === "text") {
      const text = compactText(node.data ?? "")

      if (text) {
        blocks.push({ type: "paragraph", text })
      }
      return
    }

    if (node.type !== "tag") {
      return
    }

    const element = $(node)
    const tagName = node.tagName.toLowerCase()
    const bookWidgetBlocks = parseBookWidgetBlocks({ element })

    if (bookWidgetBlocks) {
      blocks.push(...bookWidgetBlocks)
      return
    }

    if (shouldTraverseNestedBlocks({ element, tagName })) {
      element.contents().toArray().forEach(appendBlocksFromNode)
      return
    }

    const standaloneImages = getStandaloneImages({ $, element })

    if (tagName === "table") {
      const parsedTable = parseHtmlTable({ $, table: element })

      const flattenedTable = parseSingleColumnTableAsParagraphs({
        parsedTable,
        options,
      })

      if (flattenedTable) {
        blocks.push(...flattenedTable)
        return
      }

      blocks.push({
        type: "table",
        rows: parsedTable.rows,
        html: parsedTable.html,
        complex: parsedTable.complex,
      })
      return
    }

    if (tagName === "hr") {
      blocks.push({ type: "divider" })
      return
    }

    if (tagName === "blockquote") {
      const markdown = convertHtmlToMarkdown({
        html: element.html() ?? "",
        options,
      })

      if (markdown) {
        blocks.push({ type: "quote", text: markdown })
      }
      return
    }

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName[1])
      const text = compactText(
        convertHtmlToMarkdown({
          html: element.html() ?? "",
          options,
        }),
      )

      if (text) {
        blocks.push({ type: "heading", level, text })
      }
      return
    }

    if (tagName === "pre") {
      const code = element.text().trimEnd()

      if (code) {
        blocks.push({ type: "code", language: null, code })
      }
      return
    }

    if (standaloneImages.length === 1) {
      blocks.push({ type: "image", image: standaloneImages[0] })
      return
    }

    if (standaloneImages.length > 1) {
      blocks.push({ type: "imageGroup", images: standaloneImages })
      return
    }

    if (isSpacerBlock({ element, tagName })) {
      return
    }

    const html = sanitizeHtmlFragment($.html(element) ?? "")
    const markdown = convertHtmlToMarkdown({
      html,
      options,
    })

    if (markdown) {
      blocks.push({ type: "paragraph", text: markdown })
      return
    }

    if (!html) {
      return
    }

    const text = compactText(element.text())

    if (text) {
      warnings.push(`SE2 블록을 구조화하지 못해 텍스트로 축약했습니다: <${tagName}>`)
      blocks.push({
        type: "paragraph",
        text,
      })
      return
    }

    warnings.push(`SE2 블록을 해석하지 못해 raw HTML로 남겼습니다: <${tagName}>`)
    blocks.push({
      type: "rawHtml",
      html,
      reason: `se2:${tagName}`,
    })
  }

  container.contents().toArray().forEach(appendBlocksFromNode)

  const videos = blocks
    .filter((block): block is Extract<AstBlock, { type: "video" }> => block.type === "video")
    .map((block) => block.video)

  return {
    editorVersion: 2,
    tags: unique(tags),
    blocks,
    warnings: unique(warnings),
    videos,
  } satisfies ParsedPost
}
