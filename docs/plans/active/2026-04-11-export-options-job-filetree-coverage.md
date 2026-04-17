# Export Options, Job File Tree, and Coverage Hardening

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

After this change, a user can control three new parts of export behavior from the existing dashboard without leaving the current workflow. First, sticker images that are currently parsed as normal images can be skipped by default or downloaded as GIF/original asset URLs when explicitly enabled. Second, image assets can be written as normal files or embedded directly into Markdown as base64 data URLs. Third, LaTeX can be rendered with separate inline and block policies, including configurable wrapper symbols instead of one hard-coded `$$` or fenced `math` block.

The export result also becomes easier to inspect while a job is running. The dashboard will show a completed-item tree that groups generated Markdown files, exposes warning and error states per post, filters down to only problematic items, and opens a modal preview that renders the exported Markdown. The Markdown output itself will surface recoverable warnings and fallback situations as quoted callouts so the exported file explains what was preserved, downgraded, or skipped. Finally, repository validation will enforce at least 90% code coverage locally and in GitHub Actions, upload coverage to Codecov, and show the status in `README.md`.

## Progress

- [x] (2026-04-11 03:08Z) Repository structure, knowledge docs, current option model, renderer/exporter flow, job UI, test suite, README, and GitHub workflow were inspected.
- [x] (2026-04-11 03:08Z) ExecPlans scaffolding was added to `AGENTS.md` and `.agents/PLANS.md`.
- [x] (2026-04-11 03:08Z) Draft ExecPlan created in `docs/plans/active/` based on current code rather than guesswork.
- [x] (2026-04-11 03:12Z) User confirmed fatal export failures should stay as `manifest + UI` diagnostics without Markdown stub files.
- [x] (2026-04-11 03:12Z) User confirmed the milestone order should remain `옵션/모델 -> 렌더링/manifest -> Job UI -> coverage/docs/CI`.
- [x] (2026-04-11 03:13Z) Sub-agent audit confirmed request items 1 through 9 are all covered by this plan and found no missing feature scope.
- [x] (2026-04-11 03:42Z) Shared option model, parser provenance, renderer diagnostics, asset store base64 path, manifest/job item state, dashboard controls, completed-item tree, modal preview, docs, and CI updates were implemented.
- [x] (2026-04-11 03:47Z) Coverage gate reached `93.82%` lines/statements, `97.24%` functions, and `81.54%` branches via `pnpm test:coverage`.
- [x] (2026-04-11 03:47Z) End-to-end validation passed with `pnpm check:full`, including `samples:verify` and the updated `smoke:ui` flow.

## Surprises & Discoveries

- Observation: `src/modules/parser/se4-parser.ts` already parses stickers as ordinary `image` blocks, so “ignore or download as GIF” is not a brand new media type; it is a new option plus parser metadata problem.
  Evidence: `parseStickerBlock` returns `type: "image"` and `tests/parser/se4-parser.test.ts` expects the sticker fixture to become an image block.

- Observation: the current UI is a static HTML + vanilla JS dashboard and `src/server/http-server.ts` only serves `/`, `/app.js`, and `/styles.css`, so a “FileTree component” should stay inside `src/static/app.js` unless static asset routing is widened on purpose.
  Evidence: `src/static/index.html` loads one module script, and `http-server.ts` hard-codes the small static allowlist.

- Observation: coverage is not configured yet. The repository has no `vitest.config.ts`, so a 90% gate will need an explicit coverage provider and thresholds instead of relying on defaults.
  Evidence: repository search found no `vitest.config.*` file, and `package.json` only defines `vitest run --silent`.

- Observation: the dashboard previously relied on a modal shell whose hidden-state handling could block the whole page.
  Evidence: an earlier `pnpm smoke:ui` failure was caused by the hidden modal backdrop intercepting clicks until the shell visibility rules were tightened.

## Decision Log

- Decision: Use `docs/plans/active/2026-04-11-export-options-job-filetree-coverage.md` as the working ExecPlan path instead of `.agents/plans/`.
  Rationale: this repository already documents active plans in `docs/plans/active/` through `docs/plans/README.md`, and the skill says to follow an explicit repository convention first.
  Date/Author: 2026-04-11 / Codex

- Decision: Keep the dashboard implementation inside the existing static stack and treat “FileTree component” as a named vanilla-JS component boundary, not as a framework migration.
  Rationale: the current product surface is `src/static/index.html`, `src/static/app.js`, and `src/static/styles.css`; adding React or another build layer would not be proportional to the requested change.
  Date/Author: 2026-04-11 / Codex

