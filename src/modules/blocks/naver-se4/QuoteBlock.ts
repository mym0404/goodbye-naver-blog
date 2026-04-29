import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import type { OutputOption } from "../../../shared/Types.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext } from "../ParserNode.js"

export class NaverSe4QuoteBlock extends LeafBlock {
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

  override match({ hasQuote }: ParserBlockContext) {
    return Boolean(hasQuote)
  }

  override convert({ $node, options }: Parameters<LeafBlock["convert"]>[0]) {
    const quoteMarkdown = convertHtmlToMarkdown({
      html: $node.find("blockquote.se-quotation-container").html() ?? "",
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    return quoteMarkdown
      ? {
          status: "handled" as const,
          blocks: [{ type: "quote" as const, text: quoteMarkdown }],
        }
      : { status: "skip" as const }
  }
}
