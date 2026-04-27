import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type { AstBlock, ExportOptions, ParsedPost, UnknownRecord } from "../../../shared/Types.js"
import { unique } from "../../../shared/Utils.js"
import { createParserBlocksForEditor } from "../ParserBlockFactory.js"
import { BaseEditor } from "./BaseEditor.js"

const parseJsonAttribute = (value: string | undefined) => {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as UnknownRecord
  } catch {
    return null
  }
}

const getComponentModule = ($component: ReturnType<CheerioAPI>) => {
  const moduleScript = $component.find("script.__se_module_data").first()

  return (
    parseJsonAttribute(moduleScript.attr("data-module-v2")) ??
    parseJsonAttribute(moduleScript.attr("data-module"))
  )
}

export type ParseSe4PostInput = {
  $: CheerioAPI
  sourceUrl: string
  tags: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE4Editor extends BaseEditor<ParseSe4PostInput> {
  protected override readonly supportedBlocks = createParserBlocksForEditor("naver.se4")

  parse({ $, sourceUrl, tags, options }: ParseSe4PostInput): ParsedPost {
    const { blocks, body, warnings } = this.runBlocks({
      $,
      nodes: $("#viewTypeSelector .se-component").toArray(),
      sourceUrl,
      tags,
      options,
      moduleContext: (node: AnyNode) => {
        const $component = $(node)
        const moduleData = getComponentModule($component)

        return {
          moduleData,
          moduleType: typeof moduleData?.type === "string" ? moduleData.type : null,
          hasQuote: $component.find("blockquote.se-quotation-container").length > 0,
        }
      },
    })

    const videos = blocks
      .filter((block): block is Extract<AstBlock, { type: "video" }> => block.type === "video")
      .map((block) => block.video)

    return {
      editorVersion: 4,
      editorId: "naver.se4",
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos,
    } satisfies ParsedPost
  }
}
