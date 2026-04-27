import type { ParsedPost } from "../../shared/Types.js"
import type { ParserBlockId } from "../blog/BlogTypes.js"
import { getParsedPostBodyNodes } from "./blocks/BodyNodeUtils.js"

export const getParsedPostParserBlockIds = (parsedPost: ParsedPost) => {
  const parserBlockIds = new Map<ParserBlockId, number>()

  getParsedPostBodyNodes(parsedPost).forEach((node) => {
    if (node.kind === "block" && node.parserBlockId) {
      parserBlockIds.set(node.parserBlockId, (parserBlockIds.get(node.parserBlockId) ?? 0) + 1)
    }
  })

  return Array.from(parserBlockIds.keys())
}