- Decision: Treat sticker handling, base64 embedding, and LaTeX rendering as first-class export options that must round-trip through `src/shared/types.ts`, `src/shared/export-options.ts`, `/api/export-defaults`, and the dashboard form.
  Rationale: preview, export, CLI usage, manifest capture, and tests already rely on the shared option schema, so any partial wiring would create drift immediately.
  Date/Author: 2026-04-11 / Codex

- Decision: Fatal post export failures will not generate Markdown stub files; they will remain visible through `manifest.json` and the dashboard file tree diagnostics only.
  Rationale: the user explicitly chose the lighter failure path, and request item 8 only requires Markdown warning/error callouts where Markdown output actually exists.
  Date/Author: 2026-04-11 / Codex

- Decision: Keep the milestone order as `shared option model -> renderer/export pipeline -> running job UI -> coverage/docs/CI`.
  Rationale: the user explicitly approved this boundary, and it keeps each milestone independently verifiable with minimal cross-milestone rollback risk.
  Date/Author: 2026-04-11 / Codex

## Outcomes & Retrospective

Implementation finished across all four milestones. The shared option contract now carries sticker handling, base64 image embedding, and separate inline/block LaTeX wrapper controls with per-option descriptions exposed through `/api/export-defaults`. The parser and renderer preserve sticker provenance, render wrapper-configurable math, emit Markdown warning/error callouts with extracted fallback text, and keep fatal post failures in `manifest + UI` only. The export job state now streams completed/failed items into the dashboard file tree and supports warning/error filtering. Validation was hardened with `vitest.config.ts`, a `pnpm test:coverage` command, Codecov upload in GitHub Actions, updated README/docs/knowledge files, and a final `pnpm check:full` plus `pnpm test:coverage` pass above the 90% coverage bar.

## Context and Orientation

This repository exports public Naver Blog posts into Markdown, YAML frontmatter, local assets, and `manifest.json`. The option model lives in `src/shared/types.ts` and `src/shared/export-options.ts`. Server defaults are exposed from `src/server/http-server.ts` through `GET /api/export-defaults`, and the dashboard in `src/static/index.html` plus `src/static/app.js` builds its form directly from those shared defaults.

The export pipeline is `NaverBlogFetcher` in `src/modules/blog-fetcher/naver-blog-fetcher.ts`, then HTML parsing in `src/modules/parser/post-parser.ts` and the editor-specific parsers, then review warnings in `src/modules/reviewer/post-reviewer.ts`, then Markdown rendering in `src/modules/converter/markdown-renderer.ts`, then per-post writing and manifest aggregation in `src/modules/exporter/naver-blog-exporter.ts` and `src/modules/exporter/single-post-export.ts`. A “manifest” in this repository means the final `output/manifest.json` file that stores the effective options, counts, and one result row per exported post. A “job” means the in-memory export state tracked by `src/server/job-store.ts` and polled by the dashboard.

Two current implementation details matter for this plan. First, stickers are already normalized into ordinary image blocks in `src/modules/parser/se4-parser.ts`, so the parser must add enough metadata to distinguish sticker-origin images from ordinary inline images before the asset layer can decide whether to skip them. Second, formula blocks are currently rendered only as display blocks through `markdown.formulaStyle`, and the `AstBlock` formula node already carries `display: boolean`, so the missing work is to preserve inline/block intent through parsing and render them with separately configurable wrappers. Third, the current dashboard status area shows only counters and plain logs, so the file tree must be added without breaking the existing scan and export form flow described in `.agents/knowledge/product/product-outline.md`.

## Plan of Work

Milestone 1 will extend the shared export option contract and the parser/renderer data model so the requested behaviors can exist end to end. In `src/shared/types.ts`, add explicit option types for sticker asset policy, image embedding mode, inline formula rendering, block formula rendering, and configurable wrapper strings. In the same file, extend `ImageData` with a source-kind field such as `mediaKind: "image" | "sticker"` so sticker-origin blocks remain distinguishable after parsing. In `src/shared/export-options.ts`, set the default sticker policy to ignore, keep the existing default asset file behavior, and add user-facing descriptions for every new option. The server response in `src/server/http-server.ts` must expose those descriptions through `/api/export-defaults`, and the dashboard must render the new controls with a short explanation under each control instead of only a label. This milestone is complete when export payloads can carry the new values without schema drift.

