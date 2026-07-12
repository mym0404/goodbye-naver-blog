import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryQuoteBlock extends TistoryParserBlock {
  readonly id = "quote"
  readonly label = "인용"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "blockquote",
        label: "Markdown 인용",
        template: "{{ text.split('\\n').map(line => `> ${line}`).join('\\n') }}",
      },
    ],
    props: { text: { label: "인용문", type: "string" } },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" &&
      (node.tagName === "blockquote" ||
        ($node.hasClass("tt_article_useless_p_margin") === false && $node.hasClass("blockquote")))
    )
  }

  convert({ $, $node, options }: TistoryParserBlockContext) {
    const text = $node
      .contents()
      .toArray()
      .map((node) =>
        renderTistoryInline({ $, nodes: [node], resolveLinkUrl: options.resolveLinkUrl }),
      )
      .filter(Boolean)
      .join("\n")

    return text ? [{ blockId: `tistory:${this.id}`, props: { text } }] : []
  }
}
