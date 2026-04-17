# Harness Engineering Notes

## 목적
이 문서는 이 저장소에서 parser, sample, UI smoke, generated 리포트가 어떤 역할로 맞물리는지 정리한다.

## Source Of Truth
- 실제 harness 동작은 `package.json`, `scripts/harness/*`, generated 보고서 출력 경로가 기준이다.

## 관련 코드
- [../../../package.json](../../../package.json)
- [./validation.md](./validation.md)
- [../../../scripts/harness/check-parser-capabilities.ts](../../../scripts/harness/check-parser-capabilities.ts)
- [../../../scripts/harness/verify-sample-exports.ts](../../../scripts/harness/verify-sample-exports.ts)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)
- [../../../scripts/harness/generate-quality-report.ts](../../../scripts/harness/generate-quality-report.ts)
- [../../../docs/generated/quality-score.md](../../../docs/generated/quality-score.md)
- [../../../docs/generated/sample-coverage.md](../../../docs/generated/sample-coverage.md)

## 검증 방법
- `pnpm check:local`: harness와 맞물린 기본 타입·오프라인·parser 계약이 그대로 유지되는지 확인할 때 실행한다.
- `pnpm quality:report`: parser capability나 sample corpus 변경 뒤 generated 품질 보고서를 다시 만들 때 실행한다.

## Harness Roles
- `check-parser-capabilities.ts`는 `parserCapabilities`, fixture, 테스트, sample id 연결이 끊기지 않았는지 확인한다.
- `verify-sample-exports.ts`는 공개 샘플을 fetch -> parse -> render까지 다시 돌려 export 현실을 점검한다.
- `run-ui-smoke.ts`는 scan, category 선택, export, upload 결과 패널, contrast/layout invariant를 브라우저에서 확인한다.
- `generate-quality-report.ts`는 parser coverage와 sample gap을 `docs/generated/quality-score.md`, `docs/generated/sample-coverage.md`로 다시 계산한다.

## Generated Outputs
- generated 보고서는 현재 커버리지와 drift를 보여 주는 관찰 결과이며 source of truth는 아니다.
- `docs/generated/ui-review/*` 스크린샷은 같은 smoke 시나리오를 라운드별로 비교하는 기록이다.
- generated 산출물은 수동 편집하지 않고 해당 harness를 다시 실행해 갱신한다.

## Change Triggers
- parser capability, sample corpus, parser fixture를 바꿨다면 `pnpm parser:check`, 필요 시 `pnpm samples:verify`, `pnpm quality:report`를 함께 본다.
- export 결과나 upload lifecycle이 바뀌면 `pnpm smoke:ui`와 관련 UI 테스트를 함께 본다.
- knowledge에서 generated 보고서를 인용할 때는 수치 자체보다 어떤 seam이 비어 있는지 읽는 데 사용한다.
