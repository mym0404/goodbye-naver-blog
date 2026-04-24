# Validation

## 목적
패키지 스크립트, CI, task loop를 저장소 실제 동작 기준으로 정리한다.

## Source Of Truth
- 실제 검증 명령은 `package.json`, `scripts/harness/*`, `.github/workflows/required-checks.yml`이 기준이다.
- bundled verification command 구성은 이 문서와 `package.json`에만 둔다. 다른 knowledge 문서는 검증 의미만 설명한다.

## 관련 코드
- `package.json`
- `.github/workflows/required-checks.yml`
- `scripts/harness/check-parser-capabilities.ts`
- `scripts/harness/verify-sample-exports.ts`
- `scripts/harness/refresh-sample-fixtures.ts`
- `scripts/harness/run-ui-smoke.ts`
- `scripts/harness/run-ui-resume-smoke.ts`
- `scripts/harness/run-ui-live-resume-export.ts`
- `scripts/harness/run-ui-live-upload.ts`

## 검증 방법
- `pnpm check:local`: 저장소 파일을 수정한 모든 턴에서 가장 먼저 실행하는 기본 검사다. 같은 로컬 기준선을 다시 확인한다. 실패하면 현재 작업이 만든 회귀인지 먼저 보고, 현재 작업 때문이면 고치면서 진행하고 다른 변경이나 기존 상태 때문이면 즉시 중단하고 실패 사실을 보고한다.
- `pnpm check:full`: fixture-based sample regression, generated coverage, Playwright smoke UI까지 포함한 전체 기본 회귀가 필요할 때 실행한다.
- `pnpm test:coverage`: 커버리지 게이트나 CI 동작을 다시 확인해야 할 때 실행한다.

## Verification Bundles
- `package.json` 기준으로 `pnpm check:local`은 `pnpm typecheck && pnpm test:offline && pnpm parser:check && pnpm samples:verify`를 실행한다.
- `package.json` 기준으로 `pnpm check:full`은 `pnpm quality:report && pnpm typecheck && pnpm test:offline && pnpm parser:check && pnpm samples:verify && pnpm smoke:ui`를 실행한다.

## 테스트 종류
- parser unit
  `tests/parser/*.test.ts`
  `src/modules/parser/editors/*`의 editor parser class와 호환 wrapper가 blockType을 어떻게 AST로 만드는지 확인한다.
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
  mock 기반 scan/export/upload 결과 UI 흐름과 복구 Dialog/단계 복귀를 확인한다.
- Playwright live upload e2e
  `pnpm test:network:upload`
  실제 네트워크와 외부 업로드 상태를 포함한 검증이다.
- live resume export e2e
  `pnpm test:network:resume-export`
  실제 네이버 네트워크로 export를 시작한 뒤 중간 종료 후 `manifest.json` 기반 resume export를 다시 끝까지 확인한다.
- coverage gate
  `pnpm test:coverage`
  V8 coverage threshold를 확인한다.

## Primary Commands
- `pnpm check:local`: 저장소 파일을 수정한 모든 턴에서 가장 먼저 실행하는 기본 검사다. 타입, 오프라인 테스트, parser 구조 계약, sample fixture 회귀까지 포함한 기본 회귀를 확인할 때 실행한다.
- `pnpm check:full`: generated 품질 보고서, sample fixture, Playwright smoke UI까지 묶은 전체 기본 회귀를 확인할 때 실행한다.

