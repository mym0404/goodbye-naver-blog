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
- [../../../../src/shared/parser-capabilities.ts](../../../../src/shared/parser-capabilities.ts)
- [../../../../src/shared/sample-corpus.ts](../../../../src/shared/sample-corpus.ts)
- [../../../../scripts/harness/generate-quality-report.ts](../../../../scripts/harness/generate-quality-report.ts)
- [../../../../scripts/harness/check-parser-capabilities.ts](../../../../scripts/harness/check-parser-capabilities.ts)

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
- [../../../../src/shared/parser-capabilities.ts](../../../../src/shared/parser-capabilities.ts)
- [../../../../src/shared/sample-corpus.ts](../../../../src/shared/sample-corpus.ts)
- [../../product/sample-corpus.md](../../product/sample-corpus.md)
- [../../../../scripts/harness/generate-quality-report.ts](../../../../scripts/harness/generate-quality-report.ts)

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
| id | editorVersion | expectedCapabilityLookupIds |
| --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorVersion}\` | ${sample.expectedCapabilityLookupIds.map((capabilityId) => `\`${capabilityId}\``).join(", ")} |`,
  )
  .join("\n")}

## Sample Gaps
${parserStatus.sampleGapCapabilityIds.length > 0 ? parserStatus.sampleGapCapabilityIds.map((capabilityId) => `- \`${capabilityId}\``).join("\n") : "- 현재 sample gap 없음"}

## Parser-fixture Only Capabilities
${parserStatus.parserFixtureOnlyCapabilityIds.length > 0 ? parserStatus.parserFixtureOnlyCapabilityIds.map((capabilityId) => `- \`${capabilityId}\``).join("\n") : "- 현재 parser-fixture only capability 없음"}
`

  const parserBlockCatalog = `# Parser Block Catalog

## 목적
이 문서는 parser가 지원하는 capability-first 카탈로그를 정리한다. canonical 지원 단위는 공용 \`blockType\`이 아니라 \`editorVersion + blockType\` 조합이다.

## Source Of Truth
- 실제 기준은 [../../../src/shared/block-registry.ts](../../../src/shared/block-registry.ts) 와 [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts) 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- [../../../src/shared/block-registry.ts](../../../src/shared/block-registry.ts)
- [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts)
- [../../../src/shared/sample-corpus.ts](../../../src/shared/sample-corpus.ts)
- [../../../src/modules/parser/post-parser.ts](../../../src/modules/parser/post-parser.ts)
- [../../../src/modules/parser/editors/base-editor.ts](../../../src/modules/parser/editors/base-editor.ts)
- [../../../src/modules/parser/editors/naver-blog-se2-editor.ts](../../../src/modules/parser/editors/naver-blog-se2-editor.ts)
- [../../../src/modules/parser/editors/naver-blog-se3-editor.ts](../../../src/modules/parser/editors/naver-blog-se3-editor.ts)
- [../../../src/modules/parser/editors/naver-blog-se4-editor.ts](../../../src/modules/parser/editors/naver-blog-se4-editor.ts)

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`

## Capability Table
| capabilityId | editorVersion | blockType | fallbackPolicy | verificationMode | sampleIds |
| --- | --- | --- | --- | --- | --- |
${parserCapabilities
  .map(
    (capability) =>
      `| \`${capability.id}\` | \`${capability.editorVersion}\` | \`${capability.blockType}\` | \`${capability.fallbackPolicy}\` | \`${capability.verificationMode}\` | ${capability.sampleIds.length > 0 ? capability.sampleIds.map((sampleId) => `\`${sampleId}\``).join(", ") : "-"} |`,
  )
  .join("\n")}

## Notes
- capability id는 parser, renderer, UI preview, generated knowledge가 함께 쓰는 공통 seam이다.
- \`sample-fixture\` capability는 공개 글 fixture로 회귀를 확인한다.
- \`parser-fixture\` capability는 parser unit test와 parser fixture로만 관리한다.
- coverage gap과 parser-fixture only 목록은 [../reference/generated/sample-coverage.md](../reference/generated/sample-coverage.md) 에서 같이 본다.
`

  const sampleCorpusDoc = `# Sample Corpus

## 목적
이 문서는 capability-first parser regression에 쓰는 공개 네이버 블로그 샘플과 fixture 운영 방식을 정리한다.

## Source Of Truth
- 실제 샘플 목록과 metadata는 [../../../src/shared/sample-corpus.ts](../../../src/shared/sample-corpus.ts) 이다.
- 실제 fixture 파일은 \`tests/fixtures/samples/<sampleId>/source.html\`, \`expected.md\` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- [../../../src/shared/sample-corpus.ts](../../../src/shared/sample-corpus.ts)
- [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)
- [../../../scripts/harness/refresh-sample-fixtures.ts](../../../scripts/harness/refresh-sample-fixtures.ts)
- [../../../scripts/harness/lib/sample-fixtures.ts](../../../scripts/harness/lib/sample-fixtures.ts)

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`
- \`pnpm samples:refresh -- --id <sampleId>\`

## Sample Table
| id | editorVersion | expectedCapabilityLookupIds | description |
| --- | --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorVersion}\` | ${sample.expectedCapabilityLookupIds.map((capabilityId) => `\`${capabilityId}\``).join(", ")} | ${sample.description} |`,
  )
  .join("\n")}

## Selection Rules
- sample은 가능한 한 capability id를 직접 증명하는 대표 글을 선택한다.
- \`case:<unsupportedBlockCaseId>\` lookup id는 warning 기반 대표 사례 해소를 뜻한다.
- \`sample-fixture\` capability에 연결할 sample이 없으면 gap을 숨기지 않고 generated coverage에 남긴다.
- \`parser-fixture\` capability는 sample gap으로 계산하지 않는다. 이 경우 parser unit test와 parser fixture가 canonical 검증 경로다.
- 새 sample을 추가할 때는 \`sample-corpus.ts\` metadata, \`source.html\`, \`expected.md\`를 같이 추가한다.
- sample을 갱신할 때는 기본적으로 \`pnpm samples:refresh -- --id <sampleId>\`를 사용한다.
`

  return {
    parserBlockCatalog,
    qualityScore,
    sampleCorpusDoc,
    sampleCoverage,
  }
}
