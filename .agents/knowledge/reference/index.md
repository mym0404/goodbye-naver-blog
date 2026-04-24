# Reference Index

## 목적
이 문서는 `.agents/knowledge` 아래의 참고 자료 경로를 모아 둔 인덱스다. evergreen 규칙은 상위 knowledge 문서를 우선 보고, 반복 절차나 generated 출력이 필요할 때 여기서 내려간다. 이 트리는 source of truth가 아니라 reference tier다.

## 시작점
- 전체 knowledge 라우터: `.agents/knowledge/index.md`
- 디자인 기준 문서: `.agents/knowledge/DESIGN.md`
- 브라우저 수동 검증: `.agents/knowledge/reference/runbooks/browser-verification.md`
- 단건 글 수동 검증: `.agents/knowledge/reference/runbooks/single-post-verification.md`
- 플랜 아카이브: `.agents/knowledge/reference/plan-archive/index.md`
- 트러블슈팅: `.agents/knowledge/reference/troubleshooting/index.md`

## 참고 자료
- runbooks: `.agents/knowledge/reference/runbooks/`
- generated 보고서: `.agents/knowledge/reference/generated/`
- 플랜 아카이브: `.agents/knowledge/reference/plan-archive/`
- 트러블슈팅: `.agents/knowledge/reference/troubleshooting/`
- README 이미지 자산: `.agents/knowledge/reference/assets/readme/`

## generated 출력
- 품질 보고서: `.agents/knowledge/reference/generated/quality-score.md`
- sample coverage: `.agents/knowledge/reference/generated/sample-coverage.md`
- UI smoke 스크린샷: `.agents/knowledge/reference/generated/` 아래 capture-dir

## 검증
- `pnpm quality:report`: generated 품질 보고서를 다시 만들 때 실행한다.
- repo 경로 수동 점검: reference 경로를 바꾼 뒤 루트 기준 경로가 그대로 열리는지 확인할 때 실행한다.
