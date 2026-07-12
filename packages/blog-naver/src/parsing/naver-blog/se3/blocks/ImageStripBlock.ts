import { normalizeAssetUrl } from "@exitpress/blog-naver/NaverUrl.js"

import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createParagraphBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot, textOutsideNestedComponents } from "./util/ComponentBoundary.js"

const imageStripTemplate =
  "{{ images.map(image => image.caption ? `![${image.alt}](${image.url})\\n${image.caption}` : `![${image.alt}](${image.url})`).join('\\n\\n') }}"
const toParagraphBlockId = (blockId: string) =>
  blockId.replace(/:imageStrip$/, ":paragraph").replace(/^imageStrip$/, "paragraph")

export class NaverSe3ImageStripBlock extends LeafParserBlock {
  override readonly id = "imageStrip"
  override readonly label = "이미지 스트립"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "strip-markdown",
        label: "이미지 마크다운",
        template: imageStripTemplate,
      },
    ],
    props: {
      images: {
        label: "이미지 목록",
        type: "array",
        items: {
          label: "이미지",
          type: "object",
          properties: {
            url: { label: "URL", type: "string" },
            alt: { label: "대체 텍스트", type: "string" },
            caption: { label: "캡션", type: "string?" },
          },
        },
      },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $, $node }: ParserBlockContext) {
    return (
      $node.hasClass("se_imageStrip") &&
      findInComponentRoot({ $, $component: $node, selector: "img" }).length > 0
    )
  }

  override convert({ $, $node, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const images = findInComponentRoot({ $, $component: $node, selector: "img" })
      .toArray()
      .flatMap((node) => {
        const $image = $(node)
        const sourceUrl = $image.attr("data-lazy-src") ?? $image.attr("src") ?? ""

        if (!sourceUrl.trim()) {
          return []
        }

        return [
          {
            url: normalizeAssetUrl(sourceUrl),
            alt: $image.attr("alt") ?? "",
            caption: null,
          },
        ]
      })

    if (images.length === 0) {
      throw new Error("SE3 image strip block parsing failed.")
    }

    const text = textOutsideNestedComponents({
      $component: $node,
      selector: "img",
    })
    const blocks: ParsedBlock[] = [
      {
        blockId,
        props: {
          images,
        },
        assets: Object.fromEntries(
          images.map((image, index) => [
            `images.${index}.url`,
            {
              role: "image",
              sourceUrl: image.url,
              required: true,
            } satisfies ParsedBlockAsset,
          ]),
        ),
      } satisfies ParsedBlock,
    ]

    if (text) {
      blocks.push(createParagraphBlock({ blockId: toParagraphBlockId(blockId), text }))
    }

    return blocks
  }
}
