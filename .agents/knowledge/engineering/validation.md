# Validation

## 목적
패키지 스크립트, git hook, CI, task loop를 저장소 실제 동작 기준으로 정리한다.

## Source Of Truth
- 실제 검증 명령은 `package.json`, `scripts/harness/*`, `lefthook` 설정이 기준이다.

## 관련 코드
- [../../../package.json](../../../package.json)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)
- [../../../scripts/harness/generate-quality-report.ts](../../../scripts/harness/generate-quality-report.ts)

## 검증 방법
- `pnpm check:quick`
- `pnpm check:full`
- `pnpm test:coverage`

## Primary Commands
- `pnpm check:quick`: `typecheck + test:offline + parser:check`
- `pnpm check:local`: 로컬 기본 검증
- `pnpm check:full`: quality report, 로컬 검증, network test, samples verify, UI smoke
- `pnpm check`: `check:full` alias

## Focused Commands
- `pnpm dev`: `pnpm start` alias
- `pnpm start`: UI build 후 로컬 서버 실행
- `pnpm typecheck`: TypeScript 무출력 검사
- `pnpm test:offline`: 네트워크 없는 로컬 테스트
- `pnpm test:coverage`: V8 coverage 리포트 생성과 90% threshold 확인
- `pnpm test:network`: 네트워크 필요한 통합 테스트
- `pnpm parser:check`: capability, fixture, 테스트, sample 대응 검사
- `pnpm samples:verify`: 실샘플 fetch -> parse -> render 검증
- `pnpm smoke:ui`: scan -> category select -> export -> status/upload 브라우저 smoke
- `pnpm quality:report`: parser/sample coverage 기반 generated 품질 리포트 갱신

## Hook And CI
- `prepare` 스크립트가 `lefthook install`을 실행한다.
- `pre-commit` hook은 `pnpm test:offline`을 돈다.
- `pre-push` hook은 `pnpm check:local`을 돈다.
- PR CI는 `pnpm check:full` 후 `pnpm test:coverage`를 실행하고 `coverage/lcov.info`를 Codecov로 업로드한다.

## Task Loops
- parser 변경: `pnpm check:quick`, 필요 시 `pnpm samples:verify`
- renderer/exporter 변경: `pnpm check:full`, `pnpm test:coverage`
- docs만 변경: 수정한 링크와 코드 기준점을 수동 점검하고, generated 보고서 축을 건드렸다면 `pnpm quality:report`
- UI/API 변경: `pnpm smoke:ui`, 필요 시 `pnpm test:coverage`와 관련 focused vitest
