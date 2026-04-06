# Harness Engineering Notes

## 목적
이 문서는 이 저장소가 차용한 harness engineering 원칙을 요약한다.

## Source Of Truth
참고한 원문은 [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) 이다.

## 관련 코드
- [../../AGENTS.md](../../AGENTS.md)
- [../validation-harness.md](../validation-harness.md)
- [../generated/quality-score.md](../generated/quality-score.md)

## 검증 방법
- `pnpm docs:check`

## Principles
- `AGENTS.md`는 목차만 두고 세부 지식은 `docs/`에 둔다.
- repo 안 문서와 코드가 agent가 볼 수 있는 system of record다.
- 구조와 taste는 문서만이 아니라 기계적 검증으로 강제한다.
- feedforward는 읽기 순서와 샘플 corpus로 만든다.
- feedback loop는 docs, parser, sample export, UI smoke 검증으로 만든다.
- generated 리포트로 커버리지와 entropy를 눈에 보이게 만든다.
