import { LeafBlock } from "../BaseBlock.js"
import type { OutputOption } from "../../../shared/Types.js"
import type { ParserBlockContext, ParserBlockResult } from "../ParserNode.js"

export class NaverSe2DividerBlock extends LeafBlock {
  override readonly outputId = "divider"
  override readonly outputOptions = [
    {
      id: "dash-rule",
      label: "`---`",
      description: "dash 구분선으로 출력합니다.",
      preview: {
        type: "divider",
      },
      isDefault: true,
    },
    {
      id: "asterisk-rule",
      label: "`***`",
      description: "asterisk 구분선으로 출력합니다.",
      preview: {
        type: "divider",
      },
    },
  ] satisfies OutputOption<"divider">[]

  override match({ node }: ParserBlockContext) {
    return node.type === "tag" && node.tagName.toLowerCase() === "hr"
  }

  override convert(): ParserBlockResult {
    return {
      status: "handled",
      blocks: [{ type: "divider" }],
    }
  }
}
