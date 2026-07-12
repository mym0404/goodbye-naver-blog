# Code Style And Workflow

## Priorities
- Prefer the smallest code change that satisfies the current request.
- Match nearby patterns unless the current task intentionally changes the pattern.
- Use named exports.
- Prefer arrow functions for TypeScript/React functions.
- Avoid speculative abstractions, compatibility wrappers, and export barrels.

## TypeScript
- Put reusable or major exported contracts in the owning folder's `schema/` directory.
- Keep one-file-only local props inline unless naming them lowers reader effort.
- Do not create `Types.ts`, `*Types.ts`, compatibility re-export files, or `index.ts` barrels.
- If a schema file exports one main type, name the file after that type.
- If related types form one concept, group them under a representative feature name.
- Define literal unions with one const assertion source and derive the type from it.
- Prefer `type` aliases over `interface`.
- Prefer inference unless an exported API, public contract, or complex callback needs a named type.
- Do not use `any`, type-check suppression comments, or double-cast escape hatches.

## Utilities
- Put utilities in the owning folder's `util/` directory.
- A file with one exported utility is named after that function.
- Multiple exported utilities can share one file only when they belong to one clear concept.
- Do not create `*Utils.ts` files.

## Comments
- Add an English comment only when it explains a non-obvious guarantee or boundary.
- Do not comment obvious syntax or restate the identifier.
- Do not quote user prompts or task history in code comments.

## Tests
- Keep tests near the behavior they protect.
- Prefer pure logic, hook state-machine, parser, exporter, server, and blog tests over shallow UI text checks.
- Do not test Primer React internals.
- Use Playwright Test for browser workflow coverage.
- Do not add custom runners or validation scripts for checks that Vitest or Playwright can own.

## Documentation
- Keep knowledge documents current-state only.
- Do not document transition history or file inventories that code/tests already express.
