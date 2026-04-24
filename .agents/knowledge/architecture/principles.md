# Architecture Principles

## 목적
파이프라인 구조와 계층 간 계약을 바꿀 때 지켜야 하는 설계 원칙을 정리한다.

## Source Of Truth
- 실제 구조 계약은 exporter, parser, converter, server, React UI 구현이 기준이다.

## 관련 코드
- `src/modules/exporter/naver-blog-exporter.ts`
- `src/modules/converter/markdown-renderer.ts`
- `src/server/http-server.ts`

## 검증 방법
- `pnpm check:local`: 계층 경계나 구조 규칙을 건드린 뒤 기본 타입·오프라인·parser·sample fixture 계약이 유지되는지 확인할 때 실행한다.
- `pnpm check:full`: 구조 변경이 export 결과, 네트워크 연동, UI 흐름까지 번질 수 있을 때 실행한다.

## Core Principles
- fetch, parse, review, render, write, manifest 단계를 분리한 파이프라인 구조를 유지한다.
- parser capability와 sample corpus를 구조 계약의 일부로 취급한다.
- UI는 내부 모듈을 직접 읽지 않고 HTTP API만 호출한다.
- generated 보고서는 상태 요약이지 source of truth가 아니다.

## Change Implications
- parser 규약을 바꾸면 capability 선언, 샘플 corpus, parser 테스트, sample verification이 같이 바뀌어야 한다.
- converter/renderer 규약을 바꾸면 Markdown 출력, frontmatter, export spec, smoke 흐름을 같이 봐야 한다.
- exporter 변경은 manifest invariants와 UI job status까지 연결된다.
- server와 React UI는 DOM id, API payload, polling 흐름의 계약을 공유한다.
