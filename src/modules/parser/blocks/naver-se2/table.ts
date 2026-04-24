import type { CheerioAPI } from "cheerio"

import type { ParserBlock } from "../parser-node.js"
import { parseSingleColumnTableAsParagraphs } from "../common/table.js"
import type { StructuredAstBlock } from "../../../../shared/types.js"
import { compactText } from "../../../../shared/utils.js"
import { parseHtmlTable } from "../../table-parser.js"

const parseColorScripterCodeBlock = ({
  $,
  element,
}: {
  $: CheerioAPI
  element: ReturnType<CheerioAPI>
}) => {
  if (!element.hasClass("colorscripter-code-table")) {
    return null
  }

  const codeCell = element.find("tr").first().children("td").eq(1)

  if (codeCell.length === 0) {
    return null
  }

  const lineNodes = codeCell
    .find('div[style*="white-space:pre"], div[_foo*="white-space:pre"], pre')
    .toArray()
  const code = lineNodes
    .map((node) => $(node).text().replaceAll("\u00a0", " ").replaceAll("\u200b", ""))
    .map((line) => (line.trim() === "" ? "" : line))
    .join("\n")
    .trimEnd()

  if (!code) {
    return null
  }

  return {
    type: "code",
    language: null,
    code,
  } satisfies StructuredAstBlock
}

export const se2TableBlock: ParserBlock = {
  id: "se2-table",
  kind: "leaf",
  match: ({ node }) => node.type === "tag" && node.tagName.toLowerCase() === "table",
  convert: ({ $, $node, options }) => {
    const colorScripterCodeBlock = parseColorScripterCodeBlock({
      $,
      element: $node,
    })

    if (colorScripterCodeBlock) {
      return {
        status: "handled",
        blocks: [colorScripterCodeBlock],
      }
    }

    if ($node.hasClass("colorscripter-code-table") && compactText($node.text()) === "") {
      return { status: "skip" }
    }

    const parsedTable = parseHtmlTable({ $, table: $node })
    const flattenedTable = parseSingleColumnTableAsParagraphs({
      parsedTable,
      options,
    })

    if (flattenedTable) {
      return {
        status: "handled",
        blocks: flattenedTable,
      }
    }

    return {
      status: "handled",
      blocks: [
        {
          type: "table",
          rows: parsedTable.rows,
          html: parsedTable.html,
          complex: parsedTable.complex,
        },
      ],
    }
  },
}
