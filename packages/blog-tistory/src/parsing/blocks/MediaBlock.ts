import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

export class TistoryMediaBlock extends TistoryParserBlock {
  readonly id = "media"
  readonly label = "미디어"
  readonly templateDefinition = {
    label: this.label,
    presets: [{ id: "media-link", label: "미디어 링크", template: "{{ `[${title}](${url})` }}" }],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      mediaType: { label: "미디어 종류", type: "string" },
    },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" &&
      (["iframe", "video", "audio"].includes(node.tagName) ||
        ["video", "audio", "externalVideo"].includes($node.attr("data-ke-type") ?? ""))
    )
  }

  convert({ $node, node, options }: TistoryParserBlockContext) {
    if (node.type !== "tag") {
      return []
    }

    const mediaNode = ["iframe", "video", "audio"].includes(node.tagName)
      ? $node
      : $node.find("iframe[src], video[src], audio[src], source[src]").first()
    const rawUrl =
      mediaNode.attr("src") ??
      $node.attr("data-video-url") ??
      $node.find("a[href]").first().attr("href")

    if (!rawUrl) {
      return []
    }

    return [
      {
        blockId: `tistory:${this.id}`,
        props: {
          title: $node.attr("title")?.trim() || $node.find("figcaption").text().trim() || "Media",
          url: options.resolveLinkUrl ? options.resolveLinkUrl(rawUrl) : rawUrl,
          mediaType: node.tagName,
        },
      },
    ]
  }
}
