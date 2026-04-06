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
- `pnpm check:local`
- `pnpm check:quick`
- `pnpm check:full`
- `pnpm exec lefthook run pre-commit`
- `pnpm exec lefthook run pre-push`

## Commands
- `pnpm test:offline`: 로컬 훅용 오프라인 테스트
- `pnpm test:network`: 네트워크가 필요한 통합 테스트
- `pnpm docs:check`: 문서 링크, 필수 섹션, generated freshness 검사
- `pnpm parser:check`: capability, fixture, 테스트, 샘플 대응 검사
- `pnpm samples:verify`: 실샘플 fetch -> parse -> render 검증
- `pnpm smoke:ui`: scan -> category select -> export UI smoke 검증
- `pnpm quality:report`: generated 리포트 갱신
- `pnpm check:local`: 로컬 전용 오프라인 검증
- `pnpm exec lefthook run pre-commit`: 커밋 전 `pnpm test:offline` 실행
- `pnpm exec lefthook run pre-push`: 푸시 전 `pnpm check:local` 실행
- `.github/workflows/required-checks.yml`: PR에서 `pnpm check:full` 실행

## Failure Rules
- core docs 누락, dead link, 필수 heading 누락은 실패
- capability에 대응 fixture 또는 테스트가 없으면 실패
- sample id가 corpus와 맞지 않거나 editor coverage가 비면 실패
- sample export에서 expected block type이나 required snippet이 빠지면 실패
- UI smoke에서 scan, category render, export, manifest fetch 중 하나라도 실패하면 실패
- generated 문서가 최신 결과와 다르면 실패

## Execution Order
1. 로컬 훅: `pnpm test:offline`
2. 로컬 푸시 전: `pnpm typecheck`
3. 로컬 푸시 전: `pnpm test:offline`
4. 로컬 푸시 전: `pnpm docs:check`
5. 로컬 푸시 전: `pnpm parser:check`
6. PR CI: `pnpm quality:report`
7. PR CI: `pnpm test:network`
8. PR CI: `pnpm samples:verify`
9. PR CI: `pnpm smoke:ui`

## Automation Entry Points
- 로컬 git hook 설치는 `pnpm install` 이후 `prepare` 스크립트가 `lefthook install`을 실행한다.
- `pre-commit` hook은 네트워크 없는 오프라인 테스트 실패 시 커밋을 막는다.
- `pre-push` hook은 네트워크 없는 로컬 검증 실패 시 푸시를 막는다.
- 네트워크 요청이 필요한 검증은 로컬 hook에서 실행하지 않고 PR CI에서만 실행한다.
- GitHub PR 필수 체크는 `required-checks / validate` job 이름으로 노출된다.
