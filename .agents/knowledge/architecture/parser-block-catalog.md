# Parser Block Catalog

## 목적
이 문서는 Blog, Editor, Parser Block 지원 관계를 정리한다. 지원 여부의 기준은 각 editor의 `supportedBlocks` 이다.

## Source Of Truth
- 실제 기준은 `src/modules/blog/BlogRegistry.ts` 이다.
- output family 기준은 `src/shared/BlockRegistry.ts` 이다.
- 이 문서는 코드에서 자동 생성되며 수동 편집하지 않는다.

## 관련 코드
- `src/modules/blog/BlogRegistry.ts`
- `src/modules/parser/ParserBlockFactory.ts`
- `src/shared/BlockRegistry.ts`
- `src/shared/SampleCorpus.ts`
- `src/modules/parser/PostParser.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`

## Blog Table
| blogId | editors |
| --- | --- |
| `naver` | `naver.se2`, `naver.se3`, `naver.se4` |

## Editor Table
| editorId | blogId | supportedBlocks |
| --- | --- | --- |
| `naver.se2` | `naver` | `naver.se2.textNode`, `naver.se2.bookWidget`, `naver.se2.container`, `naver.se2.table`, `naver.se2.divider`, `naver.se2.lineBreak`, `naver.se2.quote`, `naver.se2.heading`, `naver.se2.code`, `naver.se2.inlineGifVideoFallback`, `naver.se2.image`, `naver.se2.spacer`, `naver.se2.textElement`, `naver.se2.fallback` |
| `naver.se3` | `naver` | `naver.se3.documentTitle`, `naver.se3.table`, `naver.se3.quote`, `naver.se3.code`, `naver.se3.image`, `naver.se3.representativeUnsupported`, `naver.se3.text`, `naver.se3.fallback` |
| `naver.se4` | `naver` | `naver.se4.documentTitle`, `naver.se4.formula`, `naver.se4.code`, `naver.se4.linkCard`, `naver.se4.video`, `naver.se4.oembed`, `naver.se4.map`, `naver.se4.table`, `naver.se4.imageStrip`, `naver.se4.imageGroup`, `naver.se4.sticker`, `naver.se4.image`, `naver.se4.heading`, `naver.se4.divider`, `naver.se4.quote`, `naver.se4.text`, `naver.se4.material`, `naver.se4.fallback` |

## Output Families
| parserBlockId | astBlockType | label |
| --- | --- | --- |
| `naver.se2.textNode` | `paragraph` | 문단 |
| `naver.se2.bookWidget` | `paragraph` | 문단 |
| `naver.se2.table` | `table` | 표 |
| `naver.se2.divider` | `divider` | 구분선 |
| `naver.se2.quote` | `quote` | 인용문 |
| `naver.se2.heading` | `heading` | 제목 |
| `naver.se2.code` | `code` | 코드 |
| `naver.se2.image` | `image` | 이미지 |
| `naver.se2.textElement` | `paragraph` | 문단 |
| `naver.se3.table` | `table` | 표 |
| `naver.se3.quote` | `quote` | 인용문 |
| `naver.se3.code` | `code` | 코드 |
| `naver.se3.image` | `image` | 이미지 |
| `naver.se3.text` | `paragraph` | 문단 |
| `naver.se4.formula` | `formula` | 수식 |
| `naver.se4.code` | `code` | 코드 |
| `naver.se4.linkCard` | `linkCard` | 링크 카드 |
| `naver.se4.video` | `video` | 비디오 |
| `naver.se4.oembed` | `linkCard` | 링크 카드 |
| `naver.se4.map` | `linkCard` | 링크 카드 |
| `naver.se4.table` | `table` | 표 |
| `naver.se4.imageStrip` | `imageGroup` | 이미지 묶음 |
| `naver.se4.imageGroup` | `imageGroup` | 이미지 묶음 |
| `naver.se4.sticker` | `image` | 이미지 |
| `naver.se4.image` | `image` | 이미지 |
| `naver.se4.heading` | `heading` | 제목 |
| `naver.se4.divider` | `divider` | 구분선 |
| `naver.se4.quote` | `quote` | 인용문 |
| `naver.se4.text` | `paragraph` | 문단 |
| `naver.se4.material` | `paragraph` | 문단 |

## Notes
- Parser Block은 source HTML parser 단위이고 AST Block은 Markdown renderer용 공통 중간 표현이다.
- 같은 AST Block으로 변환되더라도 Parser Block id는 editor별 source 구조를 기준으로 분리한다.
- sample coverage gap은 `.agents/knowledge/reference/generated/sample-coverage.md` 에서 같이 본다.
