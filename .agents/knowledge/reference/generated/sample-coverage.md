# Sample Coverage

## 목적
이 문서는 parser block별 대표 샘플 매핑과 sample fixture coverage gap을 보여주는 generated 리포트다.

## Source Of Truth
이 문서는 `src/modules/blog/BlogRegistry.ts` 와 `src/shared/SampleCorpus.ts` 를 바탕으로 자동 생성된다.

## 관련 코드
- `src/modules/blog/BlogRegistry.ts`
- `src/shared/SampleCorpus.ts`
- `.agents/knowledge/product/sample-corpus.md`
- `scripts/harness/generate-quality-report.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`
- `pnpm samples:verify`

## Parser Block To Sample Map
| parserBlockId | sampleIds |
| --- | --- |
| `naver.se2.textNode` | - |
| `naver.se2.bookWidget` | - |
| `naver.se2.container` | - |
| `naver.se2.table` | `se2-code-image-autolayout`, `se2-table-rawhtml-navigation` |
| `naver.se2.divider` | - |
| `naver.se2.lineBreak` | - |
| `naver.se2.quote` | - |
| `naver.se2.heading` | - |
| `naver.se2.code` | - |
| `naver.se2.inlineGifVideoFallback` | - |
| `naver.se2.image` | `se2-code-image-autolayout`, `se2-table-rawhtml-navigation`, `se2-thumburl-image-group` |
| `naver.se2.spacer` | - |
| `naver.se2.textElement` | `se2-legacy`, `se2-code-image-autolayout`, `se2-table-rawhtml-navigation`, `se2-thumburl-image-group` |
| `naver.se2.fallback` | - |
| `naver.se3.documentTitle` | - |
| `naver.se3.table` | `se3-quote-table-vita` |
| `naver.se3.quote` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `naver.se3.code` | - |
| `naver.se3.image` | `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `naver.se3.representativeUnsupported` | - |
| `naver.se3.text` | `se3-legacy`, `se3-quote-imagegroup-note9`, `se3-quote-table-vita` |
| `naver.se3.fallback` | - |
| `naver.se4.documentTitle` | - |
| `naver.se4.formula` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `naver.se4.code` | `se4-formula-code-linkcard`, `se4-quote-formula-code` |
| `naver.se4.linkCard` | `se4-formula-code-linkcard`, `se4-heading-itinerary`, `se4-quote-formula-code` |
| `naver.se4.video` | `se4-video-table` |
| `naver.se4.oembed` | - |
| `naver.se4.map` | - |
| `naver.se4.table` | `se4-video-table`, `se4-heading-itinerary` |
| `naver.se4.imageStrip` | - |
| `naver.se4.imageGroup` | `se4-image-group`, `se4-heading-itinerary` |
| `naver.se4.sticker` | - |
| `naver.se4.image` | `se4-video-table`, `se4-formula-code-linkcard`, `se4-heading-itinerary`, `se4-image-legacy-link`, `se4-quote-formula-code` |
| `naver.se4.heading` | `se4-heading-itinerary` |
| `naver.se4.divider` | `se4-formula-code-linkcard`, `se4-image-group`, `se4-heading-itinerary`, `se4-quote-formula-code` |
| `naver.se4.quote` | `se4-quote-formula-code` |
| `naver.se4.text` | `se4-formula-code-linkcard`, `se4-image-group`, `se4-heading-itinerary`, `se4-image-legacy-link`, `se4-quote-formula-code` |
| `naver.se4.material` | - |
| `naver.se4.fallback` | - |

## Sample Catalog
| id | editorId | expectedParserBlockIds |
| --- | --- | --- |
| `se4-video-table` | `naver.se4` | `naver.se4.image`, `naver.se4.video`, `naver.se4.table` |
| `se4-formula-code-linkcard` | `naver.se4` | `naver.se4.linkCard`, `naver.se4.image`, `naver.se4.divider`, `naver.se4.text`, `naver.se4.formula`, `naver.se4.code` |
| `se4-image-group` | `naver.se4` | `naver.se4.text`, `naver.se4.divider`, `naver.se4.imageGroup` |
| `se4-heading-itinerary` | `naver.se4` | `naver.se4.text`, `naver.se4.image`, `naver.se4.heading`, `naver.se4.divider`, `naver.se4.imageGroup`, `naver.se4.linkCard`, `naver.se4.table` |
| `se4-image-legacy-link` | `naver.se4` | `naver.se4.text`, `naver.se4.image` |
| `se4-quote-formula-code` | `naver.se4` | `naver.se4.linkCard`, `naver.se4.image`, `naver.se4.divider`, `naver.se4.text`, `naver.se4.quote`, `naver.se4.formula`, `naver.se4.code` |
| `se2-legacy` | `naver.se2` | `naver.se2.textElement` |
| `se2-code-image-autolayout` | `naver.se2` | `naver.se2.textElement`, `naver.se2.image`, `naver.se2.table` |
| `se2-table-rawhtml-navigation` | `naver.se2` | `naver.se2.textElement`, `naver.se2.image`, `naver.se2.table` |
| `se2-thumburl-image-group` | `naver.se2` | `naver.se2.image`, `naver.se2.textElement` |
| `se3-legacy` | `naver.se3` | `naver.se3.text` |
| `se3-quote-imagegroup-note9` | `naver.se3` | `naver.se3.text`, `naver.se3.image`, `naver.se3.quote`, `naver.se3.image` |
| `se3-quote-table-vita` | `naver.se3` | `naver.se3.text`, `naver.se3.image`, `naver.se3.quote`, `naver.se3.table` |

## Sample Gaps
- `naver.se2.textNode`
- `naver.se2.bookWidget`
- `naver.se2.container`
- `naver.se2.divider`
- `naver.se2.lineBreak`
- `naver.se2.quote`
- `naver.se2.heading`
- `naver.se2.code`
- `naver.se2.inlineGifVideoFallback`
- `naver.se2.spacer`
- `naver.se2.fallback`
- `naver.se3.documentTitle`
- `naver.se3.code`
- `naver.se3.representativeUnsupported`
- `naver.se3.fallback`
- `naver.se4.documentTitle`
- `naver.se4.oembed`
- `naver.se4.map`
- `naver.se4.imageStrip`
- `naver.se4.sticker`
- `naver.se4.material`
- `naver.se4.fallback`
