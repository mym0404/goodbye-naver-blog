import type { ParserBlockContext, ParserBlockTemplateDefinition } from "../../core/ParserBlock.js"

import { parseHtmlTable } from "../../common/parseHtmlTable.js"
import { parseSingleColumnTableAsParagraphs } from "../../common/parseSingleColumnTableAsParagraphs.js"
import { createTableBlock } from "../../core/ParsedBlockOutput.js"
import { LeafParserBlock } from "../../core/ParserBlock.js"

const toParagraphBlockId = (blockId: string) =>
  blockId.replace(/:table$/, ":paragraph").replace(/^table$/, "paragraph")
const tableTemplate =
  "{{ complex ? html : rows.length > 0 ? rows[0][0].isHeader ? `| ${rows[0].map(cell => cell.text).join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |${rows.slice(1).length ? `\\n${rows.slice(1).map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : ''}` : `| ${rows[0].map(cell => ' ').join(' | ')} |\\n| ${rows[0].map(cell => '---').join(' | ')} |\\n${rows.map(row => `| ${row.map(cell => cell.text).join(' | ')} |`).join('\\n')}` : html }}"

export class NaverSe2TableBlock extends LeafParserBlock {
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

  override match({ node }: ParserBlockContext) {
    return node.type === "tag" && node.tagName.toLowerCase() === "table"
  }

  override convert({ $, $node, options, blockId }: Parameters<LeafParserBlock["convert"]>[0]) {
    if ($node.hasClass("colorscripter-code-table")) {
      return []
    }

    if (!$node.is("table")) {
      throw new Error("SE2 table block parsing failed.")
    }

    const parsedTable = parseHtmlTable({
      $,
      table: $node,
      resolveLinkUrl: options.resolveLinkUrl,
    })
    const flattenedTable = parseSingleColumnTableAsParagraphs({
      blockId,
      paragraphBlockId: toParagraphBlockId(blockId),
      parsedTable,
      options,
    })

    if (flattenedTable) {
      return flattenedTable
    }

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
