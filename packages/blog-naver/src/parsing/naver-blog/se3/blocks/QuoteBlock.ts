import { convertHtmlToMarkdown } from "@exitpress/engine/markdown/util/convertHtmlToMarkdown.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createQuoteBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot } from "./util/ComponentBoundary.js"

export class NaverSe3QuoteBlock extends LeafParserBlock {
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

  override match({ $, $node }: ParserBlockContext) {
    return (
      ($node.hasClass("se_quote") || $node.hasClass("se_quotation")) &&
      findInComponentRoot({ $, $component: $node, selector: "blockquote" }).first().length > 0
    )
  }

  override convert({ $, $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const blockquote = findInComponentRoot({ $, $component: $node, selector: "blockquote" }).first()
    const markdown = convertHtmlToMarkdown({
      /* v8 ignore next */
      html: blockquote.html() ?? "",
      resolveLinkUrl: options.resolveLinkUrl,
    })

    if (!markdown) {
      throw new Error("SE3 quote block parsing failed.")
    }

    return [createQuoteBlock({ blockId, text: markdown })]
  }
}
