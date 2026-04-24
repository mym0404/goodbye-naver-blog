# Harness Engineering Notes

## 목적
이 문서는 parser capability, sample fixture, UI smoke, generated 리포트가 어떤 역할로 맞물리는지 정리한다.

## Source Of Truth
- 실제 harness 동작은 `package.json`, `scripts/harness/*`, generated 보고서 출력 경로가 기준이다.
- parser/sample knowledge projection의 canonical SoT는 `src/shared/block-registry.ts`, `src/shared/parser-capabilities.ts`, `src/shared/sample-corpus.ts`다.
- 사용자 수동 개발 서버는 `pnpm dev`의 `4173` 포트를 기준으로 보고, harness가 띄우는 서버는 이 포트와 겹치지 않게 `listen(0)` 또는 별도 포트를 사용한다.

## 관련 코드
- `package.json`
- `.agents/knowledge/engineering/validation.md`
- `scripts/harness/check-parser-capabilities.ts`
- `scripts/harness/verify-sample-exports.ts`
- `scripts/harness/refresh-sample-fixtures.ts`
- `scripts/harness/run-ui-smoke.ts`
- `scripts/harness/generate-quality-report.ts`
- `.agents/knowledge/reference/generated/quality-score.md`
- `.agents/knowledge/reference/generated/sample-coverage.md`

## 검증 방법
- `pnpm check:local`: harness와 맞물린 기본 타입·오프라인·parser·sample fixture 계약이 그대로 유지되는지 확인할 때 실행한다.
- `pnpm samples:verify`: sample fixture 회귀를 확인할 때 실행한다.
- `pnpm quality:report`: capability/sample coverage generated 문서를 다시 만들 때 실행한다.

## Harness Roles
- `check-parser-capabilities.ts`
  capability id, parser fixture, sample fixture, 테스트, sample link 연결과 generated knowledge 문서 freshness가 끊기지 않았는지 확인한다.
- `verify-sample-exports.ts`
  저장된 `source.html`을 parse -> review -> render로 다시 돌려 `expected.md`와 전체 비교한다. `sample-fixture` capability만 이 경로로 확인한다.
- `refresh-sample-fixtures.ts`
  지정 sample의 live HTML을 다시 받아 `source.html`, `expected.md`를 갱신한다.
- `run-ui-smoke.ts`
  mock 기반 scan, category 선택, export, upload 결과 패널, 테마 저장, 복구 흐름 같은 사용자 경로를 브라우저에서 확인한다.
- `run-ui-resume-smoke.ts`
  마지막 `outputDir`의 `manifest.json`을 기준으로 빈 output, export 중간, upload 중간, 실패, 완료 상태가 각 단계로 복구되는지 확인한다.
- `run-live-server.ts`, live UI harness들
  격리된 settings/cache 경로와 임시 포트를 사용해 사용자 `pnpm dev` 서버, 다른 harness 실행과 충돌하지 않게 서버를 띄운다.
- `generate-quality-report.ts`
  parser/sample knowledge projection과 parser block fixture coverage, parser capability test mapping coverage, `sample-fixture` capability coverage, `parser-fixture` capability 목록을 generated markdown으로 다시 계산한다.

## Fixture 운영 규칙
- sample fixture는 `tests/fixtures/samples/<sampleId>/source.html`, `expected.md` 구조를 사용한다.
- `source.html`은 `fetchPostHtml()` 원문 전체를 저장한다.
- `expected.md`는 fixture 전용 export 옵션으로 render한 전체 Markdown 골든이다.
- 기본 회귀는 live fetch가 아니라 fixture-based regression이다.
- live fetch는 `samples:refresh`에서만 사용한다.
- 공개 글 fixture가 끝내 확보되지 않는 capability는 `parser-fixture`로 분류한다. 이 경우 parser unit test와 parser fixture가 canonical 검증 경로다.

## Generated Outputs
- generated 보고서는 현재 커버리지와 gap을 보여 주는 관찰 결과이며 source of truth는 아니다.
- `.agents/knowledge/architecture/parser-block-catalog.md`, `.agents/knowledge/product/sample-corpus.md`는 code-derived projection이며 수동 편집하지 않는다.
- `.agents/knowledge/reference/generated/ui-review/*` 스크린샷은 Playwright smoke 시나리오 비교 기록이다.
- generated 산출물은 수동 편집하지 않고 해당 harness를 다시 실행해 갱신한다.

## Change Triggers
- parser capability, sample corpus, sample fixture를 바꿨다면 `pnpm parser:check`, `pnpm samples:verify`, `pnpm quality:report`를 함께 본다.
- renderer/exporter 결과가 바뀌면 위 전부에 `pnpm smoke:ui`를 추가한다.
- live HTML drift를 fixture에 반영해야 할 때만 `pnpm samples:refresh -- --id <sampleId>`를 실행한다.
- knowledge에서 generated 보고서를 인용할 때는 수치 자체보다 어떤 capability seam이 비어 있는지 읽는 데 사용한다.
