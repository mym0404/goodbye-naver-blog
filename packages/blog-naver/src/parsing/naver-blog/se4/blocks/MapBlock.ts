import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseJsonAttribute } from "../../core/JsonAttribute.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

const buildNaverMapSearchUrl = (query: string) =>
  `https://map.naver.com/p/search/${encodeURIComponent(query)}`

export class NaverSe4MapBlock extends LeafParserBlock {
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

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_map" || $node.hasClass("se-placesMap")
  }

  override convert({
    $node,
    moduleData,
    blockId,
    options,
  }: Parameters<LeafParserBlock["convert"]>[0]) {
    const data = (moduleData?.data ?? {}) as {
      places?: Array<{
        placeId?: string
        name?: string
        address?: string
        bookingUrl?: string | null
      }>
    }

    const placesFromModule = (data.places ?? []).flatMap((place) => {
      /* v8 ignore next */
      const title = compactText(place.name ?? "")
      /* v8 ignore next */
      const description = compactText(place.address ?? "")

      if (!title) {
        return []
      }

      const url =
        typeof place.bookingUrl === "string" && place.bookingUrl.trim()
          ? place.bookingUrl.trim()
          : buildNaverMapSearchUrl(title)

      return {
        name: title,
        address: description,
        url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
      }
    })

    if (placesFromModule.length > 0) {
      return [
        {
          blockId,
          props: {
            places: placesFromModule,
          },
        } satisfies ParsedBlock,
      ]
    }

    const mapLinks = $node.find("a.se-map-info")
    const blocks = mapLinks.toArray().flatMap((node) => {
      const $link = $node.find(node)
      const linkData = parseJsonAttribute($link.attr("data-linkdata"))
      const title =
        compactText($link.find(".se-map-title").text()) || compactText(String(linkData?.name ?? ""))
      /* v8 ignore next */
      const description =
        compactText($link.find(".se-map-address").text()) ||
        compactText(String(linkData?.address ?? ""))

      if (!title) {
        return []
      }

      const url =
        typeof linkData?.bookingUrl === "string" && linkData.bookingUrl.trim()
          ? linkData.bookingUrl.trim()
          : buildNaverMapSearchUrl(title)

      return {
        name: title,
        address: description,
        url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
      }
    })

    if (blocks.length === 0 && (data.places?.length || mapLinks.length > 0)) {
      throw new Error("SE4 map block parsing failed.")
    }

    return blocks.length > 0
      ? [
          {
            blockId,
            props: {
              places: blocks,
            },
          } satisfies ParsedBlock,
        ]
      : []
  }
}
