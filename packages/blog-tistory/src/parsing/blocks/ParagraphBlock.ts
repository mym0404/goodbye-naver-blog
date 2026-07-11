import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryParagraphBlock extends TistoryParserBlock {
  readonly id = "paragraph"
  readonly label = "문단"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "text", label: "본문", template: "{{ text }}" }],
    props: { text: { label: "본문", type: "string" } },
  } as const

  match({ node }: TistoryParserBlockContext) {
    return node.type === "tag" && node.tagName.toLowerCase() === "p"
  }

  convert({ $, $node, options }: TistoryParserBlockContext) {
    const text = renderTistoryInline({
      $,
      nodes: $node.contents().toArray(),
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return text ? [{ blockId: `tistory:${this.id}`, props: { text } }] : []
  }
}
