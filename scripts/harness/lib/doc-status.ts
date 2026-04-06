import path from "node:path"

import { coreDocs, keyDocsForAgents, requiredDocHeadings } from "./constants.js"
import { pathExists, readUtf8, repoPath, toRepoRelativePath, walkFiles } from "./paths.js"

const localLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g

const normalizeDocPath = (value: string) => value.split(path.sep).join("/")

const resolveLinkedPath = ({
  from,
  href,
}: {
  from: string
  href: string
}) => {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  ) {
    return null
  }

  const [withoutHash] = href.split("#")

  if (!withoutHash) {
    return null
  }

  return path.resolve(path.dirname(from), withoutHash)
}

const collectResolvedLinks = ({
  filePath,
  content,
}: {
  filePath: string
  content: string
}) => {
  const resolvedPaths = new Set<string>()
  const deadLinks: string[] = []

  for (const match of content.matchAll(localLinkPattern)) {
    const href = match[1]?.trim()

    if (!href) {
      continue
    }

    const resolvedPath = resolveLinkedPath({
      from: filePath,
      href,
    })

    if (!resolvedPath) {
      continue
    }

    resolvedPaths.add(normalizeDocPath(toRepoRelativePath(resolvedPath)))
    deadLinks.push(`${normalizeDocPath(toRepoRelativePath(filePath))} -> ${href}`)
  }

  return {
    resolvedPaths,
    deadLinks,
  }
}

export const collectDocStatus = async () => {
  const docsRoot = repoPath("docs")
  const markdownFiles = (await walkFiles(docsRoot))
    .filter((filePath) => filePath.endsWith(".md"))
    .sort()
  const agentsPath = repoPath("AGENTS.md")
  const missingCoreDocs: string[] = []
  const headingFailures: string[] = []
  const deadLinks: string[] = []
  const existingCoreDocs: string[] = []

  for (const docPath of coreDocs) {
    const absolutePath = repoPath(docPath)

    if (!(await pathExists(absolutePath))) {
      missingCoreDocs.push(docPath)
      continue
    }

    existingCoreDocs.push(docPath)
    const content = await readUtf8(absolutePath)

    for (const heading of requiredDocHeadings) {
      if (!content.includes(heading)) {
        headingFailures.push(`${docPath}: missing ${heading}`)
      }
    }
  }

  const agentsContent = (await pathExists(agentsPath)) ? await readUtf8(agentsPath) : ""
  const agentsLinks = collectResolvedLinks({
    filePath: agentsPath,
    content: agentsContent,
  }).resolvedPaths
  const missingAgentLinks = keyDocsForAgents.filter((docPath) => !agentsLinks.has(docPath))
  const docsIndexPath = repoPath("docs", "index.md")
  const docsIndexContent = await readUtf8(docsIndexPath)
  const docsIndexLinks = collectResolvedLinks({
    filePath: docsIndexPath,
    content: docsIndexContent,
  }).resolvedPaths
  const unlinkedCoreDocs = coreDocs
    .filter((docPath) => docPath !== "docs/index.md")
    .filter((docPath) => !docsIndexLinks.has(docPath))

  for (const filePath of [agentsPath, ...markdownFiles]) {
    const content = await readUtf8(filePath)
    const linkResult = collectResolvedLinks({
      filePath,
      content,
    })

    for (const item of linkResult.deadLinks) {
      const [_, href] = item.split(" -> ")

      if (!href) {
        continue
      }

      const resolvedPath = resolveLinkedPath({
        from: filePath,
        href,
      })

      if (!resolvedPath) {
        continue
      }

      if (!(await pathExists(resolvedPath))) {
        deadLinks.push(item)
      }
    }
  }

  return {
    missingCoreDocs,
    missingAgentLinks,
    unlinkedCoreDocs,
    headingFailures,
    deadLinks,
    coreDocCount: existingCoreDocs.length,
    validCoreDocCount: existingCoreDocs.length - headingFailures.length,
  }
}
