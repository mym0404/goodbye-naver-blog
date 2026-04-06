# Agent Guide

이 저장소의 운영 원칙은 `AGENTS.md`를 백과사전이 아니라 목차로 두는 것이다.  
세부 규칙, 구조, 샘플, 검증 기준은 모두 `docs/`를 source of truth로 취급한다.

## Read Order
1. [docs/index.md](docs/index.md)
2. [docs/architecture.md](docs/architecture.md)
3. [docs/export-spec.md](docs/export-spec.md)
4. [docs/validation-harness.md](docs/validation-harness.md)

Parser 관련 작업이면 아래를 추가로 읽는다.
- [docs/parser-block-catalog.md](docs/parser-block-catalog.md)
- [src/shared/parser-capabilities.ts](src/shared/parser-capabilities.ts)
- [docs/samples/index.md](docs/samples/index.md)

## Working Rules
- repo 밖의 지식보다 repo 안 문서를 우선한다.
- 새로운 규칙이나 샘플을 도입하면 관련 docs와 harness를 함께 갱신한다.
- 숨은 의사결정을 남기지 않는다. 구조, 샘플, 검증 기준은 모두 repo 안에 남긴다.
- 코드 변경이 parser, renderer, exporter, UI/API에 걸치면 문서와 harness를 같이 본다.
- generated 문서는 수동 편집하지 않고 스크립트로 갱신한다.

## Feedforward
작업 전에는 아래를 기준으로 판단한다.
- 구조 파악: [docs/architecture.md](docs/architecture.md)
- 제품/출력 규약: [docs/export-spec.md](docs/export-spec.md)
- 블록 파싱/지원 범위: [docs/parser-block-catalog.md](docs/parser-block-catalog.md)
- 대표 샘플: [docs/samples/index.md](docs/samples/index.md)
- 검증 절차: [docs/validation-harness.md](docs/validation-harness.md)

## Feedback Loop
변경 후에는 아래 순서로 검증한다.
1. 구조 확인: `pnpm docs:check`, `pnpm parser:check`
2. 로직 확인: `pnpm typecheck`, `pnpm test`
3. 현실 확인: `pnpm samples:verify`
4. 사용자 흐름 확인: `pnpm smoke:ui`

권장 명령:
- 전체: `pnpm check`
- 빠른 확인: `pnpm check:quick`
- 전체 루프: `pnpm check:full`
- generated 보고서 갱신: `pnpm quality:report`

## Task Loops
- parser 변경: `pnpm check:quick`, 필요 시 `pnpm samples:verify`
- renderer/exporter 변경: `pnpm check:full`
- docs만 변경: `pnpm docs:check`, `pnpm quality:report`
- UI/API 변경: `pnpm smoke:ui`

## Important Paths
- 문서 인덱스: [docs/index.md](docs/index.md)
- 샘플 corpus: [src/shared/sample-corpus.ts](src/shared/sample-corpus.ts)
- parser capability 선언: [src/shared/parser-capabilities.ts](src/shared/parser-capabilities.ts)
- generated 품질 리포트: [docs/generated/quality-score.md](docs/generated/quality-score.md)
- generated 샘플 커버리지: [docs/generated/sample-coverage.md](docs/generated/sample-coverage.md)

## Don’ts
- 거대한 규칙을 `AGENTS.md` 하나에 누적하지 않는다.
- docs와 코드가 어긋난 상태로 끝내지 않는다.
- 대표 샘플 없이 parser 동작을 넓히지 않는다.
- generated 문서를 손으로 고친 뒤 방치하지 않는다.

## When In Doubt
- 구조는 단순하게 유지한다.
- repo에서 직접 검증 가능한 기준을 우선한다.
- 샘플, fixture, docs, 테스트 중 최소 둘 이상으로 새 동작을 고정한다.
