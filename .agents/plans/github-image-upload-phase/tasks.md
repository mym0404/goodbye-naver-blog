# PicGo Image Upload Phase

This file is the only live progress record for this bundle.

## Status Board

- `Doing`: None
- `Ready Now`: T1 - Add dependency and shared contracts for image modes and upload lifecycle
- `Blocked`: None
- `Todo`: T2 - Refactor output structure to per-post folders and align preview diagnostics; T3 - Add compression, image-mode execution rules, and upload-candidate manifest data; CP1 - Re-check shared and exporter contracts; T4 - Add PicGo upload action and same-job server lifecycle; T5 - Rewrite output files and manifest/job items from PicGo upload results; T6 - Replace Assets tab controls with the new image-mode and PicGo config form; T7 - Extend status panel and polling flow for upload-ready/uploading/upload-completed states; CP2 - Re-check same-job lifecycle, secrets boundary, and user-visible flow; T8 - Sync knowledge docs and smoke scenario with the new export/upload contract; T9 - Run the final verification wave
- `Done`: None

## Tasks

### T1 - Add dependency and shared contracts for image modes and upload lifecycle
- `ID`: T1
- `Slice`: Shared Contract
- `Status`: Todo
- `Depends On`: None
- `Start When`: The bundle is approved and the repo still uses `assetPathMode`, `postDirectoryName`, `assetDirectoryName`, and `queued/running/completed/failed` as the only export job lifecycle names.
- `Files`: primary: `package.json`, `pnpm-lock.yaml`, `src/shared/types.ts`, `src/shared/export-options.ts`, `tests/export-options.test.ts`; generated/incidental: N/A
- `Context`: Downstream exporter, server, and UI work need a single contract for three image modes, same-job upload states, per-post folder structure options, and optional compression defaults.
- `Produces`: Installed `picgo` and `sharp` dependencies; new shared type names and defaults; validation/coercion coverage for the new options.
- `Must Do`: Replace user-facing `assetPathMode` with `imageHandlingMode` and remove `postDirectoryName` / `assetDirectoryName` from the structure contract. Add explicit same-job upload lifecycle naming in shared job state types. Keep `imageContentMode === base64` as a supported special case that disables upload mode. Define `groupByCategory` as the new boolean option with default `true`.
- `Must Not Do`: Do not change exporter, server, or UI implementation in this task. Do not keep two parallel user-facing option vocabularies alive.
- `Implementation Notes`: Introduce stable names up front. The expected direction is:
  - `ImageHandlingMode = "download" | "remote" | "download-and-upload"`
  - structure fields become `cleanOutputDir`, `groupByCategory`, `includeDateInPostFolderName`, `includeLogNoInPostFolderName`, `slugStyle`
  - assets fields gain `compressionEnabled` and keep `imageContentMode`, `downloadImages`, `downloadThumbnails`, `thumbnailSource`, `includeImageCaptions`, `stickerAssetMode`
  - `JobStatus` expands to `queued | running | upload-ready | uploading | upload-completed | upload-failed | completed | failed`
  - add shared upload-summary types needed by job state and manifest so downstream layers do not invent ad-hoc shapes
  - validation rules must coerce impossible combinations: `base64` disables upload mode, `download-and-upload` forces local image and thumbnail downloads
  - shared upload summary must include an explicit non-interactive terminal reason for zero-candidate jobs such as `skipped-no-candidates`, so downstream server/UI logic does not guess whether `upload-ready(0)` is valid
- `Verification Strategy`: Run `pnpm exec vitest run tests/export-options.test.ts --silent`. Success signal is exit code `0` and assertions prove the new option names, defaults, and coercion rules. If the command exits `0` but the old option names still remain in defaults or metadata, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Shared types and defaults describe the new image handling model, output structure model, and upload lifecycle without requiring downstream code to guess field names or states.
- `Definition of Done`: Dependency and shared contract changes exist, focused option tests pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms the update persisted.
- `Evidence`: evidence/t1-shared-contract.txt
- `Reopen When`: Any downstream task needs to invent a new shared option or lifecycle name not already captured here.
- `Size`: M

