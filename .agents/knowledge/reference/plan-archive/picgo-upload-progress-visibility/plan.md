# PicGo Upload Progress Visibility

## TL;DR

기존 PicGo upload flow 위에 수집/업로드 progress bar, 글 단위 부분 완료 표시, 업로드 테이블 `max-height`를 얹는다. 핵심 경로는 `image-upload-phase -> http-server/job-store -> upload panel -> smoke/live upload harness`이며, 최종 완료는 계속 rewrite 완료 뒤에만 인정한다. 최종 검증은 `pnpm check:full`과 `pnpm test:network:upload`를 함께 통과해야 닫힌다.

## Context

- 원요청은 “PicGo upload에서 실제 GitHub 커밋은 먼저 생기는데 UI에서 부분 완료를 관찰할 수 없고, 수집/업로드 진행률과 업로드 테이블 가시성도 부족하다”는 후속 개선이다.
- planning session 시작 시 subagent 사용 승인을 받았고, quick local sweep 뒤 필수 explore lens `Implementation Surface`, `Verification Surface`를 실행했다. 추가로 `Partial State` lens를 실행해 기존 bundle 재사용 가능성도 확인했다.
- explore 결과 핵심 사실:
- export 단계는 이미 `src/modules/exporter/naver-blog-exporter.ts`에서 글 단위 `onProgress`, `onItem`을 호출해 증분 갱신을 한다.
- upload 단계는 `src/server/http-server.ts`에서 `startUpload -> runPicGoUploadPhase -> rewriteUploadedAssets -> completeUpload`만 묶고 중간 증분 갱신이 없다.
- `src/server/job-store.ts`에는 `updateUpload()`가 이미 있지만 실제 upload 경로에서 호출되지 않는다.
- `src/modules/exporter/image-upload-phase.ts`는 PicGo에 파일 배열 전체를 한 번 넘기고 최종 결과 배열을 마지막에만 받는다.
- `src/ui/features/job-results/use-export-job.ts`는 이미 1초 polling을 하고 있어 transport 추가 없이도 서버 state만 자주 갱신하면 UI가 따라온다.
- `src/ui/features/job-results/job-results-panel.tsx`는 업로드 패널과 대상 테이블을 이미 갖고 있지만 progress bar가 없고, 행 상태도 전역 job 상태만 따라간다.
- 같은 파일의 결과 리스트는 `ScrollArea + max-h` 패턴을 이미 쓰고 있어 업로드 테이블에 같은 house pattern을 재사용할 수 있다.
- `.agents/knowledge/DESIGN.md`와 현재 UI 구현은 upload form이 `upload-ready`, `upload-failed`에서만 보이고 `uploading`, `upload-completed`에서는 숨는 계약을 이미 갖고 있다. 이번 bundle은 그 기존 동작을 보존하고 regression으로 고정한다.
- `scripts/harness/run-ui-smoke.ts`는 mocked upload flow를, `scripts/harness/run-ui-live-upload.ts`는 실제 GitHub upload를 이미 검증하지만 둘 다 “중간 진행률이 올라가는가”는 강하게 고정하지 않는다.
- 인터뷰가 필요했던 user-visible choice는 다음 네 가지였고, 모두 사용자 답변으로 닫혔다.
- 수집 progress bar는 글 기준 `처리한 글 수 / 전체 글 수`
- 업로드 progress bar는 자산 기준 `업로드된 자산 수 / 전체 대상 자산 수`
- 업로드 테이블 행 상태는 글 기준 `대기 / 부분 완료 / 완료 / 실패`
- GitHub 커밋이 먼저 생겨도 UI 최종 `완료`는 rewrite까지 끝난 뒤만 표시
- semantic review 중 다시 열린 row-state choice도 사용자 답변으로 닫혔다.
- rewrite가 실패한 job에서는 자산 업로드가 이미 끝난 글이어도 행 상태를 `완료`로 올리지 않고 `실패`로 표시한다.
- 이 요청은 open-ended UI/상태 계약 변경을 포함했기 때문에 인터뷰가 필요했고, 위 답변을 받은 뒤에만 detailed bundle drafting으로 들어간다.
- Phase 4 deterministic validation에서는 `plan.md` headings, `tasks.md` full schema, status board consistency, artifact graph alignment, checkpoint diff surface, browser verification structure, evidence path formatting, verification ordering을 점검한다.
- Phase 5 semantic review에서는 최소 `Execution - Hidden Decision & Contradiction`, `Verification - Scenario Completeness`를 실행하고, 이 bundle은 shared server/UI/live harness를 함께 건드리므로 `Change-Risk`, `Frontend`를 추가한다.

