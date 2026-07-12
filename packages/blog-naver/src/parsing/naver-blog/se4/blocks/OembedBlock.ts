import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"
import { load } from "cheerio"

import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { UnknownRecord } from "@exitpress/engine/shared/object/UnknownRecord.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4OembedBlock extends LeafParserBlock {
  override readonly id = "oembed"
  override readonly label = "임베드"
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
    ],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      description: { label: "설명", type: "string" },
      thumbnailUrl: { label: "썸네일 URL", type: "string?" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_oembed" || $node.hasClass("se-oembed")
  }

  override convert({ moduleData, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const data = (moduleData?.data ?? {}) as UnknownRecord & {
      html?: string
      inputUrl?: string
      thumbnailUrl?: string
      description?: string
      title?: string
      providerUrl?: string
    }
    const iframeUrl =
      typeof data.html === "string" && data.html
        ? (load(data.html)("iframe").attr("src") ?? null)
        : null
    const url = data.inputUrl ?? iframeUrl ?? data.providerUrl ?? ""

    if (!url) {
      throw new Error("SE4 oEmbed block parsing failed.")
    }

    const thumbnailUrl =
      typeof data.thumbnailUrl === "string" && data.thumbnailUrl ? data.thumbnailUrl : null

    return [
      {
        blockId,
        props: {
          title: compactText(data.title ?? "") || url,
          description: compactText(data.description ?? ""),
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
