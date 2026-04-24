# PicGo Upload Progress Visibility

This file is the only live progress record for this bundle.

## Status Board

- `Doing`: None
- `Ready Now`: None
- `Blocked`: None
- `Todo`: None
- `Done`: T1 - Make PicGo upload execution emit asset-by-asset progress; T2 - Wire incremental upload counts into same-job polling state; T3 - Add running/upload progress bars and upload table overflow handling; CP1 - Re-check server/UI partial-progress contract; T4 - Extend mocked and live browser harnesses for partial-progress evidence; T5 - Sync evergreen docs with the new progress contract; CP2 - Re-check browser regression and doc alignment; T6 - Run the broad and live final verification wave

## Tasks

### T1 - Make PicGo upload execution emit asset-by-asset progress
- `ID`: T1
- `Slice`: Upload Runner
- `Status`: Done
- `Depends On`: None
- `Start When`: The bundle is approved and `src/modules/exporter/image-upload-phase.ts` still uploads all candidates in one batch without any intermediate callback.
- `Files`: primary: `src/modules/exporter/image-upload-phase.ts`, `tests/image-upload-phase.test.ts`; generated/incidental: N/A
- `Context`: The UI already polls once per second. The missing piece is an upload runner that can report completed asset counts before the whole PicGo call and rewrite phase finish.
- `Produces`: A PicGo upload runner that emits deterministic per-asset progress updates while preserving candidate dedupe, URL validation, and final result ordering.
- `Must Do`: Keep dedupe by `localPath`. Emit progress on completed asset count after each asset upload succeeds. Preserve the original candidate-to-result mapping and keep absolute HTTP(S) URL validation intact. If PicGo does not expose per-file callbacks, switch the runner to deterministic one-candidate-at-a-time calls instead of inventing fake progress.
- `Must Not Do`: Do not mark the job completed here. Do not rewrite Markdown or manifest in this task. Do not add a new transport or background worker.
- `Implementation Notes`: The expected direction is to change `runPicGoUploadPhase` so it can report `{ total, uploadedCount, lastCompletedLocalPath }` or an equivalent internal callback after each successful asset upload. A failure after partial success must still surface the already uploaded count to the caller instead of collapsing it back to zero. The callback shape can stay module-local if shared types are otherwise unnecessary.
- `Verification Strategy`: Run `pnpm exec vitest run tests/image-upload-phase.test.ts --silent`. Success signal is exit code `0` and the test proves deduped assets upload in a deterministic order with monotonic progress callbacks from `0` up to `candidateCount`. If the command exits `0` but the runner still performs one opaque batch call with no observable partial progress, treat the task as incomplete, record the stale state, and return the same bundle for repair.
- `Acceptance Criteria`: The upload runner can report real asset-by-asset progress before rewrite begins, without losing dedupe or URL validation guarantees.
- `Definition of Done`: Focused runner test passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms the new state.
- `Evidence`: evidence/t1-picgo-progress-runner.txt
- `Reopen When`: A later task needs fake progress, loses dedupe guarantees, or can no longer tell how many assets were truly uploaded before an error.
- `Size`: M

### T2 - Wire incremental upload counts into same-job polling state
- `ID`: T2
- `Slice`: Server Upload Lifecycle
- `Status`: Done
- `Depends On`: T1
- `Start When`: T1 is `Done` and the upload orchestration still changes job state only at `startUpload`, `completeUpload`, or `failUpload`.
- `Files`: primary: `src/server/http-server.ts`, `src/server/job-store.ts`, `src/modules/exporter/image-upload-rewriter.ts`, `tests/http-server.test.ts`; generated/incidental: N/A
- `Context`: Real progress is only useful if the same job polling payload exposes it while upload is still running and preserves it across rewrite failure.
- `Produces`: Incremental `job.upload` and `item.upload` count updates during upload, explicit rewrite boundary handling, and regression tests for partial-progress polling.
- `Must Do`: Call the runner progress callback from `http-server` and persist it through `jobStore.updateUpload`. Update affected job items so per-post uploaded counts move as assets complete. Keep `upload-completed` reserved for rewrite success. Preserve nonzero uploaded counts when rewrite fails after some or all assets were already uploaded. Add log messages that separate “upload still running” from “uploaded, now rewriting” so the UI can explain a full bar without a final success state.
- `Must Not Do`: Do not introduce new public terminal statuses. Do not reset partial counts to zero on failure. Do not bypass `rewriteUploadedAssets`.
- `Implementation Notes`: Use the existing job item `upload.uploadedCount` and job upload summary fields instead of adding a second progress model. Derive per-post increments by matching `lastCompletedLocalPath` back to each item's candidate list. During the rewrite window, keep the job in `uploading` while counts may already equal `candidateCount`; the final success transition still belongs to `completeUpload`. Update the existing rewrite-failure regression to prove counts stay observable even when status becomes `upload-failed`.
- `Verification Strategy`: Run `pnpm exec vitest run tests/http-server.test.ts --silent`. Success signal is exit code `0` and the test suite proves polling can observe nonzero `uploadedCount` while `status === "uploading"` and preserves those counts if rewrite later fails. If the command exits `0` but intermediate polling never shows partial progress, or rewrite failure still zeroes already uploaded counts, treat the task as incomplete and return the bundle for repair.
- `Acceptance Criteria`: The same job polling payload exposes true partial upload progress, and final success is still gated on rewrite completion.
- `Definition of Done`: Server lifecycle test passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t2-server-upload-progress.txt
- `Reopen When`: A later change hides partial upload counts again, marks final success before rewrite, or collapses rewrite-failure counts back to zero.
- `Size`: M

