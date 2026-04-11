import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown, sanitizeHtmlFragment } from "../converter/html-fragment-converter.js"
import type { AstBlock, ExportOptions, ImageData, ParsedPost } from "../../shared/types.js"
import { compactText, unique } from "../../shared/utils.js"
import { parseHtmlTable } from "./table-parser.js"

const getStandaloneImages = ({
  $,
  element,
}: {
  $: CheerioAPI
  element: ReturnType<CheerioAPI>
}) => {
  const images = $(element)
    .find("img")
    .toArray()
    .map((imageNode): ImageData | null => {
      const $image = $(imageNode)
      const sourceUrl = $image.attr("src") ?? ""

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
      .find("img")
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
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

  container.contents().toArray().forEach((node) => {
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
  })

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