### T2 - Refactor output structure to per-post folders and align preview diagnostics
- `ID`: T2
- `Slice`: Export Paths
- `Status`: Todo
- `Depends On`: T1
- `Start When`: T1 is `Done` and exporter path code still writes separate `posts/` and `assets/` roots.
- `Files`: primary: `src/modules/exporter/export-paths.ts`, `src/modules/exporter/export-preview.ts`, `src/modules/exporter/single-post-export.ts`, `tests/export-preview.test.ts`, `tests/export-single-post.test.ts`; generated/incidental: N/A
- `Context`: Preview and single-post diagnostics must match the final output contract early, or later exporter/UI work will test against stale paths.
- `Produces`: New per-post folder layout helpers and aligned diagnostics for preview/single-post paths.
- `Must Do`: Make the post folder stem reuse the current date/logNo/slug naming pieces, but always write the Markdown file as `index.md`. When `groupByCategory` is true, keep the category path above the post folder; when false, write the post folder directly under the chosen output root.
- `Must Not Do`: Do not introduce upload logic or asset rewrite logic in this task. Do not leave compatibility shims that still emit `posts/` or `assets/` roots.
- `Implementation Notes`: Centralize path generation so Markdown and asset paths derive from one post-folder root. `single-post-export` and `export-preview` diagnostics should expose asset paths that now live beside `index.md`, because these diagnostics are part of the user-visible contract and existing tests assert concrete paths.
- `Verification Strategy`: Run `pnpm exec vitest run tests/export-preview.test.ts tests/export-single-post.test.ts --silent`. Success signal is exit code `0` and the assertions now match `.../{post-folder}/index.md` and sibling asset files. If the command exits `0` but diagnostics still mention `posts/` or `assets/`, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Preview and single-post export diagnostics prove that one post folder contains `index.md` and local assets, with category grouping controlled only by `groupByCategory`.
- `Definition of Done`: Path helpers are updated, diagnostics tests pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t2-output-paths.txt
- `Reopen When`: A later task reintroduces split roots or produces paths that no longer match preview diagnostics.
- `Size`: M

### T3 - Add compression, image-mode execution rules, and upload-candidate manifest data
- `ID`: T3
- `Slice`: Exporter Asset Flow
- `Status`: Todo
- `Depends On`: T1, T2
- `Start When`: T1 and T2 are `Done`, and `AssetStore` still only supports `relative | remote | base64` without compression or upload-candidate metadata.
- `Files`: primary: `src/modules/exporter/asset-store.ts`, `src/modules/exporter/naver-blog-exporter.ts`, `tests/asset-store.test.ts`, `tests/naver-blog-exporter.test.ts`, `tests/markdown-renderer.test.ts`; generated/incidental: N/A
- `Context`: Exporter output must already carry enough information for a later PicGo post-process phase before the server/UI can expose upload-ready behavior.
- `Produces`: Compression-aware local asset saving, three-mode execution rules, manifest/job item upload candidate metadata, and renderer expectations aligned with the new asset records.
- `Must Do`: Keep `remote` mode truly download-free for body images, keep `download` and `download-and-upload` identical until export completion, and tag every local asset with the data needed to map it back to a Markdown/frontmatter reference later. Record per-post upload eligibility and candidate counts in manifest/job-facing data.
- `Must Not Do`: Do not call PicGo yet. Do not rewrite finished Markdown to remote URLs in this task.
- `Implementation Notes`: Compression applies only when a binary image is saved locally and the format is safe to rewrite; keep unsupported formats such as SVG/GIF as pass-through. Asset records must preserve enough identity to rewrite body image links and frontmatter thumbnail fields later, so include stable local-path and reference metadata rather than relying on positional guesses. `remote` mode should still support frontmatter/source rendering without local files.
- `Verification Strategy`: Run `pnpm exec vitest run tests/asset-store.test.ts tests/naver-blog-exporter.test.ts tests/markdown-renderer.test.ts --silent`. Success signal is exit code `0`, focused tests cover remote/download/download-and-upload mode behavior, and manifest/job items now expose upload candidate counts or statuses. If the command exits `0` but upload readiness still cannot be derived from manifest/job output alone, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Export output distinguishes remote mode from local-download modes, optional compression happens only on saved local files, and manifest/job data is sufficient to drive a later upload-ready phase without reparsing Markdown from scratch.
- `Definition of Done`: Asset/exporter focused tests pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t3-exporter-assets.txt
- `Reopen When`: A later task needs extra upload-candidate metadata that is not already produced here.
- `Size`: M

