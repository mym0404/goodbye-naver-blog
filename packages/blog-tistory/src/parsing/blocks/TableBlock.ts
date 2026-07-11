import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { TistoryParserBlock } from "../core/TistoryParserBlock.js"

const escapeCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()

export class TistoryTableBlock extends TistoryParserBlock {
  readonly id = "table"
  readonly label = "표"
  readonly templateDefinition = {
    label: this.label,
    presets: [
      {
        id: "markdown-table",
        label: "Markdown 표",
        template:
          "{{ `| ${headers.join(' | ')} |\\n| ${headers.map(header => '---').join(' | ')} |${rows.length ? `\\n${rows.map(row => `| ${row.join(' | ')} |`).join('\\n')}` : ''}` }}",
      },
    ],
    props: {
      headers: { label: "머리글", type: "array" },
      rows: { label: "행", type: "array" },
    },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" && (node.tagName === "table" || $node.attr("data-ke-type") === "table")
    )
  }

  convert({ $, $node, node }: TistoryParserBlockContext) {
    const $table =
      node.type === "tag" && node.tagName === "table" ? $node : $node.find("table").first()
    const rows = $table
      .find("tr")
      .toArray()
      .map((row) =>
        $(row)
          .children("th, td")
          .toArray()
          .map((cell) => escapeCell($(cell).text())),
      )
      .filter((row) => row.length > 0)

    if (rows.length === 0) {
      return []
    }

    const width = Math.max(...rows.map((row) => row.length))
    const normalize = (row: string[]) =>
      Array.from({ length: width }, (_, index) => row[index] ?? "")
    const firstRowHasHeaders = $table.find("tr").first().children("th").length > 0
    const headers = firstRowHasHeaders
      ? normalize(rows[0]!)
      : Array.from({ length: width }, () => "")
    const bodyRows = (firstRowHasHeaders ? rows.slice(1) : rows).map(normalize)

    return [{ blockId: `tistory:${this.id}`, props: { headers, rows: bodyRows } }]
  }
}
