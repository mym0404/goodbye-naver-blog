import { convertHtmlToMarkdown } from "@exitpress/engine/markdown/util/convertHtmlToMarkdown.js"
import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createHeadingBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4HeadingBlock extends LeafParserBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-sectionTitle")
  }

  override convert({ $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const $textModule = $node.find(".se-module-text")
    const hasTextModule = $textModule.length > 0
    const title = compactText(
      convertHtmlToMarkdown({
        html: $textModule.html() ?? "",
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )

    if (!title) {
      if (hasTextModule) {
        return []
      }

      throw new Error("SE4 heading block parsing failed.")
    }

    return [createHeadingBlock({ blockId, level: 2, text: title })]
  }
}
