import { parserCapabilities } from "../../../src/shared/parser-capabilities.js"
import { sampleCorpus } from "../../../src/shared/sample-corpus.js"
import { collectDocStatus } from "./doc-status.js"
import { collectParserStatus } from "./parser-status.js"

const ratio = ({
  total,
  covered,
}: {
  total: number
  covered: number
}) => `${covered}/${total} (${Math.round((covered / Math.max(total, 1)) * 100)}%)`

export const buildGeneratedDocs = async () => {
  const docStatus = await collectDocStatus()
  const parserStatus = await collectParserStatus()
  const docsCoverageTotal = docStatus.coreDocCount
  const docsCoverageCovered = Math.max(docStatus.validCoreDocCount, 0)
  const parserTotal = parserCapabilities.length
  const parserFixtureCovered = parserStatus.parserFixtureCoverageCount
  const parserTestCovered = parserStatus.parserTestCoverageCount
  const parserSampleCovered = parserTotal - parserStatus.sampleGapBlockTypes.length
  const openRisks = [
    ...parserStatus.sampleGapBlockTypes.map(
      (blockType) => `실샘플이 없는 blockType: ${blockType}`,
    ),
    ...docStatus.headingFailures,
    ...docStatus.deadLinks,
  ]

  const qualityScore = `# Quality Score

## 목적
이 문서는 parser, sample, docs harness 커버리지를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 \`src/shared/parser-capabilities.ts\`, \`src/shared/sample-corpus.ts\`, \`docs/\` 구조를 바탕으로 자동 생성된다.

## 관련 코드
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- [../../scripts/harness/generate-quality-report.ts](../../scripts/harness/generate-quality-report.ts)
- [../../scripts/harness/check-doc-graph.ts](../../scripts/harness/check-doc-graph.ts)
- [../../scripts/harness/check-parser-capabilities.ts](../../scripts/harness/check-parser-capabilities.ts)

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm docs:check\`
- \`pnpm parser:check\`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser fixture coverage | ${ratio({ total: parserTotal, covered: parserFixtureCovered })} |
| parser test coverage | ${ratio({ total: parserTotal, covered: parserTestCovered })} |
| parser sample coverage | ${ratio({ total: parserTotal, covered: parserSampleCovered })} |
| sample corpus size | ${sampleCorpus.length} |
| docs coverage | ${ratio({ total: docsCoverageTotal, covered: docsCoverageCovered })} |

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
- [../../docs/samples/index.md](../../docs/samples/index.md)
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
