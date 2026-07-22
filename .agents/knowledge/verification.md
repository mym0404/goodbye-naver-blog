# Verification

## Source Of Truth

- Package scripts live in `package.json`.
- CI lives in `.github/workflows/required-checks.yml` and runs the full non-duplicated verification route for non-draft PRs.
- Tool versions live in `mise.toml`.
- Run local package scripts through `mise exec -- pnpm ...`.

## Runner Policy

- Unit, integration, parser, exporter, server, blog, and other non-browser checks belong in Vitest specs.
- Local and live browser end-to-end checks belong in Playwright Test specs.
- Use Vitest/Playwright config, fixtures, lifecycle hooks, reporters, filtering, and coverage before adding repo-specific runners.
- Standalone Bun scripts are acceptable for product CLIs, one-off maintenance commands, and manual evidence capture, not for checks that can be expressed as Vitest or Playwright tests.
- Verification commands must do real work directly; do not add alias-only verification scripts that merely redirect to another script.
- Use `check:*` for checks whose name would otherwise be ambiguous, and keep clear lifecycle commands such as `build:*` under their existing purpose-specific names.
- Test case shape, local/live e2e boundaries, parallel safety, and runtime-cost rules live in `.agents/knowledge/test-management.md`.

## Primary Commands

- `mise exec -- pnpm check:fmt`: format and import order check.
- `mise exec -- pnpm check:lint`: Oxlint baseline.
- `mise exec -- pnpm check:type`: fast TypeScript contract check without emitting build output.
- `mise exec -- pnpm build:server`: server TypeScript build check.
- `mise exec -- pnpm build:ui`: web production build check.
- `mise exec -- pnpm check:storybook`: generated Storybook catalog freshness check.
- `mise exec -- pnpm check:test`: full Vitest suite, including fixtures and blog integration checks.
- `mise exec -- pnpm check:coverage`: full Vitest suite with V8 coverage thresholds.
- `mise exec -- pnpm check:playwright`: Playwright local and live browser/network e2e suite against the current built web UI.
- `mise exec -- pnpm check:playwright:ui`: Playwright UI mode for the same local and live e2e suite.
- `mise exec -- pnpm exec playwright test tests/e2e/scenarios/output-adapters.spec.ts`: deterministic full export workflow e2e for every output adapter.
- Fumadocs adapter integration: create the current official app under repo-local `tmp/`, copy exported `content/docs` and `public`, build and start production mode, then open a generated `/docs/...` route.
- Docusaurus adapter integration: create the current official classic app under repo-local `tmp/`, copy exported `docs` and `static`, build and serve production output, then open the generated `/docs/...` route.
- Nextra adapter integration: create the current official Docs Theme App Router setup under repo-local `tmp/`, copy exported `content` and `public`, build and start production mode, then open the generated content route.
- Each MDX integration check covers target components or directives, navigation support files, image responses, browser errors, and console output.
- `mise exec -- pnpm check:unused`: unused source/test/script diagnostics.

## Focused Commands

- `mise exec -- pnpm format`: apply Oxfmt formatting/import sorting.
- `mise exec -- pnpm storybook:generate`: regenerate committed Storybook catalog.

## What Each Layer Proves

- Typecheck proves moved imports, shared contracts, and cross-package type compatibility.
- Vitest proves pure logic, parser block conversion, renderer, server, hook, fixture, blog, and generated catalog behavior.
- Export collision verification must cover both server preflight before output-root recreation and the engine guard before concurrent post writes.
- Storybook check proves generated catalog matches current parser/renderer output.
- Playwright proves browser workflow behavior with mocked APIs and live e2e behavior, including resume, provider setup, test upload, automatic upload progress, uploaded result links, and no manual upload POST.
- Live upload checks read `.env` locally and CI secrets in GitHub Actions.

## Blind Spots

- `check:playwright` includes live network cases; the upload case creates remote state when credentials are available.
- CI network e2e depends on upload secrets and live external services.
- Coverage does not replace behavior-specific parser, export, server, or browser e2e checks.

## Manual Browser Checks

- Use targeted browser validation for visible flow, layout, controls, or feedback changes after the affected automated checks pass.
- Do not reuse a user's development server. Start an isolated server with non-default `PORT`, separate `EXITPRESS_SETTINGS_PATH`, and separate `EXITPRESS_SCAN_CACHE_PATH` under repo-local `tmp/`.
- Confirm requested controls, progress, result state, and errors against API or manifest state.
- Confirm export reaches the expected `completed`, `failed`, `upload-completed`, or `upload-failed` state.
- Check desktop and mobile viewports for overflow, clipping, and readable contrast.
- For upload flows, verify provider setup appears before export, upload progress appears after export starts, and restored state does not resubmit credentials.
- For Storybook, confirm `Input HTML`, `Source Capture`, and `Markdown` describe the same block and bundled capture assets resolve.
- Record the URL, viewport, inputs, final job status, and visible failure details when a manual result is used as evidence.

## Task Loops

- Use focused commands while iterating only when the same class of check would otherwise be repeated frequently; run the affected verification commands before finishing.
- Do not run duplicated checks in sequence when a later command already includes the earlier one, such as `check:test` immediately before `check:coverage`.
- Documentation-only knowledge edits do not need browser e2e; verify routed paths, command existence, and changed Markdown content.
- Moving or deleting source, test, or script files requires `check:type` and `check:unused`.
- Parser changes require `check:test`.
- Export, manifest, upload, resume, UI state, server API, routing, static asset serving, or job-state changes require `build:ui` followed by `check:playwright`.
- Output-adapter changes require the adapter e2e spec plus one real parsed post to compile and render in the current official app for every affected MDX target. A lightweight Markdown preview does not prove MDX imports, target components, navigation support files, static assets, or production routing.
- Upload e2e changes must keep both local and live upload checks aligned with the current export-triggered upload flow.
- Live fetch/upload changes require `build:ui` followed by `check:playwright`.
