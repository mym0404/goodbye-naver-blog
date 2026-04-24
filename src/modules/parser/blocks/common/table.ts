import { convertHtmlToMarkdown } from "../../../converter/html-fragment-converter.js"
import type { ExportOptions, StructuredAstBlock } from "../../../../shared/types.js"
import { parseHtmlTable } from "../../table-parser.js"

export const parseSingleColumnTableAsParagraphs = ({
  parsedTable,
  options,
}: {
  parsedTable: ReturnType<typeof parseHtmlTable>
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const isSingleColumn =
    !parsedTable.complex &&
    parsedTable.rows.length > 0 &&
    parsedTable.rows.every(
      (row) => row.length === 1 && row[0]?.colspan === 1 && row[0]?.rowspan === 1,
    )

  if (!isSingleColumn) {
    return null
  }

  const paragraphs = parsedTable.rows
    .map((row) =>
      convertHtmlToMarkdown({
        html: row[0]?.html ?? "",
        options,
        resolveLinkUrl: options.resolveLinkUrl,
      }),
    )
    .map((text) => text.trim())
    .filter(Boolean)
    .map(
      (text) =>
        ({
          type: "paragraph",
          text,
        }) satisfies StructuredAstBlock,
    )

  return paragraphs.length > 0 ? paragraphs : null
}
