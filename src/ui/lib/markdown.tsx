import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import YAML from "yaml"

const frontmatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n?/

const katexTagNames = [
  "annotation",
  "annotation-xml",
  "maction",
  "math",
  "menclose",
  "mfrac",
  "mi",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "semantics",
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...katexTagNames],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
    div: [...(defaultSchema.attributes?.div ?? []), ["className"]],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className"],
      ["style"],
      ["ariaHidden"],
    ],
    math: [["xmlns"]],
    annotation: [["encoding"]],
  },
}

type FrontmatterRecord = Record<string, unknown>

const normalizeFrontmatterValue = (value: unknown) => {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return YAML.stringify(value).trim()
  }

  if (value === null || value === undefined || value === "") {
    return "-"
  }

  return String(value)
}

export const splitFrontmatter = (markdown: string) => {
  const match = markdown.match(frontmatterPattern)

  if (!match) {
    return {
      frontmatter: null,
      body: markdown,
    }
  }

  let frontmatter: FrontmatterRecord | null = null

  try {
    const parsed = YAML.parse(match[1])

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      frontmatter = parsed as FrontmatterRecord
    }
  } catch {
    frontmatter = {
      raw: match[1].trim(),
    }
  }

  return {
    frontmatter,
    body: markdown.slice(match[0].length),
  }
}

export const MarkdownDocument = ({
  markdown,
  className,
}: {
  markdown: string
  className?: string
}) => {
  const { frontmatter, body } = splitFrontmatter(markdown)

  return (
    <div className={className}>
      {frontmatter ? (
        <section className="markdown-frontmatter">
          <div className="markdown-frontmatter-label">Frontmatter</div>
          <div className="markdown-frontmatter-grid">
            {Object.entries(frontmatter).map(([key, value]) => (
              <article key={key} className="markdown-frontmatter-item">
                <span className="markdown-frontmatter-key">{key}:</span>
                <pre>{normalizeFrontmatterValue(value)}</pre>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, sanitizeSchema]]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          code: ({ className: codeClassName, children, ...props }) => (
            <code className={codeClassName} {...props}>
              {children}
            </code>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