## Focused Commands
- `pnpm dev`: `tsx watch`와 Vite HMR이 붙은 사용자용 개발 서버를 `http://localhost:4173`에 띄울 때 실행한다. AI agent, test, harness는 이 명령을 그대로 쓰지 않고 별도 `FAREWELL_SETTINGS_PATH`, `FAREWELL_SCAN_CACHE_PATH`, `PORT`를 준 `pnpm exec tsx src/server.ts`나 `listen(0)` 기반 harness entry로 분리한다.
- `pnpm start`: `pnpm build:ui` 뒤 `dist/client` 산출물을 같은 서버에서 확인할 때 실행한다.
- `pnpm typecheck`: TypeScript 오류만 빠르게 다시 확인할 때 실행한다.
- `pnpm test:offline`: 네트워크 없는 로컬 테스트만 다시 확인할 때 실행한다.
- `pnpm test:coverage`: V8 coverage 리포트와 threshold를 다시 확인할 때 실행한다.
- `pnpm parser:check`: capability catalog, parser fixture, sample fixture, 테스트/sample 연결과 generated knowledge projection freshness가 구조적으로 맞는지 확인할 때 실행한다. `parser-fixture` 분류 자체의 타당성은 자동 판정하지 않는다.
- `pnpm samples:verify`: 저장된 sample fixture가 parser -> review -> render 경로와 계속 맞는지 확인할 때 실행한다.
- `pnpm samples:refresh -- --id <sampleId>`: 지정 sample 하나의 live HTML과 expected Markdown fixture를 갱신할 때 실행한다.
- `pnpm smoke:ui`: Playwright로 고정한 mock 기반 scan -> category select -> export -> upload 화면 회귀와 `manifest.json` 기반 단계 복구 회귀를 `run-ui-smoke.ts`, `run-ui-resume-smoke.ts`로 함께 확인할 때 실행한다.
- `pnpm test:network:resume-export`: 개발 서버에서 실제 네이버 공개 글 범위를 export하다가 중간 종료한 뒤, 같은 `output/` 하위 경로의 `manifest.json`을 읽어 resume export를 끝까지 확인할 때 실행한다. 범위는 환경변수로 바꿀 수 있고, 외부 업로드는 하지 않는다.
- `pnpm test:network:resume-export:se2-table`: `blogpeople`의 SE2 표 본문이 포함된 `2013-06-26`~`2013-06-27`, category `21` 범위를 export하다가 중간 종료한 뒤 resume export를 끝까지 확인할 때 실행한다.
- `pnpm test:network:upload`: Playwright가 실제 브라우저 UI로 `mym0404` 공개 글 1건을 scan, scope 설정, export한 뒤 GitHub `mym0404/image-archive` `master` branch의 동적 prefix `farewell-live/<timestamp>` 아래로 `piclist` runtime 실업로드를 수행할 때 실행한다. 루트 `.env`에서 `FAREWELL_UPLOAD_E2E=1`, `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`를 읽는다.
- `pnpm quality:report`: parser/sample knowledge projection과 parser block fixture coverage, parser capability test mapping coverage, capability/sample coverage generated 품질 리포트를 다시 만들 때 실행한다.

## 보장하지 않는 것
- `pnpm test:offline`은 live 네이버 HTML drift를 보장하지 않는다.
- `pnpm samples:verify`는 저장된 fixture와 현재 코드의 일치만 보장한다. fixture가 오래됐는지는 보장하지 않는다.
- `pnpm samples:verify`는 `parser-fixture` capability를 보장하지 않는다. 이 범위는 parser unit test와 parser fixture가 맡는다.
- `pnpm smoke:ui`는 실제 네이버 live fetch가 아니라 mock 기반 UI 계약만 보장한다.
- `pnpm test:network:resume-export`는 실제 네이버 fetch와 resume export까지만 보장하고, 외부 업로드 상태는 보장하지 않는다.
- upload provider catalog 자체는 설치된 `piclist` runtime이 등록한 uploader config를 따른다. live e2e는 그중 GitHub 경로만 검증한다.
- `pnpm test:network:upload`만이 외부 업로드 상태까지 포함한다. 이 명령은 remote state를 만든다.

