import { blogEditors, blogs } from "../../../src/modules/blog/BlogRegistry.js"
import { blockOutputFamilyDefinitions } from "../../../src/shared/BlockRegistry.js"
import { sampleCorpus } from "../../../src/shared/SampleCorpus.js"
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
  const parserBlockIds = blogEditors.flatMap((editor) => editor.supportedBlocks)
  const openRisks = [
    ...parserStatus.missingParserFixtureBlockTypes.map(
      (blockType) => `parser fixture missing for AST blockType: ${blockType}`,
    ),
    ...parserStatus.missingParserBlockTestMappings.map(
      (parserBlockId) => `parser test mapping missing for parser block: ${parserBlockId}`,
    ),
    ...parserStatus.invalidParserBlockTestFileLinks,
    ...parserStatus.sampleGapParserBlockIds.map(
      (parserBlockId) => `실샘플이 없는 parser block: ${parserBlockId}`,
    ),
    ...parserStatus.invalidExpectedParserBlockIds,
    ...parserStatus.missingSampleSourceFixtures.map(
      (sampleId) => `sample source fixture missing for sample: ${sampleId}`,
    ),
    ...parserStatus.missingSampleExpectedFixtures.map(
      (sampleId) => `sample expected fixture missing for sample: ${sampleId}`,
    ),
    ...parserStatus.missingEditorCoverage.map(
      (editorId) => `실샘플이 없는 editor: ${editorId}`,
    ),
  ]

  const qualityScore = `# Quality Score

## 목적
이 문서는 parser fixture, parser test mapping, 실샘플 coverage를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 \`src/modules/blog/BlogRegistry.ts\`, \`src/shared/SampleCorpus.ts\`, \`tests/fixtures/\`, \`tests/*.test.ts\`를 바탕으로 자동 생성된다.

## 관련 코드
- \`src/modules/blog/BlogRegistry.ts\`
- \`src/shared/SampleCorpus.ts\`
- \`scripts/harness/generate-quality-report.ts\`
- \`scripts/harness/check-parser-blocks.ts\`

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser block fixture coverage | ${ratio({ total: parserStatus.parserBlockFixtureTotal, covered: parserStatus.parserBlockFixtureCoverageCount })} |
| parser block test mapping coverage | ${ratio({ total: parserStatus.parserBlockTestTotal, covered: parserStatus.parserBlockTestCoverageCount })} |
| parser block sample coverage | ${ratio({ total: parserStatus.parserBlockSampleTotal, covered: parserStatus.parserBlockSampleCoverageCount })} |
| sample corpus size | ${sampleCorpus.length} |
| covered editors | ${ratio({ total: blogEditors.length, covered: blogEditors.length - parserStatus.missingEditorCoverage.length })} |

## Open Risks
${openRisks.length > 0 ? openRisks.map((risk) => `- ${risk}`).join("\n") : "- 현재 열린 리스크 없음"}
`

  const sampleCoverage = `# Sample Coverage

## 목적
이 문서는 parser block별 대표 샘플 매핑과 sample fixture coverage gap을 보여주는 generated 리포트다.

## Source Of Truth
이 문서는 \`src/modules/blog/BlogRegistry.ts\` 와 \`src/shared/SampleCorpus.ts\` 를 바탕으로 자동 생성된다.

## 관련 코드
- \`src/modules/blog/BlogRegistry.ts\`
- \`src/shared/SampleCorpus.ts\`
- \`.agents/knowledge/product/sample-corpus.md\`
- \`scripts/harness/generate-quality-report.ts\`

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`

## Parser Block To Sample Map
| parserBlockId | sampleIds |
| --- | --- |
${parserBlockIds
  .map((parserBlockId) => {
    const sampleIds = parserStatus.parserBlockCoverageBySample[parserBlockId]

    return `| \`${parserBlockId}\` | ${sampleIds.length > 0 ? sampleIds.map((sampleId) => `\`${sampleId}\``).join(", ") : "-"} |`
  })
  .join("\n")}

## Sample Catalog
| id | editorId | expectedParserBlockIds |
| --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorId}\` | ${sample.expectedParserBlockIds.map((parserBlockId) => `\`${parserBlockId}\``).join(", ")} |`,
  )
  .join("\n")}

## Sample Gaps
${parserStatus.sampleGapParserBlockIds.length > 0 ? parserStatus.sampleGapParserBlockIds.map((parserBlockId) => `- \`${parserBlockId}\``).join("\n") : "- 현재 sample gap 없음"}
`

  const parserBlockCatalog = `# Parser Block Catalog