### CP1 - Re-check shared and exporter contracts
- `ID`: CP1
- `Slice`: Checkpoint
- `Status`: Todo
- `Depends On`: T2, T3
- `Start When`: T2 and T3 are `Done`.
- `Files`: primary: `package.json`, `pnpm-lock.yaml`, `src/shared/types.ts`, `src/shared/export-options.ts`, `src/modules/exporter/export-paths.ts`, `src/modules/exporter/asset-store.ts`, `src/modules/exporter/naver-blog-exporter.ts`, `src/modules/exporter/export-preview.ts`, `src/modules/exporter/single-post-export.ts`, `tests/export-options.test.ts`, `tests/export-preview.test.ts`, `tests/export-single-post.test.ts`, `tests/asset-store.test.ts`, `tests/naver-blog-exporter.test.ts`, `tests/markdown-renderer.test.ts`; generated/incidental: N/A
- `Context`: Before server/UI work starts, the bundle needs one explicit pause to prove that naming, pathing, and exporter metadata are now stable.
- `Produces`: Confirmed checkpoint evidence and an explicit go/no-go decision for the upload phase and UI work.
- `Must Do`: Re-read the live diff against the declared file surface, rerun all focused shared/exporter tests, and confirm no hidden compatibility shim or stale option name remains.
- `Must Not Do`: Do not start PicGo, server, or UI implementation inside the checkpoint. Do not widen scope.
- `Implementation Notes`: This checkpoint is specifically looking for silent contradictions such as `groupByCategory` existing in shared types while exporter paths still read `folderStrategy`, or `download-and-upload` existing in defaults while manifest output still cannot mark upload-ready posts.
- `Verification Strategy`: Run `pnpm exec vitest run tests/export-options.test.ts tests/export-preview.test.ts tests/export-single-post.test.ts tests/asset-store.test.ts tests/naver-blog-exporter.test.ts tests/markdown-renderer.test.ts --silent`. Success signal is exit code `0` and a manual diff read shows only the declared files changed. If the command exits `0` but stale names or stale output roots are still visible in the diff, keep the task incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Shared naming, output paths, and upload-candidate data are consistent enough that server/UI implementation can proceed without inventing new contracts.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/cp1-shared-exporter.txt
- `Reopen When`: Any downstream task exposes a missing or contradictory shared/exporter contract.
- `Size`: S