Milestone 2 will change export behavior itself. In `src/modules/parser/se4-parser.ts`, preserve sticker provenance while continuing to parse stickers into exportable media blocks. In `src/modules/converter/markdown-renderer.ts`, split formula rendering into inline and block paths based on `AstBlock` `display`, allow custom wrappers such as `$...$`, `\\(...\\)`, `$$...$$`, or fenced math, and render base64 image data URLs when the new embedding mode requests it. The base64 implementation should reuse `AssetStore` for URL normalization and deduping, but `src/modules/exporter/asset-store.ts` will need a second retrieval path that returns either a saved relative path or an in-memory `data:` URL payload. The same milestone must add Markdown callouts for recoverable warnings and fallback cases by emitting quoted lines such as `> ⚠️ Warning:` or `> ❌ Error:` immediately before the downgraded content or in a small diagnostic section when the issue is document-wide. The text should preserve as much extracted content as possible instead of dropping blocks silently. `src/modules/exporter/naver-blog-exporter.ts`, `src/modules/exporter/export-preview.ts`, and `src/modules/exporter/single-post-export.ts` must propagate the richer warning/error metadata into preview and manifest results.

Milestone 3 will add the running-job inspection UI. In `src/server/job-store.ts` and `src/shared/types.ts`, extend `ExportJobState` so each completed or failed item includes title, output path, warning count, failure message, and either rendered Markdown or a fetchable way to retrieve it. Keep this additive so old counters and logs still work. In `src/static/app.js`, introduce a named `FileTree` component boundary that builds a tree from manifest/job items, draws warning and error icons, tracks active filters (`all`, `warnings`, `errors`), and opens a modal viewer that renders Markdown rather than showing raw text. Update `src/static/index.html` with the tree container and modal shell, and extend `src/static/styles.css` to match the existing bright dashboard design from `.agents/knowledge/product/ui-dashboard-design-system.md`. The modal renderer should stay lightweight: if no existing dependency is available, use a minimal client-side Markdown renderer only for the modal preview and keep the exported file content itself unchanged.

Milestone 4 will harden validation, docs, and CI. Add coverage configuration with a repository-level 90% threshold, likely by creating `vitest.config.ts`, enabling a coverage provider, and adding reporters that produce terminal output plus `lcov` for Codecov. Update `package.json` scripts so local focused coverage runs are explicit and so CI can upload the generated report. Modify `.github/workflows/required-checks.yml` to run the validation suite, then the coverage command, then upload the report to Codecov using the official action and the repository’s preferred authentication mode. Update `README.md` with a Codecov status badge and the new option descriptions, and refresh the affected knowledge/docs files so the repo guidance remains synchronized: `.agents/knowledge/product/product-outline.md`, `.agents/knowledge/product/ui-dashboard-design-system.md`, `.agents/knowledge/engineering/validation.md`, `docs/index.md`, and any runbook that documents export inspection.

Each milestone is independently verifiable. Milestone 1 is verified when defaults and form payloads round-trip. Milestone 2 is verified when targeted renderer/parser/export tests prove the new output behavior. Milestone 3 is verified when the browser smoke flow can see filtered completed items and open the modal preview. Milestone 4 is verified when coverage fails below threshold locally and uploads successfully in CI.

## Concrete Steps

Work from `/Users/mj/projects/farewell-naver-blog`.

Begin Milestone 1 by adding failing tests first, then implementing the option schema:

    pnpm exec vitest run tests/export-options.test.ts tests/http-server.test.ts --silent

Add or extend tests so they fail for missing sticker/base64/formula option fields and missing option descriptions. Then update `src/shared/types.ts`, `src/shared/export-options.ts`, `src/server/http-server.ts`, and the relevant form sections in `src/static/index.html` and `src/static/app.js`.

For Milestone 2, add focused renderer/parser/export tests before implementation:

    pnpm exec vitest run tests/parser/se4-parser.test.ts tests/markdown-renderer.test.ts tests/naver-blog-exporter.test.ts --silent

The new tests should cover sticker-origin images, ignored stickers, base64 output, inline formula wrappers, block formula wrappers, and Markdown warning/error callouts.

For Milestone 3, add or update server and UI tests:

    pnpm exec vitest run tests/http-server.test.ts tests/naver-blog-exporter.test.ts --silent
    pnpm smoke:ui

The smoke flow should scan a blog, start export, observe completed-item entries, filter to warnings or errors, and open the modal preview for at least one exported Markdown file.

For Milestone 4, introduce the coverage gate and documentation sync:

    pnpm test -- --coverage
    pnpm check:quick
    pnpm quality:report

When the implementation is complete, the final full validation should be:

    pnpm test -- --coverage
    pnpm check:quick
    pnpm samples:verify
    pnpm smoke:ui

Expected evidence includes a coverage summary at or above 90%, updated README badge markup, and a successful Codecov upload step in CI configuration.

## Validation and Acceptance

Acceptance must be behavior-based.

The export options acceptance bar is that `GET /api/export-defaults` returns the new sticker/base64/LaTeX option fields with descriptions, the dashboard form shows them with short explanatory text, the preview request echoes them, and export uses those values rather than hard-coded defaults. The default sticker behavior must be “ignore”.

