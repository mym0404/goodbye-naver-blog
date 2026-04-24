import type { Cheerio, CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type {
  ExportOptions,
  ParsedPostBodyNode,
  StructuredAstBlock,
} from "../../../shared/types.js"

export type ParserBlockOptions = Pick<ExportOptions, "markdown"> &
  {
    resolveLinkUrl?: (url: string) => string
  }

export type ParserBlockContext<TNode extends AnyNode = AnyNode> = {
  $: CheerioAPI
  $node: Cheerio<TNode>
  node: TNode
  sourceUrl?: string
  tags: string[]
  options: ParserBlockOptions
}

export type ParserBlockConvertContext<TNode extends AnyNode = AnyNode> = ParserBlockContext<TNode> & {
  appendBodyNodes: (nodes: ParsedPostBodyNode[]) => void
  appendWarnings: (warnings: string[]) => void
}

export type ParserBlockResult<TNode extends AnyNode = AnyNode> =
  | {
      status: "handled"
      blocks: StructuredAstBlock[]
      warnings?: string[]
    }
  | {
      status: "fallback"
      html: string
      reason: string
      warnings?: string[]
    }
  | {
      status: "traverse"
      nodes?: TNode[]
      warnings?: string[]
    }
  | {
      status: "skip"
      warnings?: string[]
    }

export type ParserBlockBase<TNode extends AnyNode = AnyNode> = {
  id: string
  match: (context: ParserBlockContext<TNode>) => boolean
  convert: (context: ParserBlockConvertContext<TNode>) => ParserBlockResult<TNode>
}

export type ContainerBlock<TNode extends AnyNode = AnyNode> = ParserBlockBase<TNode> & {
  kind: "container"
}

export type LeafBlock<TNode extends AnyNode = AnyNode> = ParserBlockBase<TNode> & {
  kind: "leaf"
}

export type ParserBlock<TNode extends AnyNode = AnyNode> = ContainerBlock<TNode> | LeafBlock<TNode>
