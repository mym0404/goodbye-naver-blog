import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

const inlineTags = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "del",
  "em",
  "font",
  "i",
  "ins",
  "kbd",
  "label",
  "mark",
  "q",
  "s",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "time",
  "title",
  "u",
])

export class TistoryInlineBlock extends TistoryParserBlock {
  readonly id = "inline"
  readonly label = "인라인 본문"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "text", label: "본문", template: "{{ text }}" }],
    props: { text: { label: "본문", type: "string" } },
  } as const

  match({ node }: TistoryParserBlockContext) {
    return (
      node.type === "text" || (node.type === "tag" && inlineTags.has(node.tagName.toLowerCase()))
    )
  }

  convert({ $, node, options }: TistoryParserBlockContext) {
    const text = renderTistoryInline({ $, nodes: [node], resolveLinkUrl: options.resolveLinkUrl })

    return text ? [{ blockId: `tistory:${this.id}`, props: { text } }] : []
  }
}
