import { parserCapabilities } from "../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../src/shared/sample-corpus.js"
import { collectParserStatus } from "./lib/parser-status.js"

const run = async () => {
  const parserStatus = await collectParserStatus()
  const failures = [
    ...parserStatus.missingFixtureBlockTypes.map(
      (blockType) => `missing parser fixture: ${blockType}`,
    ),
    ...parserStatus.missingTestBlockTypes.map(
      (blockType) => `missing test coverage hint: ${blockType}`,
    ),
    ...parserStatus.invalidSampleLinks,
    ...parserStatus.missingExportFixtures.map(
      (sampleId) => `missing export fixture: ${sampleId}`,
    ),
    ...parserStatus.missingEditorCoverage.map(
      (editorVersion) => `missing sample corpus editor coverage: ${editorVersion}`,
    ),
  ]

  if (parserCapabilities.length !== new Set(parserCapabilities.map((item) => item.blockType)).size) {
    failures.push("parser capability blockType must be unique")
  }

  if (sampleCorpus.length !== new Set(sampleCorpus.map((item) => item.id)).size) {
    failures.push("sample corpus id must be unique")
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }

  console.log(
    `parser:check passed (${parserCapabilities.length} block types, ${sampleCorpus.length} samples, ${parserStatus.sampleGapBlockTypes.length} sample gaps)`,
  )
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
