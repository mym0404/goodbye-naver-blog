import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown, sanitizeHtmlFragment } from "../../converter/html-fragment-converter.js"
import type {
  AstBlock,
  ExportOptions,
  ImageData,
  ParsedPost,
  ParsedPostBodyNode,
  StructuredAstBlock,
} from "../../../shared/types.js"
import { compactMarkdownText, compactText, normalizeAssetUrl, unique } from "../../../shared/utils.js"
import {
  createBodyNodesFromStructuredBlocks,
  createFallbackHtmlBodyNode,
} from "../blocks/body-node-utils.js"
import { parseHtmlTable } from "../table-parser.js"
import { BaseEditor } from "./base-editor.js"

const parseTextBlocks = ({
  $,
  $component,
  options,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) =>
  $component
    .find(".se_textarea")
    .toArray()
    .map((node) =>
      convertHtmlToMarkdown({
        html: $(node).html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )
    .map((text) => compactMarkdownText(text))
    .filter(Boolean)
    .map(
      (text) =>
        ({
          type: "paragraph",
          text,
        }) satisfies StructuredAstBlock,
    )

const getStandaloneImages = ({
  $,
  $component,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
}) => {
  const images = $component
    .find("img")
    .toArray()
    .map((node): ImageData | null => {
      const $image = $(node)
      const sourceUrl = $image.attr("data-lazy-src") ?? $image.attr("src") ?? ""

      if (!sourceUrl.trim()) {
        return null
      }

      return {
        sourceUrl: normalizeAssetUrl(sourceUrl),
        originalSourceUrl: null,
        alt: $image.attr("alt") ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData
    })
    .filter((image): image is ImageData => image !== null)

  const textWithoutImages = compactText(
    $component
      .clone()
      .find("img")
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
}

type Se3ComponentContext = {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

type Se3ComponentResult =
  | { status: "handled"; blocks: StructuredAstBlock[] }
  | { status: "fallback"; html: string; reason: string; warnings: string[] }
  | { status: "skip" }

type Se3ComponentBlock = {
  id: string
  match: (context: Se3ComponentContext) => boolean
  convert: (context: Se3ComponentContext) => Se3ComponentResult
}

const se3ComponentBlocks: readonly Se3ComponentBlock[] = [
  {
    id: "se3-document-title",
    match: ({ $component }) => $component.hasClass("se_documentTitle"),
    convert: () => ({ status: "skip" }),
  },
  {
    id: "se3-table",
    match: ({ $component }) => $component.find("table").first().length > 0,
    convert: ({ $, $component }) => {
      const parsedTable = parseHtmlTable({ $, table: $component.find("table").first() })

      return {
        status: "handled",
        blocks: [
          {
            type: "table",
            rows: parsedTable.rows,
            html: parsedTable.html,
            complex: parsedTable.complex,
          },
        ],
      }
    },
  },
  {
    id: "se3-quote",
    match: ({ $component }) => $component.find("blockquote").first().length > 0,
    convert: ({ $component, options }) => {
      const markdown = convertHtmlToMarkdown({
        html: $component.find("blockquote").first().html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      })

      return markdown
        ? { status: "handled", blocks: [{ type: "quote", text: markdown }] }
        : { status: "skip" }
    },
  },
  {
    id: "se3-code",
    match: ({ $component }) => $component.find("pre").first().length > 0,
    convert: ({ $component }) => {
      const code = $component.find("pre").first().text().trimEnd()

      return code
        ? { status: "handled", blocks: [{ type: "code", language: null, code }] }
        : { status: "skip" }
    },
  },
  {
    id: "se3-image",
    match: ({ $, $component }) => getStandaloneImages({ $, $component }).length > 0,
    convert: ({ $, $component }) => {
      const standaloneImages = getStandaloneImages({ $, $component })

      if (standaloneImages.length === 1) {
        return {
          status: "handled",
          blocks: [{ type: "image", image: standaloneImages[0]! }],
        }
      }

      return {
        status: "handled",
        blocks: [{ type: "imageGroup", images: standaloneImages }],
      }
    },
  },
  {
    id: "se3-representative-unsupported",
    match: ({ $component }) =>
      ($component.hasClass("se_horizontalLine") && $component.find(".se_hr > hr").length > 0) ||
      ($component.hasClass("se_oglink") && $component.hasClass("og_bSize")),
    convert: ({ $, $component }) => {
      const className = $component.attr("class") ?? "unknown"

      return {
        status: "fallback",
        html: sanitizeHtmlFragment($.html($component) ?? ""),
        reason: `se3:${className}`,
        warnings: [`SE3 대표 미지원 블록을 원본 HTML로 보존했습니다: ${className}`],
      }
    },
  },
  {
    id: "se3-text",
    match: ({ $component }) => $component.find(".se_textarea").length > 0,
    convert: ({ $, $component, options }) => {
      const blocks = parseTextBlocks({ $, $component, options })

      return blocks.length > 0 ? { status: "handled", blocks } : { status: "skip" }
    },
  },
  {
    id: "se3-fallback",
    match: () => true,
    convert: ({ $, $component }) => {
      const className = $component.attr("class") ?? "unknown"

      return {
        status: "fallback",
        html: sanitizeHtmlFragment($.html($component) ?? ""),
        reason: `se3:${className}`,
        warnings: [`SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: ${className}`],
      }
    },
  },
]

export type ParseSe3PostInput = {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE3Editor extends BaseEditor<ParseSe3PostInput> {
  parse({ $, tags, options }: ParseSe3PostInput): ParsedPost {
    const warnings: string[] = []
    const blocks: AstBlock[] = []
    const body: ParsedPostBodyNode[] = []
    const container = $("#viewTypeSelector .se_component_wrap.sect_dsc").first()

    const pushBlocks = (nextBlocks: StructuredAstBlock[]) => {
      blocks.push(...nextBlocks)
      body.push(...createBodyNodesFromStructuredBlocks(nextBlocks))
    }

    const pushFallback = ({
      html,
      reason,
      nextWarnings,
    }: {
      html: string
      reason: string
      nextWarnings: string[]
    }) => {
      if (!html) {
        return
      }

      warnings.push(...nextWarnings)
      body.push(createFallbackHtmlBodyNode({ html, reason, warnings: nextWarnings }))
    }

    container.children(".se_component").toArray().forEach((node) => {
      const $component = $(node)
      const context = { $, $component, options }
      const block = se3ComponentBlocks.find((componentBlock) => componentBlock.match(context))
      const result = block?.convert(context)

      if (!result || result.status === "skip") {
        return
      }

      if (result.status === "handled") {
        pushBlocks(result.blocks)
        return
      }

      pushFallback({
        html: result.html,
        reason: result.reason,
        nextWarnings: result.warnings,
      })
    })

    return {
      editorVersion: 3,
      tags: unique(tags),
      body,
      blocks,
      warnings: unique(warnings),
      videos: [],
    } satisfies ParsedPost
  }
}
