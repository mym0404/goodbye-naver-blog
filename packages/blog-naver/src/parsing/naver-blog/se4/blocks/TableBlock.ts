import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseHtmlTable } from "../../common/parseHtmlTable.js"
import { createTableBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

const tableTemplate =
  "{{ complex ? html : rows.length > 0 ? rows[0][0].isHeader ? `| ${rows[0].map(cell => cell.text).join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |${rows.slice(1).length ? `\\n${rows.slice(1).map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : ''}` : `| ${rows[0].map(cell => ' ').join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |\\n${rows.map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : html }}"

export class NaverSe4TableBlock extends LeafParserBlock {
  override readonly id = "table"
  override readonly label = "표"
  override readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "default",
        label: "표",
        template: tableTemplate,
      },
    ],
    props: {
      rows: {
        label: "행",
        type: "array",
        items: {
          label: "셀 목록",
          type: "array",
          items: {
            label: "셀",
            type: "object",
            properties: {
              text: { label: "텍스트", type: "string" },
              html: { label: "HTML", type: "string" },
              colspan: { label: "열 병합 수", type: "number" },
              rowspan: { label: "행 병합 수", type: "number" },
              isHeader: { label: "머리글 여부", type: "boolean" },
            },
          },
        },
      },
      html: { label: "HTML", type: "string" },
      complex: { label: "복합 표", type: "boolean" },
    },
  } satisfies ParserBlockTemplateDefinition

  override match({ $node, moduleType }: ParserBlockContext) {
    return moduleType === "v2_table" || $node.hasClass("se-table")
  }

  override convert({ $, $node, blockId, options }: Parameters<LeafParserBlock["convert"]>[0]) {
    const table = $node.find("table").first()

    if (table.length === 0) {
      throw new Error("SE4 table block parsing failed.")
    }

    const parsedTable = parseHtmlTable({ $, table, resolveLinkUrl: options.resolveLinkUrl })

    return [
      createTableBlock({
        blockId,
        rows: parsedTable.rows,
        html: parsedTable.html,
        complex: parsedTable.complex,
      }),
    ]
  }
}
