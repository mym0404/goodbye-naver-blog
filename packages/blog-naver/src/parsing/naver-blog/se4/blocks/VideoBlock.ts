import { normalizeAssetUrl } from "@exitpress/blog-naver/NaverUrl.js"

import type { UnknownRecord } from "@exitpress/engine/shared/object/UnknownRecord.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { createVideoBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

export class NaverSe4VideoBlock extends LeafParserBlock {
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

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_video" || $node.hasClass("se-video")
  }

  override convert({ moduleData, sourceUrl, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    const data = (moduleData?.data ?? {}) as UnknownRecord & {
      thumbnail?: string
      vid?: string
      inkey?: string
      mediaMeta?: {
        title?: string
      }
      width?: string
      height?: string
    }

    return [
      createVideoBlock({
        blockId,
        video: {
          title: data.mediaMeta?.title?.trim() || "Video",
          thumbnailUrl: data.thumbnail ? normalizeAssetUrl(data.thumbnail) : null,
          /* v8 ignore next */
          sourceUrl: sourceUrl ?? "",
          vid: data.vid ?? null,
          inkey: data.inkey ?? null,
          width: data.width ? Number(data.width) : null,
          height: data.height ? Number(data.height) : null,
        },
      }),
    ]
  }
}
