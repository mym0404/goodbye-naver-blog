# Reference Index

## 목적
이 문서는 `.agents/knowledge` 아래의 참고 자료 경로를 모아 둔 인덱스다. evergreen 규칙은 상위 knowledge 문서를 우선 보고, 반복 절차나 generated 출력이 필요할 때 여기서 내려간다. 이 트리는 source of truth가 아니라 reference tier다.

## 시작점
- 전체 knowledge 라우터: [../index.md](../index.md)
- 디자인 기준 문서: [../DESIGN.md](../DESIGN.md)
- 브라우저 수동 검증: [./runbooks/browser-verification.md](./runbooks/browser-verification.md)
- 단건 글 수동 검증: [./runbooks/single-post-verification.md](./runbooks/single-post-verification.md)
- 플랜 아카이브: [./plan-archive/index.md](./plan-archive/index.md)
- 트러블슈팅: [./troubleshooting/index.md](./troubleshooting/index.md)

## 참고 자료
- runbooks: `./runbooks/`
- generated 보고서: `./generated/`
- 플랜 아카이브: `./plan-archive/`
- 트러블슈팅: `./troubleshooting/`
- README 이미지 자산: `./assets/readme/`

## generated 출력
- 품질 보고서: [./generated/quality-score.md](./generated/quality-score.md)
- sample coverage: [./generated/sample-coverage.md](./generated/sample-coverage.md)
- UI smoke 스크린샷: `./generated/ui-review/`

## 검증
- `pnpm quality:report`: generated 품질 보고서를 다시 만들 때 실행한다.
- 수정한 링크 수동 점검: reference 경로를 바꾼 뒤 상대 링크가 그대로 열리는지 확인할 때 실행한다.
