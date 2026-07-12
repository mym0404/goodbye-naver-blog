import { normalizeAssetUrl } from "@exitpress/blog-naver/NaverUrl.js"
import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { CheerioAPI } from "cheerio"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createVideoBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { hasOnlyTargetContent } from "./util/hasOnlyTargetContent.js"

const parseDimension = (value: string | undefined) => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const parseVideoId = (sourceUrl: string) => {
  try {
    return new URL(sourceUrl).searchParams.get("vid")
  } catch {
    return null
  }
}

const createEmbeddedVideo = ({ iframe }: { iframe: ReturnType<CheerioAPI> }) => {
  const sourceUrl = normalizeAssetUrl(iframe.attr("src") ?? "")

  if (!sourceUrl) {
    return null
  }

  return {
    title: compactText(iframe.attr("title") ?? "") || "Video",
    thumbnailUrl: null,
    sourceUrl,
    vid: parseVideoId(sourceUrl),
    inkey: null,
    width: parseDimension(iframe.attr("width")),
    height: parseDimension(iframe.attr("height")),
  }
}

const getEmbeddedVideos = ({ $, $node }: { $: CheerioAPI; $node: ReturnType<CheerioAPI> }) => {
  if ($node.is("iframe[src]")) {
    if ($node.hasClass("poll_iframe")) {
      return null
    }

    const video = createEmbeddedVideo({ iframe: $node })

    return video ? [video] : null
  }

  if (!$node.is("p, div, span")) {
    return null
  }

  const directIframes = $node.children("iframe[src]").toArray()

  if (directIframes.length > 0) {
    const clone = $node.clone()

    clone.children("iframe[src], style").remove()

    if (clone.find("img, iframe, video, table").length > 0 || compactText(clone.text())) {
      return null
    }

    const videos = directIframes
      .map((iframe) => createEmbeddedVideo({ iframe: $(iframe) }))
      .filter((video) => video !== null)

    return videos.length === directIframes.length ? videos : null
  }

  const isVideoContainer = $node.is("span._outerVideo, span._naverVideo")
  const videoContainers = isVideoContainer
    ? $node
    : $node.find("span._outerVideo, span._naverVideo")

  if (videoContainers.length === 0) {
    return null
  }

  if (!isVideoContainer) {
    if (
      !hasOnlyTargetContent({
        element: $node,
        targetSelector: "span._outerVideo, span._naverVideo",
      })
    ) {
      return null
    }
  }

  const videos = []

  for (const container of videoContainers.toArray()) {
    const iframe = $(container).find("iframe[src]")

    if (iframe.length !== 1) {
      return null
    }

    const video = createEmbeddedVideo({ iframe })

    if (!video) {
      return null
    }

    videos.push(video)
  }

  return videos
}

export class NaverSe2EmbeddedVideoBlock extends LeafParserBlock {
  override readonly id = "video"
  override readonly label = "비디오"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "default",
        label: "썸네일과 링크",
        template:
          "{{ thumbnailUrl ? `![${title}](${thumbnailUrl})\\n[${title}](${url})` : `[${title}](${url})` }}",
      },
    ],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      thumbnailUrl: { label: "썸네일 URL", type: "string?" },
      width: { label: "너비", type: "number?" },
      height: { label: "높이", type: "number?" },
      vid: { label: "비디오 ID", type: "string?" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $, node, $node }: ParserBlockContext) {
    return node.type === "tag" && getEmbeddedVideos({ $, $node }) !== null
  }

  override convert({ $, $node, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const videos = getEmbeddedVideos({ $, $node })

    if (!videos) {
      throw new Error("SE2 embedded video block parsing failed.")
    }

    return videos.map((video) => createVideoBlock({ blockId, video }))
  }
}
