# Quality Score

## 목적
이 문서는 parser fixture, parser test mapping, 실샘플 coverage를 요약하는 generated 품질 리포트다.

## Source Of Truth
이 문서는 `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`, `tests/fixtures/`, `tests/*.test.ts`를 바탕으로 자동 생성된다.

## 관련 코드
- `src/shared/parser-capabilities.ts`
- `src/shared/sample-corpus.ts`
- `scripts/harness/generate-quality-report.ts`
- `scripts/harness/check-parser-capabilities.ts`

## 검증 방법
- `pnpm quality:report`
- `pnpm parser:check`

## Coverage Summary
| metric | coverage |
| --- | --- |
| parser block fixture coverage | 11/11 (100%) |
| parser capability test mapping coverage | 26/26 (100%) |
| sample-fixture capability coverage | 21/21 (100%) |
| parser-fixture only capabilities | 5 |
| sample corpus size | 13 |
| covered editor versions | 3/3 (100%) |

## Open Risks
- 현재 열린 리스크 없음

## Parser-fixture Only Capabilities
- `se2-heading`
- `se2-quote`
- `se2-divider`
- `se3-divider`
- `se3-code`
