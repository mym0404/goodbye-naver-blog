# Knowledge Index

## 목적
이 디렉터리는 이 저장소의 evergreen agent knowledge를 보관하는 system of record다. 기술 스택, 검증 루프, 구조, 제품 흐름처럼 반복해서 참조해야 하는 내용을 짧고 예측 가능한 경로로 정리한다.

## Source Of Truth
- evergreen 프로젝트 지식은 이 디렉터리와 실제 코드, 설정, 스크립트, 테스트를 기준으로 유지한다.
- 사용자 문서, runbook, generated 산출물은 `docs/`에 둔다.

## Read First
1. [engineering/index.md](./engineering/index.md)
2. [architecture/index.md](./architecture/index.md)
3. [product/index.md](./product/index.md)

## 관련 코드
- [../../AGENTS.md](../../AGENTS.md)
- [../../package.json](../../package.json)
- [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)

## 검증 방법
- `pnpm quality:report`: parser capability나 sample corpus 변경으로 generated 품질 문서가 달라질 수 있을 때 다시 만든다.
- 수정한 링크와 코드 기준점 수동 spot-check: knowledge 문서를 바꾼 뒤 라우팅과 코드 앵커가 여전히 맞는지 확인할 때 실행한다.

## Retrieval Guide
- 스택, 툴링, 코딩 규칙, 검증 명령: [engineering/index.md](./engineering/index.md)
- 모듈 경계, 의존 방향, 구조 원칙: [architecture/index.md](./architecture/index.md)
- 네이버 블로그 export 도메인, 사용자 흐름, 출력 규약: [product/index.md](./product/index.md)

## High-Risk Seams
- parser 지원 범위와 fallback 정책은 `src/shared/parser-capabilities.ts`와 [architecture/parser-block-catalog.md](./architecture/parser-block-catalog.md)를 함께 본다.
- 실샘플 대표성과 export 현실은 `src/shared/sample-corpus.ts`와 [product/sample-corpus.md](./product/sample-corpus.md)를 함께 본다.
- export 후 upload lifecycle과 UI 상태 전이는 [product/domain.md](./product/domain.md), [product/product-outline.md](./product/product-outline.md), `src/server/http-server.ts`를 함께 본다.

## Source Priority
1. 명시적 사용자 지시와 루트 `AGENTS.md`
2. 실제 코드, 설정, 스크립트, 테스트
3. 이 knowledge 문서
4. `docs/` 아래 사용자 문서와 참고 자료
