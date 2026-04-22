import { parserCapabilities } from "../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../src/shared/sample-corpus.js"
import { collectParserStatus } from "./lib/parser-status.js"

const run = async () => {
  const parserStatus = await collectParserStatus()
  const failures = [
    ...parserStatus.missingParserFixtureBlockTypes.map(
      (blockType) => `missing parser fixture: ${blockType}`,
    ),
    ...parserStatus.missingCapabilityTestMappings.map(
      (capabilityId) => `missing parser test mapping: ${capabilityId}`,
    ),
    ...parserStatus.invalidCapabilityTestFileLinks,
    ...parserStatus.invalidSampleLinks,
    ...parserStatus.invalidExpectedCapabilityIds,
    ...parserStatus.missingSampleSourceFixtures.map(
      (sampleId) => `missing sample source fixture: ${sampleId}`,
    ),
    ...parserStatus.missingSampleExpectedFixtures.map(
      (sampleId) => `missing sample expected fixture: ${sampleId}`,
    ),
    ...parserStatus.missingEditorCoverage.map(
      (editorVersion) => `missing sample corpus editor coverage: ${editorVersion}`,
    ),
  ]

  if (parserCapabilities.length !== new Set(parserCapabilities.map((item) => item.id)).size) {
    failures.push("parser capability id must be unique")
  }

  if (sampleCorpus.length !== new Set(sampleCorpus.map((item) => item.id)).size) {
    failures.push("sample corpus id must be unique")
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }

  console.log(
    `parser:check passed (${parserCapabilities.length} capabilities, ${sampleCorpus.length} samples, ${parserStatus.sampleGapCapabilityIds.length} sample gaps, ${parserStatus.parserFixtureOnlyCapabilityIds.length} parser-fixture only capabilities)`,
  )
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
