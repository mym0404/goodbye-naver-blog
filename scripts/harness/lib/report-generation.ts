import { parserCapabilities } from "../../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../../src/shared/sample-corpus.js"
import { collectParserStatus } from "./parser-status.js"

const ratio = ({
  total,
  covered,
}: {
  total: number
  covered: number
}) => `${covered}/${total} (${Math.round((covered / Math.max(total, 1)) * 100)}%)`

export const buildGeneratedDocs = async () => {
  const parserStatus = await collectParserStatus()
  const parserTotal = parserCapabilities.length
  const parserFixtureCovered = parserStatus.parserFixtureCoverageCount
  const parserTestCovered = parserStatus.parserTestCoverageCount
  const parserSampleCovered = parserTotal - parserStatus.sampleGapBlockTypes.length
  const openRisks = [
    ...parserStatus.missingFixtureBlockTypes.map(
      (blockType) => `parser fixture missing for blockType: ${blockType}`,
    ),
    ...parserStatus.missingTestBlockTypes.map(
      (blockType) => `parser test reference missing for blockType: ${blockType}`,
    ),
    ...parserStatus.sampleGapBlockTypes.map(
      (blockType) => `실샘플이 없는 blockType: ${blockType}`,
    ),
    ...parserStatus.invalidSampleLinks,
    ...parserStatus.missingExportFixtures.map(
      (sampleId) => `export fixture missing for sample: ${sampleId}`,
    ),
    ...parserStatus.missingEditorCoverage.map(
      (editorVersion) => `실샘플이 없는 editorVersion: ${editorVersion}`,
    ),
  ]

  const qualityScore = `# Quality Score

## 목적
이 문서는 parser fixture, parser test, 실샘플 coverage를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 \`src/shared/parser-capabilities.ts\`, \`src/shared/sample-corpus.ts\`, \`tests/fixtures/\`, \`tests/*.test.ts\`를 바탕으로 자동 생성된다.

## 관련 코드
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- [../../scripts/harness/generate-quality-report.ts](../../scripts/harness/generate-quality-report.ts)
- [../../scripts/harness/check-parser-capabilities.ts](../../scripts/harness/check-parser-capabilities.ts)

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser fixture coverage | ${ratio({ total: parserTotal, covered: parserFixtureCovered })} |
| parser test coverage | ${ratio({ total: parserTotal, covered: parserTestCovered })} |
| parser sample coverage | ${ratio({ total: parserTotal, covered: parserSampleCovered })} |
| sample corpus size | ${sampleCorpus.length} |
| covered editor versions | ${ratio({ total: 3, covered: 3 - parserStatus.missingEditorCoverage.length })} |

## Open Risks
${openRisks.length > 0 ? openRisks.map((risk) => `- ${risk}`).join("\n") : "- 현재 열린 리스크 없음"}
`

  const sampleCoverage = `# Sample Coverage

## 목적
이 문서는 blockType별 대표 샘플 매핑과 sample coverage gap을 보여주는 generated 리포트다.

## Source Of Truth
이 문서는 \`src/shared/parser-capabilities.ts\` 와 \`src/shared/sample-corpus.ts\` 를 바탕으로 자동 생성된다.

## 관련 코드
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- [../../.agents/knowledge/product/sample-corpus.md](../../.agents/knowledge/product/sample-corpus.md)
- [../../scripts/harness/generate-quality-report.ts](../../scripts/harness/generate-quality-report.ts)

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`

## Block To Sample Map
| blockType | sampleIds |
| --- | --- |
${parserCapabilities
  .map(
    (capability) =>
      `| \`${capability.blockType}\` | ${capability.sampleIds.length > 0 ? capability.sampleIds.map((sampleId) => `\`${sampleId}\``).join(", ") : "-"} |`,
  )
  .join("\n")}

## Sample Catalog
| id | editorVersion | expectedBlockTypes |
| --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorVersion}\` | ${sample.expectedBlockTypes.map((blockType) => `\`${blockType}\``).join(", ")} |`,
  )
  .join("\n")}

## Sample Gaps
${parserStatus.sampleGapBlockTypes.length > 0 ? parserStatus.sampleGapBlockTypes.map((blockType) => `- \`${blockType}\``).join("\n") : "- 현재 sample gap 없음"}
`

  return {
    qualityScore,
    sampleCoverage,
  }
}
