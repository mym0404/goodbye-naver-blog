import type { OutputOption } from "../../../shared/Types.js"
import { compactText, normalizeAssetUrl } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext, ParserBlockResult } from "../ParserNode.js"

export class NaverSe4LinkCardBlock extends LeafBlock {
  override readonly outputId = "linkCard"
  override readonly outputOptions = [
    {
      id: "title-link",
      label: "제목 링크",
      description: "카드 제목을 링크로 출력합니다.",
      preview: {
        type: "linkCard",
        card: {
          title: "External article",
          description: "preview text",
          url: "https://example.com/article",
          imageUrl: "https://example.com/cover.png",
        },
      },
      isDefault: true,
    },
  ] satisfies OutputOption<"linkCard">[]

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_oglink" || $node.hasClass("se-oglink")
  }

  override convert({ $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const infoNode = $node.find(".se-oglink-info")
    const url = infoNode.attr("href") ?? $node.find(".se-oglink-thumbnail").attr("href") ?? ""

    if (!url) {
      return { status: "skip" }
    }

    return {
      status: "handled",
      blocks: [
        {
          type: "linkCard",
          card: {
            title: compactText($node.find(".se-oglink-title").text()) || url,
            description: compactText($node.find(".se-oglink-summary").text()),
            url,
            imageUrl: (() => {
              const thumbnailSource = $node.find(".se-oglink-thumbnail-resource").attr("src")

              return thumbnailSource ? normalizeAssetUrl(thumbnailSource) : null
            })(),
          },
        },
      ],
    }
  }
}
