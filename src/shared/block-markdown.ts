import type {
  AstBlock,
  BlockOutputSelection,
  ExportOptions,
  ImageData,
  MarkdownLinkStyle,
} from "./types.js"
import { splitFormulaWrapper } from "./formula-wrapper.js"

const markdownLineWhitespacePattern = /[^\S\n]+/g

const compactMarkdownText = (value: string) =>
  value
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => {
      const hasHardBreak = / {2}$/.test(line)
      const normalizedLine = line.replace(markdownLineWhitespacePattern, " ").trimEnd()

      return hasHardBreak && normalizedLine ? `${normalizedLine}  ` : normalizedLine
    })
    .join("\n")
    .trim()

const unique = <Type,>(values: Type[]) => [...new Set(values)]

const escapeTableCell = (value: string) =>
  value.replace(/\|/g, "\\|").replace(/\n+/g, "<br>").trim() || " "

export const createLinkFormatter = ({
  style,
  resolveLinkUrl,
}: {
  style: MarkdownLinkStyle
  resolveLinkUrl?: (url: string) => string
}) => {
  const references: string[] = []
  const referenceMap = new Map<string, string>()

  const getReferenceId = ({
    label,
    url,
  }: {
    label: string
    url: string
  }) => {
    const key = `${label}\u0000${url}`
    const existing = referenceMap.get(key)

    if (existing) {
      return existing
    }

    const nextId = `ref-${referenceMap.size + 1}`

    referenceMap.set(key, nextId)
    references.push(`[${nextId}]: ${url}`)

    return nextId
  }

  const formatLink = ({
    label,
    url,
  }: {
    label: string
    url: string
  }) => {
    const resolvedUrl = resolveLinkUrl ? resolveLinkUrl(url) : url

    if (style === "inlined") {
      return `[${label}](${resolvedUrl})`
    }

    return `[${label}][${getReferenceId({ label, url: resolvedUrl })}]`
  }

  return {
    formatLink,
    renderReferenceSection: () => (references.length > 0 ? references.join("\n") : ""),
  }
}

const isDegenerateMarkdownLine = (line: string) => /^[*_~`]+$/.test(line.trim())

export const normalizeMarkdownText = (text: string) =>
  compactMarkdownText(text.replace(/([^\s*])\*{4,}([^\s*])/g, "$1**$2"))
    .split("\n")
    .filter((line) => line.trim() && !isDegenerateMarkdownLine(line))
    .join("\n")
    .trim()

export const renderParagraph = (text: string) => normalizeMarkdownText(text)

export const renderQuote = (text: string) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

export const renderCodeBlock = ({
  language,
  code,
  variant,
}: {
  language: string | null
  code: string
  variant: string
}) => {
  const fence = variant === "tilde-fence" ? "~~~" : "```"

  return `${fence}${language ?? ""}\n${code}\n${fence}`
}

const renderWrappedFormula = ({
  formula,
  open,
  close,
  display,
}: {
  formula: string
  open: string
  close: string
  display: boolean
}) => {
  if (display) {
    return `${open}\n${formula}\n${close}`
  }

  return `${open}${formula}${close}`
}

export const renderFormula = ({
  formula,
  display,
  selection,
}: {
  formula: string
  display: boolean
  selection: BlockOutputSelection
}) => {
  const inline = splitFormulaWrapper({
    wrapper: String(selection.params?.inlineWrapper ?? "$"),
    fallbackOpen: "$",
    fallbackClose: "$",
  })

  if (!display) {
    return renderWrappedFormula({
      formula,
      open: inline.open,
      close: inline.close,
      display: false,
    })
  }

  if (selection.variant === "math-fence") {
    return `\`\`\`math\n${formula}\n\`\`\``
  }

  const block = splitFormulaWrapper({
    wrapper: String(selection.params?.blockWrapper ?? "$$"),
    fallbackOpen: "$$",
    fallbackClose: "$$",
  })

  return renderWrappedFormula({
    formula,
    open: block.open,
    close: block.close,
    display: true,
  })
}

export type RenderDiagnostic = {
  level: "warning" | "error"
  message: string
  detail?: string
}

export const renderDiagnosticCallout = ({
  level,
  message,
  detail,
}: RenderDiagnostic) => {
  const label = level === "error" ? "Error" : "Warning"
  const icon = level === "error" ? "❌" : "⚠️"
  const lines = [`> ${icon} ${label}: ${message}`]

  if (detail?.trim()) {
    lines.push(
      ...detail
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `> ${line}`),
    )
  }

  return lines.join("\n")
}

