import type { CheerioAPI } from "cheerio"
import { load } from "cheerio"

import { convertHtmlToMarkdown } from "../../converter/html-fragment-converter.js"
import type {
  AstBlock,
  ExportOptions,
  ImageData,
  ParsedPost,
  ParsedPostBodyNode,
  UnknownRecord,
  VideoData,
} from "../../../shared/types.js"
import { compactMarkdownText, compactText, normalizeAssetUrl, unique } from "../../../shared/utils.js"
import {
  createBodyNodesFromStructuredBlocks,
  createFallbackHtmlBodyNode,
} from "../blocks/body-node-utils.js"
import { BaseEditor } from "./base-editor.js"
import { parseHtmlTable } from "../table-parser.js"

type Se4FallbackHtmlBlock = {
  type: "fallbackHtml"
  html: string
  reason: string
}

type Se4ParsedBlock = AstBlock | Se4FallbackHtmlBlock

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

const se4ImageLinkSelector = "a.se-module-image-link, a.__se_image_link"

const getComponentModule = ($component: ReturnType<CheerioAPI>) => {
  const moduleScript = $component.find("script.__se_module_data").first()

  return (
    parseJsonAttribute(moduleScript.attr("data-module-v2")) ??
    parseJsonAttribute(moduleScript.attr("data-module"))
  )
}

const getComponentHtml = ({
  $,
  $component,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
}) => {
  const clone = $component.clone()
  clone.find("script.__se_module_data").remove()

  return $.html(clone).trim()
}

const parseImageLink = ($link: ReturnType<CheerioAPI>) => {
  const linkData = parseJsonAttribute($link.attr("data-linkdata"))
  const imageNode = $link.find("img").first()
  const sourceUrl = [
    typeof linkData?.src === "string" ? linkData.src : null,
    imageNode.attr("data-lazy-src"),
    imageNode.attr("src"),
  ]
    .find((candidate): candidate is string => Boolean(candidate?.trim()))
    ?.trim()

  const caption = compactText($link.closest(".se-component").find(".se-image-caption").text()) || null

  if (!sourceUrl) {
    return null
  }

  return {
    sourceUrl: normalizeAssetUrl(sourceUrl),
    originalSourceUrl: typeof linkData?.src === "string" ? normalizeAssetUrl(linkData.src) : null,
    alt: imageNode.attr("alt") ?? "",
    caption,
    mediaKind: "image",
  } satisfies ImageData
}

const buildNaverMapSearchUrl = (query: string) =>
  `https://map.naver.com/p/search/${encodeURIComponent(query)}`

const parseStickerBlock = ($component: ReturnType<CheerioAPI>) => {
  const stickerLink = $component.find("a.__se_sticker_link").first()
  const linkData = parseJsonAttribute(stickerLink.attr("data-linkdata"))
  const previewSourceUrl = $component.find("img.se-sticker-image").attr("src")?.trim() ?? null
  const originalSourceUrl = typeof linkData?.src === "string" ? linkData.src.trim() : null
  const sourceUrl = [previewSourceUrl, originalSourceUrl]
    .find((candidate): candidate is string => Boolean(candidate?.trim()))
    ?.trim()

  if (!sourceUrl) {
    return null
  }

  return {
    type: "image",
    image: {
      sourceUrl: normalizeAssetUrl(sourceUrl),
      originalSourceUrl: originalSourceUrl ? normalizeAssetUrl(originalSourceUrl) : null,
      alt: "",
      caption: null,
      mediaKind: "sticker",
    },
  } satisfies AstBlock
}

const parseImageStripBlock = ($component: ReturnType<CheerioAPI>) => {
  const images = $component
    .find(se4ImageLinkSelector)
    .toArray()
    .map((node): ImageData | null => parseImageLink($component.find(node)))
    .filter((image): image is ImageData => image !== null)

  if (images.length === 0) {
    return null
  }

  return {
    type: "imageGroup",
    images,
  } satisfies AstBlock
}

