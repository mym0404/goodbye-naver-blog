import type { CheerioAPI } from "cheerio"

import { convertHtmlToMarkdown, sanitizeHtmlFragment } from "../../converter/html-fragment-converter.js"
import type { AstBlock, ExportOptions, ImageData, ParsedPost, UnsupportedBlockInstance } from "../../../shared/types.js"
import {
  getUnsupportedBlockCaseDefinition,
  resolveUnsupportedBlockCaseSelection,
} from "../../../shared/unsupported-block-cases.js"
import { buildUnsupportedBlockCaseBlocks } from "../../../shared/unsupported-block-resolution.js"
import { compactMarkdownText, compactText, normalizeAssetUrl, unique } from "../../../shared/utils.js"
import { BaseEditor } from "./base-editor.js"
import { parseHtmlTable } from "../table-parser.js"

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
        }) satisfies AstBlock,
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

const parseUnsupportedHorizontalLine = ({
  $component,
}: {
  $component: ReturnType<CheerioAPI>
}) => {
  if (!$component.hasClass("se_horizontalLine") || $component.find(".se_hr > hr").length === 0) {
    return null
  }

  if ($component.hasClass("default")) {
    return {
      caseId: "se3-horizontal-line-default",
      data: {
        blockKind: "horizontalLine",
        styleToken: "default",
      },
    } satisfies {
      caseId: "se3-horizontal-line-default"
      data: UnsupportedBlockInstance<"se3-horizontal-line-default">["data"]
    }
  }

  if ($component.hasClass("line5")) {
    return {
      caseId: "se3-horizontal-line-line5",
      data: {
        blockKind: "horizontalLine",
        styleToken: "line5",
      },
    } satisfies {
      caseId: "se3-horizontal-line-line5"
      data: UnsupportedBlockInstance<"se3-horizontal-line-line5">["data"]
    }
  }

  return null
}

const parseUnsupportedOgLink = ({
  $,
  $component,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
}) => {
  if (!$component.hasClass("se_oglink") || !$component.hasClass("og_bSize")) {
    return null
  }

  const link = $component.find("a.se_og_box").first()
  const url = link.attr("href")?.trim() ?? ""

  if (!url) {
    return null
  }

  return {
    caseId: "se3-oglink-og_bSize",
    data: {
      url,
      title: compactText($component.find(".se_og_tit").first().text()),
      description: compactText($component.find(".se_og_desc").first().text()),
      publisher: compactText($component.find(".se_og_cp").first().text()),
      imageUrl: normalizeAssetUrl($component.find(".se_og_thumb img").first().attr("src") ?? "") || null,
      sizeToken: "og_bSize",
    },
  } satisfies {
    caseId: "se3-oglink-og_bSize"
    data: UnsupportedBlockInstance<"se3-oglink-og_bSize">["data"]
  }
}

const buildUnsupportedBlockInstance = <
  CaseId extends UnsupportedBlockInstance["caseId"],
>({
  caseId,
  blockIndex,
  warningText,
  data,
  blockCount,
}: {
  caseId: CaseId
  blockIndex: number
  warningText: string
  data: UnsupportedBlockInstance<CaseId>["data"]
  blockCount?: number
}): UnsupportedBlockInstance<CaseId> => ({
  caseId,
  blockIndex,
  ...(blockCount ? { blockCount } : {}),
  warningText,
  data,
} as UnsupportedBlockInstance<CaseId>)

export type ParseSe3PostInput = {
  $: CheerioAPI
  tags: string[]
  options: Pick<ExportOptions, "markdown" | "unsupportedBlockCases"> & {
    resolveLinkUrl?: (url: string) => string
  }
}

