import type {
  AstBlock,
  ParsedPost,
  ParsedPostBodyNode,
  ParsedPostFallbackHtmlBodyNode,
  ParsedPostStructuredBodyNode,
} from "../../shared/Types.js"

export const createStructuredBodyNode = (block: AstBlock): ParsedPostStructuredBodyNode => ({
  kind: "block",
  block,
})

export const createFallbackHtmlBodyNode = ({
  html,
  reason,
  warnings = [],
}: {
  html: string
  reason: string
  warnings?: string[]
}): ParsedPostFallbackHtmlBodyNode => ({
  kind: "fallbackHtml",
  html,
  reason,
  warnings,
})

export const createBodyNodesFromStructuredBlocks = (blocks: AstBlock[]): ParsedPostBodyNode[] =>
  blocks.map((block) => createStructuredBodyNode(block))

export const getParsedPostBodyNodes = (parsedPost: ParsedPost) => parsedPost.body

export const getStructuredBodyBlocks = (parsedPost: ParsedPost) =>
  getParsedPostBodyNodes(parsedPost)
    .filter((node): node is ParsedPostStructuredBodyNode => node.kind === "block")
    .map((node) => node.block)

export const getFallbackHtmlBodyNodes = (parsedPost: ParsedPost) =>
  getParsedPostBodyNodes(parsedPost).filter(
    (node): node is ParsedPostFallbackHtmlBodyNode => node.kind === "fallbackHtml",
  )

export const getFallbackHtmlBodyNodeWarnings = (node: ParsedPostFallbackHtmlBodyNode) =>
  node.warnings.length > 0
    ? node.warnings
    : [`fallback HTML 블록을 원본 HTML로 보존했습니다: ${node.reason}`]