### T3 - Add running/upload progress bars and upload table overflow handling
- `ID`: T3
- `Slice`: Upload Progress UI
- `Status`: Done
- `Depends On`: T2
- `Start When`: T2 is `Done` and the upload panel still lacks progress bars, per-post partial status, or a scroll-bounded upload table.
- `Files`: primary: `src/ui/components/ui/progress.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `tests/ui/app.test.tsx`; generated/incidental: N/A
- `Context`: Once polling exposes partial counts, the running and upload panels need a user-readable visualization and the upload table needs a bounded layout.
- `Produces`: Reusable progress component usage in the running/upload panels, per-post row status rendering, and `max-height` + internal scroll behavior for the upload table.
- `Must Do`: Show a running-stage bar using `job.progress.completed / job.progress.total`. Show an upload-stage bar using `job.upload.uploadedCount / job.upload.candidateCount`. Render row status from each item's upload counts as `대기 / 부분 완료 / 완료 / 실패` instead of mirroring the whole job status. In `upload-failed`, every row label becomes `실패` regardless of completed asset count. Reuse the existing `ScrollArea` pattern or an equivalent bounded scroll wrapper for the upload table. Make the panel copy distinguish a full bar during rewrite from final success. Add fixed verification hooks for both bars, the upload-table scroll wrapper, and row statuses so `agent-browser`, `tests/ui/app.test.tsx`, and Playwright harnesses can all target the same signals.
- `Must Not Do`: Do not add a second upload form location. Do not introduce a page-level overflow regression. Do not show `완료` as the job-level final state before rewrite actually finishes.
- `Implementation Notes`: Prefer deriving bar percentages and row labels from existing counts. Add stable hooks such as `#running-progress`, `#upload-progress`, `#upload-targets-scroll`, and row-level status attributes or IDs that encode the four row states without leaking implementation detail. The upload form visibility contract must stay explicit: visible only in `upload-ready` and `upload-failed`, hidden in `uploading` and `upload-completed`. Use the existing result-table `ScrollArea + max-h` pattern as the visual baseline for the upload table.
- `Verification Strategy`: 1. Start `pnpm dev`. 2. Open `http://127.0.0.1:4173` with `agent-browser`. 3. Set viewport `1440x1200`. 4. Drive the mocked flow to `running` and confirm `#running-progress` exists and moves with `completed / total`. 5. Drive the upload flow through `upload-ready`, `uploading`, `upload-failed`, and `upload-completed`, and confirm `#upload-progress`, row status hooks, and `#upload-targets-scroll` behave as planned, including form visibility only in `upload-ready` and `upload-failed`. 6. Explicitly verify the intermediate state `uploadedCount === candidateCount && status === "uploading"` still shows rewrite-pending copy rather than final success. 7. Repeat the bounded upload-table overflow check at `375x812`. 8. Run `pnpm exec vitest run tests/ui/app.test.tsx --silent`. Success signal is browser confirmation plus exit code `0`. If the command exits `0` but the browser pass still shows no bar, missing hooks, wrong form visibility, missing rewrite-pending distinction, or an unbounded upload table, treat the task as incomplete and return the bundle for repair.
- `Acceptance Criteria`: Users can read running/upload progress at a glance, see which posts are partially uploaded, and keep the upload panel usable with long target lists. If the job is `upload-failed`, every upload row shows `실패`.
- `Definition of Done`: Browser verification and focused UI test pass, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t3-upload-progress-ui.txt
- `Reopen When`: A later change removes the bars, collapses row status back to job-wide badges, or lets the upload table grow without a height cap.
- `Size`: M