### T4 - Add PicGo upload action and same-job server lifecycle
- `ID`: T4
- `Slice`: Server Upload Lifecycle
- `Status`: Todo
- `Depends On`: CP1
- `Start When`: CP1 is `Done` and the server still has no explicit upload action endpoint or ephemeral provider-config path.
- `Files`: primary: `src/modules/exporter/picgo-upload-phase.ts`, `src/server/job-store.ts`, `src/server/http-server.ts`, `tests/http-server.test.ts`, `tests/naver-blog-exporter.test.ts`; generated/incidental: N/A
- `Context`: The same job needs a second phase that can accept provider settings without ever writing those secrets into the stored export request or polling payload.
- `Produces`: PicGo upload service entrypoint, `/api/export/:id/upload` server action, job store lifecycle transitions for `upload-ready`, `uploading`, `upload-completed`, and `upload-failed`.
- `Must Do`: Keep credentials request-scoped and ephemeral. Validate that only jobs created with `download-and-upload` and eligible candidate assets can enter the upload phase. Surface per-job upload progress counts without persisting raw config JSON or secrets. Add explicit request-origin protection so blind cross-site POSTs to the localhost upload endpoint are rejected. Enforce redaction rules so logs, thrown errors, test fixtures, and evidence never include raw credential values.
- `Must Not Do`: Do not build provider-specific UI schemas or durable credential storage. Do not mark a job `upload-completed` before rewrite work finishes.
- `Implementation Notes`: `picgo-upload-phase.ts` should own the PicGo instantiation and upload call shape so the rest of the codebase depends on a small internal interface, not on PicGo APIs directly. The POST body contract should be `{ uploaderKey, uploaderConfigJson }`. Parse JSON in the server layer, set `picBed.current` / `picBed.uploader` and `picBed.<uploaderKey>` in memory, call the upload service, then discard the config. If upload starts for an ineligible job, return a clear 4xx instead of silently no-oping. Zero-candidate `download-and-upload` jobs must terminate as `completed` with `skipped-no-candidates` and never expose the upload form. Require JSON `Content-Type`, a same-origin `Origin`/`Host` match when the browser sends `Origin`, and a custom XHR header such as `X-Requested-With` so plain cross-site form POSTs fail closed.
- `Verification Strategy`: Run `pnpm exec vitest run tests/http-server.test.ts tests/naver-blog-exporter.test.ts --silent`. Success signal is exit code `0`, tests prove that eligible `upload-ready` jobs can transition to upload states, ineligible or zero-candidate jobs get the expected 4xx or `completed + skipped-no-candidates` behavior, same-origin guard rejects malformed cross-site style requests, and polling payloads do not echo credential fields. If the command exits `0` but a mocked upload request can still read secrets back through `/api/export/:id` or bypass the origin guard, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: The server exposes a same-job upload action that only eligible jobs can use, drives explicit upload lifecycle states, rejects cross-site style abuse, and never persists provider secrets in the job payload, logs, or manifest.
- `Definition of Done`: Upload action and server lifecycle tests pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t4-server-upload.txt
- `Reopen When`: Any later test or review shows secrets leaking through stored job state or the upload endpoint can be triggered for the wrong job type.
- `Size`: M

