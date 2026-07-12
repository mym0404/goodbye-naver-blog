import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseJsonAttribute } from "../../core/JsonAttribute.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot } from "./util/ComponentBoundary.js"

export class NaverSe3LinkCardBlock extends LeafParserBlock {
  override readonly id = "linkCard"
  override readonly label = "링크 카드"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "card",
        label: "썸네일·링크·설명",
        template:
          "{{ `${thumbnailUrl ? `![${title}](${thumbnailUrl})\\n` : ''}[${title}](${url})${description ? `\\n${description}` : ''}` }}",
      },
      { id: "link", label: "링크만", template: "{{ `[${title}](${url})` }}" },
      {
        id: "link-description",
        label: "링크와 설명만",
        template:
          "{{ description ? `[${title}](${url})\\n${description}` : `[${title}](${url})` }}",
      },
      {
        id: "thumbnail-link",
        label: "썸네일과 링크만",
        template:
          "{{ thumbnailUrl ? `![${title}](${thumbnailUrl})\\n[${title}](${url})` : `[${title}](${url})` }}",
      },
    ],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      description: { label: "설명", type: "string" },
      thumbnailUrl: { label: "썸네일 URL", type: "string?" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se_oglink")
  }

  override convert({ $, $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const linkNode = findInComponentRoot({ $, $component: $node, selector: "a.se_og_box" }).first()
    const linkData = parseJsonAttribute(linkNode.attr("data-linkdata"))
    const url = linkNode.attr("href") ?? (typeof linkData?.link === "string" ? linkData.link : "")

    if (!url) {
      throw new Error("SE3 link card block parsing failed.")
    }

    const thumbnail = findInComponentRoot({
      $,
      $component: $node,
      selector: ".se_og_thumb img",
    }).first()
    const title = compactText(
      findInComponentRoot({ $, $component: $node, selector: ".se_og_tit" }).first().text(),
    )
    const description = findInComponentRoot({ $, $component: $node, selector: ".se_og_desc" })
      .first()
      .text()

    const thumbnailUrl = thumbnail.attr("data-lazy-src") ?? thumbnail.attr("src") ?? null

    return [
      {
        blockId,
        props: {
          title: title || url,
          description: compactText(description),
          url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
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
