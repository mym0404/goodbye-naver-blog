# Parser Block Catalog

## 목적
이 문서는 parser가 지원하는 공용 블록 타입, editor version별 지원 범위, fallback 정책, 대표 샘플을 카탈로그화한다.

## Source Of Truth
실제 기준은 [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts) 이다.

## 관련 코드
- [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts)
- [../../../src/modules/parser/post-parser.ts](../../../src/modules/parser/post-parser.ts)
- [../../../src/modules/parser/se2-parser.ts](../../../src/modules/parser/se2-parser.ts)
- [../../../src/modules/parser/se3-parser.ts](../../../src/modules/parser/se3-parser.ts)
- [../../../src/modules/parser/se4-parser.ts](../../../src/modules/parser/se4-parser.ts)

## 검증 방법
- `pnpm parser:check`
- `pnpm test`
- `pnpm samples:verify`

## Block Table
| blockType | supportedEditors | fallbackPolicy | sampleIds |
| --- | --- | --- | --- |
| `paragraph` | `2, 3, 4` | `best-effort` | `se2-legacy`, `se3-legacy`, `se4-formula-code-linkcard` |
| `heading` | `2, 4` | `markdown-paragraph` | - |
| `quote` | `2, 3, 4` | `markdown-paragraph` | `se4-quote-formula-code` |
| `divider` | `2, 4` | `structured` | `se4-formula-code-linkcard`, `se4-image-group` |
| `code` | `2, 3, 4` | `markdown-paragraph` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `formula` | `4` | `skip` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `image` | `2, 3, 4` | `markdown-paragraph` | `se4-video-table`, `se4-image-legacy-link`, `se4-quote-formula-code` |
| `imageGroup` | `2, 3, 4` | `markdown-paragraph` | `se4-image-group`, `se2-thumburl-image-group` |
| `video` | `4` | `skip` | `se4-video-table` |
| `linkCard` | `4` | `markdown-paragraph` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `table` | `2, 3, 4` | `raw-html` | `se4-video-table` |
| `rawHtml` | `2, 4` | `raw-html` | - |

## Notes
- `rawHtml`은 fallback 블록이라 실샘플보다 fixture와 parser 테스트로 고정하는 비중이 높다.
- `heading`도 현재 실샘플 대표값이 없어 fixture/test coverage를 우선 사용한다.
- `formula`, `video`는 unsupported 시 skip 가능성이 있어 샘플 검증이 특히 중요하다.
- SE4 `image`는 `se-module-image-link`와 `__se_image_link` 두 앵커 변형을 모두 실샘플로 검증한다.
- SE2 책 위젯(`s_subtype="book"`)은 일반 paragraph fallback으로 두지 않고 image + hard-break paragraph 조합으로 풀어 Markdown 줄바꿈을 보존한다.
