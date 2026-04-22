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
  const parserTotal = parserStatus.parserCapabilitySampleTotal
  const parserBlockTotal = parserStatus.parserBlockTotal
  const parserFixtureCovered = parserStatus.parserBlockFixtureCoverageCount
  const parserTestCovered = parserStatus.parserCapabilityTestCoverageCount
  const parserTestTotal = parserStatus.parserCapabilityTestTotal
  const parserSampleCovered = parserStatus.parserCapabilitySampleCoverageCount
  const openRisks = [
    ...parserStatus.missingParserFixtureBlockTypes.map(
      (blockType) => `parser fixture missing for blockType: ${blockType}`,
    ),
    ...parserStatus.missingCapabilityTestMappings.map(
      (capabilityId) => `parser test mapping missing for capability: ${capabilityId}`,
    ),
    ...parserStatus.invalidCapabilityTestFileLinks,
    ...parserStatus.sampleGapCapabilityIds.map(
      (capabilityId) => `실샘플이 없는 capability: ${capabilityId}`,
    ),
    ...parserStatus.invalidSampleLinks,
    ...parserStatus.invalidExpectedCapabilityIds,
    ...parserStatus.missingSampleSourceFixtures.map(
      (sampleId) => `sample source fixture missing for sample: ${sampleId}`,
    ),
    ...parserStatus.missingSampleExpectedFixtures.map(
      (sampleId) => `sample expected fixture missing for sample: ${sampleId}`,
    ),
    ...parserStatus.missingEditorCoverage.map(
      (editorVersion) => `실샘플이 없는 editorVersion: ${editorVersion}`,
    ),
  ]

  const qualityScore = `# Quality Score

## 목적
이 문서는 parser fixture, parser test mapping, 실샘플 coverage를 요약하는 generated 품질 리포트다.

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
| parser block fixture coverage | ${ratio({ total: parserBlockTotal, covered: parserFixtureCovered })} |
| parser capability test mapping coverage | ${ratio({ total: parserTestTotal, covered: parserTestCovered })} |
| sample-fixture capability coverage | ${ratio({ total: parserTotal, covered: parserSampleCovered })} |
| parser-fixture only capabilities | ${parserStatus.parserFixtureOnlyCapabilityIds.length} |
| sample corpus size | ${sampleCorpus.length} |
| covered editor versions | ${ratio({ total: 3, covered: 3 - parserStatus.missingEditorCoverage.length })} |

## Open Risks
${openRisks.length > 0 ? openRisks.map((risk) => `- ${risk}`).join("\n") : "- 현재 열린 리스크 없음"}

## Parser-fixture Only Capabilities
${parserStatus.parserFixtureOnlyCapabilityIds.length > 0 ? parserStatus.parserFixtureOnlyCapabilityIds.map((capabilityId) => `- \`${capabilityId}\``).join("\n") : "- 현재 parser-fixture only capability 없음"}
`

  const sampleCoverage = `# Sample Coverage

## 목적
이 문서는 capability별 대표 샘플 매핑과 sample fixture coverage gap을 보여주는 generated 리포트다.

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

## Capability To Sample Map
| capabilityId | blockType | verificationMode | sampleIds |
| --- | --- | --- | --- |
${parserCapabilities
  .map(
    (capability) =>
      `| \`${capability.id}\` | \`${capability.blockType}\` | \`${capability.verificationMode}\` | ${capability.sampleIds.length > 0 ? capability.sampleIds.map((sampleId) => `\`${sampleId}\``).join(", ") : "-"} |`,
  )
  .join("\n")}

## Sample Catalog
| id | editorVersion | expectedCapabilityIds |
| --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorVersion}\` | ${sample.expectedCapabilityIds.map((capabilityId) => `\`${capabilityId}\``).join(", ")} |`,
  )
  .join("\n")}

## Sample Gaps
${parserStatus.sampleGapCapabilityIds.length > 0 ? parserStatus.sampleGapCapabilityIds.map((capabilityId) => `- \`${capabilityId}\``).join("\n") : "- 현재 sample gap 없음"}

## Parser-fixture Only Capabilities
${parserStatus.parserFixtureOnlyCapabilityIds.length > 0 ? parserStatus.parserFixtureOnlyCapabilityIds.map((capabilityId) => `- \`${capabilityId}\``).join("\n") : "- 현재 parser-fixture only capability 없음"}
`

  return {
    qualityScore,
    sampleCoverage,
  }
}
