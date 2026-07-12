import { convertHtmlToMarkdown } from "@exitpress/engine/markdown/util/convertHtmlToMarkdown.js"
import { compactText } from "@exitpress/engine/shared/text/util/TextCompaction.js"

import type { TableRow } from "@exitpress/domain/parser/schema/TableRow.js"
import type { CheerioAPI } from "cheerio"

export const parseHtmlTable = ({
  $,
  table,
  resolveLinkUrl,
}: {
  $: CheerioAPI
  table: ReturnType<CheerioAPI>
  resolveLinkUrl?: (url: string) => string
}) => {
  const normalizedTable = table.clone()

  if (resolveLinkUrl) {
    normalizedTable.find("a[href]").each((_, anchor) => {
      const link = normalizedTable.find(anchor)
      const href = link.attr("href")

      if (href) {
        link.attr("href", resolveLinkUrl(href))
      }
    })
  }

  const rows = normalizedTable
    .find("tr")
    .toArray()
    .map((row) =>
      $(row)
        .children("th, td")
        .toArray()
        .map((cell) => {
          const cellNode = $(cell)

          return {
            text: compactText(
              convertHtmlToMarkdown({
                html: cellNode.html() ?? "",
              }),
            ),
            /* v8 ignore next -- Cheerio types allow null for empty selections, but cells come from an existing table child. */
            html: (cellNode.html() ?? "").trim(),
            colspan: Number(cellNode.attr("colspan") ?? "1"),
            rowspan: Number(cellNode.attr("rowspan") ?? "1"),
            isHeader: cell.tagName === "th",
          }
        }),
    )
    .filter((row): row is TableRow => row.length > 0)

  const widths = rows.map((row) => row.reduce((sum, cell) => sum + cell.colspan, 0))
  const hasMergedCells = rows.some((row) =>
    row.some((cell) => cell.colspan > 1 || cell.rowspan > 1),
  )
  const widthMismatch = widths.some((width) => width !== widths[0])

  return {
    rows,
    html: $.html(normalizedTable).trim(),
    complex: hasMergedCells || widthMismatch,
  }
}