## Goal

사용자가 export와 PicGo upload를 실행할 때, 실행 단계와 업로드 단계 모두에서 전체 대비 진행률을 bar로 볼 수 있고, upload 중에는 글 단위 `대기 / 부분 완료 / 완료 / 실패` 상태를 같은 패널에서 관찰할 수 있어야 한다. 동시에 GitHub에 일부 자산이 먼저 반영되는 실제 상황이 job polling과 UI에 중간 집계로 드러나야 하며, 업로드 대상 테이블은 많은 항목에서도 패널 높이를 무너뜨리지 않도록 내부 스크롤을 가져야 한다.

## Non-Goals

- 새로운 uploader provider 추가
- websocket, SSE, background worker, queue 도입
- `upload-completed` 외에 별도 최종 상태명을 추가하는 대규모 상태 모델 확장
- export/scan 기능 자체의 범위 확장
- parser, renderer, frontmatter 스키마 개편
- commit/push/PR 생성

## Constraints

- 최종 `완료`는 계속 rewrite 성공 뒤에만 표시한다.
- GitHub 쪽 반영이 먼저 일어나더라도 job status를 성공으로 승격시키지 않는다.
- 중간 진행률은 같은 `/api/export/:id` polling payload에만 실어야 하며 새 transport를 추가하지 않는다.
- upload 진행률 기준은 고유 업로드 대상 자산 수다. 글 수가 아니다.
- 수집 진행률 기준은 처리한 글 수다. scan 카운트가 아니다.
- 업로드 테이블 행 상태는 글 기준 네 상태 `대기 / 부분 완료 / 완료 / 실패`만 사용한다.
- rewrite 실패가 난 job에서는 해당 글의 업로드 자산 수와 무관하게 행 상태를 `실패`로 표시한다.
- 업로드 대상 테이블은 기존 결과 리스트와 같은 `ScrollArea + max-h` house pattern을 재사용한다.
- UI 변경 검증은 먼저 `agent-browser`로 실제 화면을 보고, 반복 회귀는 `pnpm smoke:ui`와 `pnpm test:network:upload`로 고정한다.
- 실제 GitHub upload 관찰 버그이므로 최종 닫힘에는 `pnpm test:network:upload` evidence가 필요하다. 필요한 env가 없으면 완료로 닫지 않는다.
- live upload 검증 branch는 항상 `master`로 고정한다. 별도 branch env는 쓰지 않고, 모든 same-branch evidence와 cleanup 판단도 `master` 기준으로 남긴다.

## Commands

- `pnpm exec vitest run tests/image-upload-phase.test.ts --silent`
- `pnpm exec vitest run tests/http-server.test.ts --silent`
- `pnpm exec vitest run tests/ui/app.test.tsx --silent`
- `pnpm check:local`
- `pnpm smoke:ui`
- `pnpm check:full`
- `pnpm test:network:upload`
- `pnpm dev`

## Project Structure

- `src/modules/exporter/image-upload-phase.ts`
  - PicGo upload 실행 surface. 현재 batch 호출만 하므로 중간 progress를 만들려면 여기부터 바뀐다.
