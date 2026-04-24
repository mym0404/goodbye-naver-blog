# PicGo Upload Progress Visibility Notes

## Revision Log

- `rev1`
  - Created bundle after Phase 1 explore + interview closure.
  - Fixed user-visible choices:
  - running progress uses processed-post count
  - upload progress uses uploaded-asset count
  - upload row states use `대기 / 부분 완료 / 완료 / 실패`
  - final success still waits for rewrite completion
- `rev2`
  - Applied semantic-review fixes.
  - Locked rewrite-failed row status to `실패`.
  - Added dedicated live verification branch policy and stop-and-return rule after external-state writes.
  - Strengthened browser verification with fixed selector contract, form-visibility checks, and full-bar rewrite-pending evidence.
  - Replaced `CP2` coverage-only check with smoke/live/doc alignment checks.
- `rev5`
  - Semantic review lenses all passed after consistency fixes.
  - Preserved upload form visibility as an existing repo contract, not a new product choice.
- `rev6`
  - Replanned live verification policy after execution feedback.
  - Replaced dedicated-branch-only policy with `master`-fixed live verification policy.
  - Reopened `T4` by removing the missing-branch env blocker.
- `rev7`
  - Kept upload progress and row-state snapshot visible in the result step after `upload-completed`.
  - Changed live harness to use a run-unique upload path on `master` so GitHub writes always produce same-branch evidence.
  - Closed the live verification gap by accepting the persisted result-stage upload snapshot when the real rewrite-pending window is shorter than the live polling window.

## Discoveries

- `src/server/job-store.ts` already has `updateUpload()` but no current upload path uses it.
- `src/ui/features/job-results/use-export-job.ts` already polls every second, so progress visibility is blocked by state production, not transport.
- `src/modules/exporter/image-upload-phase.ts` currently returns only final results after a single batch call.
- `src/modules/exporter/image-upload-rewriter.ts` currently moves counts to final values only after rewrite success.
- Existing result-list UI already uses a bounded `ScrollArea` pattern that can be copied to the upload table.
- Existing smoke and live upload harnesses already cover the upload flow, which lowers the cost of adding progress visibility assertions.

## Risks

- Sequential PicGo uploads may change throughput or timing assumptions in tests and live harnesses.
- A full upload progress bar during rewrite can be mistaken for final completion unless the panel copy stays explicit.
- Rewrite failure after real uploads is the easiest place to accidentally hide true partial progress again.
- Live upload verification depends on env and external GitHub state, so the final wave must keep a real stop-and-return branch.
- `master` is now the only approved live verification branch for this bundle, so evidence and cleanup notes must stay same-branch and explicit.

## Review Targets

- Hidden product choice risk: whether counts stay visible on rewrite failure while final success remains gated.
- Verification risk: whether mocked smoke and real upload harness both prove partial progress instead of only final completion.
- Frontend risk: whether the upload table height cap and row states are deterministic enough to assert in browser checks.
- Change-risk surface: shared state model across exporter/server/UI/harness without new terminal statuses.
- External-state risk: if a partial-progress assertion fails after a real commit lands, the bundle must preserve branch/SHA evidence and forbid same-branch retry without an explicit fresh branch choice.
- Existing-contract risk: upload form visibility must remain treated as preserved behavior so later execution does not accidentally reopen it as a new UX choice.

## Execution Notes

- `exec`
  - Before replan, `T4` live verification was blocked because the previous bundle required `FAREWELL_UPLOAD_E2E_GITHUB_BRANCH`.
  - Continued with `T5` because it depends only on `CP1` and its verification path is executable without the live env.
- `replan`
  - User fixed the live branch policy to `master`.
  - Bundle contracts now treat `FAREWELL_UPLOAD_E2E_GITHUB_BRANCH` as unnecessary and route live evidence to `master`.
- `exec`
  - `T4` mocked smoke harness passed after encoding running/upload/rewrite-pending selectors and bounded upload-table overflow.
  - `T4` live harness on `master` observed real GitHub uploads and final completion, but never observed the required UI intermediate state `status === "uploading" && uploadedCount > 0`.
  - Last live snapshot before timeout was already `job.status=upload-completed`, while the UI had moved to `upload-completed` with no visible upload progress bar or partial row state.
  - This is outside the declared `T4` write scope because the remaining gap is product/runtime behavior, not harness coverage. The bundle is now stale at `T4`.
- `repair`
  - Added faster upload polling and kept the upload snapshot visible into the result step so fast live runs no longer lose the last observed counts.
  - Updated the live harness to upload into a run-unique `master` path because repeated hashed files at `/` produced GitHub no-op writes and stale branch-head checks.
  - Final live evidence captured `uploading + uploadedCount=1/2 + partial row` on `master`, then `upload-completed + uploadProgress=100 + complete row` as the persisted post-rewrite snapshot.
  - `pnpm test:network:upload` passed after the unique-path fix, and `pnpm check:full` passed with the updated UI/harness/docs contract.
