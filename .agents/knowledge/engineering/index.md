# Engineering Knowledge

## 여기서 찾는 것
- 런타임, 주요 의존성, 진입점: `.agents/knowledge/engineering/stack.md`
- 구현 우선순위와 문서 경계: `.agents/knowledge/engineering/coding-guidelines.md`
- 패키지 스크립트, verification bundle, 훅, CI, 재검증 루프: `.agents/knowledge/engineering/validation.md`
- capability/sample/UI harness 역할: `.agents/knowledge/engineering/harness-engineering-notes.md`
- shadcn 설치 목록, 현재 사용처, chooser 기준: `.agents/knowledge/engineering/shadcn-component-map.md`

## 대표 기준점
- 저장소 명령과 검증 루프: `package.json`
- parser 계약 점검 harness: `scripts/harness/check-parser-capabilities.ts`
- sample fixture refresh harness: `scripts/harness/refresh-sample-fixtures.ts`
- generated 품질 보고서 생성기: `scripts/harness/generate-quality-report.ts`

## 언제 읽는가
- 어떤 검증 명령을 우선 돌릴지 정해야 할 때
- 스택이나 엔트리포인트를 빠르게 잡아야 할 때
- 훅, CI, smoke, fixture-based sample verification 연결 지점을 찾아야 할 때

## 검증
- `pnpm check:local`: 저장소 파일을 수정한 모든 턴에서 가장 먼저 실행하는 기본 검사다.
- `pnpm quality:report`: parser coverage나 sample 품질 지표가 달라질 수 있는 변경 뒤 generated 보고서를 갱신할 때 실행한다.
