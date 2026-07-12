import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { UnknownRecord } from "@exitpress/engine/shared/object/UnknownRecord.js"
import type { AnyNode } from "domhandler"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseJsonAttribute } from "../../core/JsonAttribute.js"
import { createVideoBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot } from "./util/ComponentBoundary.js"

const parseDimension = (value: unknown) => {
  if (typeof value === "string" && !compactText(value)) {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const getRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {}

const getAdjacentModuleScripts = ({ $, $node }: Pick<ParserBlockContext, "$" | "$node">) => {
  const scripts: AnyNode[] = []
  const siblings = $node.nextAll()

  for (let index = 0; index < siblings.length; index += 1) {
    const sibling = siblings[index]!
    const $sibling = $(sibling)

    if ($sibling.hasClass("se_component")) {
      break
    }

    if ($sibling.is("script.__se_module_data")) {
      scripts.push(sibling)
    }
  }

  return scripts
}

const getVideoModuleData = ({ $, $node }: Pick<ParserBlockContext, "$" | "$node">) => {
  const mediaId = findInComponentRoot({ $, $component: $node, selector: ".se_mediaArea[id]" })
    .first()
    .attr("id")
  const moduleScripts = getAdjacentModuleScripts({ $, $node })

  if (!mediaId) {
    return parseJsonAttribute($(moduleScripts[0]).attr("data-module"))
  }

  for (let index = 0; index < moduleScripts.length; index += 1) {
    const moduleData = parseJsonAttribute($(moduleScripts[index]).attr("data-module"))
    const data = getRecord(moduleData?.data)

    if (moduleData?.id === mediaId || data.baseElId === mediaId) {
      return moduleData
    }
  }

  return undefined
}

export class NaverSe3VideoBlock extends LeafParserBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se_video") && $node.hasClass("default")
  }

  override convert({
    $,
    $node,
    sourceUrl = "",
    blockId,
  }: Parameters<LeafParserBlock["convert"]>[0]) {
    const moduleData = getVideoModuleData({ $, $node })
    const data = getRecord(moduleData?.data)
    const title =
      compactText(
        findInComponentRoot({
          $,
          $component: $node,
          selector: ".se_mediaCaption .se_textarea",
        }).text(),
      ) || "Video"

    return [
      createVideoBlock({
        blockId,
        video: {
          title,
          thumbnailUrl: null,
          sourceUrl,
          vid: typeof data.vid === "string" ? data.vid : null,
          inkey: typeof data.inkey === "string" ? data.inkey : null,
          width: parseDimension(data.width),
          height: parseDimension(data.height),
        },
      }),
    ]
  }
}