- `src/modules/exporter/image-upload-rewriter.ts`
  - upload 결과를 Markdown/manifest/item에 반영하는 후처리 surface. 최종 완료 경계가 여기와 붙어 있다.
- `src/server/http-server.ts`
  - upload same-job orchestration, polling API, progress update 결합 지점
- `src/server/job-store.ts`
  - upload 중간 집계와 item-level count를 보관하는 상태 저장소
- `src/ui/features/job-results/use-export-job.ts`
  - `/api/export/:id` polling loop
- `src/ui/features/job-results/job-results-panel.tsx`
  - 실행/업로드/결과 패널, progress bar, upload table, row status surface
- `src/ui/components/ui/scroll-area.tsx`
  - 업로드 테이블 max-height에 재사용할 기존 scroll container
- `src/ui/App.tsx`
  - panel step 전환과 top summary progress surface
- `tests/http-server.test.ts`
  - same-job upload lifecycle와 rewrite boundary regression surface
- `tests/ui/app.test.tsx`
  - 진행률 bar, 부분 완료 row, max-height layout을 사용자 화면 기준으로 고정할 주요 UI test surface
- `scripts/harness/run-ui-smoke.ts`
  - mocked browser regression
- `scripts/harness/run-ui-live-upload.ts`
  - 실제 GitHub upload와 UI polling 관찰 regression
- `.agents/knowledge/product/domain.md`
  - upload 진행률과 완료 경계의 evergreen 제품 계약
- `.agents/knowledge/DESIGN.md`
  - upload table overflow와 progress UI 규약

## Testing Strategy

- PicGo runner의 증분 progress는 focused unit test로 먼저 잠근다.
- same-job upload lifecycle과 rewrite 경계는 HTTP focused test로 잠근다.
- 실행/업로드 progress bar, row status, max-height는 App-level UI test와 `agent-browser` 탐색으로 먼저 확인한다.
- 반복 브라우저 회귀는 `pnpm smoke:ui`에 mocked 중간 progress/overflow 시나리오를 추가해 고정한다.
- 실제 GitHub 반영과 UI polling 관찰은 `pnpm test:network:upload`에서만 닫는다.
- broad regression은 마지막 wave에서 `pnpm check:full`로 묶는다.

## Success Criteria

- 실행 단계에 글 기준 progress bar가 보이고 `처리한 글 수 / 전체 글 수`를 정확히 반영한다.
- 업로드 단계에 자산 기준 progress bar가 보이고 `업로드된 자산 수 / 전체 대상 자산 수`를 정확히 반영한다.
- upload 중 job polling payload에서 `uploadedCount`가 증분 갱신되고, UI는 polling만으로 그 변화를 따라간다.
- 업로드 대상 표의 각 글 행이 `대기 / 부분 완료 / 완료 / 실패`를 현재 단계 계약에 맞게 표시한다. 단, `upload-failed` job에서는 item-level count와 무관하게 모든 행을 `실패`로 표시한다.
- GitHub에 일부 자산이 먼저 반영되어도 job status는 rewrite 완료 전까지 `upload-completed`로 올라가지 않는다.
- rewrite 실패가 나더라도 이미 업로드된 자산 수는 관찰 가능한 상태로 남고, 상태는 `upload-failed`로 유지된다.
- 업로드 대상 표는 `max-height`와 내부 스크롤을 가져 긴 목록에서도 패널 높이를 무너뜨리지 않는다.
- `pnpm smoke:ui`가 progress bar, 부분 완료 row, table overflow를 mocked 시나리오로 검증한다.
- `pnpm test:network:upload`가 실제 GitHub upload 중간에 “GitHub 쪽 partial upload evidence가 이미 존재하는 동안 UI는 아직 `uploading`이고 `uploadedCount > 0` 또는 `부분 완료`를 보여준다”는 증거를 남긴다.
- `pnpm check:full`과 `pnpm test:network:upload`가 통과한다.

## Open Questions

- None

