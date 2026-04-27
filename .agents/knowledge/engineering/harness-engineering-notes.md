# Harness Engineering Notes

## 목적
이 문서는 parser block, sample fixture, UI smoke harness가 어떤 역할로 맞물리는지 정리한다.

## Source Of Truth
- 실제 harness 동작은 `package.json`, `scripts/harness/*`가 기준이다.
- parser/sample 기준은 `src/shared/BlockRegistry.ts`, `src/modules/blog/BlogRegistry.ts`, `tests/fixtures/samples/*`다.
- 사용자 수동 개발 서버는 `pnpm dev`의 `4173` 포트를 기준으로 보고, harness가 띄우는 서버는 이 포트와 겹치지 않게 `listen(0)` 또는 별도 포트를 사용한다.

## 관련 코드
- `package.json`
- `.agents/knowledge/engineering/validation.md`
- `tests/sample-fixtures.test.ts`
- `scripts/harness/run-ui-smoke.ts`

## 검증 방법
- `pnpm check:local`: harness와 맞물린 기본 타입·오프라인·sample fixture 계약이 그대로 유지되는지 확인할 때 실행한다.
- `pnpm test:offline`: sample fixture 회귀를 포함한 오프라인 테스트를 실행한다.

## Harness Roles
- `tests/sample-fixtures.test.ts`
  저장된 `source.html`을 parse -> review -> render로 다시 돌려 `expected.md`와 전체 비교한다. `sample-fixture` parser block만 이 경로로 확인한다.
- `run-ui-smoke.ts`
  mock 기반 scan, category 선택, export, upload 결과 패널, 테마 저장, 복구 흐름 같은 사용자 경로를 브라우저에서 확인한다.
- `run-ui-resume-smoke.ts`
  마지막 `outputDir`의 `manifest.json`을 기준으로 빈 output, export 중간, upload 중간, 실패, 완료 상태가 각 단계로 복구되는지 확인한다.
- `run-live-server.ts`, live UI harness들
  격리된 settings/cache 경로와 임시 포트를 사용해 사용자 `pnpm dev` 서버, 다른 harness 실행과 충돌하지 않게 서버를 띄운다.
## Fixture 운영 규칙
- sample fixture는 `tests/fixtures/samples/<sampleId>/source.html`, `expected.md` 구조를 사용한다.
- `source.html`은 `fetchPostHtml()` 원문 전체를 저장한다.
- `expected.md`는 fixture 전용 export 옵션으로 render한 전체 Markdown 골든이다.
- 기본 회귀는 live fetch가 아니라 fixture-based regression이다.
- 공개 글 fixture가 끝내 확보되지 않는 parser block는 unit test나 focused fixture 테스트로 확인한다.

## Change Triggers
- parser block이나 sample fixture를 바꿨다면 `pnpm test:offline`을 함께 본다.
- renderer/exporter 결과가 바뀌면 위 전부에 `pnpm smoke:ui`를 추가한다.
