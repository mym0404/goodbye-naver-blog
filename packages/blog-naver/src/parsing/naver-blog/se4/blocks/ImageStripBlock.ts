import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

import { parseImageLink, se4ImageLinkSelector } from "./util/ImageLink.js"

const imageStripTemplate =
  "{{ images.map(image => image.caption ? `![${image.alt}](${image.url})\\n${image.caption}` : `![${image.alt}](${image.url})`).join('\\n\\n') }}"

export class NaverSe4ImageStripBlock extends LeafParserBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-imageStrip")
  }

  override convert({ $node, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const images = $node
      .find(se4ImageLinkSelector)
      .toArray()
      .map((node) => parseImageLink($node.find(node)))
      .filter((image): image is NonNullable<typeof image> => image !== null)

    if (images.length === 0) {
      throw new Error("SE4 image strip block parsing failed.")
    }

    return [
      {
        blockId,
        props: {
          images: images.map((image) => ({
            url: image.sourceUrl,
            alt: image.alt,
            caption: image.caption,
          })),
        },
        assets: Object.fromEntries(
          images.map((image, index) => [
            `images.${index}.url`,
            {
              role: "image",
              sourceUrl: image.sourceUrl,
              required: true,
            } satisfies ParsedBlockAsset,
          ]),
        ),
      } satisfies ParsedBlock,
    ]
  }
}
