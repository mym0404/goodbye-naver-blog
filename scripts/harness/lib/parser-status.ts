import path from "node:path"

import { blogEditors } from "../../../src/modules/blog/BlogRegistry.js"
import type { BlogEditorId, ParserBlockId } from "../../../src/modules/blog/BlogTypes.js"
import { blockOutputFamilyDefinitions } from "../../../src/shared/BlockRegistry.js"
import { sampleCorpus } from "../../../src/shared/SampleCorpus.js"
import type { BlockType } from "../../../src/shared/Types.js"
import { pathExists, repoPath, walkFiles } from "./paths.js"

const parserTestFilePathsByEditor = {
  "naver.se2": ["tests/parser/se2-parser.test.ts"],
  "naver.se3": ["tests/parser/se3-parser.test.ts"],
  "naver.se4": ["tests/parser/se4-parser.test.ts"],
} satisfies Record<BlogEditorId, string[]>

export const collectParserStatus = async () => {
  const parserFixtureDir = repoPath("tests", "fixtures", "parser")
  const sampleFixtureDir = repoPath("tests", "fixtures", "samples")
  const parserFixtureFiles = (await pathExists(parserFixtureDir))
    ? (await walkFiles(parserFixtureDir)).filter((filePath) => filePath.endsWith(".html"))
    : []
  const parserFixtureBlockTypes = new Set(
    parserFixtureFiles.map((filePath) => path.basename(filePath, ".html")),
  )
  const parserBlockIds = blogEditors.flatMap((editor) => editor.supportedBlocks)
  const parserBlockIdSet = new Set(parserBlockIds)
  const outputAstBlockTypes = Array.from(
    new Set(blockOutputFamilyDefinitions.map((definition) => definition.astBlockType)),
  ) as BlockType[]
  const missingParserFixtureBlockTypes = outputAstBlockTypes.filter(
    (blockType) => !parserFixtureBlockTypes.has(blockType),
  )
  const missingParserBlockTestMappings: ParserBlockId[] = []
  const invalidParserBlockTestFileLinks: string[] = []
  const invalidExpectedParserBlockIds: string[] = []
  const missingSampleSourceFixtures: string[] = []
  const missingSampleExpectedFixtures: string[] = []
  const coveredParserBlockTestIds = new Set<ParserBlockId>()

  for (const editor of blogEditors) {
    const testFilePaths = parserTestFilePathsByEditor[editor.id]
    const existingTestFilePaths = []

    for (const testFilePath of testFilePaths) {
      if (await pathExists(repoPath(...testFilePath.split("/")))) {
        existingTestFilePaths.push(testFilePath)
      } else {
        invalidParserBlockTestFileLinks.push(`${editor.id}: missing test file ${testFilePath}`)
      }
    }

    for (const parserBlockId of editor.supportedBlocks) {
      if (existingTestFilePaths.length === 0) {
        missingParserBlockTestMappings.push(parserBlockId)
      } else {
        coveredParserBlockTestIds.add(parserBlockId)
      }
    }
  }

  for (const sample of sampleCorpus) {
    for (const parserBlockId of sample.expectedParserBlockIds) {
      if (!parserBlockIdSet.has(parserBlockId)) {
        invalidExpectedParserBlockIds.push(
          `${sample.id}: expected parser block ${parserBlockId} is not declared`,
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

  const sampleCoveredParserBlockIds = new Set(
    sampleCorpus.flatMap((sample) => sample.expectedParserBlockIds),
  )
  const sampleGapParserBlockIds = parserBlockIds.filter(
    (parserBlockId) => !sampleCoveredParserBlockIds.has(parserBlockId),
  )
  const missingEditorCoverage = blogEditors
    .map((editor) => editor.id)
    .filter((editorId) => !sampleCorpus.some((sample) => sample.editorId === editorId))
  const parserBlockCoverageBySample = Object.fromEntries(
    parserBlockIds.map((parserBlockId) => [
      parserBlockId,
      sampleCorpus
        .filter((sample) => sample.expectedParserBlockIds.includes(parserBlockId))
        .map((sample) => sample.id),
    ]),
  ) satisfies Record<ParserBlockId, string[]>

  return {
    missingParserFixtureBlockTypes,
    missingParserBlockTestMappings,
    sampleGapParserBlockIds,
    invalidParserBlockTestFileLinks,
    invalidExpectedParserBlockIds,
    missingSampleSourceFixtures,
    missingSampleExpectedFixtures,
    missingEditorCoverage,
    parserBlockCoverageBySample,
    parserBlockFixtureCoverageCount: outputAstBlockTypes.length - missingParserFixtureBlockTypes.length,
    parserBlockFixtureTotal: outputAstBlockTypes.length,
    parserBlockTestCoverageCount: coveredParserBlockTestIds.size,
    parserBlockTestTotal: parserBlockIds.length,
    parserBlockSampleCoverageCount: parserBlockIds.length - sampleGapParserBlockIds.length,
    parserBlockSampleTotal: parserBlockIds.length,
  }
}
