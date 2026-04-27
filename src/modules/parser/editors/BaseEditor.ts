import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type {
  AstBlock,
  ExportOptions,
  ParsedPost,
  ParsedPostBodyNode,
  UnknownRecord,
} from "../../../shared/Types.js"
import {
  createBodyNodesFromStructuredBlocks,
  createFallbackHtmlBodyNode,
} from "../blocks/BodyNodeUtils.js"
import type {
  ParserBlockConvertContext,
  ParserBlockOptions,
  ParserBlockResult,
} from "../blocks/ParserNode.js"
import type { ParserBlockBinding } from "../ParserBlockFactory.js"

export type BaseEditorParseInput = {
  $: CheerioAPI
  sourceUrl?: string
  tags: string[]
  options: Pick<ExportOptions, "markdown"> &
    {
      resolveLinkUrl?: (url: string) => string
    }
}

export abstract class BaseEditor<TInput extends BaseEditorParseInput = BaseEditorParseInput> {
  protected readonly supportedBlocks: readonly ParserBlockBinding[] = []

  abstract parse(input: TInput): ParsedPost

  protected runBlocks({
    $,
    nodes,
    tags,
    options,
    sourceUrl,
    moduleContext,
  }: {
    $: CheerioAPI
    nodes: AnyNode[]
    tags: string[]
    options: ParserBlockOptions
    sourceUrl?: string
    moduleContext?: (node: AnyNode) => {
      moduleData?: UnknownRecord | null
      moduleType?: string | null
      hasQuote?: boolean
    }
  }) {
    const warnings: string[] = []
    const blocks: AstBlock[] = []
    const body: ParsedPostBodyNode[] = []

    const appendWarnings = (nextWarnings: string[]) => {
      warnings.push(...nextWarnings)
    }

    const appendBodyNodes = (nodes: ParsedPostBodyNode[]) => {
      body.push(...nodes)
    }

    const handleResult = (result: ParserBlockResult, parserBlockId: ParserBlockBinding["id"]) => {
      if (result.warnings) {
        appendWarnings(result.warnings)
      }

      if (result.status === "handled") {
        blocks.push(...result.blocks)
        body.push(...createBodyNodesFromStructuredBlocks(result.blocks, parserBlockId))
        return
      }

      if (result.status === "fallback") {
        body.push(
          createFallbackHtmlBodyNode({
            html: result.html,
            reason: result.reason,
            warnings: result.warnings,
          }),
        )
        return
      }

      if (result.status === "traverse") {
        result.nodes?.forEach(appendBlocksFromNode)
      }
    }

    const appendBlocksFromNode = (node: AnyNode) => {
      const context: ParserBlockConvertContext = {
        $,
        $node: $(node),
        node,
        sourceUrl,
        tags,
        options,
        appendBodyNodes,
        appendWarnings,
        ...moduleContext?.(node),
      }
      const block = this.supportedBlocks.find((supportedBlock) => supportedBlock.block.match(context))

      if (!block) {
        return
      }

      handleResult(block.block.convert(context), block.id)
    }

    nodes.forEach(appendBlocksFromNode)

    return {
      blocks,
      body,
      warnings,
    }
  }
}
