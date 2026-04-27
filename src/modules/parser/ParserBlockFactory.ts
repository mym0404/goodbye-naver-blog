import { getBlogEditorDefinition } from "../blog/BlogRegistry.js"
import type { BlogEditorId, ParserBlockId } from "../blog/BlogTypes.js"
import type { ParserBlock } from "./blocks/ParserNode.js"
import { NaverSe2BookWidgetBlock } from "./blocks/naver-se2/BookWidgetBlock.js"
import { NaverSe2CodeBlock } from "./blocks/naver-se2/CodeBlock.js"
import { NaverSe2ContainerBlock } from "./blocks/naver-se2/ContainerBlock.js"
import { NaverSe2DividerBlock } from "./blocks/naver-se2/DividerBlock.js"
import { NaverSe2FallbackBlock } from "./blocks/naver-se2/FallbackBlock.js"
import { NaverSe2HeadingBlock } from "./blocks/naver-se2/HeadingBlock.js"
import { NaverSe2ImageBlock } from "./blocks/naver-se2/ImageBlock.js"
import { NaverSe2InlineGifVideoFallbackBlock } from "./blocks/naver-se2/InlineGifVideoFallbackBlock.js"
import { NaverSe2LineBreakBlock } from "./blocks/naver-se2/LineBreakBlock.js"
import { NaverSe2QuoteBlock } from "./blocks/naver-se2/QuoteBlock.js"
import { NaverSe2SpacerBlock } from "./blocks/naver-se2/SpacerBlock.js"
import { NaverSe2TableBlock } from "./blocks/naver-se2/TableBlock.js"
import { NaverSe2TextElementBlock } from "./blocks/naver-se2/TextElementBlock.js"
import { NaverSe2TextNodeBlock } from "./blocks/naver-se2/TextNodeBlock.js"
import { NaverSe3CodeBlock } from "./blocks/naver-se3/CodeBlock.js"
import { NaverSe3DocumentTitleBlock } from "./blocks/naver-se3/DocumentTitleBlock.js"
import { NaverSe3FallbackBlock } from "./blocks/naver-se3/FallbackBlock.js"
import { NaverSe3ImageBlock } from "./blocks/naver-se3/ImageBlock.js"
import { NaverSe3QuoteBlock } from "./blocks/naver-se3/QuoteBlock.js"
import { NaverSe3RepresentativeUnsupportedBlock } from "./blocks/naver-se3/RepresentativeUnsupportedBlock.js"
import { NaverSe3TableBlock } from "./blocks/naver-se3/TableBlock.js"
import { NaverSe3TextBlock } from "./blocks/naver-se3/TextBlock.js"
import { NaverSe4CodeBlock } from "./blocks/naver-se4/CodeBlock.js"
import { NaverSe4DividerBlock } from "./blocks/naver-se4/DividerBlock.js"
import { NaverSe4DocumentTitleBlock } from "./blocks/naver-se4/DocumentTitleBlock.js"
import { NaverSe4FallbackBlock } from "./blocks/naver-se4/FallbackBlock.js"
import { NaverSe4FormulaBlock } from "./blocks/naver-se4/FormulaBlock.js"
import { NaverSe4HeadingBlock } from "./blocks/naver-se4/HeadingBlock.js"
import { NaverSe4ImageBlock } from "./blocks/naver-se4/ImageBlock.js"
import { NaverSe4ImageGroupBlock } from "./blocks/naver-se4/ImageGroupBlock.js"
import { NaverSe4ImageStripBlock } from "./blocks/naver-se4/ImageStripBlock.js"
import { NaverSe4LinkCardBlock } from "./blocks/naver-se4/LinkCardBlock.js"
import { NaverSe4MapBlock } from "./blocks/naver-se4/MapBlock.js"
import { NaverSe4MaterialBlock } from "./blocks/naver-se4/MaterialBlock.js"
import { NaverSe4OembedBlock } from "./blocks/naver-se4/OembedBlock.js"
import { NaverSe4QuoteBlock } from "./blocks/naver-se4/QuoteBlock.js"
import { NaverSe4StickerBlock } from "./blocks/naver-se4/StickerBlock.js"
import { NaverSe4TableBlock } from "./blocks/naver-se4/TableBlock.js"
import { NaverSe4TextBlock } from "./blocks/naver-se4/TextBlock.js"
import { NaverSe4VideoBlock } from "./blocks/naver-se4/VideoBlock.js"

