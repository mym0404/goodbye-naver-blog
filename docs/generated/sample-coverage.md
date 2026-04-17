# Sample Coverage

## 목적
이 문서는 blockType별 대표 샘플 매핑과 sample coverage gap을 보여주는 generated 리포트다.

## Source Of Truth
이 문서는 `src/shared/parser-capabilities.ts` 와 `src/shared/sample-corpus.ts` 를 바탕으로 자동 생성된다.

## 관련 코드
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- [../../.agents/knowledge/product/sample-corpus.md](../../.agents/knowledge/product/sample-corpus.md)
- [../../scripts/harness/generate-quality-report.ts](../../scripts/harness/generate-quality-report.ts)

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`

## Block To Sample Map
| blockType | sampleIds |
| --- | --- |
| `paragraph` | `se2-legacy`, `se3-legacy`, `se4-formula-code-linkcard` |
| `heading` | - |
| `quote` | `se4-quote-formula-code` |
| `divider` | `se4-formula-code-linkcard`, `se4-image-group` |
| `code` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `formula` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `image` | `se4-video-table`, `se4-image-legacy-link`, `se4-quote-formula-code` |
| `imageGroup` | `se4-image-group`, `se2-thumburl-image-group` |
| `video` | `se4-video-table` |
| `linkCard` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `table` | `se4-video-table` |
| `rawHtml` | - |

## Sample Catalog
| id | editorVersion | expectedBlockTypes |
| --- | --- | --- |
| `se4-video-table` | `4` | `image`, `video`, `table` |
| `se4-formula-code-linkcard` | `4` | `linkCard`, `image`, `divider`, `paragraph`, `formula`, `code` |
| `se4-image-group` | `4` | `paragraph`, `divider`, `imageGroup` |
| `se4-image-legacy-link` | `4` | `paragraph`, `image` |
| `se4-quote-formula-code` | `4` | `linkCard`, `image`, `divider`, `paragraph`, `quote`, `formula`, `code` |
| `se2-legacy` | `2` | `paragraph` |
| `se2-thumburl-image-group` | `2` | `imageGroup`, `paragraph` |
| `se3-legacy` | `3` | `paragraph` |

## Sample Gaps
- `heading`
- `rawHtml`