### T5 - Rewrite output files and manifest/job items from PicGo upload results
- `ID`: T5
- `Slice`: Output Rewrite
- `Status`: Todo
- `Depends On`: T4
- `Start When`: T4 is `Done` and the system can obtain PicGo upload results without yet rewriting all output surfaces.
- `Files`: primary: `src/modules/exporter/picgo-upload-rewriter.ts`, `src/modules/exporter/picgo-upload-phase.ts`, `src/modules/exporter/naver-blog-exporter.ts`, `tests/naver-blog-exporter.test.ts`, `tests/markdown-renderer.test.ts`; generated/incidental: N/A
- `Context`: Upload is not complete until every user-visible output surface reflects the final remote URLs.
- `Produces`: Deterministic rewrite step that updates body image URLs, frontmatter `thumbnail`, manifest `assetPaths`, and job item `assetPaths` using PicGo upload results.
- `Must Do`: Rewrite only assets that were uploaded successfully, keep local Markdown/frontmatter formatting stable except for URL replacement, and fail the upload phase clearly if a required replacement cannot be mapped back to its source local asset. Update both persisted manifest content and in-memory job items to the same final URLs. Reject any PicGo result whose final URL is not an absolute `http` or `https` URL before rewrite starts.
- `Must Not Do`: Do not re-run the whole export pipeline. Do not leave mixed local-path and uploaded-URL state for the same successfully uploaded asset.
- `Implementation Notes`: Add a dedicated rewriter module so markdown/body/frontmatter mutation logic does not sprawl across the server. The rewriter should consume upload-candidate metadata created in `T3`, not re-parse the original HTML. Stage every rewritten `index.md` and `manifest.json` payload in memory first, write temp files beside the originals, and rename them into place only after the full rewrite set is ready. Update in-memory job items only after the file swap succeeds. On success, the same job should move from `uploading` to `upload-completed`; on failure during rewrite, delete temp files, leave originals untouched, and move to `upload-failed`.
- `Verification Strategy`: Run `pnpm exec vitest run tests/naver-blog-exporter.test.ts tests/markdown-renderer.test.ts --silent`. Success signal is exit code `0`, focused tests prove that body image links, frontmatter `thumbnail`, and manifest/job `assetPaths` all switch together, a simulated non-http(s) PicGo URL is rejected, and a simulated rewrite failure leaves the prior export output unchanged because no temp-to-final rename occurs. If the command exits `0` but only one or two of those surfaces update or partial files remain after a forced failure, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: After a successful upload phase, every affected output surface shows the uploaded URL consistently; after an invalid URL or rewrite failure, the export output remains in its pre-upload local state and the job reports `upload-failed`.
- `Definition of Done`: Rewrite-focused verification passes, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t5-output-rewrite.txt
- `Reopen When`: Any later task shows inconsistent URL replacement across body/frontmatter/manifest/job item surfaces.
- `Size`: M

### T6 - Replace Assets tab controls with the new image-mode and PicGo config form
- `ID`: T6
- `Slice`: UI Options
- `Status`: Todo
- `Depends On`: T1, T4
- `Start When`: T1 and T4 are `Done`, and the Assets tab still exposes the old option vocabulary or has no upload action input surface.
- `Files`: primary: `src/ui/features/options/export-options-panel.tsx`, `src/ui/App.tsx`, `src/ui/lib/api.ts`, `tests/ui/export-options-panel.test.tsx`, `tests/ui/app.test.tsx`; generated/incidental: N/A
- `Context`: Users need an understandable image-mode choice and an explicit PicGo config entry point that does not blur into normal export defaults.
- `Produces`: Updated Assets tab with three-mode control, compression toggle, category grouping toggle wiring, and client state that can later trigger the post-export upload action.
- `Must Do`: Keep `uploaderKey` and `uploaderConfigJson` out of the Assets tab itself and show them only when the selected job is `upload-ready` and the export was created with `download-and-upload`. Disable or coerce controls so `base64` and `remote` cannot accidentally present upload settings. Keep the UI copy short and product-facing.
- `Must Not Do`: Do not add provider-specific helper text that merely restates policy. Do not persist secrets into long-lived export defaults.
- `Implementation Notes`: The Assets tab should own the new `imageHandlingMode`, `compressionEnabled`, and `groupByCategory` controls. Because upload is a post-export phase, the provider form lives in the status/result flow, not inside the reusable export defaults payload. `src/ui/lib/api.ts` should define a distinct client call shape for `/api/export/:id/upload`, but the actual form rendering belongs to the results surface.
- `Verification Strategy`: Run `pnpm exec vitest run tests/ui/export-options-panel.test.tsx tests/ui/app.test.tsx --silent`. Success signal is exit code `0`, tests cover control visibility/disable rules for `remote`, `download`, `download-and-upload`, and `base64`, and the Assets tab never renders raw credential inputs. If the command exits `0` but the UI still lets users type secrets into export defaults state, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: The Assets tab expresses the new image handling contract clearly, and upload credentials are entered only in the explicit post-export action flow.
- `Definition of Done`: Focused UI tests for options/app pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t6-ui-options.txt
- `Reopen When`: A later change reintroduces stale option labels or stores upload credentials in export defaults state.
- `Size`: M

