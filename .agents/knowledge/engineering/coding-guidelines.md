# Coding Guidelines

## 관련 코드
- [../../../AGENTS.md](../../../AGENTS.md)
- [../../../src/shared/parser-capabilities.ts](../../../src/shared/parser-capabilities.ts)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm check:quick`: 현재 `check:local` 별칭이다. parser, renderer, exporter, server, UI 중 수정한 코드가 기본 타입·오프라인 회귀를 깨지 않았는지 확인할 때 실행한다.
- 변경 영역 focused command: 한 seam만 바꿨을 때 관련 harness나 테스트만 다시 확인할 때 실행한다.

## Repo-Specific Priorities
- repo 바깥 지식보다 저장소 안의 코드, 설정, 테스트를 우선한다.
- 구조, 샘플, 검증 기준은 숨기지 말고 코드와 문서에 남긴다.
- parser, renderer, exporter, UI/API를 바꾸면 관련 문서와 harness를 함께 본다.
- generated 문서는 직접 고치지 않고 스크립트로 다시 만든다.
- commit, push, PR 생성은 명시적 요청이 있을 때만 수행한다.

## Change Discipline
- parser 범위를 넓힐 때는 `src/shared/parser-capabilities.ts`, 샘플 corpus, 테스트를 함께 맞춘다.
- exporter나 renderer 규약을 바꾸면 `manifest`, Markdown 출력, export spec, smoke 흐름이 같이 맞아야 한다.
- UI 변경은 정적 DOM id와 smoke selector 계약을 함부로 깨지 않도록 주의한다.
- 단건 검증이 필요하면 `scripts/export-single-post.ts`로 실제 공개 글 하나를 다시 확인한다.

## Documentation Discipline
- evergreen 지식은 `.agents/knowledge/`가 기준이다.
- `docs/runbooks/`는 반복 가능한 운영 절차, `docs/generated/`는 harness 산출물, `docs/plans/active/`는 활성 작업 메모다.
- 코드 동작이 바뀌면 knowledge와 관련 docs를 같이 갱신한다.
- `README.md`는 사용자 진입, `CONTRIBUTING.md`는 기여자 진입 문서로 유지한다.
