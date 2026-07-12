import type { TistoryParserBlockContext } from "../core/TistoryParserBlock.js"

import { renderTistoryInline } from "../core/TistoryInline.js"
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
        label: "표",
        template:
          "{{ complex ? html : `| ${headers.join(' | ')} |\\n| ${headers.map(header => '---').join(' | ')} |${rows.length ? `\\n${rows.map(row => `| ${row.join(' | ')} |`).join('\\n')}` : ''}` }}",
      },
    ],
    props: {
      headers: {
        label: "머리글",
        type: "array",
        items: { label: "셀", type: "string" },
      },
      rows: {
        label: "행",
        type: "array",
        items: {
          label: "셀 목록",
          type: "array",
          items: { label: "셀", type: "string" },
        },
      },
      html: { label: "HTML", type: "string" },
      complex: { label: "복합 표", type: "boolean" },
    },
  } as const

  match({ $node, node }: TistoryParserBlockContext) {
    return (
      node.type === "tag" && (node.tagName === "table" || $node.attr("data-ke-type") === "table")
    )
  }

  convert({ $, $node, node, options }: TistoryParserBlockContext) {
    const $table =
      node.type === "tag" && node.tagName === "table" ? $node : $node.find("table").first()
    const htmlTable = $table.clone()

    if (options.resolveLinkUrl) {
      htmlTable.find("a[href]").each((_, anchor) => {
        const href = $(anchor).attr("href")

        if (href) {
          $(anchor).attr("href", options.resolveLinkUrl!(href))
        }
      })
    }

    const rows = $table
      .find("tr")
      .toArray()
      .map((row) =>
        $(row)
          .children("th, td")
          .toArray()
          .map((cell) =>
            escapeCell(
              renderTistoryInline({
                $,
                nodes: $(cell).contents().toArray(),
                resolveLinkUrl: options.resolveLinkUrl,
              }),
            ),
          ),
      )
      .filter((row) => row.length > 0)

    if (rows.length === 0) {
      return []
    }

    const width = Math.max(...rows.map((row) => row.length))
    const widths = $table
      .find("tr")
      .toArray()
      .map((row) =>
        $(row)
          .children("th, td")
          .toArray()
          .reduce((sum, cell) => sum + Number($(cell).attr("colspan") ?? "1"), 0),
      )
    const complex =
      $table.find("th[rowspan], th[colspan], td[rowspan], td[colspan]").length > 0 ||
      widths.some((rowWidth) => rowWidth !== widths[0])
    const normalize = (row: string[]) =>
      Array.from({ length: width }, (_, index) => row[index] ?? "")
    const firstRowHasHeaders = $table.find("tr").first().children("th").length > 0
    const headers = firstRowHasHeaders
      ? normalize(rows[0]!)
      : Array.from({ length: width }, () => "")
    const bodyRows = (firstRowHasHeaders ? rows.slice(1) : rows).map(normalize)

    return [
      {
        blockId: `tistory:${this.id}`,
        props: { headers, rows: bodyRows, html: $.html(htmlTable).trim(), complex },
      },
    ]
  }
}