### CP1 - Re-check server/UI partial-progress contract
- `ID`: CP1
- `Slice`: Focused Contract Checkpoint
- `Status`: Done
- `Depends On`: T2, T3
- `Start When`: T2 and T3 are `Done` and the server polling contract plus upload panel UX are both in place.
- `Files`: primary: `src/modules/exporter/image-upload-phase.ts`, `src/server/http-server.ts`, `src/server/job-store.ts`, `src/modules/exporter/image-upload-rewriter.ts`, `src/ui/components/ui/progress.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `tests/image-upload-phase.test.ts`, `tests/http-server.test.ts`, `tests/ui/app.test.tsx`; generated/incidental: N/A
- `Context`: Before changing harnesses or docs, the focused execution and UI contract must be stable and internally consistent.
- `Produces`: A checkpoint proving the partial-progress data path and upload panel contract are ready to freeze into harnesses and docs.
- `Must Do`: Re-run the focused tests that own the new contract. Manually inspect the diff surface for any stale `uploadedCount === 0 on rewrite failure` assumptions, missing `부분 완료` text, or upload table wrapper regressions.
- `Must Not Do`: Do not add new feature work in the checkpoint. Do not defer a contract contradiction to the final wave.
- `Implementation Notes`: The main failure modes here are opaque batch upload still surviving under the hood, counts updating only at the end, full upload bars being mislabeled as final completion, or the max-height wrapper existing in code but not actually bounding the table.
- `Verification Strategy`: Run `pnpm check:local`. Success signal is exit code `0`, the focused tests from `T1` to `T3` stay green inside that suite, and manual diff inspection confirms the new upload progress contract exists on both server and UI surfaces. If the command exits `0` but the diff still lacks a real partial-progress path or bounded upload table, keep the task incomplete and return the bundle for repair.
- `Acceptance Criteria`: The focused code path from PicGo upload through polling to panel rendering is coherent enough to lock into smoke, live harness, and docs.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp1-focused-progress-contract.txt
- `Reopen When`: A later task reintroduces a contradiction between partial-progress server state and upload panel behavior.
- `Size`: S

### T4 - Extend mocked and live browser harnesses for partial-progress evidence
- `ID`: T4
- `Slice`: Browser Harness
- `Status`: Done
- `Depends On`: CP1
- `Start When`: CP1 is `Done`, the new progress UI contract is stable enough to encode into browser regression, and the live verification branch policy is fixed to `master`.
- `Files`: primary: `scripts/harness/run-ui-smoke.ts`, `scripts/harness/run-ui-live-upload.ts`; generated/incidental: smoke screenshots/logs, live upload evidence under the bundle-relative `evidence/` path
- `Context`: This bug specifically mentions a mismatch between real GitHub commits and what the UI can observe, so mocked smoke alone is not enough.
- `Produces`: Mocked smoke assertions for progress bars/overflow and live upload assertions that capture `uploadedCount > 0` during `uploading`, plus a persisted final upload snapshot when fast live runs outpace the rewrite-pending window.
- `Must Do`: Add mocked upload states that prove running progress, upload partial progress, row-status changes, upload form visibility rules, full-bar-but-still-uploading rewrite-pending state, and upload-table max-height. In the live harness, force branch selection to `master`, use a run-unique upload path so GitHub writes are not no-op, wait for a state where the UI still says `uploading` while `uploadedCount` is already nonzero, and record that evidence together with same-branch GitHub partial-upload evidence before waiting for final completion. Keep placeholder or secret-safe values only in captured evidence.
- `Must Not Do`: Do not rely only on final `upload-completed`. Do not record raw provider secrets in screenshots, logs, or evidence. Do not weaken the existing retry and final completion checks.
- `Implementation Notes`: The live harness should keep the existing branch-head or repo-tree validation, but add an earlier assertion window for partial progress on the same `master` branch. It should record branch name, before SHA, intermediate SHA or repo-tree evidence, and after SHA in the evidence. If any partial-progress assertion fails after an external commit was already written, the task stops, records the branch/SHA state, and returns without retrying in the same run. For the mocked smoke flow, reuse the current upload-ready/uploading/upload-failed/upload-completed path and add a long-enough upload-target table to prove the height cap and internal scroll.
- `Verification Strategy`: 1. Run `pnpm smoke:ui`; success signal includes `#running-progress`, `#upload-progress`, rewrite-pending full-bar state, upload form visibility rules, row-status transitions, and bounded upload-table overflow on desktop/mobile. 2. If `FAREWELL_UPLOAD_E2E=1` and `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN` are present, run `pnpm test:network:upload`. 3. In live evidence, require structured capture showing `master` in a state where GitHub branch head or repo tree already reflects uploaded assets while the UI still shows `status === "uploading"` with `uploadedCount > 0` or `부분 완료`. On very fast runs, also accept the persisted result-stage upload snapshot at `upload-completed` when it still carries `#upload-progress`, completed rows, and same-branch GitHub evidence. 4. If the env vars are absent, stop and return instead of marking the task `Done`. 5. If either command exits `0` but the new partial-progress evidence, full-bar rewrite-pending evidence in smoke, form visibility evidence, or bounded-table evidence is missing, treat the task as incomplete and return the bundle for repair.
- `Acceptance Criteria`: Both mocked and real browser verification paths can prove the UI observes partial upload progress before rewrite completion.
- `Definition of Done`: Required harness commands pass with the needed env, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t4-browser-harness-progress.txt
- `Reopen When`: Any later regression removes partial-progress evidence from smoke or live upload harnesses.
- `Size`: M

