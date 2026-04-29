import type { CheerioAPI } from "cheerio"

import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"
import type { ImageData, OutputOption } from "../../../shared/Types.js"
import { compactText, normalizeAssetUrl } from "../../../shared/Utils.js"

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

export class NaverSe2ImageBlock extends LeafBlock {
  override readonly outputId = "image"
  override readonly outputOptions = [
    {
      id: "markdown-image",
      label: "일반 Markdown 이미지",
      description: "이미지를 `![alt](url)` 형식으로 출력합니다.",
      preview: {
        type: "image",
        image: {
          sourceUrl: "https://example.com/image.png",
          originalSourceUrl: "https://example.com/image.png",
          alt: "diagram",
          caption: "caption",
          mediaKind: "image",
        },
      },
      isDefault: true,
    },
    {
      id: "linked-image",
      label: "원본 링크 감싸기",
      description: "이미지를 원본 링크로 감싼 뒤 출력합니다.",
      preview: {
        type: "image",
        image: {
          sourceUrl: "https://example.com/image.png",
          originalSourceUrl: "https://example.com/image.png",
          alt: "diagram",
          caption: "caption",
          mediaKind: "image",
        },
      },
    },
    {
      id: "source-only",
      label: "링크만 남기기",
      description: "이미지 대신 링크 텍스트만 남깁니다.",
      preview: {
        type: "image",
        image: {
          sourceUrl: "https://example.com/image.png",
          originalSourceUrl: "https://example.com/image.png",
          alt: "diagram",
          caption: "caption",
          mediaKind: "image",
        },
      },
    },
  ] satisfies OutputOption<"image">[]

  override match({ node, $, $node }: ParserBlockContext) {
    return node.type === "tag" && getStandaloneImages({ $, element: $node }).length > 0
  }

  override convert({ $, $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
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
  }
}
