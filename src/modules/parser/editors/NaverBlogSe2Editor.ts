import type { CheerioAPI } from "cheerio"

import type { AstBlock, ExportOptions, ParsedPost } from "../../../shared/Types.js"
import { unique } from "../../../shared/Utils.js"
import { createParserBlocksForEditor } from "../ParserBlockFactory.js"
import { BaseEditor } from "./BaseEditor.js"

export type ParseSe2PostInput = {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE2Editor extends BaseEditor<ParseSe2PostInput> {
  protected override readonly supportedBlocks = createParserBlocksForEditor("naver.se2")

  parse({ $, tags, options }: ParseSe2PostInput): ParsedPost {
    const container = $("#viewTypeSelector").first()
    const { blocks, body, warnings } = this.runBlocks({
      $,
      nodes: container.contents().toArray(),
      tags,
      options,
    })

    const videos = blocks
      .filter((block): block is Extract<AstBlock, { type: "video" }> => block.type === "video")
      .map((block) => block.video)

    return {
      editorVersion: 2,
      editorId: "naver.se2",
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos,
    } satisfies ParsedPost
  }
}
