import type { CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

import type { AstBlock, ParsedPost, UnknownRecord } from "@shared/Types.js"
import { unique } from "@shared/Utils.js"
import { NaverSe4CodeBlock } from "../blocks/naver-se4/CodeBlock.js"
import { NaverSe4DividerBlock } from "../blocks/naver-se4/DividerBlock.js"
import { NaverSe4DocumentTitleBlock } from "../blocks/naver-se4/DocumentTitleBlock.js"
import { NaverSe4FallbackBlock } from "../blocks/naver-se4/FallbackBlock.js"
import { NaverSe4FormulaBlock } from "../blocks/naver-se4/FormulaBlock.js"
import { NaverSe4HeadingBlock } from "../blocks/naver-se4/HeadingBlock.js"
import { NaverSe4ImageBlock } from "../blocks/naver-se4/ImageBlock.js"
import { NaverSe4ImageGroupBlock } from "../blocks/naver-se4/ImageGroupBlock.js"
import { NaverSe4ImageStripBlock } from "../blocks/naver-se4/ImageStripBlock.js"
import { NaverSe4LinkCardBlock } from "../blocks/naver-se4/LinkCardBlock.js"
import { NaverSe4MapBlock } from "../blocks/naver-se4/MapBlock.js"
import { NaverSe4MaterialBlock } from "../blocks/naver-se4/MaterialBlock.js"
import { NaverSe4OembedBlock } from "../blocks/naver-se4/OembedBlock.js"
import { NaverSe4QuoteBlock } from "../blocks/naver-se4/QuoteBlock.js"
import { NaverSe4StickerBlock } from "../blocks/naver-se4/StickerBlock.js"
import { NaverSe4TableBlock } from "../blocks/naver-se4/TableBlock.js"
import { NaverSe4TextBlock } from "../blocks/naver-se4/TextBlock.js"
import { NaverSe4VideoBlock } from "../blocks/naver-se4/VideoBlock.js"
import { BaseEditor } from "./BaseEditor.js"
import type { BaseEditorParseInput } from "./BaseEditor.js"

const hasSmartEditorVersion = (html: string, version: number) =>
  html.replaceAll("&#034;", "\"").match(/smartEditorVersion["']?\s*:\s*["']?(\d+)["']?/i)?.[1] ===
  String(version)

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

export class NaverBlogSE4Editor extends BaseEditor {
  override readonly type = "naver-se4"
  override readonly label = "SmartEditor 4"

  protected override readonly supportedBlocks = [
    new NaverSe4DocumentTitleBlock(),
    new NaverSe4FormulaBlock(),
    new NaverSe4CodeBlock(),
    new NaverSe4LinkCardBlock(),
    new NaverSe4VideoBlock(),
    new NaverSe4OembedBlock(),
    new NaverSe4MapBlock(),
    new NaverSe4TableBlock(),
    new NaverSe4ImageStripBlock(),
    new NaverSe4ImageGroupBlock(),
    new NaverSe4StickerBlock(),
    new NaverSe4ImageBlock(),
    new NaverSe4HeadingBlock(),
    new NaverSe4DividerBlock(),
    new NaverSe4QuoteBlock(),
    new NaverSe4TextBlock(),
    new NaverSe4MaterialBlock(),
    new NaverSe4FallbackBlock(),
  ]

  override canParse(html: string) {
    return hasSmartEditorVersion(html, 4) || html.includes('class="se-component')
  }

  override parse({ $, sourceUrl = "", tags, options }: BaseEditorParseInput): ParsedPost {
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
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos,
    } satisfies ParsedPost
  }
}
