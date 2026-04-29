import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import type { OutputOption } from "../../../shared/Types.js"
import { compactMarkdownText } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext } from "../ParserNode.js"

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

  const introBlocks = texts.slice(0, recommendationStartIndex).map((text) => ({
    type: "paragraph" as const,
    text,
  }))
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
      type: "paragraph" as const,
      text: items.map((item) => `- ${item}`).join("\n"),
    },
  ]
}

const parseTextBlocks = ({
  $node,
  options,
}: {
  $node: Parameters<LeafBlock["convert"]>[0]["$node"]
  options: ParserBlockContext["options"]
}) => {
  const texts = $node
    .find("p.se-text-paragraph")
    .toArray()
    .map((paragraph) =>
      convertHtmlToMarkdown({
        html: $node.find(paragraph).html() ?? "",
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

  return texts.map((text) => ({
    type: "paragraph" as const,
    text,
  }))
}

export class NaverSe4TextBlock extends LeafBlock {
  override readonly outputId = "paragraph"
  override readonly outputOptions = [
    {
      id: "markdown-paragraph",
      label: "Markdown 문단",
      description: "정규화된 문단 텍스트를 그대로 출력합니다.",
      preview: {
        type: "paragraph",
        text: "첫 줄입니다.\n\n둘째 문단입니다.",
      },
      isDefault: true,
    },
  ] satisfies OutputOption<"paragraph">[]

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_text" || $node.hasClass("se-text")
  }

  override convert({ $node, options }: Parameters<LeafBlock["convert"]>[0]) {
    return {
      status: "handled" as const,
      blocks: parseTextBlocks({ $node, options }),
    }
  }
}
