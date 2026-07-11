import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

const ignoredTags = new Set(["script", "style", "noscript", "template", "button", "input"])
const ignoredClassPattern =
  /(?:^|\s)(?:ad|adsbygoogle|revenue_unit_wrap|container_postbtn|another_category|protected|share|sns)(?:\s|$)/i

export class TistoryIgnoreBlock extends TistoryParserBlock {
  readonly id = "ignore"
  readonly label = "무시"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "ignore", label: "무시", template: "" }],
    props: {},
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "script" ||
      node.type === "style" ||
      (node.type === "tag" && ignoredTags.has(node.tagName.toLowerCase())) ||
      ignoredClassPattern.test($node.attr("class") ?? "") ||
      ["revenue", "advertisement"].includes($node.attr("data-ke-type") ?? "")
    )
  }

  convert() {
    return []
  }
}
