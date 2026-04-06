import { readFile } from "node:fs/promises"

import { parserCapabilities } from "../../src/shared/parser-capabilities.js"
import { generatedDocs } from "./lib/constants.js"
import { collectDocStatus } from "./lib/doc-status.js"
import { buildGeneratedDocs } from "./lib/report-generation.js"
import { repoPath } from "./lib/paths.js"

const run = async () => {
  const docStatus = await collectDocStatus()
  const failures = [
    ...docStatus.missingCoreDocs.map((item) => `missing core doc: ${item}`),
    ...docStatus.missingAgentLinks.map((item) => `AGENTS.md missing link: ${item}`),
    ...docStatus.unlinkedCoreDocs.map((item) => `docs/index.md missing link: ${item}`),
    ...docStatus.headingFailures,
    ...docStatus.deadLinks.map((item) => `dead link: ${item}`),
  ]
  const parserCatalogContent = await readFile(repoPath("docs", "parser-block-catalog.md"), "utf8")

  for (const capability of parserCapabilities) {
    if (!parserCatalogContent.includes(`\`${capability.blockType}\``)) {
      failures.push(`parser-block-catalog.md missing blockType entry: ${capability.blockType}`)
    }
  }

  const generatedContent = await buildGeneratedDocs()
  const generatedActual = {
    "docs/generated/quality-score.md": await readFile(
      repoPath("docs", "generated", "quality-score.md"),
      "utf8",
    ).catch(() => ""),
    "docs/generated/sample-coverage.md": await readFile(
      repoPath("docs", "generated", "sample-coverage.md"),
      "utf8",
    ).catch(() => ""),
  }
  const generatedExpected = {
    "docs/generated/quality-score.md": generatedContent.qualityScore,
    "docs/generated/sample-coverage.md": generatedContent.sampleCoverage,
  }

  for (const docPath of generatedDocs) {
    if (generatedActual[docPath] !== generatedExpected[docPath]) {
      failures.push(`generated doc is stale: ${docPath}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }

  console.log(
    `docs:check passed (${docStatus.coreDocCount} core docs, ${generatedDocs.length} generated docs)`,
  )
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
