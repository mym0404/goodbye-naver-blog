# Agent Guide

## Project Overview

- This repository is a local export tool for public blog posts, with concrete blog packages for supported blog platforms.
- It scans posts, parses blog/editor-specific content into blocks, renders Markdown, writes assets, and keeps resumable export state.
- The repo maintains a React web UI, server API, export engine, fixture regression tests, local browser e2e coverage, and live network e2e coverage.

## Tech Stack

- Runtime versions are pinned by `mise.toml`: Node.js, pnpm, and Bun.
- Run repo commands through `mise exec -- pnpm ...`.
- The codebase uses TypeScript ESM, React, Vite, Primer React, Octicons, Oxfmt, Oxlint, Vitest, and Playwright.

## Project Structure

```text
.
|-- AGENTS.md                 # agent entry and knowledge router
|-- .agents/knowledge/        # evergreen repo-local agent knowledge
|-- packages/domain/          # shared contracts and pure option/path logic
|-- packages/engine/          # blog interfaces, render/export/assets/upload rewrite
|-- packages/blog-naver/      # concrete Naver blog adapter
|-- packages/blog-tistory/    # concrete Tistory blog adapter
|-- packages/server/          # local HTTP API, jobs, state, upload catalog, static serving
|-- packages/web/             # React export wizard, Storybook view, UI primitives
|-- scripts/                  # single-post, evidence, Storybook, maintenance CLIs
|-- tests/                    # Vitest/Playwright tests, fixtures, shared test support
|-- package.json              # repo-native commands
|-- pnpm-workspace.yaml       # package workspace
`-- mise.toml                 # toolchain source of truth
```

## Architecture

- Main runtime starts in the server package and serves the web UI plus HTTP APIs.
- Core identity is `blogKey`, `sourceId`, `postId`, and `sourceInput`; concrete platform details stay in the owning `blog-*` package.
- Shared cross-package contracts live in owning folders under `schema/`.
- Shared utilities live in owning folders under `util/`; a single exported utility uses the function name as the file name.
- Dependency direction is `web -> domain`, `server -> domain, engine, blog-*`, `engine -> domain`, and `blog-* -> domain, engine`.
- Read `.agents/knowledge/architecture.md` before changing package boundaries or runtime flow.

## Design System

- UI rules live in `.agents/knowledge/DESIGN.md`.
- UI changes use Primer React components, Octicons, Primer `sx` styling, and dark/light wizard patterns.
- Page layout decisions follow `.agents/knowledge/DESIGN.md` and Primer Layout foundations before custom structures.
- Keep global CSS limited to reset/base document concerns; do not add component styling, theme overrides, or Primer lookalike rules there.
- Do not add shadcn, Radix UI wrappers, Remix icons, Tailwind utilities, or compatibility shims.

## Operating Rules

- Keep changes surgical and match nearby code style.
- Do not create branches, commits, pushes, PRs, or worktrees unless the user explicitly asks.
- Keep temporary harness/config output under repo-local `tmp/` or `.cache/` as documented.
- Do not preserve legacy compatibility shims unless the user explicitly asks for backward compatibility.
- Prefer Vitest for unit/integration/blog checks and Playwright Test for local/live browser e2e; do not add new custom test runners or validation scripts when a standard runner can express the check.
- Test design and browser e2e management rules live in `.agents/knowledge/test-management.md`.

## Validation Routes

- `mise exec -- pnpm check:test`: Vitest unit, integration, fixture, and blog checks.
- `mise exec -- pnpm check:coverage`: Vitest unit, integration, fixture, and blog checks with coverage thresholds.
- `mise exec -- pnpm build:ui && mise exec -- pnpm check:playwright`: Playwright local and live e2e checks against the built web UI.
- `check:playwright` uses live services and its upload scenario creates remote state when credentials are available.
- `mise exec -- pnpm check:unused`: dead-code and unused export baseline; run after deleting, moving, or renaming code.
- `mise exec -- pnpm check:fmt`, `check:lint`, `check:type`, `check:storybook`, `build:server`, and `build:ui`: focused static/build/catalog checks.
- Full validation details and blind spots live in `.agents/knowledge/verification.md`.

## Knowledge Router

- Runtime ownership, domain concepts, dependency boundaries: `.agents/knowledge/architecture.md`
- TypeScript, utilities, comments, tests, documentation: `.agents/knowledge/code-style.md`
- Parser routing, block contracts, props, presets, quality criteria: `.agents/knowledge/parser-blocks.md`
- Upload, resume, manifest, and URL rewrite behavior: `.agents/knowledge/upload.md`
- Test case shape, local/live e2e boundaries, runtime cost: `.agents/knowledge/test-management.md`
- Commands, CI, verification layers, manual browser checks: `.agents/knowledge/verification.md`
- UI layout, Primer component use, forms, responsive behavior: `.agents/knowledge/DESIGN.md`
- Live sample fixture contracts and cache behavior: `.agents/knowledge/fixtures.md`
- Single-post inspection, source capture, and Markdown evidence: `.agents/knowledge/post-evidence.md`

## Knowledge System

- Root `AGENTS.md` is the primary knowledge store and the only router.
- Evergreen repo-local knowledge lives under `.agents/knowledge/*`.
- Update this file and the relevant knowledge documents in the same change whenever structure, runtime entrypoints, validation commands, ownership boundaries, or documented behavior change.
- Task-local scope, temporary criteria, one-off preferences, and examples are not durable repository knowledge unless the user explicitly makes them general or code changes make them current truth.
- Current knowledge describes the existing repository state and must not be used by itself to reject intentional functional or structural changes.
