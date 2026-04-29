import type { AstBlock, ParsedPost } from "@shared/Types.js"
import { unique } from "@shared/Utils.js"
import { NaverSe2BookWidgetBlock } from "../blocks/naver-se2/BookWidgetBlock.js"
import { NaverSe2CodeBlock } from "../blocks/naver-se2/CodeBlock.js"
import { NaverSe2ContainerBlock } from "../blocks/naver-se2/ContainerBlock.js"
import { NaverSe2DividerBlock } from "../blocks/naver-se2/DividerBlock.js"
import { NaverSe2FallbackBlock } from "../blocks/naver-se2/FallbackBlock.js"
import { NaverSe2HeadingBlock } from "../blocks/naver-se2/HeadingBlock.js"
import { NaverSe2ImageBlock } from "../blocks/naver-se2/ImageBlock.js"
import { NaverSe2InlineGifVideoFallbackBlock } from "../blocks/naver-se2/InlineGifVideoFallbackBlock.js"
import { NaverSe2LineBreakBlock } from "../blocks/naver-se2/LineBreakBlock.js"
import { NaverSe2QuoteBlock } from "../blocks/naver-se2/QuoteBlock.js"
import { NaverSe2SpacerBlock } from "../blocks/naver-se2/SpacerBlock.js"
import { NaverSe2TableBlock } from "../blocks/naver-se2/TableBlock.js"
import { NaverSe2TextElementBlock } from "../blocks/naver-se2/TextElementBlock.js"
import { NaverSe2TextNodeBlock } from "../blocks/naver-se2/TextNodeBlock.js"
import { BaseEditor } from "./BaseEditor.js"
import type { BaseEditorParseInput } from "./BaseEditor.js"

export class NaverBlogSE2Editor extends BaseEditor {
  override readonly type = "naver-se2"
  override readonly label = "SmartEditor 2"

  protected override readonly supportedBlocks = [
    new NaverSe2TextNodeBlock(),
    new NaverSe2BookWidgetBlock(),
    new NaverSe2ContainerBlock(),
    new NaverSe2TableBlock(),
    new NaverSe2DividerBlock(),
    new NaverSe2LineBreakBlock(),
    new NaverSe2QuoteBlock(),
    new NaverSe2HeadingBlock(),
    new NaverSe2CodeBlock(),
    new NaverSe2InlineGifVideoFallbackBlock(),
    new NaverSe2ImageBlock(),
    new NaverSe2SpacerBlock(),
    new NaverSe2TextElementBlock(),
    new NaverSe2FallbackBlock(),
  ]

  override canParse(html: string) {
    return !html.includes('class="se-component') && !html.includes('class="se_component')
  }

  override parse({ $, tags, options }: BaseEditorParseInput): ParsedPost {
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
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos,
    } satisfies ParsedPost
  }
}
