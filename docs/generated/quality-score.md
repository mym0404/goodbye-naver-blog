# Quality Score

## 목적
이 문서는 parser fixture, parser test, 실샘플 coverage를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`, `tests/fixtures/`, `tests/*.test.ts`를 바탕으로 자동 생성된다.

## 관련 코드
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- [../../scripts/harness/generate-quality-report.ts](../../scripts/harness/generate-quality-report.ts)
- [../../scripts/harness/check-parser-capabilities.ts](../../scripts/harness/check-parser-capabilities.ts)

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser fixture coverage | 12/12 (100%) |
| parser test coverage | 12/12 (100%) |
| parser sample coverage | 10/12 (83%) |
| sample corpus size | 8 |
| covered editor versions | 3/3 (100%) |

## Open Risks
- 실샘플이 없는 blockType: heading
- 실샘플이 없는 blockType: rawHtml
