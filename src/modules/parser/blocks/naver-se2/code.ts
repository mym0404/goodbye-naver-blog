import type { ParserBlock } from "../parser-node.js"

export const se2CodeBlock: ParserBlock = {
  id: "se2-code",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && node.tagName.toLowerCase() === "pre",
  convert: ({ $node }) => {
    const code = $node.text().trimEnd()

    return code
      ? {
          status: "handled",
          blocks: [{ type: "code", language: null, code }],
        }
      : { status: "skip" }
  },
}
