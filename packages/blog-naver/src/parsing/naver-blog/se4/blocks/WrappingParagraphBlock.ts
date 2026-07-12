import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createImageBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { parseTextBlocks } from "./TextBlock.js"
import { parseImageLink, se4ImageLinkSelector } from "./util/ImageLink.js"

const wrappingParagraphLayoutClasses = [
  "se-l-inner-big-left",
  "se-l-inner-big-right",
  "se-l-inner-left",
  "se-l-inner-right",
]

export class NaverSe4WrappingParagraphBlock extends LeafParserBlock {
  override readonly id = "wrappingParagraph"
  override readonly label = "감싸는 문단"
  override readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "children", label: "하위 블록", template: "" }],
    props: {},
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return (
      $node.hasClass("se-wrappingParagraph") &&
      wrappingParagraphLayoutClasses.some((className) => $node.hasClass(className))
    )
  }

  override convert({ $, $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const $imageSlot = $node.find(".se-component-slot-float").first()
    const imageBlocks = []
    const imageBlockId = blockId
      .replace(/:wrappingParagraph$/, ":image")
      .replace(/^wrappingParagraph$/, "image")
    const paragraphBlockId = blockId
      .replace(/:wrappingParagraph$/, ":paragraph")
      .replace(/^wrappingParagraph$/, "paragraph")

    if ($imageSlot.length > 0) {
      const image = parseImageLink($imageSlot.find(se4ImageLinkSelector).first())

      if (!image) {
        throw new Error("SE4 wrapping paragraph image parsing failed.")
      }

      const imageBlock = createImageBlock({ blockId: imageBlockId, image, options })

      if (imageBlock) {
        imageBlocks.push(imageBlock)
      }
    }

    const $textSlot = $node.find(".se-component-slot").not(".se-component-slot-float").first()
    const textBlocks =
      $textSlot.length > 0
        ? parseTextBlocks({
            $,
            $node: $textSlot,
            blockId: paragraphBlockId,
            options,
          })
        : []

    return [...imageBlocks, ...textBlocks]
  }
}
