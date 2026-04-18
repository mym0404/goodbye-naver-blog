# Engineering Knowledge

## 여기서 찾는 것
- 런타임, 주요 의존성, 진입점: [stack.md](./stack.md)
- 구현 우선순위와 문서 경계: [coding-guidelines.md](./coding-guidelines.md)
- 패키지 스크립트, 훅, CI, 재검증 루프: [validation.md](./validation.md)
- parser/sample/UI harness 역할: [harness-engineering-notes.md](./harness-engineering-notes.md)

## 대표 기준점
- 저장소 명령과 검증 루프: [../../../package.json](../../../package.json)
- parser 계약 점검 harness: [../../../scripts/harness/check-parser-capabilities.ts](../../../scripts/harness/check-parser-capabilities.ts)
- generated 품질 보고서 생성기: [../../../scripts/harness/generate-quality-report.ts](../../../scripts/harness/generate-quality-report.ts)

## 언제 읽는가
- 어떤 검증 명령을 우선 돌릴지 정해야 할 때
- 스택이나 엔트리포인트를 빠르게 잡아야 할 때
- 훅, CI, smoke, sample verification 연결 지점을 찾아야 할 때

## 검증
- `pnpm check:quick`: 현재 `check:local` 별칭이다. 작은 수정 뒤 같은 로컬 기준선을 다시 확인할 때 실행한다.
- `pnpm quality:report`: parser coverage나 sample 품질 지표가 달라질 수 있는 변경 뒤 generated 보고서를 갱신할 때 실행한다.
