# Agent Guide

## Project Overview
이 저장소는 네이버 블로그 공개 글을 수집해 공용 AST로 파싱하고 Markdown, frontmatter, 자산 파일, `manifest.json`으로 export하는 도구다. 로컬 웹 UI, 단건 검증 CLI, parser/sample/harness 기반 검증 체계를 함께 유지한다.

## Always-On Rules
- evergreen 프로젝트 지식은 `docs/`가 아니라 `.agents/knowledge/`를 먼저 읽는다.
- 코드, 설정, 스크립트, 테스트 동작이 바뀌면 관련 `.agents/knowledge/` 문서도 같이 갱신한다.
- parser, renderer, exporter, UI/API를 바꾸면 문서와 harness를 함께 확인한다.
- generated 문서는 수동 편집하지 않고 스크립트로 갱신한다.
- repo 밖의 추측보다 저장소 안의 코드, 설정, 테스트를 우선한다.
- commit, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

## Validation Commands
- 빠른 확인: `pnpm check:quick` 작은 코드 수정 뒤 타입, 오프라인 테스트, parser 계약만 바로 확인할 때 실행한다.
- 로컬 기본 루프: `pnpm check:local` 일반적인 구현 작업을 마친 뒤 handoff 전에 기본 회귀를 확인할 때 실행한다.
- 전체 검증: `pnpm check:full` export 결과, 네트워크 연동, UI 흐름까지 바뀌었거나 최종 인계 직전에 전체 회귀를 묶어서 확인할 때 실행한다.
- 품질 리포트 갱신: `pnpm quality:report` parser coverage나 sample 품질 지표가 달라질 수 있는 변경 후 generated 품질 문서를 다시 만들 때 실행한다.
- parser 계약: `pnpm parser:check` parser block 지원 범위나 capability 선언을 건드린 뒤 계약이 sample corpus와 여전히 맞는지 확인할 때 실행한다.
- 실샘플 검증: `pnpm samples:verify` renderer나 exporter 결과가 실제 sample export 산출물에 영향을 주는 변경 뒤 실행한다.
- UI 흐름: `pnpm smoke:ui` 대시보드 상호작용, export job 화면, 브라우저 흐름이 바뀐 뒤 실제 UI 스모크를 다시 확인할 때 실행한다.

## Knowledge Routing
- 전체 인덱스: [.agents/knowledge/index.md](.agents/knowledge/index.md)
- 스택, 코딩 규칙, 검증: [.agents/knowledge/engineering/index.md](.agents/knowledge/engineering/index.md)
- 시스템 구조와 설계 원칙: [.agents/knowledge/architecture/index.md](.agents/knowledge/architecture/index.md)
- 제품 도메인과 사용자 흐름: [.agents/knowledge/product/index.md](.agents/knowledge/product/index.md)
- parser capability와 sample corpus는 각각 `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`를 코드 기준점으로 함께 본다.
- parser 블록 카탈로그: [.agents/knowledge/architecture/parser-block-catalog.md](.agents/knowledge/architecture/parser-block-catalog.md)
- sample corpus: [.agents/knowledge/product/sample-corpus.md](.agents/knowledge/product/sample-corpus.md)
- UI 디자인 시스템: [.agents/knowledge/product/ui-dashboard-design-system.md](.agents/knowledge/product/ui-dashboard-design-system.md)
- `docs/`는 runbook, 계획, generated 산출물, 사용자용 참고 자료만 둔다.

## Knowledge Sync Contract
- `.agents/knowledge/`는 이 저장소의 evergreen project knowledge system of record다.
- 루트 `AGENTS.md`는 짧은 router로 유지하고 knowledge base와 항상 동기화해야 한다.
- 저장소 동작이 바뀌면 관련 knowledge 문서도 같은 변경에 포함되어야 한다.
- stale 하거나 중복된 가이드는 흩어 두지 말고 knowledge 문서로 통합한다.

# ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in .agents/PLANS.md) from design to implementation.
