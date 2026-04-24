import { convertHtmlToMarkdown } from "../../../converter/html-fragment-converter.js"
import type { ParserBlock } from "../parser-node.js"

export const se2QuoteBlock: ParserBlock = {
  id: "se2-quote",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && node.tagName.toLowerCase() === "blockquote",
  convert: ({ $node, options }) => {
    const markdown = convertHtmlToMarkdown({
      html: $node.html() ?? "",
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return markdown
      ? {
          status: "handled",
          blocks: [{ type: "quote", text: markdown }],
        }
      : { status: "skip" }
  },
}
