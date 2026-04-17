# Architecture Knowledge

## 목적
모듈 경계, 설계 원칙, parser 카탈로그처럼 구조 이해에 필요한 지식을 라우팅한다.

## Source Of Truth
- 구조 지식은 이 디렉터리와 실제 `src/modules`, `src/server`, `src/shared`, `src/ui` 구현이 기준이다.

## 관련 코드
- [../../../src/modules/exporter/naver-blog-exporter.ts](../../../src/modules/exporter/naver-blog-exporter.ts)
- [../../../src/modules/converter/markdown-renderer.ts](../../../src/modules/converter/markdown-renderer.ts)
- [../../../src/server/http-server.ts](../../../src/server/http-server.ts)

## 검증 방법
- `pnpm parser:check`: parser capability와 구조 계약이 sample/fixture/test와 여전히 맞는지 확인할 때 실행한다.
- `pnpm check:quick`: 작은 구조 수정 뒤 타입, 오프라인 테스트, parser 계약 기준선을 다시 확인할 때 실행한다.

## Read This When
- 모듈 경계와 의존 방향을 빠르게 파악해야 할 때
- parser, converter, exporter, server가 어떻게 이어지는지 확인해야 할 때
- 구조 변경이 다른 계층에 미치는 영향을 판단해야 할 때

## Documents
- [principles.md](./principles.md): 구조 설계 원칙과 변경 시 주의점
- [system-map.md](./system-map.md): 모듈별 책임, 의존 방향, 코드 기준점
- [parser-block-catalog.md](./parser-block-catalog.md): blockType, fallback, 대표 샘플 카탈로그
