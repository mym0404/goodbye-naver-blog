import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"
import type { OutputOption } from "../../../shared/Types.js"
import { compactText } from "../../../shared/Utils.js"

export class NaverSe2HeadingBlock extends LeafBlock {
  override readonly outputId = "heading"
  override readonly outputOptions = [
    {
      id: "markdown-heading",
      label: "Markdown heading",
      description: "ATX heading(`#`) 형식으로 출력합니다.",
      preview: {
        type: "heading",
        level: 2,
        text: "Section title",
      },
      isDefault: true,
      params: [
        {
          key: "levelOffset",
          label: "제목 레벨 오프셋",
          description: "원본 제목 레벨에 더하거나 빼는 값입니다.",
          input: "number",
          defaultValue: 0,
        },
      ],
    },
  ] satisfies OutputOption<"heading">[]

  override match({ node }: ParserBlockContext) {
    return node.type === "tag" && /^h[1-6]$/.test(node.tagName.toLowerCase())
  }

  override convert({ $node, node, options }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    if (node.type !== "tag") {
      return { status: "skip" }
    }

    const level = Number(node.tagName[1])
    const text = compactText(
      convertHtmlToMarkdown({
        html: $node.html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )

    return text
      ? {
          status: "handled",
          blocks: [{ type: "heading", level, text }],
        }
      : { status: "skip" }
  }
}