### T7 - Extend status panel and polling flow for upload-ready/uploading/upload-completed states
- `ID`: T7
- `Slice`: UI Job Results
- `Status`: Todo
- `Depends On`: T5, T6
- `Start When`: T5 and T6 are `Done`, and the UI still cannot show upload-ready targets, progress, or completion state from the same job payload.
- `Files`: primary: `src/ui/hooks/use-export-job.ts`, `src/ui/features/job-results/job-results-panel.tsx`, `src/ui/App.tsx`, `tests/ui/use-export-job.test.tsx`, `tests/ui/app.test.tsx`; generated/incidental: N/A
- `Context`: The user specifically wants export-complete upload targets listed again in a table and visible progress in the status panel.
- `Produces`: Polling-aware client state for upload phases, upload target table, progress metrics, failure/completion presentation, and upload trigger wiring.
- `Must Do`: Render upload-ready posts in a compact table using the existing table language. Show the post-export credential form only for eligible `upload-ready` jobs, show upload progress and final counts in the same status panel without hiding export results, and keep the new table within the mobile no-horizontal-overflow dashboard rule. Cover happy path, failed upload path, and zero-candidate no-form path in tests.
- `Must Not Do`: Do not create a second job results screen or a modal-only flow. Do not drop existing export result table/filter behavior.
- `Implementation Notes`: Reuse the current results-panel structure so upload state appears as another section in the same board. `useExportJob` should keep polling through `upload-ready` and `uploading` until the job reaches a terminal state. Terminal states are `completed`, `upload-completed`, `upload-failed`, and `failed`.
- `Verification Strategy`: Run `pnpm exec vitest run tests/ui/use-export-job.test.tsx tests/ui/app.test.tsx --silent`. Success signal is exit code `0`, tests prove polling continues through the upload phase, the status panel renders target rows plus a mobile-safe table layout, a user can submit placeholder `uploaderKey/configJson` from the results surface and observe `uploading` before completion, and zero-candidate jobs never show the form. If the command exits `0` but the UI still stops polling at `upload-ready`, cannot show failed upload state, or regresses mobile overflow, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Users can see which posts will be uploaded, start the upload from the same job result surface, watch the job move through `upload-ready`, `uploading`, and final upload states without losing export result visibility, and keep the status panel usable on mobile.
- `Definition of Done`: Results-panel and polling tests pass, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t7-ui-results.txt
- `Reopen When`: Later work breaks polling continuity or removes the upload target/progress display from the shared status panel.
- `Size`: M

### CP2 - Re-check same-job lifecycle, secrets boundary, and user-visible flow
- `ID`: CP2
- `Slice`: Checkpoint
- `Status`: Todo
- `Depends On`: T5, T6, T7
- `Start When`: T5, T6, and T7 are `Done`.
- `Files`: primary: `src/modules/exporter/picgo-upload-phase.ts`, `src/modules/exporter/picgo-upload-rewriter.ts`, `src/modules/exporter/naver-blog-exporter.ts`, `src/server/job-store.ts`, `src/server/http-server.ts`, `src/ui/App.tsx`, `src/ui/lib/api.ts`, `src/ui/hooks/use-export-job.ts`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `tests/http-server.test.ts`, `tests/naver-blog-exporter.test.ts`, `tests/ui/export-options-panel.test.tsx`, `tests/ui/use-export-job.test.tsx`, `tests/ui/app.test.tsx`; generated/incidental: N/A
- `Context`: This checkpoint exists to catch the highest-risk regressions before docs and full-suite work: leaked secrets, broken status transitions, and partial rewrite UX.
- `Produces`: Explicit confirmation that same-job flow, secret boundary, and user-visible tables/states are all coherent.
- `Must Do`: Re-read the diff, rerun focused server/exporter/UI tests, and manually inspect polling payload fixtures or test assertions for secret leakage, zero-candidate terminal behavior, and request-origin guard coverage.
- `Must Not Do`: Do not add new feature work inside the checkpoint. Do not defer a confirmed secret leak to final verification.
- `Implementation Notes`: A passing checkpoint here means the bundle is functionally complete apart from docs/smoke and broad verification. The main red flags are: upload config appearing in job JSON or evidence, upload-ready UI lacking an action path, zero-candidate jobs still surfacing the form, cross-site style requests bypassing the guard, or successful upload rewriting only part of the output contract.
- `Verification Strategy`: Run `pnpm exec vitest run tests/http-server.test.ts tests/naver-blog-exporter.test.ts tests/ui/export-options-panel.test.tsx tests/ui/use-export-job.test.tsx tests/ui/app.test.tsx --silent`. Success signal is exit code `0` and manual diff/fixture inspection confirms no credential field is serialized into job state or evidence. If the command exits `0` but secret-bearing fixtures or snapshots still include raw config values, or zero-candidate / origin-guard coverage is absent, keep the task incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: The same job can safely transition into and out of the upload phase, zero-candidate jobs terminate cleanly, and the UI/API contract is coherent enough to freeze for docs and smoke updates.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/cp2-lifecycle-secrets-ui.txt
- `Reopen When`: Any later test or review reveals secret leakage, broken upload state transitions, or contradictory UI/API flow.
- `Size`: S

