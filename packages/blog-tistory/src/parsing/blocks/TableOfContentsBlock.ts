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
        template:
          "{{ items.map(item => `${'  '.repeat(item.depth)}- [${item.text}](${item.url})`).join('\\n') }}",
      },
    ],
    props: {
      items: {
        label: "목차 항목",
        type: "array",
        items: {
          label: "항목",
          type: "object",
          properties: {
            depth: { label: "깊이", type: "number" },
            text: { label: "텍스트", type: "string" },
            url: { label: "URL", type: "string" },
          },
        },
      },
    },
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
    const root = $node.get(0)
    const items = $node
      .find("a[href]")
      .toArray()
      .flatMap((anchor) => {
        const url = $(anchor).attr("href")?.trim()
        const text = $(anchor).text().trim()
        let listDepth = 0
        let parent = anchor.parent

        while (parent && parent !== root) {
          if (parent.type === "tag" && (parent.tagName === "ul" || parent.tagName === "ol")) {
            listDepth += 1
          }

          parent = parent.parent
        }

        const rootIsList = root?.type === "tag" && (root.tagName === "ul" || root.tagName === "ol")

        return url && text
          ? [
              {
                depth: rootIsList ? listDepth : Math.max(0, listDepth - 1),
                text,
                url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
              },
            ]
          : []
      })

    return items.length > 0 ? [{ blockId: `tistory:${this.id}`, props: { items } }] : []
  }
}
