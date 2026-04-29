import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import type { OutputOption } from "../../../shared/Types.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"

export class NaverSe3QuoteBlock extends LeafBlock {
  override readonly outputId = "quote"
  override readonly outputOptions = [
    {
      id: "blockquote",
      label: "blockquote",
      description: "모든 줄 앞에 `>`를 붙입니다.",
      preview: {
        type: "quote",
        text: "Quoted line\nsecond line",
      },
      isDefault: true,
    },
  ] satisfies OutputOption<"quote">[]

  override match({ $node }: ParserBlockContext) {
    return $node.find("blockquote").first().length > 0
  }

  override convert({ $node, options }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    const markdown = convertHtmlToMarkdown({
      html: $node.find("blockquote").first().html() ?? "",
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return markdown
      ? { status: "handled" as const, blocks: [{ type: "quote" as const, text: markdown }] }
      : { status: "skip" as const }
  }
}
