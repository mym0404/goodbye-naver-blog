# Validation

## 목적
패키지 스크립트, git hook, CI, task loop를 저장소 실제 동작 기준으로 정리한다.

## Source Of Truth
- 실제 검증 명령은 `package.json`, `scripts/harness/*`, `lefthook.yml`, `.github/workflows/required-checks.yml`이 기준이다.

## 관련 코드
- [../../../package.json](../../../package.json)
- [../../../lefthook.yml](../../../lefthook.yml)
- [../../../.github/workflows/required-checks.yml](../../../.github/workflows/required-checks.yml)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)
- [../../../scripts/harness/generate-quality-report.ts](../../../scripts/harness/generate-quality-report.ts)

## 검증 방법
- `pnpm check:quick`: 작은 로컬 수정 뒤 타입, 오프라인 테스트, parser 계약만 빠르게 다시 확인할 때 실행한다.
- `pnpm check:full`: 네트워크 테스트, 실샘플 export, UI smoke까지 묶인 전체 회귀가 필요할 때 실행한다.
- `pnpm test:coverage`: 커버리지 게이트나 CI 동작을 다시 확인해야 할 때 실행한다.

## Primary Commands
- `pnpm check:quick`: 작은 코드 수정 뒤 `typecheck + test:offline + parser:check`만 바로 확인할 때 실행한다.
- `pnpm check:local`: 일반적인 구현 작업을 마친 뒤 handoff 전 기본 회귀를 확인할 때 실행한다.
- `pnpm check:full`: export 결과, 네트워크 연동, UI 흐름까지 바뀌었거나 최종 인계 직전에 전체 회귀를 확인할 때 실행한다.
- `pnpm check`: `check:full`을 그대로 부를 때 실행한다.

## Focused Commands
- `pnpm dev`: `pnpm start`를 짧게 부를 때 실행한다.
- `pnpm start`: 로컬 UI를 실제 서버와 함께 띄워 수동 확인할 때 실행한다.
- `pnpm typecheck`: TypeScript 오류만 빠르게 다시 확인할 때 실행한다.
- `pnpm test:offline`: 네트워크 없는 로컬 테스트만 다시 확인할 때 실행한다.
- `pnpm test:coverage`: V8 coverage 리포트와 90% threshold를 다시 확인할 때 실행한다.
- `pnpm test:network`: 네트워크가 필요한 통합 테스트를 다시 확인할 때 실행한다.
- `pnpm parser:check`: parser capability, fixture, 테스트, sample 대응이 맞는지 확인할 때 실행한다.
- `pnpm samples:verify`: 실제 공개 샘플 export 결과가 renderer/exporter 변경 뒤에도 유지되는지 확인할 때 실행한다.
- `pnpm smoke:ui`: scan -> category select -> export -> upload 결과 화면까지 브라우저 흐름을 다시 확인할 때 실행한다.
- `pnpm quality:report`: parser/sample coverage 기반 generated 품질 리포트를 다시 만들 때 실행한다.

## Hook And CI
- `prepare` 스크립트가 `lefthook install`을 실행한다.
- `pre-commit` hook은 `pnpm test:offline`을 돈다.
- `pre-push` hook은 `pnpm check:local`을 돈다.
- PR CI는 `pnpm check:full` 후 `pnpm test:coverage`를 실행하고 `coverage/lcov.info`를 Codecov로 업로드한다.

## Task Loops
- parser 변경 뒤에는 `pnpm check:quick`을 먼저 돌리고, sample 현실까지 바뀌면 `pnpm samples:verify`를 추가한다.
- renderer/exporter 변경 뒤에는 `pnpm check:full`로 export 회귀를 묶어 확인하고 필요 시 `pnpm test:coverage`를 추가한다.
- docs만 변경했을 때는 수정한 링크와 코드 기준점을 수동 점검하고, generated 보고서 축을 건드렸다면 `pnpm quality:report`를 실행한다.
- UI/API 변경 뒤에는 `pnpm smoke:ui`를 먼저 돌리고, 필요 시 `pnpm test:coverage`와 관련 focused vitest를 추가한다.
