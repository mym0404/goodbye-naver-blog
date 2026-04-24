import type { ParsedPost } from "../../shared/types.js"
import { unique } from "../../shared/utils.js"
import {
  getFallbackHtmlBodyNodeWarnings,
  getFallbackHtmlBodyNodes,
  getParsedPostBodyNodes,
} from "../parser/blocks/body-node-utils.js"

export const reviewParsedPost = (parsedPost: ParsedPost) => {
  const bodyNodes = getParsedPostBodyNodes(parsedPost)
  const fallbackHtmlNodes = getFallbackHtmlBodyNodes(parsedPost)
  const warnings = [
    ...parsedPost.warnings,
    ...fallbackHtmlNodes.flatMap((node) => getFallbackHtmlBodyNodeWarnings(node)),
  ]

  if (bodyNodes.length === 0) {
    warnings.push("본문 블록이 비어 있습니다.")
  }

  if (fallbackHtmlNodes.length > 0) {
    warnings.push(`fallback HTML 블록 ${fallbackHtmlNodes.length}개가 포함됩니다.`)
  }

  return {
    warnings: unique(warnings),
  }
}
