import type { CheerioAPI } from "cheerio"

import type { ImageData, OutputOption } from "../../../shared/Types.js"
import { compactText, normalizeAssetUrl } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"

const getStandaloneImages = ({
  $,
  $component,
}: {
  $: CheerioAPI
  $component: ReturnType<CheerioAPI>
}) => {
  const images = $component
    .find("img")
    .toArray()
    .map((node): ImageData | null => {
      const $image = $(node)
      const sourceUrl = $image.attr("data-lazy-src") ?? $image.attr("src") ?? ""

      if (!sourceUrl.trim()) {
        return null
      }

      return {
        sourceUrl: normalizeAssetUrl(sourceUrl),
        originalSourceUrl: null,
        alt: $image.attr("alt") ?? "",
        caption: null,
        mediaKind: "image",
      } satisfies ImageData
    })
    .filter((image): image is ImageData => image !== null)

  const textWithoutImages = compactText(
    $component
      .clone()
      .find("img")
      .remove()
      .end()
      .text(),
  )

  return textWithoutImages ? [] : images
}

export class NaverSe3ImageBlock extends LeafBlock {
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

  override match({ $, $node }: ParserBlockContext) {
    return getStandaloneImages({ $, $component: $node }).length > 0
  }

  override convert({ $, $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const standaloneImages = getStandaloneImages({ $, $component: $node })

    if (standaloneImages.length === 1) {
      return {
        status: "handled" as const,
        blocks: [{ type: "image" as const, image: standaloneImages[0]! }],
      }
    }

    return {
      status: "handled" as const,
      blocks: [{ type: "imageGroup" as const, images: standaloneImages }],
    }
  }
}