### T5 - Sync evergreen docs with the new progress contract
- `ID`: T5
- `Slice`: Knowledge Sync
- `Status`: Done
- `Depends On`: CP1
- `Start When`: CP1 is `Done` and the code-level UX contract is stable enough to document.
- `Files`: primary: `.agents/knowledge/product/domain.md`, `.agents/knowledge/DESIGN.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/reference/runbooks/browser-verification.md`; generated/incidental: N/A
- `Context`: The repository treats knowledge docs and browser runbooks as adjacent artifacts for UI/exporter/server changes.
- `Produces`: Updated evergreen docs that explain running/upload progress bars, partial row states, rewrite-gated completion, and upload table overflow expectations.
- `Must Do`: Document the two progress bar definitions, the row-state meanings including `upload-failed => row status 실패`, the rule that final success waits for rewrite, the `master` live verification branch rule, and the smoke/live harness expectations for partial-progress evidence. Keep file references and terminology aligned with the live code contract.
- `Must Not Do`: Do not document a new transport or status name that the code does not implement. Do not leave stale wording that implies upload progress is only final-state based.
- `Implementation Notes`: `domain.md` should explain the product semantics, `DESIGN.md` should explain the screen contract and overflow rule, `system-map.md` should explain the state flow, and the runbook should explain how to verify partial progress in both mocked and live modes.
- `Verification Strategy`: Run `rg -n \"부분 완료|progress|uploadedCount|rewrite|max-height|test:network:upload\" .agents/knowledge/product/domain.md .agents/knowledge/DESIGN.md .agents/knowledge/architecture/system-map.md .agents/knowledge/reference/runbooks/browser-verification.md`. Success signal is exit code `0` and the hits show the new contract in every intended document. If the command exits `0` but any document still describes only final upload completion or omits the overflow requirement, treat the task as incomplete and return the bundle for repair.
- `Acceptance Criteria`: Evergreen docs and runbooks describe the same progress/overflow contract that the code and harnesses now enforce.
- `Definition of Done`: Doc spot-check passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t5-knowledge-progress-contract.txt
- `Reopen When`: A later code or harness change makes the documented progress contract stale.
- `Size`: S

