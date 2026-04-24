import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type {
  AstBlock,
  ExportOptions,
  ParsedPost,
  ParsedPostBodyNode,
} from "../../../shared/types.js"
import { unique } from "../../../shared/utils.js"
import {
  createBodyNodesFromStructuredBlocks,
  createFallbackHtmlBodyNode,
} from "../blocks/body-node-utils.js"
import type {
  ParserBlock,
  ParserBlockConvertContext,
  ParserBlockResult,
} from "../blocks/parser-node.js"
import {
  se2ContainerBlock,
  se2DividerBlock,
  se2LineBreakBlock,
  se2SpacerBlock,
} from "../blocks/naver-se2/container.js"
import { se2CodeBlock } from "../blocks/naver-se2/code.js"
import {
  se2FallbackBlock,
  se2InlineGifVideoFallbackBlock,
} from "../blocks/naver-se2/fallback.js"
import { se2HeadingBlock } from "../blocks/naver-se2/heading.js"
import { se2ImageBlock } from "../blocks/naver-se2/image.js"
import { se2QuoteBlock } from "../blocks/naver-se2/quote.js"
import { se2TableBlock } from "../blocks/naver-se2/table.js"
import {
  se2BookWidgetBlock,
  se2TextElementBlock,
  se2TextNodeBlock,
} from "../blocks/naver-se2/text-node.js"
import { BaseEditor } from "./base-editor.js"

export type ParseSe2PostInput = {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE2Editor extends BaseEditor<ParseSe2PostInput> {
  protected override readonly supportedBlocks: readonly ParserBlock[] = [
    se2TextNodeBlock,
    se2BookWidgetBlock,
    se2ContainerBlock,
    se2TableBlock,
    se2DividerBlock,
    se2LineBreakBlock,
    se2QuoteBlock,
    se2HeadingBlock,
    se2CodeBlock,
    se2InlineGifVideoFallbackBlock,
    se2ImageBlock,
    se2SpacerBlock,
    se2TextElementBlock,
    se2FallbackBlock,
  ]

  parse({ $, tags, options }: ParseSe2PostInput): ParsedPost {
    const warnings: string[] = []
    const blocks: AstBlock[] = []
    const body: ParsedPostBodyNode[] = []
    const container = $("#viewTypeSelector").first()

    const appendWarnings = (nextWarnings: string[]) => {
      warnings.push(...nextWarnings)
    }

    const appendBodyNodes = (nodes: ParsedPostBodyNode[]) => {
      body.push(...nodes)
    }

    const handleResult = (result: ParserBlockResult) => {
      if (result.warnings) {
        appendWarnings(result.warnings)
      }

      if (result.status === "handled") {
        blocks.push(...result.blocks)
        body.push(...createBodyNodesFromStructuredBlocks(result.blocks))
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
        tags,
        options,
        appendBodyNodes,
        appendWarnings,
      }
      const block = this.supportedBlocks.find((supportedBlock) => supportedBlock.match(context))

      if (!block) {
        return
      }

      handleResult(block.convert(context))
    }

    container.contents().toArray().forEach(appendBlocksFromNode)

    const videos = blocks
      .filter((block): block is Extract<AstBlock, { type: "video" }> => block.type === "video")
      .map((block) => block.video)

    return {
      editorVersion: 2,
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos,
    } satisfies ParsedPost
  }
}
