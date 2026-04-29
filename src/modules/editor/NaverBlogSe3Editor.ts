import type { ParsedPost } from "@shared/Types.js"
import { unique } from "@shared/Utils.js"
import { NaverSe3CodeBlock } from "../blocks/naver-se3/CodeBlock.js"
import { NaverSe3DocumentTitleBlock } from "../blocks/naver-se3/DocumentTitleBlock.js"
import { NaverSe3FallbackBlock } from "../blocks/naver-se3/FallbackBlock.js"
import { NaverSe3ImageBlock } from "../blocks/naver-se3/ImageBlock.js"
import { NaverSe3QuoteBlock } from "../blocks/naver-se3/QuoteBlock.js"
import { NaverSe3RepresentativeUnsupportedBlock } from "../blocks/naver-se3/RepresentativeUnsupportedBlock.js"
import { NaverSe3TableBlock } from "../blocks/naver-se3/TableBlock.js"
import { NaverSe3TextBlock } from "../blocks/naver-se3/TextBlock.js"
import { BaseEditor } from "./BaseEditor.js"
import type { BaseEditorParseInput } from "./BaseEditor.js"

const hasSmartEditorVersion = (html: string, version: number) =>
  html.replaceAll("&#034;", "\"").match(/smartEditorVersion["']?\s*:\s*["']?(\d+)["']?/i)?.[1] ===
  String(version)

export class NaverBlogSE3Editor extends BaseEditor {
  override readonly type = "naver-se3"
  override readonly label = "SmartEditor 3"

  protected override readonly supportedBlocks = [
    new NaverSe3DocumentTitleBlock(),
    new NaverSe3TableBlock(),
    new NaverSe3QuoteBlock(),
    new NaverSe3CodeBlock(),
    new NaverSe3ImageBlock(),
    new NaverSe3RepresentativeUnsupportedBlock(),
    new NaverSe3TextBlock(),
    new NaverSe3FallbackBlock(),
  ]

  override canParse(html: string) {
    return hasSmartEditorVersion(html, 3) || html.includes('class="se_component')
  }

  override parse({ $, tags, options }: BaseEditorParseInput): ParsedPost {
    const container = $("#viewTypeSelector .se_component_wrap.sect_dsc").first()
    const { blocks, body, warnings } = this.runBlocks({
      $,
      nodes: container.children(".se_component").toArray(),
      tags,
      options,
    })

    return {
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos: [],
    } satisfies ParsedPost
  }
}
