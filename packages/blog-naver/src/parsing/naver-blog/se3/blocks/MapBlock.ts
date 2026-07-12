import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { LeafParserBlock } from "../../core/ParserBlock.js"

import { findInComponentRoot } from "./util/ComponentBoundary.js"

const buildNaverMapSearchUrl = (query: string) =>
  `https://map.naver.com/p/search/${encodeURIComponent(query)}`

export class NaverSe3MapBlock extends LeafParserBlock {
  override readonly id = "map"
  override readonly label = "지도"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "place-links",
        label: "장소 링크",
        template:
          "{{ places.map(place => place.address ? `[${place.name}](${place.url})\\n${place.address}` : `[${place.name}](${place.url})`).join('\\n\\n') }}",
      },
    ],
    props: {
      places: {
        label: "장소 목록",
        type: "array",
        items: {
          label: "장소",
          type: "object",
          properties: {
            name: { label: "이름", type: "string" },
            address: { label: "주소", type: "string" },
            url: { label: "URL", type: "string" },
          },
        },
      },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se_map") && $node.hasClass("default")
  }

  override convert({ $, $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const name = compactText(
      findInComponentRoot({ $, $component: $node, selector: ".se_title" })
        .first()
        .contents()
        .first()
        .text(),
    )
    const address = compactText(
      findInComponentRoot({ $, $component: $node, selector: ".se_address" }).first().text(),
    )

    if (!name) {
      throw new Error("SE3 map block parsing failed.")
    }

    const url = buildNaverMapSearchUrl(name)

    return [
      {
        blockId,
        props: {
          places: [
            {
              name,
              address,
              url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
            },
          ],
        },
      } satisfies ParsedBlock,
    ]
  }
}
