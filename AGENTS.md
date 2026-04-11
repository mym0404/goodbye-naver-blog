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
- 빠른 확인: `pnpm check:quick`
- 로컬 기본 루프: `pnpm check:local`
- 전체 검증: `pnpm check:full`
- 품질 리포트 갱신: `pnpm quality:report`
- parser 계약: `pnpm parser:check`
- 실샘플 검증: `pnpm samples:verify`
- UI 흐름: `pnpm smoke:ui`

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
