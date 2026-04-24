# System Map

## 목적
모듈별 책임, 의존 방향, 코드 기준점을 빠르게 찾도록 돕는다.

## Source Of Truth
- 실제 경계는 `src/modules`, `src/server`, `src/shared`, `src/ui` 코드가 기준이다.

## 관련 코드
- `src/modules/blog-fetcher/naver-blog-fetcher.ts`
- `src/modules/parser/post-parser.ts`
- `src/modules/parser/editors/base-editor.ts`
- `src/shared/export-options.ts`

## 검증 방법
- `pnpm typecheck`: 모듈 경계나 import 방향을 바꾼 뒤 정적 연결 상태를 빠르게 확인할 때 실행한다.
- focused test 또는 `pnpm check:local`: 바뀐 모듈 seam이 실제 동작과 parser 계약을 깨지 않았는지 확인할 때 실행한다.

## Module Boundaries
- `blog-fetcher`: 네이버 모바일 API, 글 HTML fetch, 자산 다운로드
- `parser`: `post-parser.ts`가 editor version을 감지하고 `editors/*`의 SE2, SE3, SE4 class가 본문을 공용 AST로 변환한다.
- `reviewer`: 파싱 경고를 보정하고 정리
- `converter`: AST를 Markdown과 frontmatter로 렌더링
- `exporter`: fetch -> parse -> review -> render -> write -> manifest 실행과 image upload/rewrite 단계를 묶고, 글 본문 export는 제한된 동시성으로 처리하되 결과 반영 순서는 입력 순서를 유지한다.
- `server`: 로컬 웹 UI, export job API, 같은 job의 upload trigger/polling lifecycle, `providerKey/providerFields -> runtime uploader config` 매핑, upload 중간 count 집계 제공
- `server`: 마지막 `outputDir`의 `manifest.json`을 기준으로 job을 hydrate하고 UI bootstrap 복구 payload를 만든다.
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
- parser editor classes: `src/modules/parser/editors/base-editor.ts`, `src/modules/parser/editors/naver-blog-se2-editor.ts`, `src/modules/parser/editors/naver-blog-se3-editor.ts`, `src/modules/parser/editors/naver-blog-se4-editor.ts`
- sample corpus: `src/shared/sample-corpus.ts`
- Markdown renderer: `src/modules/converter/markdown-renderer.ts`
- exporter flow: `src/modules/exporter/naver-blog-exporter.ts`
- upload runner: `src/modules/exporter/image-upload-phase.ts`
- output rewrite after upload: `src/modules/exporter/image-upload-rewriter.ts`
- HTTP API: `src/server/http-server.ts`
- UI shell: `index.html`, `src/ui/App.tsx`, `src/ui/features/common/*`, `src/ui/styles/globals.css`, `src/ui/features/*`
- results/upload surface: `src/ui/features/job-results/job-results-panel.tsx`
- upload polling hook: `src/ui/features/job-results/use-export-job.ts`
- progress primitive: `src/ui/components/ui/progress.tsx`

## Upload Progress Flow
- `src/modules/exporter/image-upload-phase.ts`는 dedupe된 자산을 순차 업로드하고 asset-by-asset progress callback과 per-asset completion callback을 올린다.
- `src/server/http-server.ts`는 callback을 받아 `JobStore.updateUpload()`와 item-level count로 반영한다.
- `src/server/job-store.ts`는 같은 job의 `upload.uploadedCount`, item별 `upload.uploadedCount`, `rewriteStatus`를 polling payload에 유지한다.
- `src/modules/exporter/image-upload-rewriter.ts`는 글 단위 Markdown 치환 뒤 같은 `manifest.json` snapshot을 즉시 갱신한다.
- `src/server/export-job-manifest.ts`는 `manifest.json`을 결과물 + 복구 SoT로 읽고 쓴다.
- 글에 필요한 자산이 모두 업로드되면 그 글만 즉시 치환한다. 최종 `upload-completed` 전이는 남은 rewrite 대상이 없어졌을 때만 일어난다.
- `src/ui/features/job-results/job-results-panel.tsx`는 `upload-completed` 뒤에도 upload snapshot을 결과 단계에 남겨 fast live runs에서도 마지막 progress/row 상태를 확인할 수 있게 한다.
