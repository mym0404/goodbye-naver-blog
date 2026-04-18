# Add Opt-In Live Upload Network E2E

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

After this change, a contributor can run one explicit command that fetches a real public `mym0404` post, exports it through the real HTTP server, and uploads its images through the real PicGo upload phase. This gives the repository one opt-in proof that the production upload path still works beyond mocked browser smoke and stubbed server tests.

## Progress

- [x] (2026-04-17 14:08Z) Read `.agents/PLANS.md`, `package.json`, `tests/http-server.test.ts`, `src/server/http-server.ts`, `src/modules/exporter/picgo-upload-phase.ts`, and validation docs to map the current upload path.
- [x] (2026-04-17 14:12Z) Verified live `mym0404` metadata and identified `222990202785` in the single-post `NestJS` category as the fast upload target with at least one body image.
- [x] (2026-04-17 14:08Z) Added an opt-in live upload integration test, a dedicated package script, and validation/README documentation.
- [x] (2026-04-17 14:10Z) Verified the new test’s default path with `pnpm exec vitest run tests/naver.upload.integration.test.ts --silent`; it skipped cleanly without env vars.
- [x] (2026-04-17 14:10Z) Wired `.github/workflows/required-checks.yml` to run `pnpm test:network:upload` on every non-draft PR using repository vars/secrets.
- [x] (2026-04-17 14:17Z) Fixed the upload destination to GitHub `mym0404/image-archive` with path `/` and removed provider/repo/path env knobs.
- [x] (2026-04-17 14:19Z) Switched local and CI configuration to root `.env` management and added `.env.example`.
- [x] (2026-04-17 14:21Z) Fixed the GitHub upload branch to `master` and removed branch env dependency from the live test contract.
- [ ] (2026-04-17 14:10Z) `pnpm typecheck` still fails on pre-existing `SinglePostFetcher.fetchBinary` mismatches in `scripts/lib/single-post-metadata-cache.ts` and `tests/single-post-metadata-cache.test.ts`; the live upload work did not resolve those unrelated errors.
- [ ] Run the new test with real provider credentials and record a passing transcript.

## Surprises & Discoveries

- Observation: the earlier sample `223034929697` does have images, but `BOJ + 2023-03-04` now resolves to two posts, so it no longer isolates a one-post export scope.
  Evidence: live `getAllPosts()` output showed both `223034929697` and `223034207704` on `2023-03-04` in category `85`.
- Observation: category `NestJS` currently has one post and its parsed block list includes an image, which makes it a faster live upload target than broader categories.
  Evidence: live `scanBlog()` returned `NestJS` with `postCount: 1`, and `fetchPostHtml("222990202785")` parsed into `paragraph,image`.
- Observation: repository-wide `pnpm typecheck` is not currently green even before exercising the new live upload path.
  Evidence: `scripts/lib/single-post-metadata-cache.ts` and `tests/single-post-metadata-cache.test.ts` both fail because `SinglePostFetcher` now requires `fetchBinary`.
- Observation: forcing the live upload step into the existing `pull_request` workflow means fork PRs can fail before code quality is evaluated, because repository secrets are not exposed there.
  Evidence: the workflow now sources `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN` from repository secrets under `.github/workflows/required-checks.yml`.
- Observation: once repo/path and branch were fixed, the extra provider env knobs only added variance without improving coverage.
  Evidence: the test now needs only `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN` while still exercising the same HTTP export and PicGo upload path.
- Observation: loading `.env` inside the test keeps local UX simple without changing unrelated runtime entrypoints.
  Evidence: `tests/naver.upload.integration.test.ts` now populates `process.env` from `.env` before resolving the live upload config.
- Observation: fixing the branch to `master` is better than keeping a branch env because local and CI setup no longer carry an unnecessary override surface.
  Evidence: the live harness now resolves the GitHub provider branch to `master` without reading env.

## Decision Log

- Decision: keep the live upload test outside `check:full` and expose it as `pnpm test:network:upload`.
  Rationale: the command creates external side effects, needs secrets, and should never run accidentally in default local or CI validation.
  Date/Author: 2026-04-17 / Codex
- Decision: require `FAREWELL_UPLOAD_E2E=1` in addition to provider-specific env vars.
  Rationale: secrets alone should not be enough to trigger a real upload by accident.
  Date/Author: 2026-04-17 / Codex
- Decision: use `mym0404/222990202785` as the live export target and fail early if its scope stops resolving to exactly one post.
  Rationale: this keeps runtime short while making scope drift obvious instead of silently uploading a larger batch.
  Date/Author: 2026-04-17 / Codex
- Decision: follow the user request literally and place the live upload test in the always-on PR workflow instead of keeping it manual-only.
  Rationale: the user explicitly asked for GitHub Actions to run it always; the resulting fork-secret limitation is documented rather than silently avoided.
  Date/Author: 2026-04-17 / Codex
- Decision: fix the upload destination to GitHub `mym0404/image-archive` and path `/` instead of accepting provider/repo/path env overrides.
  Rationale: the user standardized the destination, so removing the extra env surface makes local and CI setup simpler and less error-prone.
  Date/Author: 2026-04-17 / Codex
