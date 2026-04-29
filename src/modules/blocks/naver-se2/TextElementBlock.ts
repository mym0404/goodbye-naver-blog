import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import type { OutputOption } from "../../../shared/Types.js"
import { compactText } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext, ParserBlockResult } from "../ParserNode.js"

export class NaverSe2TextElementBlock extends LeafBlock {
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

  override match({ node, $node }: ParserBlockContext) {
    if (node.type !== "tag") {
      return false
    }

    if (compactText($node.text()) === "") {
      return false
    }

    return !["table", "hr", "br", "blockquote", "pre"].includes(node.tagName.toLowerCase())
  }

  override convert({ $, $node, node, options }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
    if (node.type !== "tag") {
      return { status: "skip" }
    }

    const html = $.html($node) ?? ""
    const markdown = convertHtmlToMarkdown({
      html,
      options,
      resolveLinkUrl: options.resolveLinkUrl,
    })

    if (markdown) {
      return {
        status: "handled",
        blocks: [{ type: "paragraph", text: markdown }],
      }
    }

    const text = compactText($node.text())

    return text
      ? {
          status: "handled",
          blocks: [{ type: "paragraph", text }],
          warnings: [`SE2 블록을 구조화하지 못해 텍스트로 축약했습니다: <${node.tagName.toLowerCase()}>`],
        }
      : { status: "skip" }
  }
}
