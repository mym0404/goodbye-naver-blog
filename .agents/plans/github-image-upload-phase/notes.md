# PicGo Image Upload Phase

## Discoveries

- [2026-04-17 03:10Z] Discovery: `src/server/job-store.ts` stores the full `ExportRequest`, and `src/server/http-server.ts` returns that job object through polling. Raw provider credentials therefore cannot ride inside export options or the export request body.
- [2026-04-17 03:18Z] Discovery: `src/modules/exporter/export-paths.ts` still assumes split `posts/` and `assets/` roots, while `src/modules/exporter/export-preview.ts` and `src/modules/exporter/single-post-export.ts` expose concrete path diagnostics that will immediately drift if the folder contract changes.
- [2026-04-17 03:24Z] Discovery: PicGo-Core’s official docs describe a Node API with `new PicGo()` and `picgo.upload([...])`, and uploader configuration conventionally lives under `picBed.current` plus `picBed.<uploaderKey>`. This makes PicGo-Core viable as the upload engine without hard-coding GitHub-only SDK calls.
- [2026-04-17 03:31Z] Discovery: `src/shared/utils.ts` already emits date-only slugs, so the request to stop including time in names is already satisfied and should not spawn unnecessary code churn.

## Decisions

- [2026-04-17 03:12Z] Decision: Treat image handling as three user-facing modes: `download`, `remote`, and `download-and-upload`. Rationale: the user explicitly reframed the feature around these three outcomes, and `download-and-upload` shares the entire pre-export flow with `download`.
- [2026-04-17 03:15Z] Decision: Keep upload as a second phase of the same export job, using explicit statuses `upload-ready`, `uploading`, `upload-completed`, and `upload-failed`. Rationale: the user rejected a separate upload job and wants progress to remain in the existing status surface.
- [2026-04-17 03:20Z] Decision: Replace the split `posts/` and `assets/` output roots with one post folder that contains `index.md` and sibling asset files. Rationale: the user wants all artifacts for one post co-located and chose `index.md` explicitly.
- [2026-04-17 03:27Z] Decision: Use PicGo-Core as the upload engine. The original bundle started with `uploaderKey + uploaderConfigJson` UI, but the reopened bundle replaces that with provider selection plus structured provider fields in the post-export flow. Rationale: PicGo remains the stable engine, while raw JSON textarea input is now an explicit UX anti-goal.
- [2026-04-17 03:29Z] Decision: Apply compression only at local download-save time, not as a second transform right before upload. Rationale: this keeps the first implementation deterministic and avoids two different binary-rewrite points.

## Risks

- [2026-04-17 03:14Z] Risk: Secret leakage is the highest-risk failure mode because the current polling payload mirrors stored job state closely. Any accidental persistence of provider field values would be user-visible immediately.
- [2026-04-17 03:22Z] Risk: Output rewrite can silently become partial if body image links, frontmatter `thumbnail`, manifest `assetPaths`, and job item `assetPaths` are not all driven from the same upload mapping source.
- [2026-04-17 03:30Z] Risk: UI smoke can pass while missing the new upload flow if the harness assertions are only export-focused. The final wave must prove that upload-ready and upload-completed states are actually exercised.
- [2026-04-17 04:05Z] Risk: A localhost-only server still needs request-origin protection. Without an explicit origin/header guard, a third-party page can attempt a blind POST to the upload endpoint.
- [2026-04-17 05:02Z] Risk: Rewriting provider UX without changing the post-export-only boundary could accidentally push provider fields back into export defaults or job request state. The reopened plan must keep the form in results flow only.

## Revision Notes

- [2026-04-17 03:17Z] Revision Note: The original draft over-centered a GitHub-only post-process path. User review reopened the approach and shifted the bundle toward a three-mode image contract plus per-post folder output.
- [2026-04-17 03:26Z] Revision Note: After provider ecosystem research, the bundle switched from a GitHub-specific uploader plan to a PicGo-Core-based upload engine plan.
- [2026-04-17 03:36Z] Revision Note: Phase 2 approval was received after the draft was rewritten around PicGo-Core, same-job upload states, and the co-located post-folder output structure.
- [2026-04-17 04:08Z] Revision Note: Phase 5 review surfaced four hard tightenings: the provider form must live only in the post-export results flow, zero-candidate jobs need a non-interactive terminal state, the upload endpoint needs request-origin and redaction requirements, and rewrite must use staged temp-file swaps to preserve pre-upload output on failure.
- [2026-04-17 04:45Z] Revision Note: Exec review reopened the bundle instead of replacing it. Surviving follow-ups center on failure/retry UX, rewrite-success accounting, returned-URL sanitization, strict origin policy, and upload-only UI mode.
- [2026-04-17 04:58Z] Revision Note: A later user correction reopened the provider UX axis again. The plan no longer targets a GitHub-easy-path or raw JSON fallback; it now fixes the contract to “PicGo stays, provider inputs are structured fields, and the JSON textarea goes away.”
- [2026-04-17 05:12Z] Revision Note: Planner validation and review reran after the provider-structured rewrite. The rerun found two stale planner-only contradictions: `plan.md` still described pre-change repo facts and the final smoke wave still read like completion-only. Both were reconciled inside the bundle without reopening scope again.

## Retrospective

- [2026-04-17 03:38Z] Retrospective: The bundle is decision-complete for implementation. The main complexity is no longer “how to upload to GitHub,” but “how to keep exporter output, same-job state, and UI tables in sync while secrets remain ephemeral.”
- [2026-04-17 04:07Z] Execution Note: After T1 renamed the shared structure/assets contract, the declared T2 file surface no longer fully matches the minimal repair path. `buildMarkdownFilePath` now fails immediately on removed fields, and keeping preview/single-post diagnostics aligned with the per-post folder contract also requires touching `src/modules/exporter/asset-store.ts` earlier than the bundle’s original T3 boundary.
- [2026-04-17 05:05Z] Execution Note: The reopened provider UX change ripples farther than the original T7 form surface. Raw JSON assumptions currently live in `src/ui/features/job-results/job-results-panel.tsx`, `src/ui/App.tsx`, `src/ui/hooks/use-export-job.ts`, `src/server/http-server.ts`, `tests/http-server.test.ts`, `tests/ui/use-export-job.test.tsx`, `tests/ui/app.test.tsx`, `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`, and `.agents/knowledge/product/ui-dashboard-design-system.md`, so T4/T6/T7/CP2/T8/T9 all need reopening.