const parsePlacesMapBlock = ({
  $component,
  moduleData,
}: {
  $component: ReturnType<CheerioAPI>
  moduleData: UnknownRecord | null
}): Extract<AstBlock, { type: "linkCard" }>[] => {
  const data = (moduleData?.data ?? {}) as {
    places?: Array<{
      placeId?: string
      name?: string
      address?: string
      bookingUrl?: string | null
    }>
  }

  const placesFromModule = (data.places ?? []).flatMap((place) => {
      const title = compactText(place.name ?? "")
      const description = compactText(place.address ?? "")

      if (!title) {
        return []
      }

      return [
        {
          type: "linkCard",
          card: {
            title,
            description,
            url:
              typeof place.bookingUrl === "string" && place.bookingUrl.trim()
                ? place.bookingUrl.trim()
                : buildNaverMapSearchUrl(title),
            imageUrl: null,
          },
        } satisfies Extract<AstBlock, { type: "linkCard" }>,
      ]
    })

  if (placesFromModule.length > 0) {
    return placesFromModule
  }

  return $component
    .find("a.se-map-info")
    .toArray()
    .flatMap((node) => {
      const $link = $component.find(node)
      const linkData = parseJsonAttribute($link.attr("data-linkdata"))
      const title = compactText($link.find(".se-map-title").text()) || compactText(String(linkData?.name ?? ""))
      const description =
        compactText($link.find(".se-map-address").text()) || compactText(String(linkData?.address ?? ""))

      if (!title) {
        return []
      }

      return [
        {
          type: "linkCard",
          card: {
            title,
            description,
            url:
              typeof linkData?.bookingUrl === "string" && linkData.bookingUrl.trim()
                ? linkData.bookingUrl.trim()
                : buildNaverMapSearchUrl(title),
            imageUrl: null,
          },
        } satisfies Extract<AstBlock, { type: "linkCard" }>,
      ]
    })
}

