import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

const compactInlineText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")

export const renderTistoryInline = ({
  $,
  nodes,
  resolveLinkUrl,
}: {
  $: CheerioAPI
  nodes: AnyNode[]
  resolveLinkUrl?: (url: string) => string
}): string => {
  const renderNode = (node: AnyNode): string => {
    if (node.type === "text") {
      return node.data
    }

    if (node.type !== "tag") {
      return ""
    }

    const $node = $(node)
    const tagName = node.tagName.toLowerCase()
    const content = $node.contents().toArray().map(renderNode).join("")

    if (tagName === "br") {
      return "\n"
    }

    if (tagName === "a") {
      const url = $node.attr("href")?.trim()
      const text = compactInlineText(content).trim()

      return url ? `[${text || url}](${resolveLinkUrl ? resolveLinkUrl(url) : url})` : text
    }

    if (tagName === "img") {
      const url =
        $node.attr("data-origin-url") ??
        $node.attr("data-url") ??
        $node.attr("data-src") ??
        $node.attr("src")

      return url ? `![${$node.attr("alt")?.trim() ?? ""}](${url})` : ""
    }

    if (tagName === "strong" || tagName === "b") {
      return content.trim() ? `**${content.trim()}**` : ""
    }

    if (tagName === "em" || tagName === "i") {
      return content.trim() ? `*${content.trim()}*` : ""
    }

    if (tagName === "s" || tagName === "del" || tagName === "strike") {
      return content.trim() ? `~~${content.trim()}~~` : ""
    }

    if (tagName === "code") {
      return content ? `\`${content}\`` : ""
    }

    return content
  }

  return compactInlineText(nodes.map(renderNode).join("")).trim()
}
