# Architecture

## 목적
이 문서는 현재 exporter의 모듈 경계와 의존 방향을 설명한다.

## Source Of Truth
실제 구조는 `src/modules`, `src/server`, `src/shared`, `src/static`에 있는 코드다. 이 문서는 그 구조를 요약한다.

## 관련 코드
- [../src/modules/blog-fetcher/naver-blog-fetcher.ts](../src/modules/blog-fetcher/naver-blog-fetcher.ts)
- [../src/modules/parser/post-parser.ts](../src/modules/parser/post-parser.ts)
- [../src/modules/converter/markdown-renderer.ts](../src/modules/converter/markdown-renderer.ts)
- [../src/modules/exporter/naver-blog-exporter.ts](../src/modules/exporter/naver-blog-exporter.ts)
- [../src/server/http-server.ts](../src/server/http-server.ts)

## 검증 방법
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:check`

## Domains
- `blog-fetcher`: 네이버 모바일 API, 글 HTML, 자산 다운로드
- `parser`: SE2, SE3, SE4 본문을 공용 AST로 변환
- `converter`: AST를 Markdown과 frontmatter로 렌더링
- `reviewer`: 파싱 결과의 경고를 보정하고 정리
- `exporter`: fetch, parse, review, render, write, manifest를 묶어 실행
- `server`: 로컬 웹 UI와 export job API 제공
- `shared`: 옵션, 타입, 공용 유틸, capability, sample corpus
- `static`: scan -> category select -> export UI

## Dependency Direction
- `server` -> `modules/*`, `shared/*`
- `exporter` -> `blog-fetcher`, `parser`, `reviewer`, `converter`, `shared/*`
- `parser` -> `converter/html-fragment-converter`, `shared/*`
- `converter` -> `shared/*`
- `static` -> HTTP API만 호출하고 내부 모듈을 직접 참조하지 않음

## Agent Notes
- parser와 docs는 `src/shared/parser-capabilities.ts` 기준으로 연결한다.
- 현실 검증 샘플은 `src/shared/sample-corpus.ts` 기준으로 연결한다.
- generated 보고서는 codebase 상태를 요약하는 산출물이지, source of truth 자체는 아니다.
