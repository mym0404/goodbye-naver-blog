import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { ParsedBlockAsset } from "@exitpress/domain/parser/schema/Media.js"
import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"

import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseJsonAttribute } from "../../core/JsonAttribute.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

const parseCssUrl = (value: string | undefined) => value?.match(/url\((['"]?)(.*?)\1\)/)?.[2]

export class NaverSe4MaterialBlock extends LeafParserBlock {
  override readonly id = "material"
  override readonly label = "자료 링크"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "card",
        label: "썸네일·링크·설명",
        template:
          "{{ `${thumbnailUrl ? `![${title}](${thumbnailUrl})\\n` : ''}[${title}](${url})${description ? `\\n${description}` : ''}` }}",
      },
      { id: "link", label: "링크만", template: "{{ `[${title}](${url})` }}" },
      {
        id: "link-description",
        label: "링크와 설명만",
        template:
          "{{ description ? `[${title}](${url})\\n${description}` : `[${title}](${url})` }}",
      },
    ],
    props: {
      title: { label: "제목", type: "string" },
      url: { label: "URL", type: "string" },
      description: { label: "설명", type: "string" },
      thumbnailUrl: { label: "썸네일 URL", type: "string?" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-material") || $node.find(".not_sponsored_component").length > 0
  }

  override convert({ $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const customCard = $node.find(".not_sponsored_component").first()

    if (customCard.length > 0) {
      const link = customCard.find("a.link").first()
      const url = link.attr("href") ?? ""

      if (!url) {
        throw new Error("SE4 material block parsing failed.")
      }

      const thumbnailSource = parseCssUrl(customCard.find(".thumbnail").attr("style"))
      const description = [customCard.find(".label").text(), customCard.find(".date").text()]
        .map(compactText)
        .filter(Boolean)
        .join(" / ")

      return [
        {
          blockId,
          props: {
            title: compactText(customCard.find(".title").text()) || url,
            description,
            url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
            thumbnailUrl: thumbnailSource ?? null,
          },
          ...(thumbnailSource
            ? {
                assets: {
                  thumbnailUrl: {
                    role: "thumbnail",
                    sourceUrl: thumbnailSource,
                    required: false,
                  } satisfies ParsedBlockAsset,
                },
              }
            : {}),
        } satisfies ParsedBlock,
      ]
    }

    const materialLink = $node.find("a.se-module-material").first()
    const linkData = parseJsonAttribute(materialLink.attr("data-linkdata"))
    const url =
      materialLink.attr("href") ?? (typeof linkData?.link === "string" ? linkData.link : "")

    if (!url) {
      throw new Error("SE4 material block parsing failed.")
    }

    const description = materialLink
      .find(".se-material-detail")
      .children()
      .toArray()
      .reduce(
        (state, node) => {
          const $detailNode = materialLink.find(node)

          if ($detailNode.hasClass("se-material-detail-title")) {
            return {
              currentTitle: compactText($detailNode.text()),
              entries: state.entries,
            }
          }

          if (!$detailNode.hasClass("se-material-detail-description")) {
            return state
          }

          const detail = compactText($detailNode.text())

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

    return [
      {
        blockId,
        props: {
          title:
            compactText(materialLink.find(".se-material-title").text()) ||
            (typeof linkData?.title === "string" ? compactText(linkData.title) : "") ||
            url,
          description,
          url: options.resolveLinkUrl ? options.resolveLinkUrl(url) : url,
          thumbnailUrl: thumbnailSource,
        },
        ...(thumbnailSource
          ? {
              assets: {
                thumbnailUrl: {
                  role: "thumbnail",
                  sourceUrl: thumbnailSource,
                  required: false,
                } satisfies ParsedBlockAsset,
              },
            }
          : {}),
      } satisfies ParsedBlock,
    ]
  }
}
