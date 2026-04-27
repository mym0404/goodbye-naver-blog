import type { CheerioAPI } from "cheerio"

import type { ExportOptions, ParsedPost } from "../../../shared/Types.js"
import { unique } from "../../../shared/Utils.js"
import { createParserBlocksForEditor } from "../ParserBlockFactory.js"
import { BaseEditor } from "./BaseEditor.js"

export type ParseSe3PostInput = {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE3Editor extends BaseEditor<ParseSe3PostInput> {
  protected override readonly supportedBlocks = createParserBlocksForEditor("naver.se3")

  parse({ $, tags, options }: ParseSe3PostInput): ParsedPost {
    const container = $("#viewTypeSelector .se_component_wrap.sect_dsc").first()
    const { blocks, body, warnings } = this.runBlocks({
      $,
      nodes: container.children(".se_component").toArray(),
      tags,
      options,
    })

    return {
      editorVersion: 3,
      editorId: "naver.se3",
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos: [],
    } satisfies ParsedPost
  }
}