## Work Objectives

- PicGo upload execution을 증분 progress를 낼 수 있는 방식으로 바꾼다.
- same-job upload state가 item/job 양쪽에서 부분 완료를 보관하도록 만든다.
- rewrite 완료를 최종 성공 경계로 유지하면서도 실제 업로드된 수치는 감추지 않는다.
- 실행 단계와 업로드 단계에 각각 맞는 progress bar를 추가한다.
- upload table에 글 단위 부분 완료 상태와 `max-height` 스크롤을 적용한다.
- mocked smoke와 live upload harness가 모두 중간 progress를 검증하게 만든다.
- knowledge 문서를 새로운 진행률/overflow 계약과 맞춘다.

## Verification Strategy

- focused-first 원칙을 쓴다. runner, server, UI를 각각 focused test로 잠근 뒤 broad suite와 browser harness로 올린다.
- UI task에서는 먼저 `pnpm dev`로 앱을 띄우고 `agent-browser`로 `http://127.0.0.1:4173`를 확인한다. desktop viewport는 `1440x1200`, mobile viewport는 `375x812`를 쓴다.
- 실행 단계 browser scenario는 `scan -> export start -> running panel`까지 가서 bar가 `completed / total` 비율에 맞게 움직이는지 본다.
- 업로드 단계 browser scenario는 `upload-ready -> upload start -> uploading -> upload-failed or upload-completed` 흐름에서 bar, row status, table scroll을 본다.
- `pnpm smoke:ui`는 mocked payload로 `uploadedCount`가 증가하는 중간 상태, full bar but rewrite pending 상태, failure/retry, mobile overflow를 증명해야 한다.
- `pnpm test:network:upload`는 실제 GitHub upload에서 `master` branch head or repo tree evidence뿐 아니라, upload 중간에 UI의 `uploadedCount > 0 && status === uploading` 또는 동등한 partial-progress evidence를 남겨야 한다.
- live upload env(`FAREWELL_UPLOAD_E2E=1`, GitHub token)가 없으면 final wave는 stop-and-return이다. 이 버그는 real provider evidence 없이 닫지 않는다.
- 어떤 명령이 exit code `0`이어도 claimed scenario가 실제로 실행되지 않았으면 task는 완료가 아니다.

## Execution Strategy

- 먼저 PicGo runner에서 asset-by-asset progress를 만들고, 그 결과를 server/job store가 polling payload로 흘리게 한다.
- 그다음 UI에서 기존 upload panel을 확장해 progress bar, row status, table max-height를 붙인다. transport는 그대로 두고 state 소비만 바꾼다.
- server/UI focused verification이 지나간 뒤 mocked smoke와 live upload harness를 보강한다.
- 마지막에 knowledge sync와 broad verification으로 adjacent artifact drift를 닫는다.
- 가장 큰 리스크는 세 가지다.
- PicGo runner를 순차 실행으로 바꾸면서 결과 순서나 dedupe 보장이 깨질 수 있다.
- rewrite 실패에서 uploadedCount를 너무 일찍 0으로 되돌리면 사용자 문제를 다시 숨긴다.
- full progress bar와 final success를 혼동시키는 UI 카피가 생기면 요구 4와 모순된다.
- live upload가 공유 branch를 오염시키면 재시도와 증거 추적이 꼬인다.

## Parallel Waves

- Wave 1: `T1`, `T2`
  - 둘 다 upload execution/server state surface지만 `T1`이 progress source를 만들고 `T2`가 same-job state에 연결하므로 serial이다.
- Wave 2: `T3`
  - UI는 `T2`에서 polling payload contract가 고정된 뒤에만 착수한다.
- Wave 3: `CP1`
  - server/UI focused regression을 한 번 묶어 검증한다.
- Wave 4: `T4`, `T5`
  - harness와 knowledge는 서로 다른 write surface지만 둘 다 `CP1` 뒤 확정된 UX contract와 `master` live branch policy를 따라가야 하므로 serial로 둔다.
