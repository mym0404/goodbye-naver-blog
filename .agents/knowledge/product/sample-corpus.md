# Sample Corpus

## 목적
이 문서는 capability-first parser regression에 쓰는 공개 네이버 블로그 샘플과 fixture 운영 방식을 정리한다.

## Source Of Truth
- 실제 샘플 목록과 metadata는 `src/shared/sample-corpus.ts` 이다.
- 실제 fixture 파일은 `tests/fixtures/samples/<sampleId>/source.html`, `expected.md` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- `src/shared/sample-corpus.ts`
- `src/shared/parser-capabilities.ts`
- `scripts/harness/verify-sample-exports.ts`
- `scripts/harness/refresh-sample-fixtures.ts`
- `scripts/harness/lib/sample-fixtures.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`
- `pnpm samples:refresh -- --id <sampleId>`

## Sample Table
| id | editorVersion | expectedCapabilityLookupIds | description |
| --- | --- | --- | --- |
| `se4-video-table` | `4` | `se4-image`, `se4-video`, `se4-table` | 오래된 SE4 글에서 video, table, image 블록을 검증한다. |
| `se4-formula-code-linkcard` | `4` | `se4-linkCard`, `se4-image`, `se4-divider`, `se4-paragraph`, `se4-formula`, `se4-code` | 수식, 코드, 링크 카드와 본문/구분선을 함께 검증한다. |
| `se4-image-group` | `4` | `se4-paragraph`, `se4-divider`, `se4-imageGroup` | imageGroup 블록과 문단, 구분선 조합을 검증한다. |
| `se4-heading-itinerary` | `4` | `se4-paragraph`, `se4-image`, `se4-heading`, `se4-divider`, `se4-imageGroup`, `se4-linkCard`, `se4-table` | SE4 sectionTitle heading이 반복되는 여행 일정 글을 검증한다. |
| `se4-image-legacy-link` | `4` | `se4-paragraph`, `se4-image` | __se_image_link 마크업을 쓰는 오래된 SE4 본문 이미지를 검증한다. |
| `se4-quote-formula-code` | `4` | `se4-linkCard`, `se4-image`, `se4-divider`, `se4-paragraph`, `se4-quote`, `se4-formula`, `se4-code` | 인용문과 수식, 코드가 섞인 SE4 글을 검증한다. |
| `se2-legacy` | `2` | `se2-paragraph` | SE2 raw HTML 본문을 paragraph 중심으로 변환하는지 검증한다. |
| `se2-code-image-autolayout` | `2` | `se2-paragraph`, `se2-image`, `se2-code` | SE2 본문에서 code와 image가 함께 나오는 기술 글을 검증한다. |
| `se2-table-rawhtml-navigation` | `2` | `se2-paragraph`, `se2-image`, `se2-table` | SE2 table과 인라인 GIF video fallback이 함께 반영된 실제 본문을 검증한다. |
| `se2-thumburl-image-group` | `2` | `se2-imageGroup`, `se2-paragraph` | SE2 thumburl 기반 레거시 본문 이미지 묶음을 검증한다. |
| `se3-legacy` | `3` | `se3-paragraph` | SE3 글 파싱과 chrome 텍스트 제거를 검증한다. |
| `se3-quote-imagegroup-note9` | `3` | `se3-paragraph`, `se3-image`, `se3-quote`, `se3-imageGroup` | SE3 본문에서 image, quote, imageGroup이 함께 나오는 IT 리뷰 글을 검증한다. |
| `se3-quote-table-vita` | `3` | `se3-paragraph`, `se3-image`, `se3-quote`, `se3-table` | SE3 table, quote와 fallback HTML 보존이 함께 반영된 게임 리뷰 글을 검증한다. |

## Selection Rules
- sample은 가능한 한 capability id를 직접 증명하는 대표 글을 선택한다.
- `sample-fixture` capability에 연결할 sample이 없으면 gap을 숨기지 않고 generated coverage에 남긴다.
- `parser-fixture` capability는 sample gap으로 계산하지 않는다. 이 경우 parser unit test와 parser fixture가 canonical 검증 경로다.
- 새 sample을 추가할 때는 `src/shared/sample-corpus.ts`, `tests/fixtures/samples/<sampleId>/source.html`, `tests/fixtures/samples/<sampleId>/expected.md`를 같이 추가한다.
- sample을 갱신할 때는 기본적으로 `pnpm samples:refresh -- --id <sampleId>`를 사용한다.
