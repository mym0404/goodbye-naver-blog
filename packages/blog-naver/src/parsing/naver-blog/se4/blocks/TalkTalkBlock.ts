import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4TalkTalkBlock extends LeafParserBlock {
  override readonly id = "talkTalk"
  override readonly label = "톡톡 링크"
  override readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "link", label: "링크", template: "{{ `[${title}](${url})` }}" }],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-talktalk")
  }

  override convert({ $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const talkTalkLink = $node.find("a.se-module-talktalk").first()
    const url = talkTalkLink.attr("href") ?? ""

    if (!url) {
      throw new Error("SE4 TalkTalk block parsing failed.")
    }

    return [
      {
        blockId,
        props: {
          title: compactText($node.find(".se-talktalk-banner-text").text()) || url,
          url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
        },
      } satisfies ParsedBlock,
    ]
  }
}
