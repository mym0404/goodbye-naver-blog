# Parser Block Catalog

## 목적
이 문서는 parser가 지원하는 capability-first 카탈로그를 정리한다. canonical 지원 단위는 공용 `blockType`이 아니라 `editorVersion + blockType` 조합이다.

## Source Of Truth
- 실제 기준은 `src/shared/block-registry.ts` 와 `src/shared/parser-capabilities.ts` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- `src/shared/block-registry.ts`
- `src/shared/parser-capabilities.ts`
- `src/shared/sample-corpus.ts`
- `src/modules/parser/post-parser.ts`
- `src/modules/parser/editors/base-editor.ts`
- `src/modules/parser/editors/naver-blog-se2-editor.ts`
- `src/modules/parser/editors/naver-blog-se3-editor.ts`
- `src/modules/parser/editors/naver-blog-se4-editor.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`

## Capability Table
| capabilityId | editorVersion | blockType | fallbackPolicy | verificationMode | sampleIds |
| --- | --- | --- | --- | --- | --- |
| `se2-paragraph` | `2` | `paragraph` | `best-effort` | `sample-fixture` | `se2-legacy`, `se2-code-image-autolayout`, `se2-table-rawhtml-navigation` |
| `se3-paragraph` | `3` | `paragraph` | `best-effort` | `sample-fixture` | `se3-legacy`, `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-paragraph` | `4` | `paragraph` | `best-effort` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-heading-itinerary`, `se4-image-group` |
| `se2-heading` | `2` | `heading` | `markdown-paragraph` | `parser-fixture` | - |
| `se4-heading` | `4` | `heading` | `markdown-paragraph` | `sample-fixture` | `se4-heading-itinerary` |
| `se2-quote` | `2` | `quote` | `markdown-paragraph` | `parser-fixture` | - |
| `se3-quote` | `3` | `quote` | `markdown-paragraph` | `sample-fixture` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-quote` | `4` | `quote` | `markdown-paragraph` | `sample-fixture` | `se4-quote-formula-code` |
| `se2-divider` | `2` | `divider` | `structured` | `parser-fixture` | - |
| `se3-divider` | `3` | `divider` | `structured` | `parser-fixture` | - |
| `se4-divider` | `4` | `divider` | `structured` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-image-group`, `se4-heading-itinerary` |
| `se2-code` | `2` | `code` | `markdown-paragraph` | `sample-fixture` | `se2-code-image-autolayout` |
| `se3-code` | `3` | `code` | `markdown-paragraph` | `parser-fixture` | - |
| `se4-code` | `4` | `code` | `markdown-paragraph` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `se4-formula` | `4` | `formula` | `skip` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `se2-image` | `2` | `image` | `markdown-paragraph` | `sample-fixture` | `se2-code-image-autolayout`, `se2-table-rawhtml-navigation` |
| `se3-image` | `3` | `image` | `markdown-paragraph` | `sample-fixture` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `se4-image` | `4` | `image` | `markdown-paragraph` | `sample-fixture` | `se4-video-table`, `se4-image-legacy-link`, `se4-quote-formula-code`, `se4-heading-itinerary` |
| `se2-imageGroup` | `2` | `imageGroup` | `markdown-paragraph` | `sample-fixture` | `se2-thumburl-image-group` |
| `se3-imageGroup` | `3` | `imageGroup` | `markdown-paragraph` | `sample-fixture` | `se3-quote-imagegroup-note9` |
| `se4-imageGroup` | `4` | `imageGroup` | `markdown-paragraph` | `sample-fixture` | `se4-image-group`, `se4-heading-itinerary` |
| `se4-video` | `4` | `video` | `skip` | `sample-fixture` | `se4-video-table` |
| `se4-linkCard` | `4` | `linkCard` | `markdown-paragraph` | `sample-fixture` | `se4-formula-code-linkcard`, `se4-quote-formula-code`, `se4-heading-itinerary` |
| `se2-table` | `2` | `table` | `raw-html` | `sample-fixture` | `se2-table-rawhtml-navigation` |
| `se3-table` | `3` | `table` | `raw-html` | `sample-fixture` | `se3-quote-table-vita` |
| `se4-table` | `4` | `table` | `raw-html` | `sample-fixture` | `se4-video-table`, `se4-heading-itinerary` |

## Notes
- capability id는 parser, renderer, UI preview, generated knowledge가 함께 쓰는 공통 seam이다.
- `sample-fixture` capability는 공개 글 fixture로 회귀를 확인한다.
- `parser-fixture` capability는 parser unit test와 parser fixture로만 관리한다.
- coverage gap과 parser-fixture only 목록은 `.agents/knowledge/reference/generated/sample-coverage.md` 에서 같이 본다.
