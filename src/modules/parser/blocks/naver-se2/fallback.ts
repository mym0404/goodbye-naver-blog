import type { CheerioAPI } from "cheerio"

import { sanitizeHtmlFragment } from "../../../converter/html-fragment-converter.js"
import type { ParserBlock } from "../parser-node.js"
import { compactText, normalizeAssetUrl } from "../../../../shared/utils.js"

const hasInlineGifVideo = ({ $node }: { $node: ReturnType<CheerioAPI> }) => {
  if (!$node.is("p")) {
    return false
  }

  const video = $node.children("video.fx._postImage._gifmp4[data-gif-url]").first()

  if (video.length === 0) {
    return false
  }

  const textWithoutVideo = compactText(
    $node
      .clone()
      .children("video")
      .remove()
      .end()
      .text(),
  )

  return !textWithoutVideo && Boolean(normalizeAssetUrl(video.attr("src") ?? ""))
}

export const se2InlineGifVideoFallbackBlock: ParserBlock = {
  id: "se2-inline-gif-video-fallback",
  kind: "leaf",
  match: ({ node, $node }) => node.type === "tag" && hasInlineGifVideo({ $node }),
  convert: ({ $, $node }) => {
    const html = sanitizeHtmlFragment($.html($node) ?? "")

    return html
      ? {
          status: "fallback",
          html,
          reason: "se2:inline-gif-video",
          warnings: ["SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다."],
        }
      : { status: "skip" }
  },
}

export const se2FallbackBlock: ParserBlock = {
  id: "se2-fallback",
  kind: "leaf",
  match: ({ node }) => node.type === "tag",
  convert: ({ $, $node, node }) => {
    if (node.type !== "tag") {
      return { status: "skip" }
    }

    const html = sanitizeHtmlFragment($.html($node) ?? "")

    return html
      ? {
          status: "fallback",
          html,
          reason: `se2:${node.tagName.toLowerCase()}`,
          warnings: [`SE2 블록을 구조화하지 못해 원본 HTML로 보존했습니다: <${node.tagName.toLowerCase()}>`],
        }
      : { status: "skip" }
  },
}
