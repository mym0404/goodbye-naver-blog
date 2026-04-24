import path from "node:path"

import { parserCapabilities } from "../../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../../src/shared/sample-corpus.js"
import type { BlockType, EditorVersion, ParserCapabilityId } from "../../../src/shared/types.js"
import { pathExists, repoPath, walkFiles } from "./paths.js"

export const collectParserStatus = async () => {
  const parserFixtureDir = repoPath("tests", "fixtures", "parser")
  const sampleFixtureDir = repoPath("tests", "fixtures", "samples")
  const parserFixtureFiles = (await pathExists(parserFixtureDir))
    ? (await walkFiles(parserFixtureDir)).filter((filePath) => filePath.endsWith(".html"))
    : []
  const parserFixtureBlockTypes = new Set(
    parserFixtureFiles.map((filePath) => path.basename(filePath, ".html")),
  )
  const sampleById = new Map(sampleCorpus.map((sample) => [sample.id, sample]))
  const capabilityLookupIdSet = new Set([
    ...parserCapabilities.map((capability) => capability.id),
  ])
  const sampleFixtureCapabilities = parserCapabilities.filter(
    (capability) => capability.verificationMode === "sample-fixture",
  )
  const parserFixtureOnlyCapabilityIds = parserCapabilities
    .filter((capability) => capability.verificationMode === "parser-fixture")
    .map((capability) => capability.id)
  const blockTypes = Array.from(
    new Set(parserCapabilities.map((capability) => capability.blockType)),
  ) as BlockType[]
  const missingParserFixtureBlockTypes: BlockType[] = []
  const missingCapabilityTestMappings: ParserCapabilityId[] = []
  const sampleGapCapabilityIds: ParserCapabilityId[] = []
  const invalidCapabilityTestFileLinks: string[] = []
  const invalidSampleLinks: string[] = []
  const invalidExpectedCapabilityIds: string[] = []
  const missingSampleSourceFixtures: string[] = []
  const missingSampleExpectedFixtures: string[] = []
  const coveredCapabilityTestIds = new Set<ParserCapabilityId>()

  for (const blockType of blockTypes) {
    if (!parserFixtureBlockTypes.has(blockType)) {
      missingParserFixtureBlockTypes.push(blockType)
    }
  }

  for (const capability of parserCapabilities) {
    if (capability.verificationMode === "sample-fixture" && capability.sampleIds.length === 0) {
      sampleGapCapabilityIds.push(capability.id)
    }

    if (capability.testFilePaths.length === 0) {
      missingCapabilityTestMappings.push(capability.id)
    }

    let hasOnlyExistingTestFiles = capability.testFilePaths.length > 0

    for (const testFilePath of capability.testFilePaths) {
      if (!(await pathExists(repoPath(...testFilePath.split("/"))))) {
        invalidCapabilityTestFileLinks.push(`${capability.id}: missing test file ${testFilePath}`)
        hasOnlyExistingTestFiles = false
      }
    }

    if (hasOnlyExistingTestFiles) {
      coveredCapabilityTestIds.add(capability.id)
    }

    for (const sampleId of capability.sampleIds) {
      const sample = sampleById.get(sampleId)

      if (!sample) {
        invalidSampleLinks.push(`${capability.id}: missing sample ${sampleId}`)
        continue
      }

      if (!sample.expectedCapabilityLookupIds.includes(capability.id)) {
        invalidSampleLinks.push(
          `${capability.id}: sample ${sampleId} does not declare the capability in expectedCapabilityLookupIds`,
        )
      }
    }
  }

  for (const sample of sampleCorpus) {
    for (const capabilityLookupId of sample.expectedCapabilityLookupIds) {
      if (!capabilityLookupIdSet.has(capabilityLookupId)) {
        invalidExpectedCapabilityIds.push(
          `${sample.id}: expected capability lookup ${capabilityLookupId} is not declared`,
        )
      }
    }

    const sourcePath = path.join(sampleFixtureDir, sample.id, "source.html")
    const expectedPath = path.join(sampleFixtureDir, sample.id, "expected.md")

    if (!(await pathExists(sourcePath))) {
      missingSampleSourceFixtures.push(sample.id)
    }

    if (!(await pathExists(expectedPath))) {
      missingSampleExpectedFixtures.push(sample.id)
    }
  }

  const editorCoverage = ([2, 3, 4] as EditorVersion[]).filter(
    (editorVersion) => !sampleCorpus.some((sample) => sample.editorVersion === editorVersion),
  )
  const capabilityCoverageBySample = Object.fromEntries(
    parserCapabilities.map((capability) => [capability.id, capability.sampleIds]),
  ) satisfies Record<ParserCapabilityId, string[]>

  return {
    missingParserFixtureBlockTypes,
    missingCapabilityTestMappings,
    sampleGapCapabilityIds,
    invalidCapabilityTestFileLinks,
    invalidSampleLinks,
    invalidExpectedCapabilityIds,
    missingSampleSourceFixtures,
    missingSampleExpectedFixtures,
    missingEditorCoverage: editorCoverage,
    capabilityCoverageBySample,
    parserFixtureOnlyCapabilityIds,
    parserBlockFixtureCoverageCount: blockTypes.length - missingParserFixtureBlockTypes.length,
    parserBlockTotal: blockTypes.length,
    parserCapabilityTestCoverageCount: coveredCapabilityTestIds.size,
    parserCapabilityTestTotal: parserCapabilities.length,
    parserCapabilitySampleCoverageCount: sampleFixtureCapabilities.length - sampleGapCapabilityIds.length,
    parserCapabilitySampleTotal: sampleFixtureCapabilities.length,
  }
}