const parseTextBlocks = ({
  $component,
  options,
}: {
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const texts = $component
    .find("p.se-text-paragraph")
    .toArray()
    .map((paragraph) =>
      convertHtmlToMarkdown({
        html: $component.find(paragraph).html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )
    .map((text) => compactMarkdownText(text))
    .filter(Boolean)

  const recommendationBlocks = parseRecommendationTextBlocks(texts)

  if (recommendationBlocks) {
    return recommendationBlocks
  }

  return texts.map(
    (text) =>
      ({
        type: "paragraph",
        text,
      }) satisfies AstBlock,
  )
}

const recommendationHeaderPatterns = [/^추천트렌드/, /^이런 상품 어때요/]
const recommendationNoisePatterns = [
  ...recommendationHeaderPatterns,
  /^요즘 많이 찾는/,
  /^추천검색어/,
]

const isHashtagParagraph = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => token.startsWith("#"))

const parseRecommendationTextBlocks = (texts: string[]) => {
  const recommendationStartIndex = texts.findIndex((text) =>
    recommendationHeaderPatterns.some((pattern) => pattern.test(text)),
  )

  if (recommendationStartIndex === -1 || texts.length - recommendationStartIndex < 6) {
    return null
  }

  const introBlocks = texts.slice(0, recommendationStartIndex).map(
    (text) =>
      ({
        type: "paragraph",
        text,
      }) satisfies AstBlock,
  )
  const items: string[] = []
  let currentItem: string | null = null

  texts.slice(recommendationStartIndex).forEach((text) => {
    if (recommendationNoisePatterns.some((pattern) => pattern.test(text))) {
      return
    }

    if (isHashtagParagraph(text)) {
      if (currentItem) {
        currentItem = `${currentItem} ${text}`.trim()
      }
      return
    }

    if (currentItem) {
      items.push(currentItem)
    }

    currentItem = text
  })

  if (currentItem) {
    items.push(currentItem)
  }

  if (items.length < 3) {
    return null
  }

  return [
    ...introBlocks,
    {
      type: "paragraph",
      text: items.map((item) => `- ${item}`).join("\n"),
    } satisfies AstBlock,
  ]
}

const parseQuoteBlock = ({
  $component,
  options,
}: {
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const quoteMarkdown = convertHtmlToMarkdown({
    html: $component.find("blockquote.se-quotation-container").html() ?? "",
    options,
    resolveLinkUrl: options.resolveLinkUrl,
  })

  if (!quoteMarkdown) {
    return null
  }

  return {
    type: "quote",
    text: quoteMarkdown,
  } satisfies AstBlock
}

const parseHeadingBlock = ({
  $component,
  options,
}: {
  $component: ReturnType<CheerioAPI>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const title = compactText(
    convertHtmlToMarkdown({
      html: $component.find(".se-module-text").html() ?? "",
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    }),
  )

  if (!title) {
    return null
  }

  return {
    type: "heading",
    level: 2,
    text: title,
  } satisfies AstBlock
}

const parseFormulaBlock = ({
  $component,
  moduleData,
  warnings,
}: {
  $component: ReturnType<CheerioAPI>
  moduleData: UnknownRecord
  warnings: string[]
}) => {
  const data = (moduleData.data ?? {}) as {
    html?: string
    latex?: string
    text?: string
    display?: boolean
    inline?: boolean
    isInline?: boolean
  }
  const candidates: string[] = []

  if (data.html) {
    const formulaDocument = load(data.html)

    candidates.push(
      ...formulaDocument(".mq-selectable")
        .toArray()
        .map((node) => compactText(formulaDocument(node).text()))
        .filter(Boolean),
    )
  }

  if (typeof data.latex === "string") {
    candidates.push(compactText(data.latex))
  }

  if (typeof data.text === "string") {
    candidates.push(compactText(data.text))
  }

  candidates.push(compactText($component.text()))

  const formula = candidates
    .map((candidate) => candidate.replace(/^\${1,2}/, "").replace(/\${1,2}$/, "").trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0]

  if (!formula) {
    warnings.push("수식 블록을 해석하지 못해 건너뛰었습니다.")
    return null
  }

  return {
    type: "formula",
    formula,
    display:
      !(data.display === false) &&
      data.inline !== true &&
      data.isInline !== true &&
      !$component.hasClass("se-inline-math") &&
      !$component.hasClass("se-math-inline"),
  } satisfies AstBlock
}

const parseCodeBlock = ($component: ReturnType<CheerioAPI>) => {
  const sourceNode = $component.find(".__se_code_view").first()
  const classNames = sourceNode.attr("class") ?? ""
  const languageMatch = classNames.match(/language-([\w-]+)/)
  const code = sourceNode.text().trimEnd()

  if (!code) {
    return null
  }

  return {
    type: "code",
    language: languageMatch?.[1] ?? null,
    code,
  } satisfies AstBlock
}

const parseLinkCardBlock = ($component: ReturnType<CheerioAPI>) => {
  const infoNode = $component.find(".se-oglink-info")
  const url = infoNode.attr("href") ?? $component.find(".se-oglink-thumbnail").attr("href") ?? ""

  if (!url) {
    return null
  }

  return {
    type: "linkCard",
    card: {
      title: compactText($component.find(".se-oglink-title").text()) || url,
      description: compactText($component.find(".se-oglink-summary").text()),
      url,
      imageUrl: (() => {
        const thumbnailSource = $component.find(".se-oglink-thumbnail-resource").attr("src")

        return thumbnailSource ? normalizeAssetUrl(thumbnailSource) : null
      })(),
    },
  } satisfies AstBlock
}

const parseOembedBlock = ({
  moduleData,
}: {
  moduleData: UnknownRecord
}) => {
  const data = (moduleData.data ?? {}) as {
    html?: string
    inputUrl?: string
    thumbnailUrl?: string
    description?: string
    title?: string
    providerUrl?: string
  }
  const iframeUrl =
    typeof data.html === "string" && data.html
      ? load(data.html)("iframe").attr("src") ?? null
      : null
  const url = data.inputUrl ?? iframeUrl ?? data.providerUrl ?? ""

  if (!url) {
    return null
  }

  return {
    type: "linkCard",
    card: {
      title: compactText(data.title ?? "") || url,
      description: compactText(data.description ?? ""),
      url,
      imageUrl:
        typeof data.thumbnailUrl === "string" ? normalizeAssetUrl(data.thumbnailUrl) : null,
    },
  } satisfies AstBlock
}

const parseVideoBlock = ({
  moduleData,
  sourceUrl,
}: {
  moduleData: UnknownRecord
  sourceUrl: string
}) => {
  const data = (moduleData.data ?? {}) as {
    thumbnail?: string
    vid?: string
    inkey?: string
    mediaMeta?: {
      title?: string
    }
    width?: string
    height?: string
  }

  return {
    type: "video",
    video: {
      title: data.mediaMeta?.title?.trim() || "Video",
      thumbnailUrl: data.thumbnail ? normalizeAssetUrl(data.thumbnail) : null,
      sourceUrl,
      vid: data.vid ?? null,
      inkey: data.inkey ?? null,
      width: data.width ? Number(data.width) : null,
      height: data.height ? Number(data.height) : null,
    },
  } satisfies AstBlock
}

const parseTableBlock = ({
  $,
  $component,
  warnings,
  options,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
  warnings: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const table = $component.find("table").first()

  if (table.length === 0) {
    warnings.push("표 블록을 표로 해석하지 못해 원본 HTML로 보존했습니다.")

    return {
      type: "fallbackHtml",
      html: getComponentHtml({ $, $component }),
      reason: "table-fallback",
    } satisfies Se4ParsedBlock
  }

  const parsedTable = parseHtmlTable({ $, table })

  return {
    type: "table",
    rows: parsedTable.rows,
    html: parsedTable.html,
    complex: parsedTable.complex,
  } satisfies AstBlock
}

const parseMaterialBlock = ($component: ReturnType<CheerioAPI>) => {
  const materialLink = $component.find("a.se-module-material").first()
  const linkData = parseJsonAttribute(materialLink.attr("data-linkdata"))
  const url = materialLink.attr("href") ?? (typeof linkData?.link === "string" ? linkData.link : "")

  if (!url) {
    return null
  }

  const description = materialLink
    .find(".se-material-detail")
    .children()
    .toArray()
    .reduce(
      (state, node) => {
        const $node = materialLink.find(node)

        if ($node.hasClass("se-material-detail-title")) {
          return {
            currentTitle: compactText($node.text()),
            entries: state.entries,
          }
        }

        if (!$node.hasClass("se-material-detail-description")) {
          return state
        }

        const detail = compactText($node.text())

        if (!detail) {
          return state
        }

        return {
          currentTitle: "",
          entries: [
            ...state.entries,
            state.currentTitle ? `${state.currentTitle}: ${detail}` : detail,
          ],
        }
      },
      {
        currentTitle: "",
        entries: [] as string[],
      },
    )
    .entries.join(" / ")

  const thumbnailSource =
    materialLink.find(".se-material-thumbnail-resource").attr("src") ??
    (typeof linkData?.thumbnail === "string" ? linkData.thumbnail : null)

  return {
    type: "linkCard",
    card: {
      title:
        compactText(materialLink.find(".se-material-title").text()) ||
        (typeof linkData?.title === "string" ? compactText(linkData.title) : "") ||
        url,
      description,
      url,
      imageUrl: thumbnailSource ? normalizeAssetUrl(thumbnailSource) : null,
    },
  } satisfies AstBlock
}

const parseUnsupportedComponent = ({
  $,
  $component,
  warnings,
  options,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
  warnings: string[]
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const className = $component.attr("class") ?? "unknown"
  const html = getComponentHtml({ $, $component })

  warnings.push(`지원하지 않는 SE4 블록을 원본 HTML로 보존했습니다: ${className}`)
  return {
    type: "fallbackHtml",
    html,
    reason: `unsupported:${className}`,
  } satisfies Se4ParsedBlock
}

const parseImageBlock = ($component: ReturnType<CheerioAPI>) => {
  const image = parseImageLink($component.find(se4ImageLinkSelector).first())

  if (!image) {
    return null
  }

  return {
    type: "image",
    image,
  } satisfies AstBlock
}

const parseImageGroupBlock = ($component: ReturnType<CheerioAPI>) => {
  const images = $component
    .find(se4ImageLinkSelector)
    .toArray()
    .map((node): ImageData | null => parseImageLink($component.find(node)))
    .filter((image): image is ImageData => image !== null)

  if (images.length === 0) {
    return null
  }

  return {
    type: "imageGroup",
    images,
  } satisfies AstBlock
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
  parse({
    $,
    sourceUrl,
    tags,
    options,
  }: ParseSe4PostInput) {
  const warnings: string[] = []
  const blocks: AstBlock[] = []
  const body: ParsedPostBodyNode[] = []

  const pushBlocks = (nextBlocks: Se4ParsedBlock[], fallbackWarnings: string[] = []) => {
    const structuredBlocks = nextBlocks.filter((block): block is AstBlock => block.type !== "fallbackHtml")

    blocks.push(...structuredBlocks)
    body.push(...createBodyNodesFromStructuredBlocks(structuredBlocks))

    nextBlocks
      .filter((block): block is Se4FallbackHtmlBlock => block.type === "fallbackHtml")
      .forEach((block) => {
        body.push(
          createFallbackHtmlBodyNode({
            html: block.html,
            reason: block.reason,
            warnings: fallbackWarnings,
          }),
        )
      })
  }

  type Se4ComponentContext = {
    $component: ReturnType<CheerioAPI>
    moduleData: UnknownRecord | null
    moduleType: string | null
    hasQuote: boolean
  }
  type Se4ComponentBlock = {
    id: string
    match: (context: Se4ComponentContext) => boolean
    convert: (context: Se4ComponentContext) => Se4ParsedBlock[]
  }
  const componentBlocks: readonly Se4ComponentBlock[] = [
    {
      id: "se4-document-title",
      match: ({ $component }) => $component.hasClass("se-documentTitle"),
      convert: () => [],
    },
    {
      id: "se4-formula",
      match: ({ moduleType, moduleData }) => moduleType === "v2_formula" && Boolean(moduleData),
      convert: ({ $component, moduleData }) => {
        const formulaBlock = moduleData ? parseFormulaBlock({ $component, moduleData, warnings }) : null

        return formulaBlock ? [formulaBlock] : []
      },
    },
    {
      id: "se4-code",
      match: ({ $component, moduleType }) => moduleType === "v2_code" || $component.hasClass("se-code"),
      convert: ({ $component }) => {
        const codeBlock = parseCodeBlock($component)

        return codeBlock ? [codeBlock] : []
      },
    },
    {
      id: "se4-link-card",
      match: ({ $component, moduleType }) => moduleType === "v2_oglink" || $component.hasClass("se-oglink"),
      convert: ({ $component }) => {
        const linkCard = parseLinkCardBlock($component)

        return linkCard ? [linkCard] : []
      },
    },
    {
      id: "se4-video",
      match: ({ $component, moduleType }) => moduleType === "v2_video" || $component.hasClass("se-video"),
      convert: ({ moduleData }) => [parseVideoBlock({ moduleData: moduleData ?? {}, sourceUrl })],
    },
    {
      id: "se4-oembed",
      match: ({ $component, moduleType }) => moduleType === "v2_oembed" || $component.hasClass("se-oembed"),
      convert: ({ moduleData }) => {
        const oembedBlock = parseOembedBlock({
          moduleData: moduleData ?? {},
        })

        if (!oembedBlock) {
          warnings.push("oEmbed 블록을 해석하지 못해 건너뛰었습니다.")
          return []
        }

        return [oembedBlock]
      },
    },
    {
      id: "se4-map",
      match: ({ $component, moduleType }) => moduleType === "v2_map" || $component.hasClass("se-placesMap"),
      convert: ({ $component, moduleData }) =>
        parsePlacesMapBlock({
          $component,
          moduleData,
        }),
    },
    {
      id: "se4-table",
      match: ({ $component, moduleType }) => moduleType === "v2_table" || $component.hasClass("se-table"),
      convert: ({ $component }) => {
        const tableBlock = parseTableBlock({
          $,
          $component,
          warnings,
          options,
        })

        return tableBlock ? [tableBlock] : []
      },
    },
    {
      id: "se4-image-strip",
      match: ({ $component }) => $component.hasClass("se-imageStrip"),
      convert: ({ $component }) => {
        const imageStrip = parseImageStripBlock($component)

        return imageStrip ? [imageStrip] : []
      },
    },
    {
      id: "se4-image-group",
      match: ({ moduleType }) => moduleType === "v2_imageGroup",
      convert: ({ $component }) => {
        const imageGroup = parseImageGroupBlock($component)

        return imageGroup ? [imageGroup] : []
      },
    },
    {
      id: "se4-sticker",
      match: ({ $component }) => $component.hasClass("se-sticker"),
      convert: ({ $component }) => {
        const stickerBlock = parseStickerBlock($component)

        return stickerBlock ? [stickerBlock] : []
      },
    },
    {
      id: "se4-image",
      match: ({ $component }) => $component.hasClass("se-image"),
      convert: ({ $component }) => {
        const imageBlock = parseImageBlock($component)

        return imageBlock ? [imageBlock] : []
      },
    },
    {
      id: "se4-heading",
      match: ({ $component }) => $component.hasClass("se-sectionTitle"),
      convert: ({ $component }) => {
        const headingBlock = parseHeadingBlock({
          $component,
          options,
        })

        return headingBlock ? [headingBlock] : []
      },
    },
    {
      id: "se4-divider",
      match: ({ $component }) => $component.hasClass("se-horizontalLine"),
      convert: () => [{ type: "divider" }],
    },
    {
      id: "se4-quote",
      match: ({ hasQuote }) => hasQuote,
      convert: ({ $component }) => {
        const quoteBlock = parseQuoteBlock({
          $component,
          options,
        })

        return quoteBlock ? [quoteBlock] : []
      },
    },
    {
      id: "se4-text",
      match: ({ $component, moduleType }) => moduleType === "v2_text" || $component.hasClass("se-text"),
      convert: ({ $component }) =>
        parseTextBlocks({
          $component,
          options,
        }),
    },
    {
      id: "se4-material",
      match: ({ $component }) => $component.hasClass("se-material"),
      convert: ({ $component }) => {
        const materialBlock = parseMaterialBlock($component)

        if (!materialBlock) {
          warnings.push("material 블록을 해석하지 못해 건너뛰었습니다.")
          return []
        }

        return [materialBlock]
      },
    },
    {
      id: "se4-fallback",
      match: () => true,
      convert: ({ $component }) => {
        const fallbackBlock = parseUnsupportedComponent({
          $,
          $component,
          warnings,
          options,
        })

        return fallbackBlock ? [fallbackBlock] : []
      },
    },
  ]

  $("#viewTypeSelector .se-component")
    .toArray()
    .forEach((componentNode) => {
      const $component = $(componentNode)
      const moduleData = getComponentModule($component)
      const moduleType = typeof moduleData?.type === "string" ? moduleData.type : null
      const context = {
        $component,
        moduleData,
        moduleType,
        hasQuote: $component.find("blockquote.se-quotation-container").length > 0,
      }
      const warningStart = warnings.length
      const componentBlock = componentBlocks.find((block) => block.match(context))

      pushBlocks(componentBlock?.convert(context) ?? [], warnings.slice(warningStart))
    })

  const videos = blocks
    .filter((block): block is Extract<AstBlock, { type: "video" }> => block.type === "video")
    .map((block) => block.video)

  return {
    editorVersion: 4,
    tags: unique(tags),
    body,
    blocks,
    warnings: unique(warnings),
    videos,
    } satisfies ParsedPost
  }
}
