# Quality Score

## 목적
이 문서는 parser fixture, parser test mapping, 실샘플 coverage를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 `src/modules/blog/BlogRegistry.ts`, `src/shared/SampleCorpus.ts`, `tests/fixtures/`, `tests/*.test.ts`를 바탕으로 자동 생성된다.

## 관련 코드
- `src/modules/blog/BlogRegistry.ts`
- `src/shared/SampleCorpus.ts`
- `scripts/harness/generate-quality-report.ts`
- `scripts/harness/check-parser-blocks.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser block fixture coverage | 11/11 (100%) |
| parser block test mapping coverage | 40/40 (100%) |
| parser block sample coverage | 18/40 (45%) |
| sample corpus size | 13 |
| covered editors | 3/3 (100%) |

## Open Risks
- 실샘플이 없는 parser block: naver.se2.textNode
- 실샘플이 없는 parser block: naver.se2.bookWidget
- 실샘플이 없는 parser block: naver.se2.container
- 실샘플이 없는 parser block: naver.se2.divider
- 실샘플이 없는 parser block: naver.se2.lineBreak
- 실샘플이 없는 parser block: naver.se2.quote
- 실샘플이 없는 parser block: naver.se2.heading
- 실샘플이 없는 parser block: naver.se2.code
- 실샘플이 없는 parser block: naver.se2.inlineGifVideoFallback
- 실샘플이 없는 parser block: naver.se2.spacer
- 실샘플이 없는 parser block: naver.se2.fallback
- 실샘플이 없는 parser block: naver.se3.documentTitle
- 실샘플이 없는 parser block: naver.se3.code
- 실샘플이 없는 parser block: naver.se3.representativeUnsupported
- 실샘플이 없는 parser block: naver.se3.fallback
- 실샘플이 없는 parser block: naver.se4.documentTitle
- 실샘플이 없는 parser block: naver.se4.oembed
- 실샘플이 없는 parser block: naver.se4.map
- 실샘플이 없는 parser block: naver.se4.imageStrip
- 실샘플이 없는 parser block: naver.se4.sticker
- 실샘플이 없는 parser block: naver.se4.material
- 실샘플이 없는 parser block: naver.se4.fallback