### T8 - Sync knowledge docs and smoke scenario with the new export/upload contract
- `ID`: T8
- `Slice`: Knowledge And Smoke
- `Status`: Todo
- `Depends On`: CP2
- `Start When`: CP2 is `Done`, and the code-level contract is stable enough to document and smoke-test.
- `Files`: primary: `.agents/knowledge/product/domain.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/product/ui-dashboard-design-system.md`, `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`; generated/incidental: N/A
- `Context`: The repo’s evergreen knowledge and browser smoke path are both part of the enforced adjacent artifact surface for UI/exporter changes.
- `Produces`: Updated architecture/domain/UI knowledge and a smoke scenario that explicitly covers upload-ready/upload-completed results.
- `Must Do`: Document the new image handling modes, same-job upload phase, zero-candidate terminal behavior, per-post folder structure, and status-panel expectations. Extend the smoke harness scenario or assertions so it proves the new UI contract instead of only passing through older export-only screens. Ensure smoke artifacts use placeholder config values only and never persist raw secrets.
- `Must Not Do`: Do not write stale docs that mention `posts/` and `assets/` split roots or old option names. Do not rely on manual tribal knowledge instead of updating the smoke/runbook artifacts.
- `Implementation Notes`: Keep the knowledge docs aligned with the exact source-of-truth files they mention. In the smoke harness, use deterministic mocked job payloads rather than a live provider. Ensure the scenario includes upload-ready, upload trigger submission, uploading, upload-completed, and mobile overflow checks using placeholder config values.
- `Verification Strategy`: Run `pnpm smoke:ui`. Success signal is exit code `0`, the harness exercises the new upload-related UI path at `http://127.0.0.1:4173` across its desktop/mobile viewports, confirms upload-ready -> uploading -> upload-completed, and evidence is written under the bundle-relative path without raw credential values. If the command exits `0` but the scenario never visits those states or still leaks raw config values into evidence, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: Evergreen docs match the live code contract, and the UI smoke path actually proves the new upload-related user flow.
- `Definition of Done`: Knowledge docs and smoke updates land, smoke passes, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t8-smoke-and-knowledge.txt
- `Reopen When`: A later code change makes the docs or smoke assertions stale.
- `Size`: M

