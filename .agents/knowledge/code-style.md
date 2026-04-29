# Code Style And Workflow

## Repo-Specific Priorities
- Prefer current code, tests, and package scripts over stale docs.
- Keep runtime code in `src/`. Fixture lists, coverage reports, harness metadata, and generated evidence stay outside runtime code.
- Parser, renderer, exporter, server, and UI contracts should stay visible in code or tests when they are mechanical.
- Commit, push, and PR creation require explicit user request.

## TypeScript
- The repo is strict TypeScript with NodeNext ESM.
- Use `.js` extensions in TS imports where NodeNext runtime imports require them.
- Reuse shared types from `src/shared/*` when crossing module or server/UI boundaries.
- Keep parser block output behavior aligned across `BaseBlock.outputOptions` arrays, editor `supportedBlocks` arrays, and `src/modules/blog/BaseBlog.ts`.
- This project does not preserve local schema backward compatibility unless explicitly requested. When an option/state contract changes, prefer the current schema and remove stale aliases or migration paths.
- Prefer `type` aliases for object shapes, unions, and inferred helper types; do not introduce `interface` unless an external API requires it.
- For finite runtime options, define `as const` arrays or objects and derive union types from them with `typeof`.
- Use `as const satisfies` for registries and status maps that need literal inference plus shared shape checking.
- Use `Record<Union, Value>` when a map should stay exhaustive over a known union.

## Runtime Modules
- Keep core runtime ownership under `src/modules/{domain}`; do not split module code by technical type first.
- Use classes for stateful services, editors, and parser blocks that own dependencies, caches, or shared behavior.
- Use `readonly` fields for constructor dependencies and long-lived state that should not be reassigned.
- Use `private` methods for internal multi-step class logic.
- Keep `createX` helpers for pure value construction, binding construction, or test/harness fixtures.
- Parser block implementations should extend `ContainerBlock` or `LeafBlock` and return literal parser results with `as const` when inference would widen status or block types.
- Keep editor and parser block relationships as direct `BaseBlock` instances inside each editor class.
- Keep one-block parser helper logic inside the concrete parser block file when it improves locality; split helpers only when reuse or readability clearly benefits.

## Date And Time
- Store manifest, job, and export timestamps as ISO strings from `new Date().toISOString()`.
- Use `Date.now()` only for elapsed-time checks, polling loops, temporary ids, or harness output paths.
- Keep display-only date formatting in shared formatting helpers instead of duplicating formatter setup.

## UI Code
- `src/ui/components/ui/*` is the shadcn primitive layer. Prefer feature composition, tokens, or helper classes before changing primitives.
- Use `@shared/*` and `@/*` aliases configured in `vite.config.ts` and `tsconfig.json`.
- UI tests should prefer user behavior, accessibility state, API contract, and visible text over className or computed-style assertions.
- Do not add native `<select>` for new dropdowns; use the existing shadcn `Select`.
- Do not mix icon sets; use `@remixicon/react`.
- Keep UI feature code under `src/ui/features/{domain}`.
- Keep cross-feature UI shell, hooks, and status helpers under `src/ui/features/common`.
- Keep primitive wrappers under `src/ui/components/ui`; do not move feature-specific behavior into primitives.

## Server And Harness
- User `pnpm dev` owns the normal development server path.
- Tests and harnesses should use isolated `FAREWELL_SETTINGS_PATH`, `FAREWELL_SCAN_CACHE_PATH`, and non-default `PORT` or `listen(0)`.
- Ad-hoc server checks should not share `.cache/export-ui-settings.json` with the user's development session.

## Documentation
- Evergreen repo knowledge lives in shallow `.agents/knowledge/*.md` files.
- `AGENTS.md` is the only router.
- Keep old/new narration, task logs, and cleanup history out of evergreen docs unless they describe a current operating constraint.
- Update relevant knowledge when parser block, sample fixture, renderer/exporter, upload/resume, or UI design contracts change.