## Hook And CI
- 로컬 git hook은 저장소 설정으로 관리하지 않는다.
- PR CI는 `pnpm check:full`, `pnpm test:network:upload`, `pnpm test:coverage`를 실행하고 `coverage/lcov.info`를 Codecov로 업로드한다.
- 실업로드 step은 GitHub `mym0404/image-archive` 저장소와 `master` branch를 고정값으로 사용하고, path는 run마다 `farewell-live/<timestamp>` prefix를 만든다. GitHub Actions에서는 repository secret `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`로 `.env`를 만들어 실행한다.
- fork PR에서는 기본 `pull_request` 보안 모델상 secret이 주입되지 않으므로 live upload step이 실패할 수 있다.

## Task Loops
- 모든 저장소 파일 변경 턴은 `pnpm check:local`로 시작한다. 더 큰 검증이 필요하면 그 위에 focused command나 broader regression을 추가한다.
- 검증 명령이 실패하면 현재 작업 diff와 실패 지점을 먼저 대조한다. 현재 작업 때문에 깨졌다면 그 자리에서 고치고 같은 검증을 다시 돌린다.
- 검증 명령이 현재 작업과 무관한 기존 실패를 드러내면 그 시점에서 작업을 멈추고, 통과로 보고하지 않은 채 실패 명령과 영향 범위를 그대로 보고한다.
- 코어 기능, 사용자 흐름, 상태 전이, 결과/복구 구조를 바꾸는 변경 뒤에는 Playwright smoke 경로를 직접 건드렸는지와 무관하게 최소 `pnpm smoke:ui`를 실행한다.
- capability/sample/harness 변경 뒤에는 `pnpm typecheck`, `pnpm test:offline`, `pnpm parser:check`, `pnpm samples:verify`, `pnpm quality:report`를 우선 본다.
- capability catalog를 바꿀 때는 `sample-fixture`와 `parser-fixture` 분류를 함께 검토한다. 공개 글을 끝내 확보하지 못한 capability를 억지로 sample gap으로 남기지 않는다.
- renderer/exporter 결과 변경 뒤에는 위 전부에 `pnpm smoke:ui`, `pnpm test:coverage`를 추가한다.
- UI/API 변경 뒤에는 먼저 `agent-browser`로 실제 화면을 확인하고, 그 변경이 코어 기능이나 사용자 경로까지 건드리면 `pnpm smoke:ui`를 함께 돌린다.
- AI agent나 ad-hoc harness가 로컬 서버를 직접 띄울 때는 사용자 `pnpm dev`와 포트가 겹치지 않게 `4173`을 피한다. 수동 디버그는 비기본 포트를 명시하고, 자동 harness는 가능하면 `listen(0)`으로 임시 포트를 받는다.
- UI 테스트와 smoke는 CSS class, computed style, query selector 기반 레이아웃 숫자 검증보다 사용자 행동 계약을 우선한다.
- 스타일 검증이 꼭 필요하면 광범위한 자동 assert 대신 `agent-browser` 같은 실제 브라우저 확인을 우선하고, 자동화에는 접근성/상태/텍스트처럼 제품 계약만 남긴다.
- export/upload 흐름, 복구 시나리오, 업로더 연동처럼 사용자 경로를 크게 바꾸는 변경 뒤에는 `pnpm smoke:ui`, `pnpm test:network:upload`를 둘 다 실행한다.
- export resume 경로나 `manifest.json` 직렬화/복구 규칙을 바꿨다면 `pnpm smoke:ui`, `pnpm test:network:resume-export`를 함께 본다.
- fixture 자체를 갱신해야 할 때만 `pnpm samples:refresh -- --id <sampleId>`를 실행한다.
- 실업로드 검증이 필요하면 `pnpm test:network:upload`를 별도로 실행한다. 이 명령은 외부 상태를 만들 수 있으므로 `check:full`에는 포함하지 않는다.
- knowledge만 변경했을 때도 `pnpm check:local`은 기본으로 실행하고, 수정한 링크와 코드 기준점을 수동 점검한다. generated 보고서 축을 건드렸다면 `pnpm quality:report`를 추가한다.
