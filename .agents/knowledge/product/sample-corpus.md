# Sample Corpus

## 목적
이 문서는 실샘플 검증에 사용하는 공개 네이버 블로그 글과 그 대표 블록을 정의한다.

## Source Of Truth
실제 샘플 목록은 [../../../src/shared/sample-corpus.ts](../../../src/shared/sample-corpus.ts) 이다.

## 관련 코드
- [../../../src/shared/sample-corpus.ts](../../../src/shared/sample-corpus.ts)
- [../../../tests/naver.integration.test.ts](../../../tests/naver.integration.test.ts)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)

## 검증 방법
- `pnpm samples:verify`: 공개 샘플 목록이나 renderer/exporter 결과가 바뀌었을 때 실제 export 결과를 다시 확인한다.
- `pnpm parser:check`: sample id가 parser capability와 계속 맞물리는지 확인할 때 실행한다.

## Sample Table
| id | blogId | logNo | editorVersion | expectedBlockTypes | description |
| --- | --- | --- | --- | --- | --- |
| `se4-video-table` | `mym0404` | `221302086471` | `4` | `image`, `video`, `table` | 오래된 SE4의 video/table 대표 샘플 |
| `se4-formula-code-linkcard` | `mym0404` | `223034929697` | `4` | `linkCard`, `image`, `divider`, `paragraph`, `formula`, `code` | 수식/코드/링크 카드 대표 샘플 |
| `se4-image-group` | `mym0404` | `224056819985` | `4` | `paragraph`, `divider`, `imageGroup` | imageGroup 대표 샘플 |
| `se4-heading-itinerary` | `goyamee` | `223511986798` | `4` | `paragraph`, `image`, `heading`, `divider`, `imageGroup`, `linkCard`, `table` | sectionTitle heading이 반복되는 여행 일정 대표 샘플 |
| `se4-image-legacy-link` | `mym0404` | `221589718939` | `4` | `paragraph`, `image` | `__se_image_link` 기반 본문 이미지 대표 샘플 |
| `se4-quote-formula-code` | `mym0404` | `222619228134` | `4` | `linkCard`, `image`, `divider`, `paragraph`, `quote`, `formula`, `code` | quote 포함 SE4 대표 샘플 |
| `se2-legacy` | `mym0404` | `220496669802` | `2` | `paragraph` | SE2 legacy 대표 샘플 |
| `se2-thumburl-image-group` | `mym0404` | `221425068566` | `2` | `imageGroup`, `paragraph` | `thumburl` 기반 SE2 본문 이미지 묶음 대표 샘플 |
| `se3-legacy` | `mym0404` | `221236891086` | `3` | `paragraph` | SE3 legacy 대표 샘플 |

## Selection Rules
- parser capability에 sample id를 연결할 수 있는 블록은 되도록 대표 샘플을 가진다.
- fallback 전용 블록은 fixture 중심으로 커버하고, sample gap은 generated 리포트에 남긴다.
