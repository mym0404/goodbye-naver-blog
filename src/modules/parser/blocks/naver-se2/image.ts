import type { CheerioAPI } from "cheerio"

import type { ParserBlock } from "../parser-node.js"
import type { ImageData } from "../../../../shared/types.js"
import { compactText, normalizeAssetUrl } from "../../../../shared/utils.js"

const standaloneImageSelector = "img, [thumburl]"

const getStandaloneImages = ({
  $,
  element,
}: {
  $: CheerioAPI
  element: ReturnType<CheerioAPI>
}) => {
  const images = $(element)
    .find(standaloneImageSelector)
    .toArray()
    .map((imageNode): ImageData | null => {
      const $image = $(imageNode)
      const sourceUrl = normalizeAssetUrl($image.attr("src") ?? $image.attr("thumburl") ?? "")

      if (!sourceUrl) {
        return null
      }

      return {
        sourceUrl,
        originalSourceUrl: null,
        alt: $image.attr("alt") ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData
    })
    .filter((image): image is ImageData => image !== null)

  const textWithoutImages = compactText(
    $(element)
      .clone()
      .find(standaloneImageSelector)
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
}

export const se2ImageBlock: ParserBlock = {
  id: "se2-image",
  kind: "leaf",
  match: ({ node, $, $node }) => node.type === "tag" && getStandaloneImages({ $, element: $node }).length > 0,
  convert: ({ $, $node }) => {
    const standaloneImages = getStandaloneImages({ $, element: $node })

    if (standaloneImages.length === 1) {
      return {
        status: "handled",
        blocks: [{ type: "image", image: standaloneImages[0]! }],
      }
    }

    return {
      status: "handled",
      blocks: [{ type: "imageGroup", images: standaloneImages }],
    }
  },
}
