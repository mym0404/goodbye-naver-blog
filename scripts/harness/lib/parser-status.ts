import path from "node:path"

import { parserCapabilities } from "../../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../../src/shared/sample-corpus.js"
import type { BlockType, EditorVersion } from "../../../src/shared/types.js"
import { pathExists, readUtf8, repoPath, walkFiles } from "./paths.js"

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const collectParserStatus = async () => {
  const parserFixtureDir = repoPath("tests", "fixtures", "parser")
  const exportFixtureDir = repoPath("tests", "fixtures", "exports")
  const parserFixtureFiles = (await pathExists(parserFixtureDir))
    ? (await walkFiles(parserFixtureDir)).filter((filePath) => filePath.endsWith(".html"))
    : []
  const exportFixtureFiles = (await pathExists(exportFixtureDir))
    ? (await walkFiles(exportFixtureDir)).filter((filePath) => filePath.endsWith(".json"))
    : []
  const parserFixtureBlockTypes = new Set(
    parserFixtureFiles.map((filePath) => path.basename(filePath, ".html")),
  )
  const exportFixtureIds = new Set(
    exportFixtureFiles.map((filePath) => path.basename(filePath, ".json")),
  )
  const testFiles = (await walkFiles(repoPath("tests")))
    .filter((filePath) => filePath.endsWith(".test.ts"))
    .sort()
  const testContent = (
    await Promise.all(testFiles.map((filePath) => readUtf8(filePath)))
  ).join("\n")
  const sampleById = new Map(sampleCorpus.map((sample) => [sample.id, sample]))
  const missingFixtureBlockTypes: BlockType[] = []
  const missingTestBlockTypes: BlockType[] = []
  const sampleGapBlockTypes: BlockType[] = []
  const invalidSampleLinks: string[] = []
  const missingExportFixtures: string[] = []

  for (const capability of parserCapabilities) {
    if (!parserFixtureBlockTypes.has(capability.blockType)) {
      missingFixtureBlockTypes.push(capability.blockType)
    }

    const testPattern = new RegExp(`type:\\s*"${escapeRegex(capability.blockType)}"`)

    if (!testPattern.test(testContent)) {
      missingTestBlockTypes.push(capability.blockType)
    }

    if (capability.sampleIds.length === 0) {
      sampleGapBlockTypes.push(capability.blockType)
    }

    for (const sampleId of capability.sampleIds) {
      const sample = sampleById.get(sampleId)

      if (!sample) {
        invalidSampleLinks.push(`${capability.blockType}: missing sample ${sampleId}`)
        continue
      }

      if (!sample.expectedBlockTypes.includes(capability.blockType)) {
        invalidSampleLinks.push(
          `${capability.blockType}: sample ${sampleId} does not declare the block in expectedBlockTypes`,
        )
      }
    }
  }

  for (const sample of sampleCorpus) {
    if (!exportFixtureIds.has(sample.id)) {
      missingExportFixtures.push(sample.id)
    }
  }

  const editorCoverage = ([2, 3, 4] as EditorVersion[]).filter(
    (editorVersion) =>
      !sampleCorpus.some((sample) => sample.editorVersion === editorVersion),
  )
  const blockCoverageBySample = Object.fromEntries(
    parserCapabilities.map((capability) => [capability.blockType, capability.sampleIds]),
  ) satisfies Record<BlockType, string[]>

  return {
    missingFixtureBlockTypes,
    missingTestBlockTypes,
    sampleGapBlockTypes,
    invalidSampleLinks,
    missingExportFixtures,
    missingEditorCoverage: editorCoverage,
    blockCoverageBySample,
    parserFixtureCoverageCount:
      parserCapabilities.length - missingFixtureBlockTypes.length,
    parserTestCoverageCount: parserCapabilities.length - missingTestBlockTypes.length,
    parserSampleCoverageCount:
      parserCapabilities.length - sampleGapBlockTypes.length,
  }
}
