# Architecture Knowledge

## 여기서 찾는 것
- 파이프라인과 계층 계약: `.agents/knowledge/architecture/principles.md`
- 모듈 책임, 의존 방향, 코드 앵커: `.agents/knowledge/architecture/system-map.md`
- parser block 지원 범위와 fallback projection: `.agents/knowledge/architecture/parser-block-catalog.md`

## 대표 기준점
- export 파이프라인: `src/modules/exporter/naver-blog-exporter.ts`
- Markdown 렌더러: `src/modules/converter/markdown-renderer.ts`
- HTTP API와 job lifecycle: `src/server/http-server.ts`

## 언제 읽는가
- 모듈 경계와 의존 방향을 빠르게 파악해야 할 때
- parser, converter, exporter, server가 어떻게 이어지는지 확인해야 할 때
- 구조 변경이 다른 계층에 번지는 범위를 판단해야 할 때

## 검증
- `pnpm parser:check`: parser capability와 generated knowledge projection이 sample, fixture, 테스트와 여전히 맞는지 확인할 때 실행한다.
- `pnpm check:local`: 작은 구조 수정 뒤 같은 로컬 기준선을 다시 확인할 때 실행한다.
