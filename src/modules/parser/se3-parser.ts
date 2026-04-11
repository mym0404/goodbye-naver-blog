import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown, sanitizeHtmlFragment } from "../converter/html-fragment-converter.js"
import type { AstBlock, ExportOptions, ImageData, ParsedPost } from "../../shared/types.js"
import { compactText, normalizeAssetUrl, unique } from "../../shared/utils.js"
import { parseHtmlTable } from "./table-parser.js"

const parseTextBlocks = ({
  $,
  $component,
  options,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown">
}) =>
  $component
    .find(".se_textarea")
    .toArray()
    .map((node) =>
      convertHtmlToMarkdown({
        html: $(node).html() ?? "",
        options,
      }),
    )
    .map((text) => compactText(text))
    .filter(Boolean)
    .map(
      (text) =>
        ({
          type: "paragraph",
          text,
        }) satisfies AstBlock,
    )

const getStandaloneImages = ({
  $,
  $component,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
}) => {
  const images = $component
    .find("img")
    .toArray()
    .map((node): ImageData | null => {
      const $image = $(node)
      const sourceUrl = $image.attr("data-lazy-src") ?? $image.attr("src") ?? ""

      if (!sourceUrl.trim()) {
        return null
      }

      return {
        sourceUrl: normalizeAssetUrl(sourceUrl),
        originalSourceUrl: null,
        alt: $image.attr("alt") ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData
    })
    .filter((image): image is ImageData => image !== null)

  const textWithoutImages = compactText(
    $component
      .clone()
      .find("img")
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
}

export const parseSe3Post = ({
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
  const container = $("#viewTypeSelector .se_component_wrap.sect_dsc").first()

  container.children(".se_component").toArray().forEach((node) => {
    const $component = $(node)
    const standaloneImages = getStandaloneImages({ $, $component })
    const table = $component.find("table").first()
    const blockquote = $component.find("blockquote").first()
    const pre = $component.find("pre").first()

    if ($component.hasClass("se_documentTitle")) {
      return
    }

    if (table.length > 0) {
      const parsedTable = parseHtmlTable({ $, table })
      blocks.push({
        type: "table",
        rows: parsedTable.rows,
        html: parsedTable.html,
        complex: parsedTable.complex,
      })
      return
    }

    if (blockquote.length > 0) {
      const markdown = convertHtmlToMarkdown({
        html: blockquote.html() ?? "",
        options,
      })

      if (markdown) {
        blocks.push({
          type: "quote",
          text: markdown,
        })
      }
      return
    }

    if (pre.length > 0) {
      const code = pre.text().trimEnd()

      if (code) {
        blocks.push({
          type: "code",
          language: null,
          code,
        })
      }
      return
    }

    if (standaloneImages.length === 1) {
      blocks.push({
        type: "image",
        image: standaloneImages[0],
      })
      return
    }

    if (standaloneImages.length > 1) {
      blocks.push({
        type: "imageGroup",
        images: standaloneImages,
      })
      return
    }

    const textBlocks = parseTextBlocks({
      $,
      $component,
      options,
    })

    if (textBlocks.length > 0) {
      blocks.push(...textBlocks)
      return
    }

    const markdown = convertHtmlToMarkdown({
      html: sanitizeHtmlFragment($.html($component) ?? ""),
      options,
    })

    if (markdown) {
      warnings.push(`SE3 블록을 구조화하지 못해 텍스트로 변환했습니다: ${$component.attr("class") ?? "unknown"}`)
      blocks.push({
        type: "paragraph",
        text: markdown,
      })
      return
    }

    warnings.push(`SE3 블록을 해석하지 못해 건너뛰었습니다: ${$component.attr("class") ?? "unknown"}`)
  })

  return {
    editorVersion: 3,
    tags: unique(tags),
    blocks,
    warnings: unique(warnings),
    videos: [],
  } satisfies ParsedPost
}
