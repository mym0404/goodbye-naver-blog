# Sample Fixtures

## Source Of Truth
- Sample fixture directories live under `tests/fixtures/samples/*`.
- Each sample must contain either `expected.md` or `expected-error.md`.
- `tests/support/sample-fixtures.spec.ts` discovers directories dynamically.
- `tests/support/sample-fixtures.ts` parses expected frontmatter, fetches the live source post HTML from `blogKey`, `sourceId`, and `postId`, and renders it with fixture export options.
- Live sample HTML is cached under `tmp/harness/sample-post-html-cache` through the shared `BlogPostContentCache` interface outside CI.
- CI fixture runs bypass the sample HTML cache and fetch live HTML directly.
- Sample fixtures do not store source HTML files; update `blogKey`, `sourceId`, `postId`, and expected Markdown from the live post.
- The shared fixture harness normalizes volatile asset URLs so expected Markdown does not depend on request-specific download tokens.

## Fixture Options
- Sample fixture rendering uses `defaultExportOptions()`.
- Fixture rendering sets asset handling to remote references.
- Fixture rendering disables image and thumbnail downloads.
- Fixture rendering disables `exportedAt` frontmatter so expected Markdown stays stable.

## Sample Inventory
- The fixture directory tree is the source of truth for the current sample list.
- Do not mirror every fixture id in knowledge.
- Use `rg --files tests/fixtures/samples` or `tests/support/sample-fixtures.spec.ts` discovery behavior when the exact current set matters.

## Operating Rules
- Add or update the expected output file for each sample.
- Do not add fixture-local source HTML such as `post.html`; live public posts and the sample HTML cache are the source of input truth.
- `expected.md` and `expected-error.md` must start with YAML frontmatter containing title, source, blogKey, sourceId, postId, publishedAt, category, and categoryPath.
- `expected-error.md` must include an `error` frontmatter string.
- Fixture ids should describe editor and dominant block coverage.
- A parser block without a public sample should be covered by focused parser tests until a durable sample exists.
- Parser block, renderer, or export option changes that alter Markdown output or parser failure behavior must update the affected expected files intentionally.

## Verification
- `mise exec -- pnpm check:test`: runs sample fixture live-fetch regression with the rest of the Vitest suite.
- `mise exec -- pnpm check:coverage`: includes sample fixture coverage in the Vitest coverage run.
