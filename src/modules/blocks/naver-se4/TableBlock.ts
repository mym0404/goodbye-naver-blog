import { parseHtmlTable } from "../../parser/TableParser.js"
import type { OutputOption } from "../../../shared/Types.js"
import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockContext } from "../ParserNode.js"

const getComponentHtml = ({
  $,
  $node,
}: {
  $: Parameters<LeafBlock["convert"]>[0]["$"]
  $node: Parameters<LeafBlock["convert"]>[0]["$node"]
}) => {
  const clone = $node.clone()
  clone.find("script.__se_module_data").remove()

  return $.html(clone).trim()
}

export class NaverSe4TableBlock extends LeafBlock {
  override readonly outputId = "table"
  override readonly outputOptions = [
    {
      id: "gfm-or-html",
      label: "GFM 우선",
      description: "단순 표는 GFM, 복잡한 표는 HTML fallback으로 처리합니다.",
      preview: {
        type: "table",
        complex: false,
        html: "<table><tr><th>col</th></tr><tr><td>value</td></tr></table>",
        rows: [
          [{ text: "col", html: "col", colspan: 1, rowspan: 1, isHeader: true }],
          [{ text: "value", html: "value", colspan: 1, rowspan: 1, isHeader: false }],
        ],
      },
      isDefault: true,
    },
    {
      id: "html-only",
      label: "원본 HTML 유지",
      description: "표를 HTML fragment로 유지합니다.",
      preview: {
        type: "table",
        complex: false,
        html: "<table><tr><th>col</th></tr><tr><td>value</td></tr></table>",
        rows: [
          [{ text: "col", html: "col", colspan: 1, rowspan: 1, isHeader: true }],
          [{ text: "value", html: "value", colspan: 1, rowspan: 1, isHeader: false }],
        ],
      },
    },
  ] satisfies OutputOption<"table">[]

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_table" || $node.hasClass("se-table")
  }

  override convert({ $, $node }: Parameters<LeafBlock["convert"]>[0]) {
    const table = $node.find("table").first()

    if (table.length === 0) {
      return {
        status: "fallback" as const,
        html: getComponentHtml({ $, $node }),
        reason: "table-fallback",
        warnings: ["표 블록을 표로 해석하지 못해 원본 HTML로 보존했습니다."],
      }
    }

    const parsedTable = parseHtmlTable({ $, table })

    return {
      status: "handled" as const,
      blocks: [
        {
          type: "table" as const,
          rows: parsedTable.rows,
          html: parsedTable.html,
          complex: parsedTable.complex,
        },
      ],
    }
  }
}
