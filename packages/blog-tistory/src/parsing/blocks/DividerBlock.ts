import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryDividerBlock extends TistoryParserBlock {
  readonly id = "divider"
  readonly label = "구분선"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "horizontal-rule", label: "Markdown 구분선", template: "---" }],
    props: {},
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" &&
      (node.tagName === "hr" || $node.attr("data-ke-type") === "horizontalRule")
    )
  }

  convert() {
    return [{ blockId: `tistory:${this.id}`, props: {} }]
  }
}
