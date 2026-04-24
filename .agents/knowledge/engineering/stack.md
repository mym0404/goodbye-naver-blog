# Stack And Tooling

## 목적
런타임, 핵심 의존성, 애플리케이션 진입점, 디렉터리 구조를 빠르게 파악하도록 돕는다.

## Source Of Truth
- 실제 스택 계약은 `package.json`, `src/`, `scripts/`, `tests/`가 기준이다.

## 관련 코드
- `package.json`
- `src/server.ts`
- `scripts/export-single-post.ts`

## 검증 방법
- `pnpm typecheck`: 런타임 엔트리, shared 타입, import 구조를 빠르게 다시 확인할 때 실행한다.
- `pnpm check:local`: 작은 코드 수정 뒤 저장소 기본 로컬 기준선을 다시 확인할 때 실행한다.

## Runtime
- Node.js 기반 ESM 저장소다.
- 패키지 매니저는 `pnpm`이다.
- 실행 엔트리는 `tsx`를 사용한다.
- `pnpm dev`는 `tsx watch`와 Vite middleware를 함께 써서 `http://localhost:4173`에서 사용자용 HMR 개발 서버를 띄운다.
- AI agent, test, harness가 직접 서버를 띄울 때는 `pnpm dev`를 재사용하지 않고, 격리된 `FAREWELL_SETTINGS_PATH`, `FAREWELL_SCAN_CACHE_PATH`, 비기본 `PORT` 또는 `listen(0)` 기반 entry를 사용해 사용자 개발 서버와 분리한다.
- `pnpm start`는 `pnpm build:ui` 뒤 `dist/client` 빌드 산출물을 서빙한다.

## Core Libraries
- `react`, `react-dom`, `vite`, `tailwindcss`: 로컬 대시보드 런타임과 빌드
- `radix-ui`, `@radix-ui/react-scroll-area`, `@radix-ui/react-slot`, `sonner`: 대시보드 UI 프리미티브와 토스트
- `yaml`: frontmatter 직렬화
- `cheerio`, `jsdom`: HTML 파싱과 DOM 처리
- `turndown`, `turndown-plugin-gfm`: HTML to Markdown 변환
- `playwright`: UI smoke와 브라우저 검증
- `vitest`: 테스트 러너
- `typescript`: 정적 타입체크

## Application Surfaces
- `src/server.ts`, `src/server/http-server.ts`: 로컬 HTTP 서버와 API
- `index.html`, `src/ui/*`: React + Vite 기반 로컬 웹 UI
- `src/modules/exporter/*`: 전체 export 실행과 단건 export
- `scripts/export-single-post.ts`: 단건 수동 검증 CLI
- `scripts/harness/*`: parser, samples, UI smoke, quality report 검증

## Repo Shape
- `src/modules`: fetcher, parser, reviewer, converter, exporter
- `src/modules/parser/editors`: SE2, SE3, SE4 parser class 구현
- `src/server`: job store와 HTTP API
- `src/shared`: 타입, 옵션, parser capability, sample corpus, 유틸
- `src/ui`: React 앱 셸, `features/common` 공용 shell/hook/status, feature별 UI 조합, shadcn primitive
- `tests`: unit, integration, smoke 보조 테스트
- `.agents/knowledge/reference`: generated 보고서, runbook, 플랜 아카이브, 트러블슈팅
