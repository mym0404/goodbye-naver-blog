import { LeafBlock } from "../BaseBlock.js"
import type { OutputOption } from "../../../shared/Types.js"
import type { ParserBlockContext, ParserBlockResult } from "../ParserNode.js"
import { parseImageLink, se4ImageLinkSelector } from "./ImageLink.js"

export class NaverSe4ImageBlock extends LeafBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-image")
  }

  override convert({ $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const image = parseImageLink($node.find(se4ImageLinkSelector).first())

    return image
      ? {
          status: "handled",
          blocks: [{ type: "image", image }],
        }
      : { status: "skip" }
  }
}
