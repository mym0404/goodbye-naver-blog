# Validation

## 목적
패키지 스크립트, CI, task loop를 저장소 실제 동작 기준으로 정리한다.

## Source Of Truth
- 실제 검증 명령은 `package.json`, `scripts/harness/*`, `.github/workflows/required-checks.yml`이 기준이다.

## 관련 코드
- [../../../package.json](../../../package.json)
- [../../../.github/workflows/required-checks.yml](../../../.github/workflows/required-checks.yml)
- [../../../scripts/harness/check-parser-capabilities.ts](../../../scripts/harness/check-parser-capabilities.ts)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)
- [../../../scripts/harness/refresh-sample-fixtures.ts](../../../scripts/harness/refresh-sample-fixtures.ts)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)
- [../../../scripts/harness/run-ui-live-upload.ts](../../../scripts/harness/run-ui-live-upload.ts)

## 검증 방법
- `pnpm check:quick`: 현재 `check:local` 별칭이다. 작은 로컬 수정 뒤 같은 로컬 기준선(`typecheck + test:offline + parser:check`)을 다시 확인할 때 실행한다.
- `pnpm check:full`: fixture-based sample regression, generated coverage, Playwright smoke UI까지 포함한 전체 기본 회귀가 필요할 때 실행한다.
- `pnpm test:coverage`: 커버리지 게이트나 CI 동작을 다시 확인해야 할 때 실행한다.

## 테스트 종류
- parser unit
  `tests/parser/*.test.ts`
  개별 editor parser가 blockType을 어떻게 AST로 만드는지 확인한다.
- renderer/exporter unit
  `tests/markdown-renderer.test.ts`, `tests/export-single-post.test.ts`, `tests/naver-blog-exporter.test.ts` 등
  AST -> Markdown, export 파이프라인, frontmatter, 자산 처리 계약을 확인한다.
- fixture-based sample regression
  `pnpm samples:verify`
  저장된 `source.html -> expected.md` fixture를 오프라인으로 다시 렌더링해 전체 Markdown 골든을 비교한다. `sample-fixture` capability만 이 경로로 본다.
- fixture refresh/drift check
  `pnpm samples:refresh -- --id <sampleId>`
  live HTML을 다시 받아 fixture를 갱신한다. 회귀 검증이 아니라 fixture 관리용이다.
- Playwright smoke UI
  `pnpm smoke:ui`
  mock 기반 scan/export/upload 결과 UI 흐름, contrast, 레이아웃 invariant를 확인한다.
- Playwright live upload e2e
  `pnpm test:network:upload`
  실제 네트워크와 외부 업로드 상태를 포함한 검증이다.
- coverage gate
  `pnpm test:coverage`
  V8 coverage threshold를 확인한다.

## Primary Commands
- `pnpm check:quick`: 현재 `pnpm check:local` 별칭이다. 작은 코드 수정 뒤 같은 로컬 기준선을 바로 확인할 때 실행한다.
- `pnpm check:local`: `typecheck + test:offline + parser:check` 기본 회귀를 확인할 때 실행한다.
- `pnpm check:full`: `quality:report + check:local + samples:verify + smoke:ui` 전체 기본 회귀를 확인할 때 실행한다.
- `pnpm check`: `check:full`을 그대로 부를 때 실행한다.

