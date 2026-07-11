import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryCodeBlock extends TistoryParserBlock {
  readonly id = "code"
  readonly label = "코드"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "fenced-code",
        label: "코드 블록",
        template: "{{ `\\`\\`\\`${language}\\n${code}\\n\\`\\`\\`` }}",
      },
    ],
    props: {
      language: { label: "언어", type: "string" },
      code: { label: "코드", type: "string" },
    },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return node.type === "tag" && (node.tagName === "pre" || $node.attr("data-ke-type") === "code")
  }

  convert({ $node }: TistoryParserBlockContext) {
    const $code = $node.is("pre") ? $node.find("code").first() : $node.find("pre, code").first()
    const target = $code.length > 0 ? $code : $node
    const className = target.attr("class") ?? ""
    const language =
      target.attr("data-ke-language") ??
      className.match(/(?:language-|lang-)([\w+-]+)/)?.[1] ??
      $node.attr("data-ke-language") ??
      ""
    const code = target.text().replace(/^\n|\n$/g, "")

    return code ? [{ blockId: `tistory:${this.id}`, props: { language, code } }] : []
  }
}