### T9 - Run the final verification wave
- `ID`: T9
- `Slice`: Final Verification
- `Status`: Todo
- `Depends On`: T8
- `Start When`: T8 is `Done` and no unresolved blocker remains.
- `Files`: primary: `package.json`, `pnpm-lock.yaml`, `src/shared/types.ts`, `src/shared/export-options.ts`, `src/modules/exporter/export-paths.ts`, `src/modules/exporter/asset-store.ts`, `src/modules/exporter/naver-blog-exporter.ts`, `src/modules/exporter/export-preview.ts`, `src/modules/exporter/single-post-export.ts`, `src/modules/exporter/picgo-upload-phase.ts`, `src/modules/exporter/picgo-upload-rewriter.ts`, `src/modules/converter/markdown-renderer.ts`, `src/server/job-store.ts`, `src/server/http-server.ts`, `src/ui/App.tsx`, `src/ui/lib/api.ts`, `src/ui/hooks/use-export-job.ts`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx`, `.agents/knowledge/product/domain.md`, `.agents/knowledge/architecture/system-map.md`, `.agents/knowledge/product/ui-dashboard-design-system.md`, `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`, `tests/export-options.test.ts`, `tests/export-preview.test.ts`, `tests/export-single-post.test.ts`, `tests/asset-store.test.ts`, `tests/naver-blog-exporter.test.ts`, `tests/markdown-renderer.test.ts`, `tests/http-server.test.ts`, `tests/ui/export-options-panel.test.tsx`, `tests/ui/use-export-job.test.tsx`, `tests/ui/app.test.tsx`; generated/incidental: coverage artifacts, smoke screenshots/logs, `manifest.json` fixture outputs, any updated lockfile-integrity artifacts
- `Context`: Final verification proves the whole slice, not just the focused tasks, and confirms adjacent artifacts stayed aligned.
- `Produces`: Final evidence that focused tests, broad coverage, smoke, and full repo-native checks all pass for the completed feature.
- `Must Do`: Run the focused regression command, `pnpm test:coverage`, `pnpm smoke:ui`, and `pnpm check:full` in that order. Record evidence for each step. Confirm the browser smoke actually covers upload-ready, upload trigger submission, uploading, upload-completed states, mobile table layout, and redacted evidence handling, not just a green exit code.
- `Must Not Do`: Do not treat a partial verification wave as enough. Do not ignore a red `check:full` failure caused by changed files in this plan’s surface.
- `Implementation Notes`: If a broad command fails because a required file from the declared surface was missed, return the same bundle to the planner for reconciliation instead of silently narrowing the verification claim. If `check:full` fails only on unrelated pre-existing repo issues outside the declared file surface, record the evidence precisely before deciding whether the task can close.
- `Verification Strategy`: 1. Run `pnpm exec vitest run tests/export-options.test.ts tests/http-server.test.ts tests/asset-store.test.ts tests/export-preview.test.ts tests/export-single-post.test.ts tests/markdown-renderer.test.ts tests/naver-blog-exporter.test.ts tests/ui/export-options-panel.test.tsx tests/ui/use-export-job.test.tsx tests/ui/app.test.tsx --silent`. 2. Run `pnpm test:coverage`. 3. Run `pnpm smoke:ui`; this command boots the local app at `http://127.0.0.1:4173`, uses its built-in desktop/mobile viewports, and must execute the upload-ready -> uploading -> upload-completed UI scenario from the results surface while preserving mobile layout and redacting evidence. 4. Run `pnpm check:full`. Success signal is that all four steps pass and generated evidence confirms the upload-related scenario truly ran. If any command exits `0` but the claimed upload scenario, mobile layout check, or redaction coverage is missing, treat the task as incomplete and return the bundle for same-turn repair.
- `Acceptance Criteria`: The completed feature is proven by focused tests, broad coverage, smoke, and full repo-native verification, with no contradiction between code, docs, and user-visible behavior.
- `Definition of Done`: All final-wave commands pass or are explicitly adjudicated with evidence, evidence is recorded, task status becomes `Done`, the top `Status Board` is refreshed, and rereading `tasks.md` confirms persistence.
- `Evidence`: evidence/t9-final-verification.txt
- `Reopen When`: Any later regression breaks focused tests, smoke, or `check:full`, or reveals that the final-wave scenario never actually covered the upload flow.
- `Size`: M
