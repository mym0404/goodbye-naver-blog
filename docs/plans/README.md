# Plans

## 목적
이 문서는 계획 문서를 어떻게 저장하고 상태를 관리할지 정의한다.

## Source Of Truth
복잡한 작업 계획은 `docs/plans/active/`, 완료된 계획은 `docs/plans/completed/` 에 둔다.

## 관련 코드
- [../../AGENTS.md](../../AGENTS.md)
- [../validation-harness.md](../validation-harness.md)

## 검증 방법
- `pnpm docs:check`

## Rules
- 작은 변경은 별도 계획 문서 없이 진행할 수 있다.
- 큰 변경은 active 계획 문서로 시작하고 완료 후 completed로 옮긴다.
- 계획에는 작업, 결정, 검증 기준만 남긴다.
- 기간, 공수, 인력 산정은 남기지 않는다.
