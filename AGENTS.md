# Agent Guide

## Project Overview
- 이 저장소는 네이버 블로그 공개 글을 수집해 editor별 parser block 기준으로 공용 AST로 변환하고 Markdown, frontmatter, 자산 파일, `manifest.json`으로 export하는 도구다.
- 로컬 웹 UI, 단건 export CLI, fixture-first sample regression, Playwright UI smoke, live network e2e를 함께 유지한다.

## Tech Stack
- `pnpm` 단일 저장소에서 Node.js ESM, TypeScript, `tsx`를 사용한다.
- 로컬 대시보드는 React, Vite, Tailwind CSS v4, shadcn/Radix, Sonner 위에서 동작한다.
- 검증 표면은 Vitest, Playwright, `scripts/harness/*`가 맡는다.

## Runtime And Architecture
- 런타임 시작점은 `src/Server.ts`, HTTP API는 `src/server/HttpServer.ts`다.
- export 파이프라인은 `src/modules/exporter/NaverBlogExporter.ts`에서 따라간다.
- parser/sample seam은 `src/modules/parser/PostParser.ts`, `src/modules/parser/editors/*`, `src/modules/parser/blocks/*`, `tests/fixtures/samples/*`, `tests/sample-fixtures.test.ts`다.
- UI 셸과 토큰 시작점은 `src/ui/App.tsx`, `src/ui/features/common/*`, `src/ui/styles/globals.css`다.

## Design System
- UI 기준 문서는 `.agents/knowledge/DESIGN.md`다.
- theme/token source of truth는 `src/ui/styles/globals.css`, primitive layer는 `src/ui/components/ui/*`다.
- dark-first single-column wizard, shadcn primitive 우선, 아이콘은 `@remixicon/react`만 유지한다.

## Operating Rules
- source of truth 우선순위는 사용자 지시, 루트 `AGENTS.md`, 코드/설정/테스트, evergreen knowledge, reference 문서다.
- `.agents/knowledge/reference/`는 참고 자료다. 제품 계약이나 구조 계약의 source of truth가 아니다.
- 영속 UI 설정과 서버 파일 캐시는 `.cache/` 아래에 저장한다. 작업 산출물 폴더에는 런타임 산출물만 둔다.
- AI agent, test, harness가 서버를 띄울 때는 사용자 `pnpm dev`와 공유 `.cache/export-ui-settings.json`을 피하고, 별도 `FAREWELL_SETTINGS_PATH`, `FAREWELL_SCAN_CACHE_PATH`, 비기본 `PORT` 또는 `listen(0)`을 쓴다.
- parser block, sample fixture, renderer/exporter 계약이 바뀌면 관련 knowledge를 함께 갱신한다.
- commit, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

## Validation Routes
- `pnpm check:local`: 저장소 파일을 수정한 모든 턴에서 항상 실행한다. `typecheck`, offline tests를 실행한다.
- `pnpm check:full`: 기본 회귀와 Playwright smoke UI까지 포함한 넓은 로컬 회귀다.
- `pnpm smoke:ui`: mock 기반 UI 흐름과 복구 경로를 확인한다. 코어 사용자 흐름이나 상태 전이를 바꾼 뒤 실행한다.
- `pnpm test:network`: build 1회 뒤 live resume export, SE2 table resume export, live upload e2e를 순서대로 실행한다. 외부 네트워크와 upload secret이 필요하고 remote state를 만든다.
- 조금이라도 큰 변경이거나 코어 기능, 사용자 흐름, 상태 전이, export/upload/resume 경로를 건드린 변경이면 `pnpm smoke:ui`와 `pnpm test:network`를 모두 실행한다.
- 검증 명령이 실패하면 현재 작업이 만든 회귀인지 먼저 본다. 현재 작업 때문이면 고치고, 기존 상태나 다른 변경 때문이면 실패 명령과 영향 범위를 보고한다.
- 정확한 bundle 구성과 blind spot은 `.agents/knowledge/engineering/validation.md`와 `package.json`이 기준이다.

## Knowledge Router
- evergreen 프로젝트 지식은 `.agents/knowledge/index.md`에서 시작한다.
- 스택, coding 규칙, harness 역할은 `.agents/knowledge/engineering/index.md`로 간다.
- parser block 카탈로그, 모듈 경계, export/server 파이프라인은 `.agents/knowledge/architecture/index.md`로 간다.
- 도메인 제약, 출력 규약, sample fixture 운영은 `.agents/knowledge/product/index.md`로 간다.
- UI 규칙과 primitive/token 계약은 `.agents/knowledge/DESIGN.md`에서 본다.
- runbook, 플랜 아카이브, 트러블슈팅, README 자산은 `.agents/knowledge/reference/index.md`로 내려간다.