const parserBlockFactories: Partial<Record<ParserBlockId, () => ParserBlock>> = {
  "naver.se2.textNode": () => new NaverSe2TextNodeBlock(),
  "naver.se2.bookWidget": () => new NaverSe2BookWidgetBlock(),
  "naver.se2.container": () => new NaverSe2ContainerBlock(),
  "naver.se2.table": () => new NaverSe2TableBlock(),
  "naver.se2.divider": () => new NaverSe2DividerBlock(),
  "naver.se2.lineBreak": () => new NaverSe2LineBreakBlock(),
  "naver.se2.quote": () => new NaverSe2QuoteBlock(),
  "naver.se2.heading": () => new NaverSe2HeadingBlock(),
  "naver.se2.code": () => new NaverSe2CodeBlock(),
  "naver.se2.inlineGifVideoFallback": () => new NaverSe2InlineGifVideoFallbackBlock(),
  "naver.se2.image": () => new NaverSe2ImageBlock(),
  "naver.se2.spacer": () => new NaverSe2SpacerBlock(),
  "naver.se2.textElement": () => new NaverSe2TextElementBlock(),
  "naver.se2.fallback": () => new NaverSe2FallbackBlock(),
  "naver.se3.documentTitle": () => new NaverSe3DocumentTitleBlock(),
  "naver.se3.table": () => new NaverSe3TableBlock(),
  "naver.se3.quote": () => new NaverSe3QuoteBlock(),
  "naver.se3.code": () => new NaverSe3CodeBlock(),
  "naver.se3.image": () => new NaverSe3ImageBlock(),
  "naver.se3.representativeUnsupported": () => new NaverSe3RepresentativeUnsupportedBlock(),
  "naver.se3.text": () => new NaverSe3TextBlock(),
  "naver.se3.fallback": () => new NaverSe3FallbackBlock(),
  "naver.se4.documentTitle": () => new NaverSe4DocumentTitleBlock(),
  "naver.se4.formula": () => new NaverSe4FormulaBlock(),
  "naver.se4.code": () => new NaverSe4CodeBlock(),
  "naver.se4.linkCard": () => new NaverSe4LinkCardBlock(),
  "naver.se4.video": () => new NaverSe4VideoBlock(),
  "naver.se4.oembed": () => new NaverSe4OembedBlock(),
  "naver.se4.map": () => new NaverSe4MapBlock(),
  "naver.se4.table": () => new NaverSe4TableBlock(),
  "naver.se4.imageStrip": () => new NaverSe4ImageStripBlock(),
  "naver.se4.imageGroup": () => new NaverSe4ImageGroupBlock(),
  "naver.se4.sticker": () => new NaverSe4StickerBlock(),
  "naver.se4.image": () => new NaverSe4ImageBlock(),
  "naver.se4.heading": () => new NaverSe4HeadingBlock(),
  "naver.se4.divider": () => new NaverSe4DividerBlock(),
  "naver.se4.quote": () => new NaverSe4QuoteBlock(),
  "naver.se4.text": () => new NaverSe4TextBlock(),
  "naver.se4.material": () => new NaverSe4MaterialBlock(),
  "naver.se4.fallback": () => new NaverSe4FallbackBlock(),
}

export type ParserBlockBinding = {
  id: ParserBlockId
  block: ParserBlock
}

export const createParserBlock = (parserBlockId: ParserBlockId): ParserBlockBinding => {
  const factory = parserBlockFactories[parserBlockId]

  if (!factory) {
    throw new Error(`Unknown parser block: ${parserBlockId}`)
  }

  return {
    id: parserBlockId,
    block: factory(),
  }
}

export const createParserBlocksForEditor = (editorId: BlogEditorId) => {
  const editor = getBlogEditorDefinition(editorId)

  return editor?.supportedBlocks.map(createParserBlock) ?? []
}
