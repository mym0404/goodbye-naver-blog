import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

const normalizeDescription = ({ description, url }: { description: string; url: string }) =>
  description
    .split("\n")
    .map((line) => compactText(line))
    .filter(Boolean)
    .filter((line) => line !== url && !/^[()]+$/.test(line))
    .join("\n")

export class NaverSe4LinkCardBlock extends LeafParserBlock {
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

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_oglink" || $node.hasClass("se-oglink")
  }

  override convert({ $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const infoNode = $node.find(".se-oglink-info")
    const url = infoNode.attr("href") ?? $node.find(".se-oglink-thumbnail").attr("href") ?? ""

    if (!url) {
      throw new Error("SE4 link card block parsing failed.")
    }

    const thumbnailUrl = $node.find(".se-oglink-thumbnail-resource").attr("src") ?? null

    return [
      {
        blockId,
        props: {
          title: compactText($node.find(".se-oglink-title").text()) || url,
          description: normalizeDescription({
            description: $node.find(".se-oglink-summary").text(),
            url,
          }),
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