export class NaverBlogSE3Editor extends BaseEditor<ParseSe3PostInput> {
  parse({
    $,
    tags,
    options,
  }: ParseSe3PostInput) {
  const warnings: string[] = []
  const blocks: AstBlock[] = []
  const unsupportedBlocks: UnsupportedBlockInstance[] = []
  const container = $("#viewTypeSelector .se_component_wrap.sect_dsc").first()

  container.children(".se_component").toArray().forEach((node) => {
    const $component = $(node)
    const standaloneImages = getStandaloneImages({ $, $component })
    const table = $component.find("table").first()
    const blockquote = $component.find("blockquote").first()
    const pre = $component.find("pre").first()

    if ($component.hasClass("se_documentTitle")) {
      return
    }

    if (table.length > 0) {
      const parsedTable = parseHtmlTable({ $, table })
      blocks.push({
        type: "table",
        rows: parsedTable.rows,
        html: parsedTable.html,
        complex: parsedTable.complex,
      })
      return
    }

    if (blockquote.length > 0) {
      const markdown = convertHtmlToMarkdown({
        html: blockquote.html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      })

      if (markdown) {
        blocks.push({
          type: "quote",
          text: markdown,
        })
      }
      return
    }

    if (pre.length > 0) {
      const code = pre.text().trimEnd()

      if (code) {
        blocks.push({
          type: "code",
          language: null,
          code,
        })
      }
      return
    }

    if (standaloneImages.length === 1) {
      blocks.push({
        type: "image",
        image: standaloneImages[0],
      })
      return
    }

    if (standaloneImages.length > 1) {
      blocks.push({
        type: "imageGroup",
        images: standaloneImages,
      })
      return
    }

    const unsupportedCase =
      parseUnsupportedHorizontalLine({
        $component,
      }) ??
      parseUnsupportedOgLink({
        $,
        $component,
      })

    if (unsupportedCase) {
      const warningText = getUnsupportedBlockCaseDefinition(unsupportedCase.caseId)!.warningText
      const blockIndex = blocks.length
      const unsupportedBlock = buildUnsupportedBlockInstance({
        caseId: unsupportedCase.caseId,
        blockIndex,
        warningText,
        data: unsupportedCase.data,
      })
      const resolvedBlocks = buildUnsupportedBlockCaseBlocks({
        unsupportedBlock,
        candidateId: resolveUnsupportedBlockCaseSelection({
          caseId: unsupportedCase.caseId,
          unsupportedBlockCases: options.unsupportedBlockCases,
        }).candidateId,
      })

      if (resolvedBlocks.length > 0) {
        blocks.push(...resolvedBlocks)
        unsupportedBlocks.push(
          buildUnsupportedBlockInstance({
            caseId: unsupportedCase.caseId,
            blockIndex,
            blockCount: resolvedBlocks.length,
            warningText,
            data: unsupportedCase.data,
          }),
        )
        return
      }

      const markdown = convertHtmlToMarkdown({
        html: sanitizeHtmlFragment($.html($component) ?? ""),
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      })

      if (markdown) {
        warnings.push(warningText)
        blocks.push({
          type: "paragraph",
          text: markdown,
        })
        unsupportedBlocks.push(unsupportedBlock)
        return
      }
    }

    const textBlocks = parseTextBlocks({
      $,
      $component,
      options,
    })

    if (textBlocks.length > 0) {
      blocks.push(...textBlocks)
      return
    }

    const markdown = convertHtmlToMarkdown({
      html: sanitizeHtmlFragment($.html($component) ?? ""),
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    if (markdown) {
      warnings.push(`SE3 블록을 구조화하지 못해 텍스트로 변환했습니다: ${$component.attr("class") ?? "unknown"}`)
      blocks.push({
        type: "paragraph",
        text: markdown,
      })
      return
    }

    warnings.push(`SE3 블록을 해석하지 못해 건너뛰었습니다: ${$component.attr("class") ?? "unknown"}`)
  })

  return {
    editorVersion: 3,
    tags: unique(tags),
    blocks,
    unsupportedBlocks,
    warnings: unique(warnings),
    videos: [],
    } satisfies ParsedPost
  }
}
