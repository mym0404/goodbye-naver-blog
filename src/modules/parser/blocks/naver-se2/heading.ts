import { convertHtmlToMarkdown } from "../../../converter/html-fragment-converter.js"
import type { ParserBlock } from "../parser-node.js"
import { compactText } from "../../../../shared/utils.js"

export const se2HeadingBlock: ParserBlock = {
  id: "se2-heading",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && /^h[1-6]$/.test(node.tagName.toLowerCase()),
  convert: ({ $node, node, options }) => {
    if (node.type !== "tag") {
      return { status: "skip" }
    }

    const level = Number(node.tagName[1])
    const text = compactText(
      convertHtmlToMarkdown({
        html: $node.html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )

    return text
      ? {
          status: "handled",
          blocks: [{ type: "heading", level, text }],
        }
      : { status: "skip" }
  },
}