export const buildDiagnosticsSection = (diagnostics: RenderDiagnostic[]) => {
  const uniqueDiagnostics = unique(
    diagnostics.map((diagnostic) => JSON.stringify(diagnostic)),
  ).map((diagnostic) => JSON.parse(diagnostic) as RenderDiagnostic)

  if (uniqueDiagnostics.length === 0) {
    return ""
  }

  return ["## Export Diagnostics", uniqueDiagnostics.map(renderDiagnosticCallout).join("\n\n")]
    .filter(Boolean)
    .join("\n\n")
}

export const renderLinkCardBlock = ({
  block,
  formatLink,
}: {
  block: Extract<AstBlock, { type: "linkCard" }>
  formatLink: (input: { label: string; url: string }) => string
}) => {
  const title = block.card.title || block.card.url
  const description = normalizeMarkdownText(block.card.description)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim()

      if (!trimmed) {
        return false
      }

      if (/^[()]+$/.test(trimmed)) {
        return false
      }

      if (trimmed === block.card.url) {
        return false
      }

      return true
    })
    .join("\n")

  if (block.card.imageUrl) {
    return formatLink({
      label: title,
      url: block.card.url,
    })
  }

  return [formatLink({ label: title, url: block.card.url }), description].filter(Boolean).join("\n\n")
}

export const getDividerMarker = (selection: BlockOutputSelection) =>
  selection.variant === "asterisk-rule" ? "***" : "---"

export const getHeadingLevelOffset = (selection: BlockOutputSelection) =>
  Number(selection.params?.levelOffset ?? 0)

export const renderGfmTable = (block: Extract<AstBlock, { type: "table" }>) => {
  const [headerRow, ...bodyRows] = block.rows

  if (!headerRow) {
    return block.html
  }

  const columnCount = headerRow.length
  const normalizeRow = (cells: typeof headerRow) =>
    [
      ...cells.map((cell) => escapeTableCell(cell.text)),
      ...Array.from({ length: Math.max(0, columnCount - cells.length) }, () => " "),
    ].slice(0, columnCount)

  return [
    `| ${normalizeRow(headerRow).join(" | ")} |`,
    `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
    ...bodyRows.map((row) => `| ${normalizeRow(row).join(" | ")} |`),
  ].join("\n")
}

export const renderImageBlockMarkdown = ({
  image,
  assetPath,
  selection,
  formatLink,
  includeImageCaptions,
}: {
  image: ImageData
  assetPath: string
  selection: BlockOutputSelection
  formatLink: (input: { label: string; url: string }) => string
  includeImageCaptions: boolean
}) => {
  const safeLabel = image.alt || image.caption || "Image"
  const lines: string[] = []

  if (selection.variant === "source-only") {
    lines.push(
      formatLink({
        label: safeLabel,
        url: assetPath,
      }),
    )
  } else {
    const imageMarkdown = `![${image.alt}](${assetPath})`
    const content =
      selection.variant === "linked-image"
        ? formatLink({
            label: imageMarkdown,
            url: image.originalSourceUrl || image.sourceUrl,
          })
        : imageMarkdown

    lines.push(content)
  }

  if (includeImageCaptions && image.caption) {
    lines.push(`_${image.caption}_`)
  }

  return lines.join("\n\n")
}

export const composeSnippetWithReferences = ({
  body,
  linkFormatter,
}: {
  body: string
  linkFormatter: Pick<ReturnType<typeof createLinkFormatter>, "renderReferenceSection">
}) => {
  const referenceSection = linkFormatter.renderReferenceSection()

  return [body, referenceSection].filter(Boolean).join("\n\n")
}

export type RawHtmlRenderPreview = {
  body: string
  diagnostics: RenderDiagnostic[]
}

export const composeRawHtmlPreview = ({
  body,
  diagnostics,
  linkFormatter,
}: RawHtmlRenderPreview & {
  linkFormatter: Pick<ReturnType<typeof createLinkFormatter>, "renderReferenceSection">
}) => {
  return [
    buildDiagnosticsSection(diagnostics),
    body,
    linkFormatter.renderReferenceSection(),
  ]
    .filter(Boolean)
    .join("\n\n")
}

export const getHtmlConversionOptions = ({
  linkStyle,
  dividerSelection,
}: {
  linkStyle: ExportOptions["markdown"]["linkStyle"]
  dividerSelection: BlockOutputSelection
}) =>
  ({
    linkStyle,
    dividerMarker: getDividerMarker(dividerSelection),
  }) as const
