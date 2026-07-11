import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

const containerTags = new Set([
  "article",
  "section",
  "main",
  "div",
  "figure",
  "details",
  "summary",
  "center",
  "aside",
  "header",
  "footer",
])

export class TistoryContainerBlock extends TistoryParserBlock {
  readonly id = "container"
  readonly label = "컨테이너"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "children", label: "하위 블록", template: "" }],
    props: {},
  } as const

  match({ node }: TistoryParserBlockContext) {
    return node.type === "tag" && containerTags.has(node.tagName.toLowerCase())
  }

  convert({ $node, path, parseChildren }: TistoryParserBlockContext) {
    return $node
      .contents()
      .toArray()
      .flatMap((child, index) => parseChildren(child, `${path}.${index}`))
  }
}
