import type {
  AstBlock,
  ParsedPost,
  ParsedPostBodyNode,
  ParsedPostFallbackHtmlBodyNode,
  ParsedPostStructuredBodyNode,
  StructuredAstBlock,
} from "../../../shared/types.js"

type LegacyHtmlAstBlock =
  | { type: "htmlFragment"; html: string }
  | { type: "rawHtml"; html: string; reason: string }

type LegacyParsedPostBlock = AstBlock | LegacyHtmlAstBlock

export const isStructuredAstBlock = (block: LegacyParsedPostBlock): block is StructuredAstBlock =>
  block.type !== "htmlFragment" && block.type !== "rawHtml"

export const createStructuredBodyNode = (block: StructuredAstBlock): ParsedPostStructuredBodyNode => ({
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

export const createBodyNodesFromStructuredBlocks = (blocks: StructuredAstBlock[]): ParsedPostBodyNode[] =>
  blocks.map((block) => createStructuredBodyNode(block))

export const createBodyNodesFromLegacyBlocks = (blocks: LegacyParsedPostBlock[]): ParsedPostBodyNode[] =>
  blocks.map((block) => {
    if (isStructuredAstBlock(block)) {
      return createStructuredBodyNode(block)
    }

    return createFallbackHtmlBodyNode({
      html: block.html,
      reason: block.type === "rawHtml" ? block.reason : "html-fragment",
    })
  })

export const getParsedPostBodyNodes = (parsedPost: ParsedPost) =>
  parsedPost.body ?? createBodyNodesFromLegacyBlocks(parsedPost.blocks)

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

export const withParsedPostBody = (
  parsedPost: ParsedPost,
  options: {
    rebuild?: boolean
  } = {},
): ParsedPost => ({
  ...parsedPost,
  body: !options.rebuild && parsedPost.body ? parsedPost.body : createBodyNodesFromLegacyBlocks(parsedPost.blocks),
})
