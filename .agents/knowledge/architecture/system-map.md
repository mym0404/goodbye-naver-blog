# System Map

## 목적
모듈별 책임, 의존 방향, 코드 기준점을 빠르게 찾도록 돕는다.

## Source Of Truth
- 실제 경계는 `src/modules`, `src/server`, `src/shared`, `src/ui` 코드가 기준이다.

## 관련 코드
- [../../../src/modules/blog-fetcher/naver-blog-fetcher.ts](../../../src/modules/blog-fetcher/naver-blog-fetcher.ts)
- [../../../src/modules/parser/post-parser.ts](../../../src/modules/parser/post-parser.ts)
- [../../../src/shared/export-options.ts](../../../src/shared/export-options.ts)

## 검증 방법
- `pnpm typecheck`: 모듈 경계나 import 방향을 바꾼 뒤 정적 연결 상태를 빠르게 확인할 때 실행한다.
- focused test 또는 `pnpm check:quick`: 바뀐 모듈 seam이 실제 동작과 parser 계약을 깨지 않았는지 확인할 때 실행한다.

## Module Boundaries
- `blog-fetcher`: 네이버 모바일 API, 글 HTML fetch, 자산 다운로드
- `parser`: SE2, SE3, SE4 본문을 공용 AST로 변환
- `reviewer`: 파싱 경고를 보정하고 정리
- `converter`: AST를 Markdown과 frontmatter로 렌더링
- `exporter`: fetch -> parse -> review -> render -> write -> manifest 실행과 PicGo upload/rewrite 단계를 묶음
- `server`: 로컬 웹 UI, export job API, 같은 job의 upload trigger/polling lifecycle, `providerKey/providerFields -> PicGo config` 매핑 제공
- scan 후 export는 UI가 가진 scan snapshot을 실행 경로에 넘겨 목록 재수집을 줄인다.
- `shared`: export 옵션, 타입, lifecycle contract, capability, sample corpus
- `ui`: 단계형 wizard(`블로그 입력 -> 카테고리 -> 구조 -> Frontmatter -> Markdown -> Assets -> 실행/업로드/결과`) 대시보드 UI

## Dependency Direction
- `server` -> `modules/*`, `shared/*`
- `exporter` -> `blog-fetcher`, `parser`, `reviewer`, `converter`, `shared/*`
- `parser` -> `converter/html-fragment-converter`, `shared/*`
- `converter` -> `shared/*`
- `ui` -> HTTP API only

## Code Anchors
- parser capability: `src/shared/parser-capabilities.ts`
- sample corpus: `src/shared/sample-corpus.ts`
- Markdown renderer: `src/modules/converter/markdown-renderer.ts`
- exporter flow: `src/modules/exporter/naver-blog-exporter.ts`
- upload runner: `src/modules/exporter/picgo-upload-phase.ts`
- output rewrite after upload: `src/modules/exporter/picgo-upload-rewriter.ts`
- HTTP API: `src/server/http-server.ts`
- UI shell: `index.html`, `src/ui/App.tsx`, `src/ui/styles/globals.css`, `src/ui/features/*`
- results/upload surface: `src/ui/features/job-results/job-results-panel.tsx`
- upload polling hook: `src/ui/hooks/use-export-job.ts`
