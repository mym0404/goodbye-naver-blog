import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

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
        template: "{{ lines.map(line => `> ${line}`).join('\\n') }}",
      },
    ],
    props: {
      text: { label: "인용문", type: "string" },
      lines: { label: "인용문 줄", type: "array" },
    },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" &&
      (node.tagName === "blockquote" ||
        ($node.hasClass("tt_article_useless_p_margin") === false && $node.hasClass("blockquote")))
    )
  }

  convert({ $node }: TistoryParserBlockContext) {
    const text = $node
      .text()
      .replace(/\u00a0/g, " ")
      .trim()

    return text ? [{ blockId: `tistory:${this.id}`, props: { text, lines: text.split("\n") } }] : []
  }
}
