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
- `pnpm check:quick`: 현재 `check:local` 별칭이다. 작은 로컬 수정 뒤 같은 로컬 기준선(`typecheck + test:offline + parser:check`)을 다시 확인할 때 실행한다.
- `pnpm check:full`: 네트워크 테스트, 실샘플 export, UI smoke까지 묶인 전체 회귀가 필요할 때 실행한다.
- `pnpm test:coverage`: 커버리지 게이트나 CI 동작을 다시 확인해야 할 때 실행한다.

## UI Verification Policy
- UI 변경 요청을 받으면 기본 브라우저 검증 도구는 `agent-browser`다.
- 레이아웃, 간격, 상호작용, 텍스트 대비처럼 실제 화면을 보는 탐색성 검증은 `agent-browser`로 먼저 확인한다.
- 같은 UI 흐름을 반복 재현해야 하거나 CI 회귀로 고정할 가치가 생기면 Playwright harness로 올린다.
- 이 저장소에서 Playwright로 고정된 UI 회귀 기준은 `scripts/harness/run-ui-smoke.ts`, `scripts/harness/run-ui-live-upload.ts`다.

## Primary Commands
- `pnpm check:quick`: 현재 `pnpm check:local` 별칭이다. 작은 코드 수정 뒤 같은 로컬 기준선을 바로 확인할 때 실행한다.
- `pnpm check:local`: 일반적인 구현 작업을 마친 뒤 handoff 전 기본 회귀를 확인할 때 실행한다.
- `pnpm check:full`: export 결과, 네트워크 연동, UI 흐름까지 바뀌었거나 최종 인계 직전에 전체 회귀를 확인할 때 실행한다.
- `pnpm check`: `check:full`을 그대로 부를 때 실행한다.

## Focused Commands
- `pnpm dev`: `tsx watch`와 Vite HMR이 붙은 개발 서버를 `http://localhost:4173`에 띄울 때 실행한다.
- `pnpm start`: `pnpm build:ui` 뒤 `dist/client` 산출물을 같은 서버에서 확인할 때 실행한다.
- `pnpm typecheck`: TypeScript 오류만 빠르게 다시 확인할 때 실행한다.
- `pnpm test:offline`: 네트워크 없는 로컬 테스트만 다시 확인할 때 실행한다.
- `pnpm test:coverage`: V8 coverage 리포트와 90% threshold를 다시 확인할 때 실행한다.
- `pnpm test:network`: 네트워크가 필요한 통합 테스트를 다시 확인할 때 실행한다.
- `pnpm test:network:upload`: Playwright가 실제 브라우저 UI로 `mym0404` 공개 글 1건을 scan, scope 설정, export한 뒤 GitHub `mym0404/image-archive` `master` branch 루트 경로(`/`)로 PicGo 실업로드를 수행할 때 실행한다. 업로드 뒤에는 공개 GitHub raw URL 이미지 렌더를 확인하고, branch head가 바뀐 경우 compare diff에 이미지 파일이 잡히는지까지 본다. 같은 글을 같은 루트 경로로 다시 올리는 idempotent 재실행에서는 branch head가 그대로일 수 있으므로 repo tree 존재 여부로 대체 검증한다. 루트 `.env`에서 `FAREWELL_UPLOAD_E2E=1`, `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`를 읽는다.
- `pnpm parser:check`: parser capability, fixture, 테스트, sample 대응이 맞는지 확인할 때 실행한다.
- `pnpm samples:verify`: 실제 공개 샘플 export 결과가 renderer/exporter 변경 뒤에도 유지되는지 확인할 때 실행한다.
- `pnpm smoke:ui`: Playwright로 고정한 scan -> category select -> export -> upload 결과 화면 회귀를 다시 확인할 때 실행한다.
- `pnpm quality:report`: parser/sample coverage 기반 generated 품질 리포트를 다시 만들 때 실행한다.

## Hook And CI
- `prepare` 스크립트가 `lefthook install`을 실행한다.
- `pre-commit` hook은 `pnpm test:offline`을 돈다.
- `pre-push` hook은 `pnpm check:local`을 돈다.
- PR CI는 `pnpm check:full` 뒤 Playwright 기반 `pnpm test:network:upload`, `pnpm test:coverage`를 실행하고 `coverage/lcov.info`를 Codecov로 업로드한다.
- 실업로드 step은 GitHub `mym0404/image-archive` 저장소, `master` branch, 루트 경로(`/`)를 고정값으로 사용한다. GitHub Actions에서는 repository secret `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`로 `.env`를 만들어 실행한다.
- fork PR에서는 기본 `pull_request` 보안 모델상 secret이 주입되지 않으므로 이 workflow를 그대로 유지하면 외부 기여 PR은 실패할 수 있다.

## Task Loops
- parser 변경 뒤에는 `pnpm check:quick`을 먼저 돌리고, sample 현실까지 바뀌면 `pnpm samples:verify`를 추가한다.
- renderer/exporter 변경 뒤에는 `pnpm check:full`로 export 회귀를 묶어 확인하고 필요 시 `pnpm test:coverage`를 추가한다.
- 실업로드 검증이 필요하면 `pnpm test:network:upload`를 별도로 실행한다. 이 명령은 외부 상태를 만들 수 있으므로 `check:full`에는 포함하지 않는다.
- docs만 변경했을 때는 수정한 링크와 코드 기준점을 수동 점검하고, generated 보고서 축을 건드렸다면 `pnpm quality:report`를 실행한다.
- UI/API 변경 뒤에는 먼저 `agent-browser`로 실제 화면을 확인하고, 이미 Playwright smoke로 고정된 흐름이 바뀌었으면 `pnpm smoke:ui`를 함께 돌린다. 반복 회귀로 남길 가치가 생기면 Playwright harness 추가를 우선 검토한다.
