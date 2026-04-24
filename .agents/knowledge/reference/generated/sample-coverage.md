# Sample Coverage

## 목적
이 문서는 capability별 대표 샘플 매핑과 sample fixture coverage gap을 보여주는 generated 리포트다.

## Source Of Truth
이 문서는 `src/shared/parser-capabilities.ts` 와 `src/shared/sample-corpus.ts` 를 바탕으로 자동 생성된다.

## 관련 코드
- `src/shared/parser-capabilities.ts`
- `src/shared/sample-corpus.ts`
- `.agents/knowledge/product/sample-corpus.md`
- `scripts/harness/generate-quality-report.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`

## Capability To Sample Map
| capabilityId | blockType | verificationMode | sampleIds |
| --- | --- | --- | --- |
| `se2-paragraph` | `paragraph` | `sample-fixture` | `se2-legacy`, `se2-code-image-autolayout`, `se2-table-rawhtml-navigation` |
| `se3-paragraph` | `paragraph` | `sample-fixture` | `se3-legacy`, `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-paragraph` | `paragraph` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-heading-itinerary`, `se4-image-group` |
| `se2-heading` | `heading` | `parser-fixture` | - |
| `se4-heading` | `heading` | `sample-fixture` | `se4-heading-itinerary` |
| `se2-quote` | `quote` | `parser-fixture` | - |
| `se3-quote` | `quote` | `sample-fixture` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-quote` | `quote` | `sample-fixture` | `se4-quote-formula-code` |
| `se2-divider` | `divider` | `parser-fixture` | - |
| `se3-divider` | `divider` | `parser-fixture` | - |
| `se4-divider` | `divider` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-image-group`, `se4-heading-itinerary` |
| `se2-code` | `code` | `sample-fixture` | `se2-code-image-autolayout` |
| `se3-code` | `code` | `parser-fixture` | - |
| `se4-code` | `code` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `se4-formula` | `formula` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `se2-image` | `image` | `sample-fixture` | `se2-code-image-autolayout`, `se2-table-rawhtml-navigation` |
| `se3-image` | `image` | `sample-fixture` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-image` | `image` | `sample-fixture` | `se4-video-table`, `se4-image-legacy-link`, `se4-quote-formula-code`, `se4-heading-itinerary` |
| `se2-imageGroup` | `imageGroup` | `sample-fixture` | `se2-thumburl-image-group` |
| `se3-imageGroup` | `imageGroup` | `sample-fixture` | `se3-quote-imagegroup-note9` |
| `se4-imageGroup` | `imageGroup` | `sample-fixture` | `se4-image-group`, `se4-heading-itinerary` |
| `se4-video` | `video` | `sample-fixture` | `se4-video-table` |
| `se4-linkCard` | `linkCard` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code`, `se4-heading-itinerary` |
| `se2-table` | `table` | `sample-fixture` | `se2-table-rawhtml-navigation` |
| `se3-table` | `table` | `sample-fixture` | `se3-quote-table-vita` |
| `se4-table` | `table` | `sample-fixture` | `se4-video-table`, `se4-heading-itinerary` |

## Sample Catalog
| id | editorVersion | expectedCapabilityLookupIds |
| --- | --- | --- |
| `se4-video-table` | `4` | `se4-image`, `se4-video`, `se4-table` |
| `se4-formula-code-linkcard` | `4` | `se4-linkCard`, `se4-image`, `se4-divider`, `se4-paragraph`, `se4-formula`, `se4-code` |
| `se4-image-group` | `4` | `se4-paragraph`, `se4-divider`, `se4-imageGroup` |
| `se4-heading-itinerary` | `4` | `se4-paragraph`, `se4-image`, `se4-heading`, `se4-divider`, `se4-imageGroup`, `se4-linkCard`, `se4-table` |
| `se4-image-legacy-link` | `4` | `se4-paragraph`, `se4-image` |
| `se4-quote-formula-code` | `4` | `se4-linkCard`, `se4-image`, `se4-divider`, `se4-paragraph`, `se4-quote`, `se4-formula`, `se4-code` |
| `se2-legacy` | `2` | `se2-paragraph` |
| `se2-code-image-autolayout` | `2` | `se2-paragraph`, `se2-image`, `se2-code` |
| `se2-table-rawhtml-navigation` | `2` | `se2-paragraph`, `se2-image`, `se2-table` |
| `se2-thumburl-image-group` | `2` | `se2-imageGroup`, `se2-paragraph` |
| `se3-legacy` | `3` | `se3-paragraph` |
| `se3-quote-imagegroup-note9` | `3` | `se3-paragraph`, `se3-image`, `se3-quote`, `se3-imageGroup` |
| `se3-quote-table-vita` | `3` | `se3-paragraph`, `se3-image`, `se3-quote`, `se3-table` |

## Sample Gaps
- 현재 sample gap 없음

## Parser-fixture Only Capabilities
- `se2-heading`
- `se2-quote`
- `se2-divider`
- `se3-divider`
- `se3-code`