- Decision: manage the live upload credential contract through root `.env` rather than ad-hoc shell exports.
  Rationale: the user explicitly wanted `.env` management; CI can still comply by materializing the same `.env` file before the test step.
  Date/Author: 2026-04-17 / Codex
- Decision: fix the upload branch to `master`.
  Rationale: the user explicitly asked for `master` as the only live upload branch, so keeping a branch env only adds an invalid configuration path.
  Date/Author: 2026-04-17 / Codex

## Outcomes & Retrospective

The repository now has a clear boundary between mocked upload validation and live upload validation. Mocked smoke and stubbed server tests still cover default regression loops, while the new command provides a deliberate, credentials-backed proof path for real upload behavior against the fixed GitHub destination `mym0404/image-archive` at `/`. The workflow now also attempts the live upload test on every non-draft PR. The remaining gaps are evidence and ambient repo health: the new test still needs one real run with provider credentials to capture a passing transcript, repository-wide `pnpm typecheck` still has unrelated pre-existing failures outside this change, and fork PR behavior remains a documented tradeoff.

## Context and Orientation

The live export path starts in `src/server/http-server.ts`. Its `/api/export` route creates an export job, runs `src/modules/exporter/naver-blog-exporter.ts`, and stores per-post upload candidates in the in-memory job store. The `/api/export/:jobId/upload` route then takes `providerKey` and `providerFields`, passes them into `src/modules/exporter/picgo-upload-phase.ts`, and rewrites exported Markdown plus `manifest.json` through `src/modules/exporter/picgo-upload-rewriter.ts`.

Today the repository already has two kinds of upload verification. `scripts/harness/run-ui-smoke.ts` drives a mocked browser flow that simulates `upload-ready -> uploading -> upload-failed -> retry -> upload-completed`. `tests/http-server.test.ts` verifies the server upload contract with mocked upload runners and rewriters. Neither path proves that a real public post can be fetched, exported, uploaded through PicGo, and rewritten end to end. This plan adds that missing proof as an opt-in integration test under `tests/`.

## Plan of Work

Add one new integration test file at `tests/naver.upload.integration.test.ts`. The file should load root `.env`, skip entirely unless `FAREWELL_UPLOAD_E2E=1`, use GitHub `mym0404/image-archive` with fixed `master` branch and path `/`, and fail immediately if the enable flag is set without `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`. The test should start the real HTTP server, create a temp output directory, export one real `mym0404` post using `download-and-upload`, wait for `upload-ready`, submit the real upload request, wait for `upload-completed`, and then verify that both the manifest and the written Markdown now contain uploaded absolute URLs instead of local asset references.

Update `package.json` to add a dedicated `pnpm test:network:upload` command. Keep `pnpm test:network` and `pnpm check:full` unchanged so default validation never creates remote state. Update `.agents/knowledge/engineering/validation.md` and `README.md` so the new command, its opt-in nature, and the reduced `.env`-based contract are discoverable from the repository’s validation guidance.

## Concrete Steps

From `/Users/mj/projects/farewell-naver-blog`, run:

    pnpm typecheck
    pnpm exec vitest run tests/naver.upload.integration.test.ts --silent

Without env vars, the second command should report one skipped test.

When credentials are available, run:

    cp .env.example .env
    pnpm test:network:upload

## Validation and Acceptance

The local acceptance bar without secrets is that `pnpm typecheck` passes and `pnpm exec vitest run tests/naver.upload.integration.test.ts --silent` reports the live upload test as skipped instead of failing.

The live acceptance bar with secrets is that `pnpm test:network:upload` finishes successfully, the test reaches `upload-completed`, the fetched manifest contains uploaded absolute asset URLs, and the exported Markdown file no longer contains the original local asset references recorded during `upload-ready`.

## Idempotence and Recovery

The local temp output directory is always deleted in `afterEach`, so rerunning the test does not leave local export state behind. Because the destination is fixed to `mym0404/image-archive` at `/`, repeated runs can overwrite the same remote asset paths for the same source post; that is now an intentional property of the test contract. `.env` is ignored by git and `.env.example` is the safe template to copy. The command is intentionally excluded from `check:full`, so accidental repeated remote uploads should only happen when a contributor explicitly re-runs the opt-in command.

## Artifacts and Notes

Important live values discovered during implementation:

    target blog: mym0404
    target post: 222990202785
    target category: NestJS (id 102)
    target scope behavior: one post, one body image, one thumbnail

## Interfaces and Dependencies

`tests/naver.upload.integration.test.ts` must import the real `createHttpServer`, `NaverBlogFetcher`, and `defaultExportOptions` modules. The environment contract at the end of this change is:

- `FAREWELL_UPLOAD_E2E=1` to enable real upload.
- `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN` for GitHub `mym0404/image-archive`.

Revision note: 2026-04-17. Added a new ExecPlan for opt-in live upload verification because the repository already had mocked upload coverage but no real network upload proof path.