The rendering acceptance bar is that a post containing ordinary images, sticker-origin images, inline math, display math, and raw HTML fallback can be exported in at least two modes: one using normal asset files and one using base64 embedding. In ignore-sticker mode, sticker blocks must not create files or Markdown image output. In keep/download mode, sticker blocks must appear in Markdown according to the chosen image policy. Inline formulas and block formulas must each respect their configured wrapper symbols. Recoverable fallback situations must show `>`-prefixed warning or error callouts in the generated Markdown while preserving extracted text whenever possible.

The job UI acceptance bar is that during or after export the dashboard shows a completed-item tree, highlights posts with warnings and errors using distinct icons, filters to only warnings or only errors, and opens a modal that renders the Markdown for a selected successful item. Failed items must still be visible in the tree with their failure state and diagnostic text, even if no Markdown body is available.

The coverage/CI acceptance bar is that a local coverage command fails when the repository drops below 90%, `README.md` shows a Codecov badge, and `.github/workflows/required-checks.yml` both validates the repo and uploads coverage. The final implementation must keep overall coverage at or above 90% rather than adding a badge without enforcement.

Fatal post failures are accepted only when they stay visible in the completed-item tree and `manifest.json` with explicit error diagnostics. Markdown warning/error callouts are required for successful or partially recovered outputs that still produce a Markdown file; they are not required to create stub files for fully failed posts.

## Idempotence and Recovery

These edits are safe to apply incrementally because the option schema, renderer behavior, UI, and CI can be validated in small slices. Avoid destructive cleanup while the plan is in progress; the repository already forbids unrequested git resets and the exporter can recreate the output directory during real export runs when `structure.cleanOutputDir` is enabled.

When coverage work fails midway, keep the threshold configuration and revert only the failing coverage script or workflow stanza rather than mixing unrelated fixes. When UI work fails midway, keep the previous counters and logs intact so the dashboard still functions even if the new tree or modal is temporarily hidden behind an empty state. Any temporary fixtures or debug files created for tests must be removed before closing the task.

## Artifacts and Notes

The key implementation evidence should remain short and local to this repository.

Expected test evidence:

    ✓ export options exposes sticker/base64/formula metadata
    ✓ renderMarkdownPost renders base64 images and formula wrappers
    ✓ parseSe4Post preserves sticker provenance
    ✓ http server returns enriched defaults and job item payloads

Expected coverage evidence:

    % Coverage report from v8
    All files | 90.00+ | 90.00+ | 90.00+ | 90.00+

Expected UI evidence:

    status panel shows Total / Completed / Failed / Warnings
    completed-item tree lists exported posts
    warnings filter hides clean posts
    modal preview renders Markdown for selected post

## Interfaces and Dependencies

`src/shared/types.ts` must end this work with explicit types for the new option surfaces and the richer job item surface. At minimum, `ExportOptions["assets"]` needs a sticker policy and an image embedding mode, `ExportOptions["markdown"]` needs separate inline/block formula configuration with wrapper symbols, `ImageData` needs source provenance, and `ExportJobState` needs a collection of completed-item descriptors suitable for the dashboard tree and filters.

`src/shared/export-options.ts` must remain the single source of default option values and metadata. If option descriptions are introduced generically, they should be stored alongside defaults in a reusable structure instead of hard-coding the same copy twice across server and UI. The server endpoint `GET /api/export-defaults` in `src/server/http-server.ts` must expose whatever metadata the UI needs so the dashboard does not drift from the shared model.

`src/modules/converter/markdown-renderer.ts` and `src/modules/exporter/asset-store.ts` are the critical dependency seam for base64 embedding. The renderer should ask for a resolved asset reference without knowing whether it is a relative path or a `data:` URL, and the asset store should continue deduping by normalized source URL. `src/modules/parser/se4-parser.ts` is the critical seam for sticker provenance. `src/static/app.js` is the critical seam for the dashboard interaction layer because it already owns option payload assembly, polling, preview rendering, and status updates.

`README.md`, `.agents/knowledge/engineering/validation.md`, `.agents/knowledge/product/product-outline.md`, `.agents/knowledge/product/ui-dashboard-design-system.md`, and `docs/index.md` must be updated in the same change so documentation matches code. `.github/workflows/required-checks.yml` and the new coverage configuration must point at the same coverage command the repository expects contributors to run locally.

Revision note: 2026-04-11. Updated the initial ExecPlan with explicit user decisions: fatal failures remain `manifest + UI` diagnostics only, the milestone order stays `옵션/모델 -> 렌더링/manifest -> Job UI -> coverage/docs/CI`, and a sub-agent audit confirmed that request items 1 through 9 are all covered.
