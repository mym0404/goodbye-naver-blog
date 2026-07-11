import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryHeadingBlock extends TistoryParserBlock {
  readonly id = "heading"
  readonly label = "제목"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "heading", label: "Markdown 제목", template: "{{ marker }} {{ text }}" }],
    props: {
      level: { label: "단계", type: "number" },
      marker: { label: "표시", type: "string" },
      text: { label: "제목", type: "string" },
    },
  } as const

  match({ node }: TistoryParserBlockContext) {
    return node.type === "tag" && /^h[1-6]$/i.test(node.tagName)
  }

  convert({ $, $node, node, options }: TistoryParserBlockContext) {
    if (node.type !== "tag") {
      return []
    }

    const level = Number(node.tagName.slice(1))
    const text = renderTistoryInline({
      $,
      nodes: $node.contents().toArray(),
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return text
      ? [{ blockId: `tistory:${this.id}`, props: { level, marker: "#".repeat(level), text } }]
      : []
  }
}
