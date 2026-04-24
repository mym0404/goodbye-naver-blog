# Agent Guide

## Project Overview
- 이 저장소는 네이버 블로그 공개 글을 수집해 editor별 parser capability를 기준으로 공용 AST로 변환하고 Markdown, frontmatter, 자산 파일, `manifest.json`으로 export하는 도구다.
- 로컬 웹 UI, 단건 export CLI, fixture-first sample regression, Playwright UI smoke, live upload e2e를 함께 유지한다.

## Tech Stack
- `pnpm` 단일 저장소에서 `Node.js` ESM, `TypeScript`, `tsx`를 사용한다.
- 로컬 대시보드는 `React 19`, `Vite`, `Tailwind CSS v4`, `shadcn`/`Radix`, `Sonner` 위에서 동작한다.
- export 파이프라인은 `src/modules/*`, HTTP 런타임은 `src/server/*`, 공용 계약은 `src/shared/*`에 모인다.
- 검증 표면은 `Vitest`, Playwright, `scripts/harness/*`가 맡는다.

## Runtime And Architecture
- 런타임 시작점은 `src/server.ts`, `src/server/http-server.ts`다.
- export 실행 구조는 `src/modules/exporter/naver-blog-exporter.ts`에서 따라간다.
- parser/sample 구조 seam은 `src/modules/parser/post-parser.ts`, `src/modules/parser/editors/*`, `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`가 기준이다.
- UI 셸과 토큰 시작점은 `src/ui/App.tsx`, `src/ui/features/common/*`, `src/ui/styles/globals.css`다.

## Design System
- UI 기준 문서는 `.agents/knowledge/DESIGN.md`다.
- theme/token source of truth는 `src/ui/styles/globals.css`, primitive layer는 `src/ui/components/ui/*`다.
- dark-first single-column wizard, shadcn primitive 우선, 아이콘은 `@remixicon/react`만 유지한다.

## Non-Negotiables
- evergreen 프로젝트 지식은 라우터 트리 `.agents/knowledge/index.md`에서 시작한다.
- 실제 source of truth 우선순위는 사용자 지시와 이 문서, 코드/설정/테스트, evergreen knowledge, reference/generated 문서 순서다.
- `.agents/knowledge/reference/`와 generated 보고서는 참고 자료다. 실제 제품 계약을 대신하지 않는다.
- 큰 변경의 완료 기록은 `.agents/knowledge/reference/plan-archive/`에, 재발 방지 성격의 이슈 정리는 `.agents/knowledge/reference/troubleshooting/`에 남긴다.
- 영속적인 UI 설정과 서버 파일 캐시는 작업 산출물 폴더가 아니라 `.cache/` 아래에 저장한다. 런타임 산출물만 저장한다.
- 사용자용 HMR 개발 서버는 `pnpm dev`와 `4173` 포트를 기준으로 본다. AI agent, test, harness가 로컬 서버를 직접 띄울 때는 `pnpm dev`를 그대로 쓰지 않고, 공유 `.cache/export-ui-settings.json`을 피하는 별도 `FAREWELL_SETTINGS_PATH`, `FAREWELL_SCAN_CACHE_PATH`와 `4173`이 아닌 `PORT` 또는 `listen(0)` 기반 entry를 사용한다.
- 저장소 파일을 수정한 턴에서는 범위와 무관하게 `pnpm check:local`을 항상 실행한다. 이 명령이 가장 기본 검사다.
- 검증 명령이 실패하면 현재 작업이 만든 회귀인지 먼저 본다. 현재 작업 때문이면 고치면서 계속 진행하고, 다른 변경이나 기존 상태 때문에 생긴 실패면 바로 멈추고 실패 사실을 보고한다.
- parser capability, sample fixture, renderer/exporter 계약이 바뀌면 관련 knowledge와 generated 문서를 같이 갱신한다.
- parser/sample 회귀는 fixture-first가 기본이다. live 네이버 fetch는 fixture refresh/drift check 보조 경로로만 취급한다.
- Playwright UI smoke와 live upload e2e는 유지한다. parser fixture 전환을 이유로 제거하지 않는다.
- 코어 기능, 사용자 흐름, 상태 전이, 결과/복구 구조를 바꾸는 변경 뒤에는 최소 `pnpm smoke:ui` 실행을 보장한다.
- 외부 업로드 경로까지 바뀌면 `pnpm test:network:upload`를 함께 확인한다.
- export resume 경로나 `manifest.json` 직렬화/복구 규칙까지 바뀌면 `pnpm test:network:resume-export`를 함께 확인한다.
- generated 문서는 수동 편집하지 않고 스크립트로 갱신한다.
- commit, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

## Validation Routes
- `pnpm check:local`: 저장소 파일 변경의 최소 기준선이다. 정확한 bundle 구성과 CI 연결은 `.agents/knowledge/engineering/validation.md`, `package.json`이 기준이다.
- `pnpm check:full`: sample fixture 회귀, generated 품질 보고서, Playwright smoke UI까지 포함한 넓은 기본 회귀다.
- `pnpm parser:check`: capability catalog, parser fixture, sample fixture, 테스트 연결이 맞는지 확인할 때 실행한다.
- `pnpm samples:verify`: 저장된 `source.html -> expected.md` fixture 회귀를 오프라인으로 확인할 때 실행한다.
- `pnpm samples:refresh -- --id <sampleId>`: 지정 sample의 live HTML을 다시 받아 fixture를 갱신할 때 실행한다.
- `pnpm smoke:ui`: Playwright로 고정한 mock 기반 UI 흐름과 복구 경로를 다시 확인할 때 실행한다.
- `pnpm test:network:upload`: 실제 업로드를 포함한 live e2e다. 외부 상태를 만들고 secret이 필요하다.
- `pnpm quality:report`: capability/sample coverage generated 문서를 다시 만들 때 실행한다.

## Knowledge Router
- evergreen 프로젝트 지식은 라우터 트리 `.agents/knowledge/index.md`에서 시작한다.
- 개요와 출력 규약은 `.agents/knowledge/product/product-outline.md`에서 바로 본다.
- 스택, coding 규칙, harness 역할은 `.agents/knowledge/engineering/index.md`로 간다.
- 검증 의미와 bundle 구성은 `.agents/knowledge/engineering/validation.md`에서 본다.
- capability 카탈로그, 모듈 경계, export/server 파이프라인은 `.agents/knowledge/architecture/index.md`로 간다.
- 도메인 제약, 출력 규약, sample corpus 운영은 `.agents/knowledge/product/index.md`로 간다.
- UI 규칙과 primitive/token 계약은 `.agents/knowledge/DESIGN.md`에서 본다.
- runbook, generated 보고서, 플랜 아카이브, 트러블슈팅, README 자산은 `.agents/knowledge/reference/index.md`로 내려간다.
