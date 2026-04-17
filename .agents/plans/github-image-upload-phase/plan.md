# PicGo Image Upload Phase

## TL;DR

export 결과를 `글 폴더 + index.md + 같은 폴더의 자산` 구조로 바꾸고, 이미지 처리를 `다운로드 유지 / 네이버 원본 URL 유지 / 다운로드 후 PicGo 업로드` 3모드로 재정의한다. `다운로드 후 PicGo 업로드`는 export 직후 같은 job이 `upload-ready -> uploading -> upload-completed`로 이어지는 후처리 phase로 구현하고, 성공 시 본문 이미지, frontmatter `thumbnail`, `assetPaths`, manifest/job item을 업로드 URL로 함께 치환한다. 핵심 경로는 shared contract 정리, exporter path/manifest 재설계, PicGo post-export service, same-job API/UI 상태 전이, knowledge/smoke 갱신이다.

## Context

- 사용자는 이미지 업로드를 Obsidian PicGo plugin처럼 검토해 달라고 요청했고, planning session에서 subagent 사용을 명시적으로 허용했다.
- Phase 1에서는 quick local sweep 후 `Implementation Surface`와 `Verification Surface` explore subagent를 필수로 돌렸고, 추가로 기존 UI/API 패턴 확인용 explorer를 사용했다. 공통 결론은 exporter, shared type, job API, UI test surface가 강하게 연결되어 있어 타입과 상태 계약부터 먼저 고정해야 한다는 점이었다.
- 이후 사용자 리뷰로 major axis가 여러 번 열렸다. 그 과정에서 이미지 처리 계약은 `다운로드 유지`, `네이버 원본 URL 그대로`, `다운로드 후 후처리 업로드` 3가지로 확정되었고, 1과 3은 export 완료 전까지 같은 흐름이라는 점이 고정되었다.
- output 구조에 대한 인터뷰 결과는 다음으로 확정되었다: 글 하나당 폴더 하나를 만들고 Markdown 파일명은 항상 `index.md`를 쓴다. 카테고리 그룹핑 여부는 옵션으로 두고 기본값은 `true`다.
- upload lifecycle에 대한 인터뷰 결과는 별도 job이 아니라 같은 export job 안에서 `upload-ready -> uploading -> upload-completed`로 보이도록 하는 것이다.
- 치환 범위에 대한 인터뷰 결과는 본문 이미지 링크만이 아니라 frontmatter `thumbnail`과 `assetPaths`까지 모두 갱신하는 것이다.
- 추가 탐색에서 PicGo-Core 공식 문서는 Node 앱에서 `new PicGo()`와 `picgo.upload([...])` 형태의 programmatic API를 제공하고, uploader 설정이 `picBed.current`와 `picBed.<uploaderKey>`에 저장되는 규약을 가진다는 점을 확인했다. 이 bundle은 GitHub 전용 SDK 대신 PicGo-Core를 공통 업로드 엔진으로 사용한다.
- 현재 repo facts:
  - `src/modules/exporter/naver-blog-exporter.ts`가 `fetch -> parse -> review -> render -> write -> manifest` 단일 흐름을 묶는다.
  - `src/modules/exporter/export-paths.ts`는 `posts/`와 `assets/`를 분리한 현재 경로 구조를 만든다.
  - `src/modules/exporter/asset-store.ts`는 `relative | remote | base64` 저장 모드만 다루며 업로드/압축 단계가 없다.
  - `src/modules/converter/markdown-renderer.ts`는 `AssetRecord.reference`와 `assetPaths`로 최종 Markdown/frontmatter를 만든다.
  - `src/server/job-store.ts`와 `src/server/http-server.ts`는 export request를 job에 그대로 저장하고 `/api/export/:id` polling으로 노출하므로 비밀 credential을 export request에 넣을 수 없다.
  - `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `src/ui/hooks/use-export-job.ts`, `src/ui/App.tsx`가 옵션 입력, job polling, status panel을 구성한다.
  - `src/shared/utils.ts`의 날짜 slug는 이미 `YYYY-MM-DD`만 사용하므로 “시간까지 나오지 않게” 요구는 현재 구현이 만족한다.
  - `package.json`에는 아직 `picgo`와 `sharp`가 없다.
- 추가 user-visible choice는 Phase 2 승인 후 planner default로 닫았다.
  - 첫 UI는 provider별 bespoke form을 미리 만들지 않고 `uploaderKey + uploaderConfigJson` 입력으로 시작한다. 이 방식은 PicGo 내장 uploader와 plugin uploader를 모두 수용한다.
  - compression은 다운로드 직후 저장 파일에만 적용하고, 업로드 직전 재가공은 첫 범위에서 제외한다.
  - 카테고리 그룹핑을 끄면 글 폴더는 output 루트 바로 아래에 평탄화한다.
- Phase 2에서는 최신 `draft.md`를 보여준 뒤 사용자가 “응 좋아 고고”로 방향을 승인했다.
- Phase 4 deterministic validation 목표는 필수 headings, task schema, artifact graph alignment, checkpoint diff surface, browser verification shape, evidence-path formatting, verification ordering을 확인하는 것이다.
- Phase 5 review pass에서는 최소 `Execution - Hidden Decision & Contradiction`, `Verification - Scenario Completeness`를 돌리고, 이 bundle은 secrets/UI/stateful phase 전이를 포함하므로 `Security`와 `Frontend` specialist를 추가한다.
- Phase 4 deterministic validation pass에서는 required headings, task schema, status-board consistency, artifact graph alignment, checkpoint diff surface, browser verification shape, evidence-path formatting을 다시 점검했고 blocker 없이 통과시켰다.
- Phase 5 initial review는 네 가지 hard gap을 드러냈다: credential form 위치 충돌, zero-candidate lifecycle 공백, request-origin/redaction/URL-validation 보안 누락, rewrite 원자성 부재. rev2에서는 credential form을 결과 화면 전용으로 고정하고, zero-candidate를 `completed + skipped-no-candidates`로 정의하고, upload endpoint guard/redaction rules를 넣고, temp-file swap 절차를 명시해 blocker를 닫았다.
- Phase 5 rerun 결과는 `Verification - Scenario Completeness: PASS`, `Execution - Hidden Decision & Contradiction: no findings`, `Security: no findings`, `Frontend: no findings`이다.

## Goal

사용자가 export를 실행할 때 이미지 처리 방식을 3모드 중 하나로 고를 수 있고, `다운로드 후 PicGo 업로드`를 선택한 경우 export 완료 후 같은 job이 upload-ready 상태로 전환되며, 사용자가 provider 설정을 입력하고 업로드를 실행하면 모든 업로드 대상 이미지 URL이 output Markdown/frontmatter/manifest/job 결과에 일관되게 반영되도록 한다. 동시에 output 구조는 글 단위 폴더 중심으로 단순화하고, status panel에서 업로드 대상과 진행률을 확인할 수 있어야 한다.

## Non-Goals

- PicGo-Core 밖의 bespoke provider SDK를 직접 병행 지원하지 않는다.
- PicGo plugin 마켓플레이스 UI, uploader discovery UI, plugin 설치 관리 UI를 만들지 않는다.
- background worker, queue, durable secret storage, retry queue를 도입하지 않는다.
- export 이전 preview에서 실제 업로드를 실행하지 않는다.
- parser capability나 sample corpus 자체를 확장하지 않는다.
- commit/push/PR 자동화는 다루지 않는다.

## Constraints

- planning bundle은 source code를 수정하지 않고 `.agents/plans/github-image-upload-phase/` 안의 planner artifacts만 다룬다.
- export request와 job polling 응답에 provider credential을 저장하거나 반영하지 않는다.
- upload credential form은 export options가 아니라 `upload-ready` 이후 status/result flow에만 둔다.
- `download-and-upload` 모드는 export 전에 로컬 다운로드 흐름을 그대로 수행해야 하며, export를 건너뛰고 직접 업로드해서는 안 된다.
- output Markdown 파일명은 항상 `index.md`다.
- 글 폴더 이름에는 현재 slug 규칙을 재사용하되 시간 정보는 들어가지 않는다.
- 카테고리 그룹핑 옵션 default는 `true`다.
- 첫 upload UI는 provider-specific field set이 아니라 `uploaderKey` 문자열과 `uploaderConfigJson` 입력만 제공한다.
- `POST /api/export/:id/upload`는 blind cross-site POST를 막기 위한 명시적 요청 출처 검증을 포함해야 한다.
- `uploaderConfigJson`과 그 파생 비밀값은 logs, test fixtures, smoke evidence, screenshots, error payload에 raw 형태로 남기지 않는다.
- `imageContentMode === base64` 기존 동작은 유지하되, 이 경우 PicGo upload phase는 비활성화한다.
- `download-and-upload` 모드에서는 body image와 thumbnail download를 강제해 업로드 후보가 로컬 파일로 남아야 한다.
- PicGo가 반환한 URL은 rewrite 전에 절대 URL이며 `http` 또는 `https` 스킴인지 검증해야 한다.
- knowledge 문서와 smoke/test surface를 구현과 함께 갱신해야 한다.

## Commands

- shared/export focused tests
  - `pnpm exec vitest run tests/export-options.test.ts tests/http-server.test.ts --silent`
- exporter focused tests
  - `pnpm exec vitest run tests/asset-store.test.ts tests/export-preview.test.ts tests/export-single-post.test.ts tests/markdown-renderer.test.ts tests/naver-blog-exporter.test.ts --silent`
- UI focused tests
  - `pnpm exec vitest run tests/ui/export-options-panel.test.tsx tests/ui/use-export-job.test.tsx tests/ui/app.test.tsx --silent`
- broad project verification
  - `pnpm test:coverage`
  - `pnpm smoke:ui`
  - `pnpm check:full`

## Project Structure

- `src/shared/types.ts`
  - export option, manifest, job state, job item, UI API contract의 source of truth다.
- `src/shared/export-options.ts`
  - defaults, option metadata, validation/coercion을 가진다.
- `src/modules/exporter/export-paths.ts`
  - output 폴더와 Markdown/asset 파일 경로 규칙을 계산한다.
- `src/modules/exporter/asset-store.ts`
  - 이미지 다운로드와 asset record 생성을 담당한다. compression과 upload candidate tagging의 1차 진입점이다.
- `src/modules/exporter/naver-blog-exporter.ts`
  - export lifecycle 전체와 manifest/job item 생산을 담당한다.
- `src/modules/exporter/export-preview.ts`
  - preview/single-post 진단 경로의 contract를 exporter 출력 규칙과 맞춘다.
- `src/modules/converter/markdown-renderer.ts`
  - asset reference를 사용해 Markdown body/frontmatter를 만든다.
- `src/server/job-store.ts`
  - job status, items, progress, manifest를 저장하고 polling API가 반환하는 shape를 만든다.
- `src/server/http-server.ts`
  - `/api/export`, `/api/export-defaults`, job polling endpoint를 제공한다. same-job upload action endpoint도 여기서 추가한다.
- `src/ui/features/options/export-options-panel.tsx`
  - Assets 탭의 옵션 입력과 disable/validation UX를 담당한다.
- `src/ui/features/job-results/job-results-panel.tsx`
  - export 결과 테이블과 status panel을 렌더링한다.
- `src/ui/hooks/use-export-job.ts`
  - polling과 client-side job lifecycle 연계를 담당한다.
- `tests/*`
  - exporter, HTTP API, UI contract의 regression 방지 경로다.
- `.agents/knowledge/product/ui-dashboard-design-system.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/product/domain.md`
  - UI flow, system boundary, output/domain contract의 evergreen 문서다.

## Testing Strategy

- 타입/옵션 계약은 shared focused tests로 먼저 잠근다.
- output 구조와 upload candidate data는 exporter focused tests로 잠근다.
- same-job upload phase와 secret boundary는 HTTP focused tests로 잠근다.
- 옵션 form, upload-ready panel, 진행률 표시, completed 상태는 UI focused tests와 smoke로 잠근다.
- broad verification은 `pnpm test:coverage`와 `pnpm smoke:ui`로 수행하고, 최종 wave에서 `pnpm check:full`까지 올린다.
- upload provider 실동작은 live remote provider dependency를 넣지 않는다. 대신 PicGo service는 test double 또는 mocked upload result로 deterministic하게 검증한다.

## Success Criteria

- Assets 탭에서 사용자는 `다운로드 유지`, `네이버 원본 URL 유지`, `다운로드 후 PicGo 업로드` 중 하나를 선택할 수 있다.
- `네이버 원본 URL 유지`는 export 후 로컬 이미지 파일 없이 원본 URL을 유지한다.
- `다운로드 유지`와 `다운로드 후 PicGo 업로드`는 export 완료 전까지 동일한 로컬 다운로드 결과를 만든다.
- output은 `outputDir/(optional category path)/{post-folder}/index.md` 구조를 사용하고, 같은 `{post-folder}` 안에 관련 자산 파일이 함께 저장된다.
- `download-and-upload`로 export한 job은 로컬 upload candidate가 하나 이상 있을 때만 export 완료 뒤 `upload-ready` 상태가 되고, status panel에 업로드 대상 글 테이블과 실행 UI가 나타난다.
- `download-and-upload`인데 upload candidate가 0개면 job은 `completed`로 끝나고 upload UI는 나타나지 않으며, summary에는 `skipped-no-candidates`가 기록된다.
- 사용자가 status panel의 post-export form에 `uploaderKey`와 `uploaderConfigJson`을 입력해 업로드를 실행하면 job status가 `uploading`을 거쳐 `upload-completed`로 바뀐다.
- 업로드 성공 후 각 글의 Markdown 본문 이미지, frontmatter `thumbnail`, manifest/job item의 `assetPaths`가 PicGo가 반환한 URL로 갱신된다.
- provider credential은 export request, job polling payload, manifest 파일에 남지 않는다.
- upload action은 출처 검증을 통과한 same-origin 요청만 허용되고, evidence/log/error surface에도 raw credential이 남지 않는다.
- 관련 focused tests, `pnpm test:coverage`, `pnpm smoke:ui`, `pnpm check:full`이 통과한다.

## Open Questions

- None

## Work Objectives

- shared option/state contract를 `3 image modes + same-job upload phase + post-folder output`에 맞게 고정한다.
- exporter path/output/manifest 규약을 새 구조로 정렬한다.
- PicGo-Core post-export service를 추가하고 credential을 ephemeral upload action body로 한정한다.
- zero-candidate upload job의 terminal behavior를 `completed + skipped-no-candidates`로 고정한다.
- output rewrite를 통해 Markdown/frontmatter/manifest/job item을 일관되게 갱신한다.
- UI 옵션, upload-ready 실행 UI, status panel progress/table, polling state를 새 계약에 맞게 확장한다.
- upload endpoint의 출처 검증, credential redaction, returned URL validation을 명시적 범위로 포함한다.
- knowledge/test/smoke를 함께 갱신해 adjacent artifact drift를 막는다.
- broad verification이 중간 task에서 빨갛게 유지되지 않도록 focused verification에서 broad verification으로 점진적으로 올린다.

## Verification Strategy

- focused-first 원칙을 쓴다. shared/exporter/server/UI 변경은 각 slice 전용 vitest 명령으로 먼저 잠그고, broad suite는 checkpoint와 final wave에서만 사용한다.
- PicGo upload behavior는 network-less deterministic tests로 검증한다. 성공 시 URL mapping이 재기록되는 path와, upload failure 시 job이 `upload-failed`로 남고 기존 export 산출물이 보존되는 path를 모두 포함한다.
- browser-facing verification은 `pnpm smoke:ui`가 로컬 서버를 띄우고 `http://127.0.0.1:4173`를 데스크톱/모바일 viewport에서 검증하도록 유지한다. ordered scenario에는 `download-and-upload` 옵션 진입, export 완료 상태의 upload-ready panel 확인, status panel에서 placeholder `uploaderKey/configJson`을 입력해 upload action을 제출하는 단계, `uploading` 중간 상태 확인, upload completed 상태의 결과 패널 확인이 포함되어야 한다.
- if a command exits `0` but the expected state is not actually covered, 그 task는 완료가 아니다. 예를 들어 smoke가 통과해도 upload-ready panel selector가 시나리오에 포함되지 않았다면 bundle을 planner로 되돌려 same-turn repair를 해야 한다.
- `pnpm check:full`은 마지막 wave 전용이다. earlier task들은 이 명령이 아직 불필요하게 깨지지 않도록 focused test와 smaller suite를 쓴다.

## Execution Strategy

- 먼저 shared contract를 고정해 export option, job state, manifest shape를 바꿀 준비를 한다.
- 그다음 output path refactor와 asset/compression/upload candidate data를 exporter에 먼저 넣는다. 이 단계가 끝나야 server/UI가 의존할 최종 데이터 shape가 생긴다.
- 이후 PicGo upload phase service와 same-job HTTP lifecycle을 붙이고, output rewrite를 연결한다.
- 마지막에 UI 옵션과 status panel을 새 job state에 맞게 갱신한다.
- knowledge와 smoke는 UI contract가 굳은 뒤에 반영하고, 마지막 verification wave에서 전체 suite를 올린다.
- risky surface는 secret leakage, request-origin abuse, same-job status transition, output rewrite consistency다. 이 네 surface는 각 checkpoint에서 따로 다시 본다.

## Parallel Waves

- Wave 1: `T1`
  - shared option/state contract를 고정한다. downstream 모든 task의 prerequisite다.
- Wave 2: `T2`, `T3`
  - 둘 다 exporter surface이지만 `T2`가 path/output ground truth를 만들고, `T3`가 그 위에서 asset/compression/candidate contract를 채우므로 serial로 간다.
- Wave 3: `CP1`
  - shared/exporter 계약이 UI/API 구현을 받을 준비가 되었는지 검사한다.
- Wave 4: `T4`, `T5`
  - PicGo upload service와 output rewrite는 strongly coupled이고 같은 write surface를 공유하므로 serial로 간다.
- Wave 5: `T6`, `T7`
  - UI option form과 results panel/hook은 같은 React surface를 공유하므로 serial로 간다.
- Wave 6: `CP2`
  - same-job lifecycle, secret boundary, user-visible flow를 다시 맞춘다.
- Wave 7: `T8`, `T9`
  - docs/smoke 갱신 후 final verification wave를 수행한다.

## Artifact Graph

- `T1`
  - `requires`: None
  - `unlocks`: `T2`, `T3`, `T4`, `T6`
  - `blocked_by`: None
  - `ready_when`: shared option/status naming, validation, defaults, dependency surface가 고정되어 있다.
- `T2`
  - `requires`: `T1`
  - `unlocks`: `T3`, `T5`
  - `blocked_by`: `T1`
  - `ready_when`: 새 post-folder path contract가 확정되었다.
- `T3`
  - `requires`: `T1`, `T2`
  - `unlocks`: `CP1`, `T4`, `T5`
  - `blocked_by`: `T1`, `T2`
  - `ready_when`: exporter가 compression, download/remote/upload-prep 모드, manifest candidate metadata를 생산한다.
- `CP1`
  - `requires`: `T2`, `T3`
  - `unlocks`: `T4`, `T5`
  - `blocked_by`: `T2`, `T3`
  - `ready_when`: shared/exporter focused tests가 통과하고 diff surface가 계획 범위를 벗어나지 않는다.
- `T4`
  - `requires`: `CP1`
  - `unlocks`: `T5`, `T6`, `T7`
  - `blocked_by`: `CP1`
  - `ready_when`: upload-ready job state, zero-candidate terminal handling, request-origin guard, ephemeral credential boundary를 server/job layer에 추가할 수 있다.
- `T5`
  - `requires`: `T4`
  - `unlocks`: `T7`, `CP2`
  - `blocked_by`: `T4`
  - `ready_when`: PicGo upload result를 output rewrite와 manifest/job item 치환에 연결할 수 있다.
- `T6`
  - `requires`: `T1`, `T4`
  - `unlocks`: `T7`, `CP2`
  - `blocked_by`: `T1`, `T4`
  - `ready_when`: UI가 새 option model과 upload action endpoint를 호출할 수 있다.
- `T7`
  - `requires`: `T5`, `T6`
  - `unlocks`: `CP2`
  - `blocked_by`: `T5`, `T6`
  - `ready_when`: job polling payload가 upload-ready/uploading/upload-completed 상태를 충분히 표현한다.
- `CP2`
  - `requires`: `T5`, `T6`, `T7`
  - `unlocks`: `T8`, `T9`
  - `blocked_by`: `T5`, `T6`, `T7`
  - `ready_when`: exporter/server/UI focused verification이 모두 통과하고 same-job flow가 end-to-end로 설명 가능하다.
- `T8`
  - `requires`: `CP2`
  - `unlocks`: `T9`
  - `blocked_by`: `CP2`
  - `ready_when`: knowledge docs와 smoke scenario를 live contract에 맞게 갱신할 수 있다.
- `T9`
  - `requires`: `T8`
  - `unlocks`: bundle completion
  - `blocked_by`: `T8`
  - `ready_when`: code, docs, smoke, tests가 모두 final verification을 받을 준비가 되었다.

## Checkpoint Plan

- `CP1` after `T2` and `T3`
  - 확인 대상: shared naming drift, path/output contract drift, asset candidate metadata completeness, focused exporter tests pass 여부
  - stop-and-return 조건: output path가 여전히 `posts/`/`assets/` split을 남기거나, upload candidate data가 manifest/job layer에 충분하지 않을 때
- `CP2` after `T5`, `T6`, and `T7`
  - 확인 대상: same-job status naming, zero-candidate behavior, upload-ready UX visibility, request-origin guard, secret leakage boundary, rewrite consistency
  - stop-and-return 조건: provider config가 polling payload나 evidence로 새거나, cross-site style request가 upload endpoint를 통과하거나, upload completed 뒤 일부 표면만 URL이 바뀌는 경우

## Final Verification Wave

- run focused regression commands one more time
  - `pnpm exec vitest run tests/export-options.test.ts tests/http-server.test.ts tests/asset-store.test.ts tests/export-preview.test.ts tests/export-single-post.test.ts tests/markdown-renderer.test.ts tests/naver-blog-exporter.test.ts tests/ui/export-options-panel.test.tsx tests/ui/use-export-job.test.tsx tests/ui/app.test.tsx --silent`
- run broad suite
  - `pnpm test:coverage`
- run browser smoke
  - setup command: `pnpm smoke:ui`
  - target URL: `http://127.0.0.1:4173`
  - viewport: smoke harness desktop/mobile pair
  - ordered scenario: export options에서 `download-and-upload` 모드와 compression/groupByCategory 제약을 확인한다. mocked export completion payload를 `upload-ready`로 만들어 status panel의 업로드 대상 테이블과 post-export credential form을 확인한다. placeholder config 값을 입력하고 upload execute action을 눌러 `uploading` 중간 상태를 확인한다. 이어서 mocked upload completion payload를 넣어 URL 치환된 결과 행과 완료 상태를 확인한다. 모바일 viewport에서는 upload target table이 같은 status panel 안에서 가로 overflow 없이 유지되는지도 확인한다.
  - success signal: command exit code `0`, harness가 upload-ready -> uploading -> upload-completed 시나리오를 실제로 수행한다, desktop/mobile evidence 경로가 생성된다, evidence에 raw credential이 남지 않는다.
- run repo-native broad gate
  - `pnpm check:full`
- final acceptance는 provider credential이 polling payload와 manifest에 남지 않고, new folder structure가 diagnostics/manifest/UI result table에 일관되게 반영되는 것이다.

## Sync/Reconcile Rules

- executor는 `plan.md`를 수정하지 않는다.
- executor가 변경할 수 있는 planner bundle 파일은 `notes.md`, `evidence/`, `tasks.md`의 top status board와 각 task의 `Status`/`Evidence`뿐이다.
- 실행 중 task definition이 stale하다고 드러나면 같은 bundle path를 planner에게 같은 턴에 되돌리고, stale reason을 `notes.md`에 append한 뒤 reconciliation을 다시 한다.
- adjacent artifact rule:
  - shared contract를 바꾸면 `src/shared/*`, HTTP API payload, UI tests가 같이 맞아야 한다.
  - output structure를 바꾸면 `export-preview`, `single-post-export`, `manifest`, smoke/UI result 표현이 같이 맞아야 한다.
  - UI contract를 바꾸면 `.agents/knowledge/product/ui-dashboard-design-system.md`와 smoke 시나리오가 같이 갱신되어야 한다.
- evidence는 항상 bundle-relative path를 쓴다. 예: `evidence/cp1-exporter.txt`.
- 각 task 상태 변경 후 executor는 `tasks.md`를 다시 읽고 다음 ready task가 있으면 같은 턴에 계속 진행한다.
