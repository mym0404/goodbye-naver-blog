import { LeafBlock } from "../BaseBlock.js"
import type { OutputOption } from "../../../shared/Types.js"
import type { ParserBlockResult } from "../ParserNode.js"

export class NaverSe2CodeBlock extends LeafBlock {
  override readonly outputId = "code"
  override readonly outputOptions = [
    {
      id: "backtick-fence",
      label: "``` fence",
      description: "backtick fence를 사용합니다.",
      preview: {
        type: "code",
        language: "ts",
        code: "const value = 1",
      },
      isDefault: true,
    },
    {
      id: "tilde-fence",
      label: "~~~ fence",
      description: "tilde fence를 사용합니다.",
      preview: {
        type: "code",
        language: "ts",
        code: "const value = 1",
      },
    },
  ] satisfies OutputOption<"code">[]

  override match({ node }: Parameters<LeafBlock["match"]>[0]) {
    return node.type === "tag" && node.tagName.toLowerCase() === "pre"
  }

  override convert({ $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const code = $node.text().trimEnd()

    return code
      ? {
          status: "handled",
          blocks: [{ type: "code", language: null, code }],
        }
      : { status: "skip" }
  }
}