## 목적
이 문서는 Blog, Editor, Parser Block 지원 관계를 정리한다. 지원 여부의 기준은 각 editor의 \`supportedBlocks\` 이다.

## Source Of Truth
- 실제 기준은 \`src/modules/blog/BlogRegistry.ts\` 이다.
- output family 기준은 \`src/shared/BlockRegistry.ts\` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- \`src/modules/blog/BlogRegistry.ts\`
- \`src/modules/parser/ParserBlockFactory.ts\`
- \`src/shared/BlockRegistry.ts\`
- \`src/shared/SampleCorpus.ts\`
- \`src/modules/parser/PostParser.ts\`

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`

## Blog Table
| blogId | editors |
| --- | --- |
${blogs.map((blog) => `| \`${blog.id}\` | ${blog.editors.map((editorId) => `\`${editorId}\``).join(", ")} |`).join("\n")}

## Editor Table
| editorId | blogId | supportedBlocks |
| --- | --- | --- |
${blogEditors
  .map(
    (editor) =>
      `| \`${editor.id}\` | \`${editor.blogId}\` | ${editor.supportedBlocks.map((parserBlockId) => `\`${parserBlockId}\``).join(", ")} |`,
  )
  .join("\n")}

## Output Families
| parserBlockId | astBlockType | label |
| --- | --- | --- |
${blockOutputFamilyDefinitions
  .map(
    (definition) =>
      `| \`${definition.parserBlockId}\` | \`${definition.astBlockType}\` | ${definition.label} |`,
  )
  .join("\n")}

## Notes
- Parser Block은 source HTML parser 단위이고 AST Block은 Markdown renderer용 공통 중간 표현이다.
- 같은 AST Block으로 변환되더라도 Parser Block id는 editor별 source 구조를 기준으로 분리한다.
- sample coverage gap은 \`.agents/knowledge/reference/generated/sample-coverage.md\` 에서 같이 본다.
`

  const sampleCorpusDoc = `# Sample Corpus

## 목적
이 문서는 parser block regression에 쓰는 공개 네이버 블로그 샘플과 fixture 운영 방식을 정리한다.

## Source Of Truth
- 실제 샘플 목록과 metadata는 \`src/shared/SampleCorpus.ts\` 이다.
- 실제 fixture 파일은 \`tests/fixtures/samples/<sampleId>/source.html\`, \`expected.md\` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- \`src/shared/SampleCorpus.ts\`
- \`src/modules/blog/BlogRegistry.ts\`
- \`scripts/harness/verify-sample-exports.ts\`
- \`scripts/harness/refresh-sample-fixtures.ts\`
- \`scripts/harness/lib/sample-fixtures.ts\`

## 검증 방법
- \`pnpm quality:report\`
- \`pnpm parser:check\`
- \`pnpm samples:verify\`
- \`pnpm samples:refresh -- --id <sampleId>\`

## Sample Table
| id | editorId | expectedParserBlockIds | description |
| --- | --- | --- | --- |
${sampleCorpus
  .map(
    (sample) =>
      `| \`${sample.id}\` | \`${sample.editorId}\` | ${sample.expectedParserBlockIds.map((parserBlockId) => `\`${parserBlockId}\``).join(", ")} | ${sample.description} |`,
  )
  .join("\n")}

## Selection Rules
- sample은 가능한 한 parser block id를 직접 증명하는 대표 글을 선택한다.
- 공개 글 fixture가 없는 Parser Block은 generated coverage에 gap으로 남긴다.
- 새 sample을 추가할 때는 \`src/shared/SampleCorpus.ts\`, \`tests/fixtures/samples/<sampleId>/source.html\`, \`tests/fixtures/samples/<sampleId>/expected.md\`를 같이 추가한다.
- sample을 갱신할 때는 기본적으로 \`pnpm samples:refresh -- --id <sampleId>\`를 사용한다.
`

  return {
    parserBlockCatalog,
    qualityScore,
    sampleCorpusDoc,
    sampleCoverage,
  }
}
