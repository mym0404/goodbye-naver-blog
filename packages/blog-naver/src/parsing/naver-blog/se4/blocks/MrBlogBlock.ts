import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createQuoteBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4MrBlogBlock extends LeafParserBlock {
  override readonly id = "mrBlog"
  override readonly label = "블로그씨 질문"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "default",
        label: "인용문",
        template: "{{ text.split('\\n').map(line => `> ${line}`).join('\\n') }}",
      },
    ],
    props: {
      text: { label: "본문", type: "string" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-mrBlog")
  }

  override convert({ $node, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const from = compactText($node.find(".se-mrBlog-from").text())
    const question = compactText($node.find(".se-mrBlog-question").text())
    const text = [from, question].filter(Boolean).join("\n\n")

    if (!text) {
      throw new Error("SE4 mrBlog block parsing failed.")
    }

    return [createQuoteBlock({ blockId, text })]
  }
}
