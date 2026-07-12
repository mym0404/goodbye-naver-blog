import { convertHtmlToMarkdown } from "@exitpress/engine/markdown/util/convertHtmlToMarkdown.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createQuoteBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4QuoteBlock extends LeafParserBlock {
  override readonly id = "quote"
  override readonly label = "인용문"
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

  override match({ hasQuote }: ParserBlockContext) {
    return Boolean(hasQuote)
  }

  override convert({ $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const quoteMarkdown = convertHtmlToMarkdown({
      /* v8 ignore next */
      html: $node.find("blockquote.se-quotation-container").html() ?? "",
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return quoteMarkdown ? [createQuoteBlock({ blockId, text: quoteMarkdown })] : []
  }
}