- Wave 5: `CP2`
  - mocked regression과 docs drift를 함께 재점검한다.
- Wave 6: `T6`
  - broad + live verification final wave

## Artifact Graph

- `T1`
  - `requires`: None
  - `unlocks`: `T2`
  - `blocked_by`: None
  - `ready_when`: PicGo runner가 asset-by-asset progress source를 낼 수 있다.
- `T2`
  - `requires`: `T1`
  - `unlocks`: `T3`, `CP1`
  - `blocked_by`: `T1`
  - `ready_when`: upload orchestration이 item/job 양쪽에 증분 count를 반영한다.
- `T3`
  - `requires`: `T2`
  - `unlocks`: `CP1`
  - `blocked_by`: `T2`
  - `ready_when`: UI가 progress bar, row status, table max-height를 현재 polling payload로 렌더링할 수 있다.
- `CP1`
  - `requires`: `T2`, `T3`
  - `unlocks`: `T4`, `T5`
  - `blocked_by`: `T2`, `T3`
  - `ready_when`: focused server/UI regressions가 통과하고 user-visible contract가 고정됐다.
- `T4`
  - `requires`: `CP1`
  - `unlocks`: `CP2`, `T6`
  - `blocked_by`: `CP1`
  - `ready_when`: mocked smoke와 live upload harness가 새 progress contract와 `master` branch policy를 검증할 수 있다.
- `T5`
  - `requires`: `CP1`
  - `unlocks`: `CP2`, `T6`
  - `blocked_by`: `CP1`
  - `ready_when`: knowledge/runbook이 새 progress/overflow contract를 설명한다.
- `CP2`
  - `requires`: `T4`, `T5`
  - `unlocks`: `T6`
  - `blocked_by`: `T4`, `T5`
  - `ready_when`: browser regression과 docs sync가 함께 맞는다.
- `T6`
  - `requires`: `CP2`
  - `unlocks`: None
  - `blocked_by`: `CP2`
  - `ready_when`: broad suite와 `master` branch 기반 real upload evidence를 올릴 조건이 갖춰졌다.

## Checkpoint Plan

- `CP1`: `T2`, `T3` 뒤 server/UI focused regression을 묶어 partial progress가 실제 polling payload와 panel에 모두 반영되는지 확인한다.
- `CP2`: `T4`, `T5` 뒤 mocked smoke, live harness contract, knowledge sync가 같은 UX를 설명하는지 확인한다.

## Final Verification Wave

- `T6`에서 `pnpm check:full`을 먼저 실행해 broad regression을 확인한다.
- 이어서 `pnpm test:network:upload`를 실행해 real GitHub upload 중간 progress evidence를 확보한다.
- final evidence는 최소 다음을 포함해야 한다.
- upload 중 `job.status === uploading`
- `job.upload.uploadedCount > 0`
- upload table에 `부분 완료` 또는 동등한 partial row signal 노출
- 같은 시점의 GitHub branch head 변화 또는 repo tree evidence
- `upload-failed` override를 검증할 때는 partial row signal 대신 모든 행 `실패`가 기대값이다.
- 최종 `upload-completed`는 rewrite 뒤에만 도달

## Sync/Reconcile Rules

- executor는 execution 중 `plan.md`를 바꾸지 않는다.
- planner-owned task definitions가 stale해지면 같은 bundle을 planner로 되돌려 same-turn reconciliation을 먼저 한다.
- evidence는 항상 bundle-relative path만 사용한다.
- live upload env가 없으면 `T4`/`T6`은 닫지 않고 stop-and-return로 남긴다.
- live upload evidence에는 branch명, before/after SHA, partial-progress capture 여부, cleanup or preservation 판단을 함께 남긴다.
- docs와 smoke는 code contract가 고정된 뒤에만 수정한다. code보다 먼저 새 UX를 문서화하지 않는다.
