# Sample Corpus

## 목적
이 문서는 parser block regression에 쓰는 공개 네이버 블로그 샘플과 fixture 운영 방식을 정리한다.

## Source Of Truth
- 실제 샘플 목록과 metadata는 `src/shared/SampleCorpus.ts` 이다.
- 실제 fixture 파일은 `tests/fixtures/samples/<sampleId>/source.html`, `expected.md` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- `src/shared/SampleCorpus.ts`
- `src/modules/blog/BlogRegistry.ts`
- `scripts/harness/verify-sample-exports.ts`
- `scripts/harness/refresh-sample-fixtures.ts`
- `scripts/harness/lib/sample-fixtures.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`
- `pnpm samples:refresh -- --id <sampleId>`

## Sample Table
| id | editorId | expectedParserBlockIds | description |
| --- | --- | --- | --- |
| `se4-video-table` | `naver.se4` | `naver.se4.image`, `naver.se4.video`, `naver.se4.table` | 오래된 SE4 글에서 video, table, image 블록을 검증한다. |
| `se4-formula-code-linkcard` | `naver.se4` | `naver.se4.linkCard`, `naver.se4.image`, `naver.se4.divider`, `naver.se4.text`, `naver.se4.formula`, `naver.se4.code` | 수식, 코드, 링크 카드와 본문/구분선을 함께 검증한다. |
| `se4-image-group` | `naver.se4` | `naver.se4.text`, `naver.se4.divider`, `naver.se4.imageGroup` | imageGroup 블록과 문단, 구분선 조합을 검증한다. |
| `se4-heading-itinerary` | `naver.se4` | `naver.se4.text`, `naver.se4.image`, `naver.se4.heading`, `naver.se4.divider`, `naver.se4.imageGroup`, `naver.se4.linkCard`, `naver.se4.table` | SE4 sectionTitle heading이 반복되는 여행 일정 글을 검증한다. |
| `se4-image-legacy-link` | `naver.se4` | `naver.se4.text`, `naver.se4.image` | __se_image_link 마크업을 쓰는 오래된 SE4 본문 이미지를 검증한다. |
| `se4-quote-formula-code` | `naver.se4` | `naver.se4.linkCard`, `naver.se4.image`, `naver.se4.divider`, `naver.se4.text`, `naver.se4.quote`, `naver.se4.formula`, `naver.se4.code` | 인용문과 수식, 코드가 섞인 SE4 글을 검증한다. |
| `se2-legacy` | `naver.se2` | `naver.se2.textElement` | SE2 raw HTML 본문을 paragraph 중심으로 변환하는지 검증한다. |
| `se2-code-image-autolayout` | `naver.se2` | `naver.se2.textElement`, `naver.se2.image`, `naver.se2.table` | SE2 본문에서 code와 image가 함께 나오는 기술 글을 검증한다. |
| `se2-table-rawhtml-navigation` | `naver.se2` | `naver.se2.textElement`, `naver.se2.image`, `naver.se2.table` | SE2 table과 인라인 GIF video fallback이 함께 반영된 실제 본문을 검증한다. |
| `se2-thumburl-image-group` | `naver.se2` | `naver.se2.image`, `naver.se2.textElement` | SE2 thumburl 기반 레거시 본문 이미지 묶음을 검증한다. |
| `se3-legacy` | `naver.se3` | `naver.se3.text` | SE3 글 파싱과 chrome 텍스트 제거를 검증한다. |
| `se3-quote-imagegroup-note9` | `naver.se3` | `naver.se3.text`, `naver.se3.image`, `naver.se3.quote`, `naver.se3.image` | SE3 본문에서 image, quote, imageGroup이 함께 나오는 IT 리뷰 글을 검증한다. |
| `se3-quote-table-vita` | `naver.se3` | `naver.se3.text`, `naver.se3.image`, `naver.se3.quote`, `naver.se3.table` | SE3 table, quote와 fallback HTML 보존이 함께 반영된 게임 리뷰 글을 검증한다. |

## Selection Rules
- sample은 가능한 한 parser block id를 직접 증명하는 대표 글을 선택한다.
- 공개 글 fixture가 없는 Parser Block은 generated coverage에 gap으로 남긴다.
- 새 sample을 추가할 때는 `src/shared/SampleCorpus.ts`, `tests/fixtures/samples/<sampleId>/source.html`, `tests/fixtures/samples/<sampleId>/expected.md`를 같이 추가한다.
- sample을 갱신할 때는 기본적으로 `pnpm samples:refresh -- --id <sampleId>`를 사용한다.
