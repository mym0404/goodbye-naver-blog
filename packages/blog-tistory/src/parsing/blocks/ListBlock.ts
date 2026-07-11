import type { Cheerio } from "cheerio"
import type { AnyNode } from "domhandler"

import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

type ListItem = {
  depth: number
  ordered: boolean
  index: number
  prefix: string
  text: string
}

export class TistoryListBlock extends TistoryParserBlock {
  readonly id = "list"
  readonly label = "목록"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "markdown-list",
        label: "Markdown 목록",
        template: "{{ items.map(item => `${item.prefix} ${item.text}`).join('\\n') }}",
      },
    ],
    props: { items: { label: "목록 항목", type: "array" } },
  } as const

  match({ node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" &&
      (node.tagName === "ul" || node.tagName === "ol" || node.tagName === "li")
    )
  }

  convert({ $, $node, options }: TistoryParserBlockContext) {
    const items: ListItem[] = []

    const visitItem = (
      $item: Cheerio<AnyNode>,
      { depth, index, ordered }: { depth: number; index: number; ordered: boolean },
    ) => {
      const inlineNodes = $item
        .contents()
        .toArray()
        .filter(
          (child) => child.type !== "tag" || (child.tagName !== "ul" && child.tagName !== "ol"),
        )
      const text = renderTistoryInline({
        $,
        nodes: inlineNodes,
        resolveLinkUrl: options.resolveLinkUrl,
      })

      if (text) {
        items.push({
          depth,
          ordered,
          index,
          prefix: `${"  ".repeat(depth)}${ordered ? `${index}.` : "-"}`,
          text,
        })
      }

      $item.children("ul, ol").each((_, child) => visit($(child), depth + 1))
    }

    const visit = (list: Cheerio<AnyNode>, depth: number) => {
      const listNode = list.get(0)
      const ordered = listNode?.type === "tag" && listNode.tagName === "ol"

      list
        .children("li")
        .each((index, item) => visitItem($(item), { depth, index: index + 1, ordered }))
    }

    if ($node.is("li")) {
      visitItem($node, { depth: 0, index: 1, ordered: false })
    } else {
      visit($node, 0)
    }

    return items.length > 0 ? [{ blockId: `tistory:${this.id}`, props: { items } }] : []
  }
}
