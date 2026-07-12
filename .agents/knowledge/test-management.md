# Test Management

## SMURF Tradeoffs

- Evaluate test-suite changes across Speed, Maintainability, Utilization, Reliability, and Fidelity.
- Prefer focused Vitest coverage when it can catch the same defect with less runtime and setup than browser e2e.
- Add local browser e2e for user-visible integration boundaries that need real DOM, navigation, responsive layout, or API wiring.
- Add live e2e only when external-service fidelity provides evidence that deterministic local tests cannot provide.
- Improve one SMURF attribute without needlessly reducing the others; test count by itself is not a quality target.

## Test Case Shape

- Each meaningful behavior must be represented by its own `test` or `it` case.
- Do not hide independent browser scenarios behind bulk arrays, `Object.keys`, or loops that generate opaque test cases.
- Playwright e2e files may use helpers and shared fixtures, but the exported test list must read like the scenario list.
- Playwright `describe` nesting must stay at two levels or less.
- Use parameterized or discovered cases only when the data source itself is the contract, such as sample fixture directories.
- Put parser/editor variants in focused parser, renderer, fixture, or exporter tests instead of multiplying browser e2e scenarios.

## Browser E2E Shape

- Browser e2e specs live under `tests/e2e/scenarios`.
- Browser e2e grouping uses `local` and `live`; do not use `smoke` naming for files, describes, scripts, or docs.
- Playwright config runs one suite rather than separate `local`, `live`, or `smoke` projects.
- Local Playwright runs use 8 workers; CI uses 1 worker.
- `mise exec -- pnpm check:playwright` runs the local and live Playwright suite.
- `mise exec -- pnpm check:playwright:ui` opens Playwright UI mode for the same suite.

## Local E2E

- Local e2e must use mocked API responses and deterministic local assets instead of real blog or upload provider network calls.
- Local e2e should prove browser workflow, payload shape, resume state, upload progress, rendered result state, and error handling at the UI/API boundary.
- Output-adapter e2e must include at least one deterministic full export workflow case per adapter and assert the written document layout plus required adapter support files.
- Local e2e must own its server and state with isolated temp paths for settings, scan cache, post HTML cache, output, and route state.
- Local e2e should use test-owned servers that bind with `listen(0)` so parallel workers do not fight over a fixed port.
- Do not share persistent output folders or process-global mutable state across local e2e tests.

## Live E2E

- Live e2e is for the smallest external proof that local mocks cannot provide.
- Live e2e may scan public blog metadata when the user-facing flow requires it, but it must not duplicate the same workflow across multiple live blogs without a distinct product risk.
- Live e2e exports must narrow work with category/date scope or a single-post path whenever the flow allows it.
- Live upload e2e should seed scoped scan metadata when upload behavior, not scan behavior, is under test.
- Do not use live e2e to cover every parser/editor shape; sample fixtures and focused parser tests own that coverage.
- Live e2e that writes output must use unique temp/output paths and clean them up.
- Live upload e2e is the external proof for provider metadata, remote state, Markdown URL rewrite, and credential non-leakage.

## Logs And Diagnostics

- Passing e2e tests should not print progress logs.
- Use assertions, explicit error messages, Playwright traces, and test artifacts for diagnostics.
- Keep only process handshake output that the harness needs, such as live server readiness.

## Test Runtime Cost

- Avoid tests that fetch, parse, or export every post from a real public blog unless that full-blog behavior is the feature under test.
- If a scan API returns whole-blog metadata, do not call it repeatedly in live e2e for equivalent scenarios.
- Fixture regression may fetch one live post HTML per fixture because each fixture is a durable parser sample.
- Cache live sample HTML outside CI through the existing fixture cache; do not commit copied source HTML into fixtures.
