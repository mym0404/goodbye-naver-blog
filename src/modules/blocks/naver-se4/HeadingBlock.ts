import { convertHtmlToMarkdown } from "../../converter/HtmlFragmentConverter.js"
import type { OutputOption } from "../../../shared/Types.js"
import { compactText } from "../../../shared/Utils.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext } from "../ParserNode.js"

export class NaverSe4HeadingBlock extends LeafBlock {
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

  override match({ $node }: ParserBlockContext) {
    return $node.hasClass("se-sectionTitle")
  }

  override convert({ $node, options }: Parameters<LeafBlock["convert"]>[0]) {
    const title = compactText(
      convertHtmlToMarkdown({
        html: $node.find(".se-module-text").html() ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )

    return title
      ? {
          status: "handled" as const,
          blocks: [{ type: "heading" as const, level: 2 as const, text: title }],
        }
      : { status: "skip" as const }
  }
}
