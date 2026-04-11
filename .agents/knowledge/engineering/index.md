# Engineering Knowledge

## 목적
엔지니어링 스택, 구현 규칙, 검증 루프처럼 반복적으로 참조하는 저장소 운영 지식을 안내한다.

## Source Of Truth
- 세부 엔지니어링 지식은 이 디렉터리와 실제 `package.json`, `scripts/harness/*`, `src/*` 구현이 기준이다.

## 관련 코드
- [../../../package.json](../../../package.json)
- [../../../scripts/harness/check-parser-capabilities.ts](../../../scripts/harness/check-parser-capabilities.ts)
- [../../../scripts/harness/generate-quality-report.ts](../../../scripts/harness/generate-quality-report.ts)

## 검증 방법
- `pnpm check:quick`
- 필요 시 `pnpm quality:report`

## Read This When
- 어떤 스택과 런타임을 쓰는지 확인해야 할 때
- repo 로컬 규칙과 검증 순서를 빠르게 파악해야 할 때
- 훅, CI, smoke, sample verification이 어디에 연결되는지 알아야 할 때

## Documents
- [stack.md](./stack.md): 런타임, 주요 의존성, CLI/UI/harness 구성
- [coding-guidelines.md](./coding-guidelines.md): repo에서 반복되는 구현 규칙과 문서 동기화 규칙
- [validation.md](./validation.md): 패키지 스크립트, 훅, CI, task loop
- [harness-engineering-notes.md](./harness-engineering-notes.md): harness 철학과 운영 메모
