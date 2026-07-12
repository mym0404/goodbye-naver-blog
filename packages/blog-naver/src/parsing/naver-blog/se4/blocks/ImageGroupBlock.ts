import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

import { parseImageLink, se4ImageLinkSelector } from "./util/ImageLink.js"

const imageGroupTemplate =
  "{{ images.map(image => image.caption ? `![${image.alt}](${image.url})\\n${image.caption}` : `![${image.alt}](${image.url})`).join('\\n\\n') }}"

export class NaverSe4ImageGroupBlock extends LeafParserBlock {
  override readonly id = "imageGroup"
  override readonly label = "이미지 그룹"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "gallery-markdown",
        label: "이미지 마크다운",
        template: imageGroupTemplate,
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

  override match({ moduleType }: ParserBlockContext) {
    return moduleType === "v2_imageGroup"
  }

  override convert({ $node, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const images = $node
      .find(se4ImageLinkSelector)
      .toArray()
      .map((node) => parseImageLink($node.find(node)))
      .filter((image): image is NonNullable<typeof image> => image !== null)

    if (images.length === 0) {
      throw new Error("SE4 image group block parsing failed.")
    }

    const renderedImages = images.flatMap((image, index) => {
      const sourceUrl = image.sourceUrl

      if (!sourceUrl) {
        return []
      }

      return [
        {
          index,
          value: {
            url: sourceUrl,
            alt: image.alt,
            caption: image.caption,
          },
        },
      ]
    })

    if (renderedImages.length === 0) {
      throw new Error("SE4 image group block parsing failed.")
    }

    return [
      {
        blockId,
        props: {
          images: renderedImages.map(({ value }) => value),
        },
        assets: Object.fromEntries(
          renderedImages.map(({ index, value }) => [
            `images.${index}.url`,
            {
              role: "image",
              sourceUrl: value.url,
              required: true,
            } satisfies ParsedBlockAsset,
          ]),
        ),
      } satisfies ParsedBlock,
    ]
  }
}
