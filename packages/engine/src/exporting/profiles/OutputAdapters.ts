import path from "node:path"

import type {
  ExportManifest,
  PostManifestEntry,
} from "@exitpress/domain/export-job/schema/ExportManifest.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { TemplateValue } from "@exitpress/domain/template/schema/TemplateValue.js"

import type { OutputAdapter, OutputSupportFile } from "./OutputAdapter.js"

const renderMarkdownDocument = ({
  frontmatter,
  body,
}: {
  frontmatter: string | null
  body: string
}) => (frontmatter ? `---\n${frontmatter}---\n\n${body}\n` : `${body}\n`)

const passthroughProps = (props: Record<string, TemplateValue>) => props

const gfmAdapter: OutputAdapter = {
  profile: "gfm",
  contentRootSegments: [],
  documentFileName: "index.md",
  formatPathSegment: (segment) => segment,
  prepareBlockProps: passthroughProps,
  formatAssetReference: (relativeAssetPath) => relativeAssetPath,
  renderDocument: renderMarkdownDocument,
  createSupportFiles: () => [],
}

const mdxEntityByCharacter: Record<string, string> = {
  "&": "&amp;",
  "{": "&#123;",
  "}": "&#125;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeMdxString = (value: string) =>
  value.replace(/[&{}<>"']/g, (character) => mdxEntityByCharacter[character] ?? character)

const prepareMdxValue = ({ value, key }: { value: TemplateValue; key: string }): TemplateValue => {
  if (typeof value === "string") {
    return key === "code" || key === "formula" ? value : escapeMdxString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => prepareMdxValue({ value: item, key }))
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([property, item]) => [
        property,
        prepareMdxValue({ value: item, key: property }),
      ]),
    )
  }

  return value
}

const prepareMdxProps = (props: Record<string, TemplateValue>) =>
  Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, prepareMdxValue({ value, key })]),
  )

const optionalComponentModules = [
  {
    names: ["Accordion", "Accordions"],
    source: "fumadocs-ui/components/accordion",
  },
  {
    names: ["DynamicCodeBlock"],
    source: "fumadocs-ui/components/dynamic-codeblock",
  },
  {
    names: ["File", "Files", "Folder"],
    source: "fumadocs-ui/components/files",
  },
  {
    names: ["ImageZoom"],
    source: "fumadocs-ui/components/image-zoom",
  },
  {
    names: ["InlineTOC"],
    source: "fumadocs-ui/components/inline-toc",
  },
  {
    names: ["Step", "Steps"],
    source: "fumadocs-ui/components/steps",
  },
  {
    names: ["Tab", "Tabs"],
    source: "fumadocs-ui/components/tabs",
  },
  {
    names: ["TypeTable"],
    source: "fumadocs-ui/components/type-table",
  },
] as const

const getOptionalComponentImports = (body: string) =>
  optionalComponentModules.flatMap(({ names, source }) => {
    const usedNames = names.filter((name) => new RegExp(`<${name}(?:\\s|/|>)`).test(body))

    return usedNames.length > 0 ? [`import { ${usedNames.join(", ")} } from '${source}';`] : []
  })

const renderFumadocsDocument: OutputAdapter["renderDocument"] = ({ frontmatter, body }) => {
  const imports = getOptionalComponentImports(body)
  const sections = [frontmatter ? `---\n${frontmatter}---` : "", imports.join("\n"), body].filter(
    Boolean,
  )

  return `${sections.join("\n\n")}\n`
}

type MetaNode = {
  title: string
  directories: Map<string, MetaNode>
  pages: { name: string; title: string }[]
}

const createMetaNode = (title: string): MetaNode => ({
  title,
  directories: new Map(),
  pages: [],
})

const addPostToMetaTree = ({ root, post }: { root: MetaNode; post: PostManifestEntry }) => {
  if (!post.outputPath) {
    return
  }

  const segments = post.outputPath.split("/")
  const contentRootLength = 2
  const documentDirectories = segments.slice(contentRootLength, -1)
  const postDirectory = documentDirectories.pop()

  if (!postDirectory) {
    return
  }

  let node = root

  documentDirectories.forEach((directory, index) => {
    const existing = node.directories.get(directory)

    if (existing) {
      node = existing
      return
    }

    const categoryTitle = post.category.path[index] ?? directory
    const child = createMetaNode(categoryTitle)
    node.directories.set(directory, child)
    node = child
  })

  node.pages.push({ name: postDirectory, title: post.title })
}

const renderMetaFiles = ({
  node,
  relativeDirectory,
}: {
  node: MetaNode
  relativeDirectory: string
}): OutputSupportFile[] => {
  const directoryEntries = [...node.directories.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const pages = [
    ...directoryEntries.map(([name]) => name),
    ...node.pages
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name }) => name),
  ]
  const current = {
    relativePath: path.posix.join(relativeDirectory, "meta.json"),
    content: `${JSON.stringify({ title: node.title, pages }, null, 2)}\n`,
  }

  return [
    current,
    ...directoryEntries.flatMap(([name, child]) =>
      renderMetaFiles({
        node: child,
        relativeDirectory: path.posix.join(relativeDirectory, name),
      }),
    ),
  ]
}

const createFumadocsSupportFiles = (manifest: ExportManifest) => {
  const root = createMetaNode(manifest.sourceId)

  manifest.posts
    .filter((post) => post.status === "success")
    .forEach((post) => addPostToMetaTree({ root, post }))

  return renderMetaFiles({ node: root, relativeDirectory: "content/docs" })
}

const fumadocsAdapter: OutputAdapter = {
  profile: "fumadocs",
  contentRootSegments: ["content", "docs"],
  documentFileName: "index.mdx",
  formatPathSegment: (segment) =>
    encodeURIComponent(segment).replaceAll("~", "%7E").replaceAll("%", "~"),
  prepareBlockProps: prepareMdxProps,
  formatAssetReference: (relativeAssetPath) => `/${path.posix.basename(relativeAssetPath)}`,
  renderDocument: renderFumadocsDocument,
  createSupportFiles: createFumadocsSupportFiles,
}

const adapters: Record<ExportProfile, OutputAdapter> = {
  gfm: gfmAdapter,
  fumadocs: fumadocsAdapter,
}

export const getOutputAdapter = (profile: ExportProfile) => adapters[profile]
