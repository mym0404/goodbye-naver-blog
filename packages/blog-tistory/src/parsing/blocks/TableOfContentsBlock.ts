import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryTableOfContentsBlock extends TistoryParserBlock {
  readonly id = "tableOfContents"
  readonly label = "목차"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "link-list",
        label: "목차 링크",
        template: "{{ items.map(item => `- [${item.text}](${item.url})`).join('\\n') }}",
      },
    ],
    props: { items: { label: "목차 항목", type: "array" } },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    if (node.type !== "tag") {
      return false
    }

    return (
      $node.attr("data-ke-type") === "toc" ||
      /(^|[-_])toc($|[-_])/i.test($node.attr("id") ?? "") ||
      $node.hasClass("toc") ||
      $node.hasClass("quick-nav") ||
      (node.tagName === "nav" && $node.find("a[href]").length > 0)
    )
  }

  convert({ $, $node, options }: TistoryParserBlockContext) {
    const items = $node
      .find("a[href]")
      .toArray()
      .flatMap((anchor) => {
        const url = $(anchor).attr("href")?.trim()
        const text = $(anchor).text().trim()

        return url && text
          ? [{ text, url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url }]
          : []
      })

    return items.length > 0 ? [{ blockId: `tistory:${this.id}`, props: { items } }] : []
  }
}
