import type { CheerioAPI } from "cheerio"

import { LeafBlock } from "../BaseBlock.js"
import type { ParserBlockResult } from "../ParserNode.js"
import type { ParserBlockContext } from "../ParserNode.js"
import { parseSingleColumnTableAsParagraphs } from "../common/Table.js"
import type { AstBlock, OutputOption } from "../../../shared/Types.js"
import { compactText } from "../../../shared/Utils.js"
import { parseHtmlTable } from "../../parser/TableParser.js"

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
  } satisfies AstBlock
}

export class NaverSe2TableBlock extends LeafBlock {
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

  override match({ node }: ParserBlockContext) {
    return node.type === "tag" && node.tagName.toLowerCase() === "table"
  }

  override convert({ $, $node, options }: Parameters<LeafBlock["convert"]>[0]): ParserBlockResult {
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
  }
}
