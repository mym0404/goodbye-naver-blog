import { load } from "cheerio"

import type { ParsedBlock, ParsedPost } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { ParserBlockOptions } from "@exitpress/domain/parser/schema/ParserBlockOptions.js"
import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { AnyNode } from "domhandler"

import type { TistoryParserBlockTemplateDefinition } from "./core/TistoryParserBlock.js"

import { TistoryCodeBlock } from "./blocks/CodeBlock.js"
import { TistoryContainerBlock } from "./blocks/ContainerBlock.js"
import { TistoryDividerBlock } from "./blocks/DividerBlock.js"
import { TistoryFileBlock } from "./blocks/FileBlock.js"
import { TistoryHeadingBlock } from "./blocks/HeadingBlock.js"
import { TistoryIgnoreBlock } from "./blocks/IgnoreBlock.js"
import { TistoryImageBlock } from "./blocks/ImageBlock.js"
import { TistoryInlineBlock } from "./blocks/InlineBlock.js"
import { TistoryLinkCardBlock } from "./blocks/LinkCardBlock.js"
import { TistoryListBlock } from "./blocks/ListBlock.js"
import { TistoryMediaBlock } from "./blocks/MediaBlock.js"
import { TistoryParagraphBlock } from "./blocks/ParagraphBlock.js"
import { TistoryQuoteBlock } from "./blocks/QuoteBlock.js"
import { TistoryTableBlock } from "./blocks/TableBlock.js"
import { TistoryTableOfContentsBlock } from "./blocks/TableOfContentsBlock.js"

const blocks = [
  new TistoryIgnoreBlock(),
  new TistoryTableOfContentsBlock(),
  new TistoryLinkCardBlock(),
  new TistoryFileBlock(),
  new TistoryMediaBlock(),
  new TistoryCodeBlock(),
  new TistoryTableBlock(),
  new TistoryDividerBlock(),
  new TistoryImageBlock(),
  new TistoryHeadingBlock(),
  new TistoryQuoteBlock(),
  new TistoryListBlock(),
  new TistoryParagraphBlock(),
  new TistoryContainerBlock(),
  new TistoryInlineBlock(),
]

const contentSelectors = [
  ".tt_article_useless_p_margin",
  "#article-view",
  ".article-view",
  ".article_view",
  ".entry-content",
  ".contents_style",
  "article",
]

const describeNode = (node: AnyNode) => {
  if (node.type !== "tag") {
    return node.type
  }

  const id = node.attribs.id ? `#${node.attribs.id}` : ""
  const classes = node.attribs.class
    ? `.${node.attribs.class.trim().split(/\s+/).filter(Boolean).join(".")}`
    : ""
  const keType = node.attribs["data-ke-type"]
    ? `[data-ke-type=${node.attribs["data-ke-type"]}]`
    : ""

  return `<${node.tagName}${id}${classes}${keType}>`
}

export const getTistoryBlockTemplateDefinitions = (): BlockTemplateDefinition[] =>
  blocks.map((block) => {
    const templateDefinition: TistoryParserBlockTemplateDefinition = block.templateDefinition
    const [firstPreset, ...presets] = templateDefinition.presets

    if (!firstPreset) {
      throw new Error(`Tistory block template has no preset: ${block.id}`)
    }

    const templatePresets: BlockTemplateDefinition["presets"] = [
      { ...firstPreset },
      ...presets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        template: preset.template,
      })),
    ]

    return {
      key: `tistory:${block.id}`,
      label: templateDefinition.label,
      presets: templatePresets,
      props: { ...templateDefinition.props },
    }
  })

export const parseTistoryPostHtml = ({
  html,
  tags = [],
  options,
}: {
  html: string
  tags?: string[]
  options: ParserBlockOptions
}): ParsedPost => {
  const $ = load(html)
  const root = contentSelectors
    .map((selector) => $(selector).first())
    .find(($candidate) => $candidate.length > 0)

  if (!root) {
    throw new Error("Tistory content root not found.")
  }

  const parseNode = (node: AnyNode, path: string): ParsedBlock[] => {
    if (node.type === "comment" || (node.type === "text" && !node.data.trim())) {
      return []
    }

    const $node = $(node)
    const block = blocks.find((candidate) =>
      candidate.match({ $, $node, node, path, options, parseChildren: parseNode }),
    )

    if (!block) {
      throw new Error(`Unsupported Tistory node at ${path}: ${describeNode(node)}`)
    }

    return block.convert({ $, $node, node, path, options, parseChildren: parseNode })
  }

  return {
    tags,
    blocks: root
      .contents()
      .toArray()
      .flatMap((node, index) => parseNode(node, String(index))),
  }
}
