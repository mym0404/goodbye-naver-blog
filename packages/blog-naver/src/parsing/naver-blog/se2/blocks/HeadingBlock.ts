import { convertHtmlToMarkdown } from "@exitpress/engine/markdown/util/convertHtmlToMarkdown.js"
import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createHeadingBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe2HeadingBlock extends LeafParserBlock {
  override readonly id = "heading"
  override readonly label = "제목"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "default",
        label: "원문 제목 단계",
        template: '{{ "#".repeat(level) }} {{ text }}',
      },
    ],
    props: {
      level: { label: "단계", type: "number" },
      text: { label: "본문", type: "string" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ node }: ParserBlockContext) {
    return node.type === "tag" && /^h[1-6]$/.test(node.tagName.toLowerCase())
  }

  override convert({ $node, node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    /* v8 ignore next 3 */
    if (node.type !== "tag") {
      throw new Error("SE2 heading block received a non-tag node.")
    }

    const level = Number(node.tagName[1])
    const text = compactText(
      convertHtmlToMarkdown({
        /* v8 ignore next */
        html: $node.html() ?? "",
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )

    if (!text) {
      throw new Error(`SE2 heading block parsing failed: <${node.tagName.toLowerCase()}>`)
    }

    return [createHeadingBlock({ blockId, level, text })]
  }
}
