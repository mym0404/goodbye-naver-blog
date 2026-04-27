# Sample Fixtures

## 목적
이 문서는 parser block regression에 쓰는 공개 네이버 블로그 sample fixture 운영 방식을 정리한다.

## Source Of Truth
- 실제 샘플 목록은 `tests/fixtures/samples/*` 디렉터리다.
- metadata는 각 sample의 `expected.md` frontmatter에서 읽는다.

## 관련 코드
- `tests/sample-fixtures.test.ts`
- `scripts/harness/lib/sample-fixtures.ts`

## 검증 방법
- `pnpm test:offline`

## Sample Table
| id | editorId |
| --- | --- |
| `se4-video-table` | `naver.se4` |
| `se4-formula-code-linkcard` | `naver.se4` |
| `se4-image-group` | `naver.se4` |
| `se4-heading-itinerary` | `naver.se4` |
| `se4-image-legacy-link` | `naver.se4` |
| `se4-quote-formula-code` | `naver.se4` |
| `se2-legacy` | `naver.se2` |
| `se2-code-image-autolayout` | `naver.se2` |
| `se2-table-rawhtml-navigation` | `naver.se2` |
| `se2-thumburl-image-group` | `naver.se2` |
| `se3-legacy` | `naver.se3` |
| `se3-quote-imagegroup-note9` | `naver.se3` |
| `se3-quote-table-vita` | `naver.se3` |

## Selection Rules
- sample은 editor별 실제 공개 글 fixture로 선택한다.
- 새 sample을 추가할 때는 `tests/fixtures/samples/<sampleId>/source.html`, `tests/fixtures/samples/<sampleId>/expected.md`를 같이 추가한다.
