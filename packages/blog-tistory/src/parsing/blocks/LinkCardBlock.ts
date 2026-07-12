import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryLinkCardBlock extends TistoryParserBlock {
  readonly id = "linkCard"
  readonly label = "링크 카드"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "link-description",
        label: "썸네일·링크·설명",
        template:
          "{{ `${thumbnailUrl ? `![${title}](${thumbnailUrl})\\n` : ''}[${title}](${url})${description ? `\\n${description}` : ''}` }}",
      },
    ],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      description: { label: "설명", type: "string" },
      thumbnailUrl: { label: "썸네일 URL", type: "string?" },
    },
  } as const

  match({ $node }: TistoryParserBlockContext) {
    return (
      $node.attr("data-ke-type") === "opengraph" ||
      $node.hasClass("og-link") ||
      $node.hasClass("figure-og") ||
      $node.hasClass("oglink")
    )
  }

  convert({ $node, options }: TistoryParserBlockContext) {
    const $link = $node.find("a[href]").first()
    const rawUrl = $link.attr("href")?.trim()

    if (!rawUrl) {
      return []
    }

    const thumbnailUrl = $node.find("img").first().attr("src") ?? null
    const title =
      $node.find(".og-title, .title, strong").first().text().trim() ||
      $link.attr("title")?.trim() ||
      rawUrl
    const description = $node.find(".og-desc, .description, p").first().text().trim()

    return [
      {
        blockId: `tistory:${this.id}`,
        props: {
          title,
          url: options.resolveLinkUrl ? options.resolveLinkUrl(rawUrl) : rawUrl,
          description,
          thumbnailUrl,
        },
        ...(thumbnailUrl
          ? {
              assets: {
                thumbnailUrl: {
                  role: "thumbnail",
                  sourceUrl: thumbnailUrl,
                  required: false,
                } satisfies ParsedBlockAsset,
              },
            }
          : {}),
      } satisfies ParsedBlock,
    ]
  }
}
