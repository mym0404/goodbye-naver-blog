import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

const imageSelector = "img[src], img[data-src], img[data-url], img[data-origin-url]"

export class TistoryImageBlock extends TistoryParserBlock {
  readonly id = "image"
  readonly label = "이미지"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "image-markdown",
        label: "이미지 Markdown",
        template:
          "{{ images.map(image => image.caption ? `![${image.alt}](${image.url})\\n${image.caption}` : `![${image.alt}](${image.url})`).join('\\n\\n') }}",
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
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    if (node.type !== "tag") {
      return false
    }

    const tag = node.tagName.toLowerCase()
    const keType = $node.attr("data-ke-type")
    const knownWrapper =
      tag === "figure" ||
      keType === "image" ||
      keType === "imageGroup" ||
      $node.hasClass("imageblock") ||
      $node.hasClass("image-container") ||
      $node.hasClass("imagegridblock")

    if (tag === "img") {
      return true
    }

    if (knownWrapper && $node.find(imageSelector).length > 0) {
      return true
    }

    return (
      (tag === "a" || tag === "p") && $node.find(imageSelector).length > 0 && !$node.text().trim()
    )
  }

  convert({ $, $node, node }: TistoryParserBlockContext) {
    const imageNodes =
      node.type === "tag" && node.tagName === "img" ? [node] : $node.find(imageSelector).toArray()
    const caption = $node.find("figcaption, .cap1, .image-caption").first().text().trim() || null
    const images = imageNodes.flatMap((image, index) => {
      const $image = $(image)
      const url =
        $image.attr("data-origin-url") ??
        $image.attr("data-url") ??
        $image.attr("data-src") ??
        $image.attr("src")

      return url ? [{ index, value: { url, alt: $image.attr("alt")?.trim() ?? "", caption } }] : []
    })

    if (images.length === 0) {
      return []
    }

    return [
      {
        blockId: `tistory:${this.id}`,
        props: { images: images.map(({ value }) => value) },
        assets: Object.fromEntries(
          images.map(({ index, value }) => [
            `images.${index}.url`,
            { role: "image", sourceUrl: value.url, required: true } satisfies ParsedBlockAsset,
          ]),
        ),
      } satisfies ParsedBlock,
    ]
  }
}
