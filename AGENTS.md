# Agent Guide

## Project Overview
- 이 저장소는 네이버 블로그 공개 글을 수집해 editor별 parser capability를 기준으로 공용 AST로 변환하고 Markdown, frontmatter, 자산 파일, `manifest.json`으로 export하는 도구다.
- 로컬 웹 UI, 단건 export CLI, fixture-first sample regression, Playwright UI smoke, live upload e2e를 함께 유지한다.

## Non-Negotiables
- evergreen 프로젝트 지식은 `.agents/knowledge/`를 먼저 읽는다.
- 영속적인 UI 설정과 서버 파일 캐시는 작업 산출물 폴더가 아니라 `.cache/` 아래에 저장한다. 런타임 산출물만 저장한다.
- 저장소 파일을 수정한 턴에서는 범위와 무관하게 `pnpm check:quick`을 항상 실행한다. 이 명령이 가장 기본 검사다.
- parser capability, sample fixture, renderer/exporter 계약이 바뀌면 관련 knowledge와 generated 문서를 같이 갱신한다.
- parser/sample 회귀는 fixture-first가 기본이다. live 네이버 fetch는 fixture refresh/drift check 보조 경로로만 취급한다.
- Playwright UI smoke와 live upload e2e는 유지한다. parser fixture 전환을 이유로 제거하지 않는다.
- 큰 변경 뒤에는 `pnpm smoke:ui`, `pnpm test:network:upload`를 둘 다 확인한다.
- generated 문서는 수동 편집하지 않고 스크립트로 갱신한다.
- commit, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

## Validation Commands
- `pnpm check:quick`: 현재 `check:local` 별칭이다. 저장소 파일을 수정한 모든 턴에서 가장 먼저 실행하는 기본 검사다. 같은 로컬 기준선(`typecheck + test:offline + parser:check`)을 바로 확인한다.
- `pnpm check:local`: 일반적인 구현 작업 뒤 기본 회귀를 확인할 때 실행한다.
- `pnpm check:full`: fixture-based sample regression, generated coverage, Playwright UI smoke까지 포함한 전체 기본 회귀를 확인할 때 실행한다.
- `pnpm parser:check`: capability catalog, parser fixture, sample fixture, 테스트 연결이 맞는지 확인할 때 실행한다.
- `pnpm samples:verify`: 저장된 `source.html -> expected.md` fixture 회귀를 오프라인으로 확인할 때 실행한다.
- `pnpm samples:refresh -- --id <sampleId>`: 지정 sample의 live HTML을 다시 받아 fixture를 갱신할 때 실행한다.
- `pnpm smoke:ui`: Playwright로 고정한 mock 기반 UI 회귀를 다시 확인할 때 실행한다.
- `pnpm test:network:upload`: 실제 업로드를 포함한 Playwright live e2e를 확인할 때 실행한다.
- `pnpm quality:report`: capability/sample coverage generated 문서를 다시 만들 때 실행한다.

## Knowledge Router
- evergreen 프로젝트 지식은 [.agents/knowledge/index.md](.agents/knowledge/index.md)에서 시작한다.
- 스택, 검증, harness 역할은 [.agents/knowledge/engineering/index.md](.agents/knowledge/engineering/index.md)로 간다.
- capability 카탈로그와 parser 구조는 [.agents/knowledge/architecture/index.md](.agents/knowledge/architecture/index.md)로 간다.
- sample fixture 운영과 제품 흐름은 [.agents/knowledge/product/index.md](.agents/knowledge/product/index.md)로 간다.
- parser capability와 sample corpus의 코드 기준점은 `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`다.
