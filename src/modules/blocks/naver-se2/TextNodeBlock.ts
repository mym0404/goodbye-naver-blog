import type { OutputOption } from "../../../shared/Types.js"
import { compactText } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext, ParserBlockResult } from "../ParserNode.js"

export class NaverSe2TextNodeBlock extends LeafBlock {
  override readonly outputId = "paragraph"
  override readonly outputOptions = [
    {
      id: "markdown-paragraph",
      label: "Markdown 문단",
      description: "정규화된 문단 텍스트를 그대로 출력합니다.",
      preview: {
        type: "paragraph",
        text: "첫 줄입니다.\n\n둘째 문단입니다.",
      },
      isDefault: true,
    },
  ] satisfies OutputOption<"paragraph">[]

  override match({ node }: ParserBlockContext) {
    return node.type === "text"
  }

  override convert({ node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const text = node.type === "text" ? compactText(node.data ?? "") : ""

    return text
      ? {
          status: "handled",
          blocks: [{ type: "paragraph", text }],
        }
      : { status: "skip" }
  }
}
