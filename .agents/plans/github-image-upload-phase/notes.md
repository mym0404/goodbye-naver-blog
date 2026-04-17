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
- [2026-04-17 03:27Z] Decision: Use PicGo-Core as the upload engine and start with `uploaderKey + uploaderConfigJson` UI instead of provider-specific bespoke forms. Rationale: this keeps the first version broad enough for built-in and plugin uploaders without forcing the planner to hard-code one provider family.
- [2026-04-17 03:29Z] Decision: Apply compression only at local download-save time, not as a second transform right before upload. Rationale: this keeps the first implementation deterministic and avoids two different binary-rewrite points.

## Risks

- [2026-04-17 03:14Z] Risk: Secret leakage is the highest-risk failure mode because the current polling payload mirrors stored job state closely. Any accidental persistence of `uploaderConfigJson` would be user-visible immediately.
- [2026-04-17 03:22Z] Risk: Output rewrite can silently become partial if body image links, frontmatter `thumbnail`, manifest `assetPaths`, and job item `assetPaths` are not all driven from the same upload mapping source.
- [2026-04-17 03:30Z] Risk: UI smoke can pass while missing the new upload flow if the harness assertions are only export-focused. The final wave must prove that upload-ready and upload-completed states are actually exercised.
- [2026-04-17 04:05Z] Risk: A localhost-only server still needs request-origin protection. Without an explicit origin/header guard, a third-party page can attempt a blind POST to the upload endpoint.

## Revision Notes

- [2026-04-17 03:17Z] Revision Note: The original draft over-centered a GitHub-only post-process path. User review reopened the approach and shifted the bundle toward a three-mode image contract plus per-post folder output.
- [2026-04-17 03:26Z] Revision Note: After provider ecosystem research, the bundle switched from a GitHub-specific uploader plan to a PicGo-Core-based upload engine plan.
- [2026-04-17 03:36Z] Revision Note: Phase 2 approval was received after the draft was rewritten around PicGo-Core, same-job upload states, and the co-located post-folder output structure.
- [2026-04-17 04:08Z] Revision Note: Phase 5 review surfaced four hard tightenings: the provider form must live only in the post-export results flow, zero-candidate jobs need a non-interactive terminal state, the upload endpoint needs request-origin and redaction requirements, and rewrite must use staged temp-file swaps to preserve pre-upload output on failure.

## Retrospective

- [2026-04-17 03:38Z] Retrospective: The bundle is decision-complete for implementation. The main complexity is no longer “how to upload to GitHub,” but “how to keep exporter output, same-job state, and UI tables in sync while secrets remain ephemeral.”
