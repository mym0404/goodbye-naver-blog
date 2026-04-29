import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type {
  AstBlock,
  BlockOutputSelection,
  EditorBlockOutputDefinition,
  ExportOptions,
  ParsedPost,
  ParsedPostBodyNode,
  UnknownRecord,
} from "@shared/Types.js"
import { resolveBlockOutputSelection } from "@shared/BlockRegistry.js"
import {
  createBodyNodesFromStructuredBlocks,
  createFallbackHtmlBodyNode,
} from "../blocks/BodyNodeUtils.js"
import type {
  ParserBlockConvertContext,
  ParserBlockOptions,
  ParserBlockResult,
} from "../blocks/ParserNode.js"
import type { BaseBlock } from "../blocks/BaseBlock.js"

export type BaseEditorParseInput = {
  $: CheerioAPI
  sourceUrl?: string
  tags: string[]
  options: Pick<ExportOptions, "markdown" | "blockOutputs"> &
    {
      resolveLinkUrl?: (url: string) => string
    }
}

export abstract class BaseEditor {
  abstract readonly type: string
  abstract readonly label: string

  protected readonly supportedBlocks: readonly BaseBlock[] = []

  abstract canParse(html: string): boolean

  abstract parse(input: BaseEditorParseInput): ParsedPost

  getBlockOutputDefinitions(): EditorBlockOutputDefinition[] {
    return this.supportedBlocks.flatMap((block) => {
      const outputOptions = block.outputOptions

      if (!block.outputId || !outputOptions || outputOptions.length < 2) {
        return []
      }

      return [
        {
          key: this.createBlockOutputSelectionKey(block.outputId),
          editorType: this.type,
          editorLabel: this.label,
          blockId: block.outputId,
          options: [...outputOptions],
        },
      ]
    })
  }

  private createBlockOutputSelectionKey(blockId: string) {
    return `${this.type}:${blockId}`
  }

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

    const applyOutputSelection = ({
      parsedBlock,
      parserBlock,
    }: {
      parsedBlock: AstBlock
      parserBlock: BaseBlock
    }) => {
      const outputOptions = parserBlock.outputOptions

      if (
        !parserBlock.outputId ||
        !outputOptions ||
        outputOptions.length < 2 ||
        !outputOptions.some((option) => option.preview.type === parsedBlock.type)
      ) {
        return parsedBlock
      }

      const selectionKey = this.createBlockOutputSelectionKey(parserBlock.outputId)

      return {
        ...parsedBlock,
        outputSelectionKey: selectionKey,
        outputSelection: resolveBlockOutputSelection({
          blockType: parsedBlock.type,
          outputOptions: outputOptions.filter((option) => option.preview.type === parsedBlock.type),
          blockOutputs: options.blockOutputs,
          selectionKey,
        }) as BlockOutputSelection,
      } as AstBlock & {
        outputSelectionKey: string
        outputSelection: BlockOutputSelection
      }
    }

    const handleResult = ({
      result,
      parserBlock,
    }: {
      result: ParserBlockResult
      parserBlock: BaseBlock
    }) => {
      if (result.warnings) {
        appendWarnings(result.warnings)
      }

      if (result.status === "handled") {
        const selectedBlocks = result.blocks.map((parsedBlock) =>
          applyOutputSelection({
            parsedBlock,
            parserBlock,
          }),
        )
        blocks.push(...selectedBlocks)
        body.push(...createBodyNodesFromStructuredBlocks(selectedBlocks))
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
      const block = this.supportedBlocks.find((supportedBlock) => supportedBlock.match(context))

      if (!block) {
        return
      }

      handleResult({
        result: block.convert(context),
        parserBlock: block,
      })
    }

    nodes.forEach(appendBlocksFromNode)

    return {
      blocks,
      body,
      warnings,
    }
  }
}