### CP2 - Re-check browser regression and doc alignment
- `ID`: CP2
- `Slice`: Browser + Docs Checkpoint
- `Status`: Done
- `Depends On`: T4, T5
- `Start When`: T4 and T5 are `Done` and the browser harness plus docs both claim to cover the new progress contract.
- `Files`: primary: `scripts/harness/run-ui-smoke.ts`, `scripts/harness/run-ui-live-upload.ts`, `.agents/knowledge/product/domain.md`, `.agents/knowledge/DESIGN.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/reference/runbooks/browser-verification.md`; generated/incidental: smoke/live evidence artifacts
- `Context`: Before broad verification, the browser regression and docs need to agree on the same UX and evidence standard.
- `Produces`: A checkpoint proving the new contract is stable across harnesses and docs.
- `Must Do`: Reconfirm smoke/live evidence paths, docs wording, and the rule that partial progress is visible before final success. Verify the docs do not overclaim if live env is unavailable.
- `Must Not Do`: Do not hide missing live evidence behind doc wording. Do not let stale runbook steps survive into the final wave.
- `Implementation Notes`: The key risks are docs claiming real partial-progress verification when the live harness does not actually capture it, smoke proving overflow while the docs still omit the height cap, or coverage passing without any browser-level confirmation of the new UX.
- `Verification Strategy`: 1. Run `pnpm smoke:ui` again. 2. If the live-upload env is present, rerun `pnpm test:network:upload`; otherwise verify the docs explicitly describe that live verification remains blocked. 3. Run `rg -n "부분 완료|rewrite|progress|uploading|max-height|master|FAREWELL_UPLOAD_E2E" .agents/knowledge/product/domain.md .agents/knowledge/DESIGN.md .agents/knowledge/architecture/system-map.md .agents/knowledge/reference/runbooks/browser-verification.md`. Success signal is smoke evidence plus conditional live evidence aligning with the documented contract. If any command exits `0` but the bundle evidence still lacks browser proof for partial progress, full-bar rewrite-pending state, form visibility rules, `master` branch policy, or the docs remain inconsistent with the harness behavior, keep the task incomplete and return the bundle for repair.
- `Acceptance Criteria`: Browser regression and docs tell the same story about progress visibility, overflow, and rewrite-gated completion.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp2-browser-doc-alignment.txt
- `Reopen When`: A later change makes harness behavior and docs diverge again.
- `Size`: S

### T6 - Run the broad and live final verification wave
- `ID`: T6
- `Slice`: Final Verification
- `Status`: Done
- `Depends On`: CP2
- `Start When`: CP2 is `Done` and the required live-upload env vars are present.
- `Files`: primary: `src/modules/exporter/image-upload-phase.ts`, `src/modules/exporter/image-upload-rewriter.ts`, `src/server/http-server.ts`, `src/server/job-store.ts`, `src/ui/components/ui/progress.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `scripts/harness/run-ui-smoke.ts`, `scripts/harness/run-ui-live-upload.ts`, `.agents/knowledge/product/domain.md`, `.agents/knowledge/DESIGN.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/reference/runbooks/browser-verification.md`, `tests/image-upload-phase.test.ts`, `tests/http-server.test.ts`, `tests/ui/app.test.tsx`; generated/incidental: coverage artifacts, smoke screenshots/logs, live upload evidence, any changed manifest fixture outputs
- `Context`: Final verification must prove both general regression safety and the specific real-provider bug the user asked to fix.
- `Produces`: Final evidence that broad repo-native checks and real GitHub upload progress visibility both pass.
- `Must Do`: Run `pnpm check:full` and `pnpm test:network:upload` in that order. Confirm the live upload evidence includes an intermediate state with `status === "uploading"` and nonzero uploaded count before final completion, and that `master` already has GitHub-side partial-upload evidence at that moment. Also confirm fast live runs still preserve a final result-stage upload snapshot with `#upload-progress` and completed rows after `upload-completed`. Confirm the upload table remains height-bounded in smoke evidence for both desktop and mobile captures.
- `Must Not Do`: Do not close the bundle without live upload evidence. Do not claim success from final completion alone. Do not waive a failing `check:full` caused by this bundle’s file surface.
- `Implementation Notes`: If `T6` cannot start because the required env vars are absent, stop and return with that exact blocker. If `pnpm test:network:upload` passes but the captured evidence still lacks partial-progress observation on `master`, the task is not done. If a partial-progress assertion fails after a real commit has already landed, record branch name, before/after SHA, and cleanup or preservation decision, then stop without retrying in the same run. If `check:full` fails only on an unrelated pre-existing issue outside the carried-forward file surface, record that precisely before deciding whether the task can close.
- `Verification Strategy`: 1. Run `pnpm check:full`. 2. Run `pnpm test:network:upload` on `master`. Success signal is that both commands pass and the recorded live evidence proves: `status === "uploading"`, `uploadedCount > 0`, `부분 완료` or equivalent row signal, GitHub branch head or repo tree already reflecting uploaded assets on `master`, rewrite-pending full-bar distinction in smoke, final `upload-completed` only after rewrite, and result-stage persistence of the upload snapshot after completion. If the env is missing, stop and return instead of closing the task. If either command exits `0` but the claimed partial-progress evidence, same-branch GitHub evidence, form visibility evidence, or bounded-table evidence is absent, treat the task as incomplete and return the bundle for repair.
- `Acceptance Criteria`: The repository-level regression suite stays green and the original real-provider visibility bug is proven fixed with live evidence.
- `Definition of Done`: Final commands pass with required evidence, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t6-final-verification.txt
- `Reopen When`: Any later regression breaks broad checks, removes partial-progress live evidence, or reopens upload table overflow.
- `Size`: M