## Focused Commands
- `pnpm dev`: `tsx watch`와 Vite HMR이 붙은 개발 서버를 `http://localhost:4173`에 띄울 때 실행한다.
- `pnpm start`: `pnpm build:ui` 뒤 `dist/client` 산출물을 같은 서버에서 확인할 때 실행한다.
- `pnpm typecheck`: TypeScript 오류만 빠르게 다시 확인할 때 실행한다.
- `pnpm test:offline`: 네트워크 없는 로컬 테스트만 다시 확인할 때 실행한다.
- `pnpm test:coverage`: V8 coverage 리포트와 threshold를 다시 확인할 때 실행한다.
- `pnpm parser:check`: capability catalog, parser fixture, sample fixture, 테스트, sample 대응이 맞는지 확인할 때 실행한다.
- `pnpm parser:check`: capability catalog, sample fixture, parser fixture, blockType별 test hint 연결이 구조적으로 맞는지 확인할 때 실행한다.
- `pnpm parser:check`: `parser-fixture` 분류 자체의 타당성을 자동 판정하지는 않는다. 이 판단은 capability catalog 관리 규칙으로 유지한다.
- `pnpm samples:verify`: 저장된 sample fixture가 parser -> review -> render 경로와 계속 맞는지 확인할 때 실행한다.
- `pnpm samples:refresh -- --id <sampleId>`: 지정 sample 하나의 live HTML과 expected Markdown fixture를 갱신할 때 실행한다.
- `pnpm smoke:ui`: Playwright로 고정한 mock 기반 scan -> category select -> export -> upload 결과 화면 회귀를 다시 확인할 때 실행한다.
- `pnpm test:network:upload`: Playwright가 실제 브라우저 UI로 `mym0404` 공개 글 1건을 scan, scope 설정, export한 뒤 GitHub `mym0404/image-archive` `master` branch 루트 경로(`/`)로 PicList runtime 실업로드를 수행할 때 실행한다. 루트 `.env`에서 `FAREWELL_UPLOAD_E2E=1`, `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`를 읽는다.
- `pnpm quality:report`: parser block fixture/test hint coverage와 capability/sample coverage generated 품질 리포트를 다시 만들 때 실행한다.

## 보장하지 않는 것
- `pnpm test:offline`은 live 네이버 HTML drift를 보장하지 않는다.
- `pnpm samples:verify`는 저장된 fixture와 현재 코드의 일치만 보장한다. fixture가 오래됐는지는 보장하지 않는다.
- `pnpm samples:verify`는 `parser-fixture` capability를 보장하지 않는다. 이 범위는 parser unit test와 parser fixture가 맡는다.
- `pnpm smoke:ui`는 실제 네이버 live fetch가 아니라 mock 기반 UI 계약만 보장한다.
- upload provider catalog 자체는 `~/Downloads/PicList` clone SoT를 따른다. live e2e는 그중 GitHub 경로만 검증한다.
- `pnpm test:network:upload`만이 외부 업로드 상태까지 포함한다. 이 명령은 remote state를 만든다.

## Hook And CI
- 로컬 git hook은 저장소 설정으로 관리하지 않는다.
- PR CI는 `pnpm check:full`, `pnpm test:network:upload`, `pnpm test:coverage`를 실행하고 `coverage/lcov.info`를 Codecov로 업로드한다.
- upload provider 관련 로컬 검증을 돌릴 때는 `~/Downloads/PicList` 또는 `~/Downloads/piclist` clone이 있어야 한다.
- 실업로드 step은 GitHub `mym0404/image-archive` 저장소, `master` branch, 루트 경로(`/`)를 고정값으로 사용한다. GitHub Actions에서는 repository secret `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`로 `.env`를 만들어 실행한다.
- fork PR에서는 기본 `pull_request` 보안 모델상 secret이 주입되지 않으므로 live upload step이 실패할 수 있다.

## Task Loops
- capability/sample/harness 변경 뒤에는 `pnpm typecheck`, `pnpm test:offline`, `pnpm parser:check`, `pnpm samples:verify`, `pnpm quality:report`를 우선 본다.
- capability catalog를 바꿀 때는 `sample-fixture`와 `parser-fixture` 분류를 함께 검토한다. 공개 글을 끝내 확보하지 못한 capability를 억지로 sample gap으로 남기지 않는다.
- renderer/exporter 결과 변경 뒤에는 위 전부에 `pnpm smoke:ui`, `pnpm test:coverage`를 추가한다.
- UI/API 변경 뒤에는 먼저 `agent-browser`로 실제 화면을 확인하고, 이미 Playwright smoke로 고정된 흐름이 바뀌었으면 `pnpm smoke:ui`를 함께 돌린다.
- fixture 자체를 갱신해야 할 때만 `pnpm samples:refresh -- --id <sampleId>`를 실행한다.
- 실업로드 검증이 필요하면 `pnpm test:network:upload`를 별도로 실행한다. 이 명령은 외부 상태를 만들 수 있으므로 `check:full`에는 포함하지 않는다.
- docs/knowledge만 변경했을 때는 수정한 링크와 코드 기준점을 수동 점검하고, generated 보고서 축을 건드렸다면 `pnpm quality:report`를 실행한다.
