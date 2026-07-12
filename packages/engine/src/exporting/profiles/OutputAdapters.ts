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
  assetRootSegments: ["public"],
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

const fumadocsComponentModules = [
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

const getOptionalComponentImports = (
  body: string,
  modules: readonly { names: readonly string[]; source: string }[],
) =>
  modules.flatMap(({ names, source }) => {
    const usedNames = names.filter((name) => new RegExp(`<${name}(?:\\s|/|>)`).test(body))

    return usedNames.length > 0 ? [`import { ${usedNames.join(", ")} } from '${source}';`] : []
  })

const renderFumadocsDocument: OutputAdapter["renderDocument"] = ({ frontmatter, body }) => {
  const imports = getOptionalComponentImports(body, fumadocsComponentModules)
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

const addPostToMetaTree = ({
  root,
  post,
  contentRootLength,
}: {
  root: MetaNode
  post: PostManifestEntry
  contentRootLength: number
}) => {
  if (!post.outputPath) {
    return
  }

  const segments = post.outputPath.split("/")
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
    .forEach((post) => addPostToMetaTree({ root, post, contentRootLength: 2 }))

  return renderMetaFiles({ node: root, relativeDirectory: "content/docs" })
}

const fumadocsAdapter: OutputAdapter = {
  profile: "fumadocs",
  contentRootSegments: ["content", "docs"],
  assetRootSegments: ["public"],
  documentFileName: "index.mdx",
  formatPathSegment: (segment) =>
    encodeURIComponent(segment).replaceAll("~", "%7E").replaceAll("%", "~"),
  prepareBlockProps: prepareMdxProps,
  formatAssetReference: (relativeAssetPath) => `/${path.posix.basename(relativeAssetPath)}`,
  renderDocument: renderFumadocsDocument,
  createSupportFiles: createFumadocsSupportFiles,
}

const formatMdxPathSegment = (segment: string) =>
  encodeURIComponent(segment)
    .replace(/[!'()*~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replaceAll("%", "~")

const formatRootAssetReference = (relativeAssetPath: string) =>
  `/${path.posix.basename(relativeAssetPath)}`

const renderDocusaurusDocument: OutputAdapter["renderDocument"] = ({ frontmatter, body }) => {
  const imports = body.includes("<TOCInline") ? ["import TOCInline from '@theme/TOCInline';"] : []
  const sections = [frontmatter ? `---\n${frontmatter}---` : "", imports.join("\n"), body].filter(
    Boolean,
  )

  return `${sections.join("\n\n")}\n`
}

const renderDocusaurusCategoryFiles = ({
  node,
  relativeDirectory,
}: {
  node: MetaNode
  relativeDirectory: string
}): OutputSupportFile[] =>
  [...node.directories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([name, child]) => {
      const directory = path.posix.join(relativeDirectory, name)

      return [
        {
          relativePath: path.posix.join(directory, "_category_.json"),
          content: `${JSON.stringify({ label: child.title }, null, 2)}\n`,
        },
        ...renderDocusaurusCategoryFiles({ node: child, relativeDirectory: directory }),
      ]
    })

const createDocusaurusSupportFiles = (manifest: ExportManifest) => {
  const root = createMetaNode(manifest.sourceId)

  manifest.posts
    .filter((post) => post.status === "success")
    .forEach((post) => addPostToMetaTree({ root, post, contentRootLength: 1 }))

  return renderDocusaurusCategoryFiles({ node: root, relativeDirectory: "docs" })
}

const docusaurusAdapter: OutputAdapter = {
  profile: "docusaurus",
  contentRootSegments: ["docs"],
  assetRootSegments: ["static"],
  documentFileName: "index.mdx",
  formatPathSegment: formatMdxPathSegment,
  prepareBlockProps: prepareMdxProps,
  formatAssetReference: formatRootAssetReference,
  renderDocument: renderDocusaurusDocument,
  createSupportFiles: createDocusaurusSupportFiles,
}

const nextraComponentModules = [
  {
    names: ["Callout"],
    source: "nextra/components",
  },
] as const

const renderNextraDocument: OutputAdapter["renderDocument"] = ({ frontmatter, body }) => {
  const metadata = `asIndexPage: true\n${
    frontmatter
      ?.split("\n")
      .filter((line) => !line.startsWith("asIndexPage:"))
      .join("\n") ?? ""
  }`
  const imports = getOptionalComponentImports(body, nextraComponentModules)

  return `---\n${metadata}---\n\n${imports.length > 0 ? `${imports.join("\n")}\n\n` : ""}${body}\n`
}

const renderNextraMetaFiles = ({
  node,
  relativeDirectory,
  includeIndex = false,
}: {
  node: MetaNode
  relativeDirectory: string
  includeIndex?: boolean
}): OutputSupportFile[] => {
  const directoryEntries = [...node.directories.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )
  const entries = [
    ...(includeIndex ? [["index", node.title] as const] : []),
    ...directoryEntries.map(([name, child]) => [name, child.title] as const),
    ...node.pages
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, title }) => [name, title] as const),
  ]
  const current = {
    relativePath: path.posix.join(relativeDirectory, "_meta.js"),
    content: `export default ${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`,
  }

  return [
    current,
    ...directoryEntries.flatMap(([name, child]) =>
      renderNextraMetaFiles({
        node: child,
        relativeDirectory: path.posix.join(relativeDirectory, name),
      }),
    ),
  ]
}

const createNextraSupportFiles = (manifest: ExportManifest) => {
  const root = createMetaNode(manifest.sourceId)

  manifest.posts
    .filter((post) => post.status === "success")
    .forEach((post) => addPostToMetaTree({ root, post, contentRootLength: 1 }))

  return [
    {
      relativePath: "content/index.mdx",
      content: `---\ntitle: ${JSON.stringify(manifest.sourceId)}\n---\n\n# ${escapeMdxString(manifest.sourceId)}\n`,
    },
    ...renderNextraMetaFiles({ node: root, relativeDirectory: "content", includeIndex: true }),
  ]
}

const nextraAdapter: OutputAdapter = {
  profile: "nextra",
  contentRootSegments: ["content"],
  assetRootSegments: ["public"],
  documentFileName: "index.mdx",
  formatPathSegment: formatMdxPathSegment,
  prepareBlockProps: prepareMdxProps,
  formatAssetReference: formatRootAssetReference,
  renderDocument: renderNextraDocument,
  createSupportFiles: createNextraSupportFiles,
}

const adapters: Record<ExportProfile, OutputAdapter> = {
  gfm: gfmAdapter,
  fumadocs: fumadocsAdapter,
  docusaurus: docusaurusAdapter,
  nextra: nextraAdapter,
}

export const getOutputAdapter = (profile: ExportProfile) => adapters[profile]
