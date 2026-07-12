import { normalizeAssetUrl } from "@exitpress/blog-naver/NaverUrl.js"
import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ImageData } from "@exitpress/domain/parser/schema/Media.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createImageBlock, createParagraphBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot } from "./util/ComponentBoundary.js"

export class NaverSe3SubjectMatterBlock extends LeafParserBlock {
  override readonly id = "subjectMatter"
  override readonly label = "소재 카드"
  override readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "children", label: "하위 블록", template: "" }],
    props: {},
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se_subjectMatter") && $node.hasClass("subjectMatter_book")
  }

  override convert({ $, $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const blocks = []
    const imageBlockId = blockId
      .replace(/:subjectMatter$/, ":image")
      .replace(/^subjectMatter$/, "image")
    const paragraphBlockId = blockId
      .replace(/:subjectMatter$/, ":paragraph")
      .replace(/^subjectMatter$/, "paragraph")
    const imageNode = findInComponentRoot({
      $,
      $component: $node,
      selector: ".subjectMatter_thumb img",
    }).first()
    const imageSource = imageNode.attr("data-lazy-src") ?? imageNode.attr("src")

    if (imageSource?.trim()) {
      const imageBlock = createImageBlock({
        blockId: imageBlockId,
        options,
        image: {
          sourceUrl: normalizeAssetUrl(imageSource),
          originalSourceUrl: null,
          alt: imageNode.attr("alt")?.trim() ?? "",
          caption: null,
          mediaKind: "image",
        } satisfies ImageData,
      })

      if (imageBlock) {
        blocks.push(imageBlock)
      }
    }

    const title = compactText(
      findInComponentRoot({ $, $component: $node, selector: ".subjectMatter_title_text" })
        .first()
        .text(),
    )
    const details = findInComponentRoot({
      $,
      $component: $node,
      selector: ".subjectMatter_info_item",
    })
      .toArray()
      .map((node) => {
        const detailNode = $(node)
        const label = compactText(detailNode.find(".subjectMatter_info_title").first().text())
        const value = compactText(detailNode.find(".subjectMatter_info_text").first().text())

        if (!label || !value) {
          return null
        }

        return `${label}: ${value}`
      })
      .filter((detail): detail is string => detail !== null)
    const summaryLines = [title ? `**${title}**` : "", ...details].filter(Boolean)

    if (summaryLines.length > 0) {
      blocks.push(
        createParagraphBlock({ blockId: paragraphBlockId, text: summaryLines.join("  \n") }),
      )
    }

    const detailLink = findInComponentRoot({
      $,
      $component: $node,
      selector: "a.subjectMatter_item_link",
    }).first()
    const detailUrl = detailLink.attr("href")?.trim()

    if (detailUrl) {
      const label = compactText(detailLink.text()) || "상세보기"
      const url = options.resolveLinkUrl ? options.resolveLinkUrl(detailUrl) : detailUrl

      blocks.push(createParagraphBlock({ blockId: paragraphBlockId, text: `[${label}](${url})` }))
    }

    if (blocks.length === 0) {
      throw new Error("SE3 subject matter block parsing failed.")
    }

    return blocks
  }
}
