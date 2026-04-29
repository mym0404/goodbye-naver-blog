import { LeafBlock } from "../BaseBlock.js"
import type { OutputOption } from "../../../shared/Types.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"

export class NaverSe3CodeBlock extends LeafBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.find("pre").first().length > 0
  }

  override convert({ $node }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const code = $node.find("pre").first().text().trimEnd()

    return code
      ? {
          status: "handled" as const,
          blocks: [{ type: "code" as const, language: null, code }],
        }
      : { status: "skip" as const }
  }
}
