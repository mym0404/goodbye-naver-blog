# Harness Engineering Notes

## 목적
이 문서는 이 저장소가 차용한 harness engineering 원칙을 요약한다.

## Source Of Truth
참고한 원문은 [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/) 이다.

## 관련 코드
- [../../../AGENTS.md](../../../AGENTS.md)
- [./validation.md](./validation.md)
- [../../../docs/generated/quality-score.md](../../../docs/generated/quality-score.md)

## 검증 방법
- `pnpm quality:report`

## Principles
- `AGENTS.md`는 router만 두고 세부 지식은 `.agents/knowledge/`에 둔다.
- repo 안 문서와 코드가 agent가 볼 수 있는 system of record다.
- 지식 구조는 읽기 쉬운 라우팅과 국소적인 수동 점검으로 유지하고, 전용 문서 validator는 두지 않는다.
- feedforward는 읽기 순서와 sample corpus로 만든다.
- feedback loop는 quality report, parser, sample export, UI smoke 검증으로 만든다.
- generated 리포트로 커버리지와 entropy를 눈에 보이게 만든다.
