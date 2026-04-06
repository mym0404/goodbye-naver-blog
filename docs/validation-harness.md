# Validation Harness

## 목적
이 문서는 feedforward와 feedback loop를 구현하는 harness 스크립트, 입력, 실패 기준, 실행 순서를 정의한다.

## Source Of Truth
실제 구현은 `scripts/harness/` 아래 스크립트와 `package.json` scripts다.

## 관련 코드
- [../package.json](../package.json)
- [../scripts/harness/check-doc-graph.ts](../scripts/harness/check-doc-graph.ts)
- [../scripts/harness/check-parser-capabilities.ts](../scripts/harness/check-parser-capabilities.ts)
- [../scripts/harness/verify-sample-exports.ts](../scripts/harness/verify-sample-exports.ts)
- [../scripts/harness/run-ui-smoke.ts](../scripts/harness/run-ui-smoke.ts)
- [../scripts/harness/generate-quality-report.ts](../scripts/harness/generate-quality-report.ts)

## 검증 방법
- `pnpm check`
- `pnpm check:quick`
- `pnpm check:full`

## Commands
- `pnpm docs:check`: 문서 링크, 필수 섹션, generated freshness 검사
- `pnpm parser:check`: capability, fixture, 테스트, 샘플 대응 검사
- `pnpm samples:verify`: 실샘플 fetch -> parse -> render 검증
- `pnpm smoke:ui`: scan -> category select -> export UI smoke 검증
- `pnpm quality:report`: generated 리포트 갱신

## Failure Rules
- core docs 누락, dead link, 필수 heading 누락은 실패
- capability에 대응 fixture 또는 테스트가 없으면 실패
- sample id가 corpus와 맞지 않거나 editor coverage가 비면 실패
- sample export에서 expected block type이나 required snippet이 빠지면 실패
- UI smoke에서 scan, category render, export, manifest fetch 중 하나라도 실패하면 실패
- generated 문서가 최신 결과와 다르면 실패

## Execution Order
1. `pnpm quality:report`
2. `pnpm docs:check`
3. `pnpm parser:check`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm samples:verify`
7. `pnpm smoke:ui`
