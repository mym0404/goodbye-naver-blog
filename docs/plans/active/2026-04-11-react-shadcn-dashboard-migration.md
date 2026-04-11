# React + shadcn Dashboard Runtime Migration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

After this change, the export dashboard will stop being a static HTML page driven by manual DOM mutation and become a React application whose state, rendering, and interaction logic are explicit component code. The visual language must not become a generic starter app: it must keep the current bright analysis-dashboard design, the left navy sidebar, the KPI strip, the same export workflow, and the same behavior the user already has today.

The user-visible outcome is concrete. After building the client bundle and starting the server, the browser should open the same export workflow, but the interface will now be composed from shadcn/ui components, the preview and modal Markdown rendering will use a real React Markdown renderer instead of the current string-replacement renderer, and repeated alignment bugs such as unstable pills, mismatched row heights, or broken segmented toggles will be systematically removed through five screenshot review passes. The final result must still scan, preview, export, poll job status, filter completed items, and open the Markdown modal exactly as it does now.

## Progress

- [x] (2026-04-11 04:00Z) Inspected `AGENTS.md`, `.agents/PLANS.md`, `docs/plans/README.md`, the current active plan, `package.json`, `tsconfig.json`, `src/server/http-server.ts`, `src/static/*`, and the browser smoke harness.
- [x] (2026-04-11 04:01Z) Reviewed Build Web Apps guidance for `shadcn` and `frontend-skill`, and confirmed this repository has no existing `components.json`.
- [x] (2026-04-11 04:02Z) Queried current shadcn/ui guidance and confirmed that an existing project needs an explicit `components.json`, Tailwind CSS entry file, and alias mapping.
- [x] (2026-04-11 04:05Z) Collected migration concerns from three sub-agents covering runtime/build risks, test/CI risks, and UI quality risks.
- [x] (2026-04-11 13:20Z) Added `vite.config.ts`, `components.json`, React dependencies, root `index.html`, and `src/ui/*` so the client now builds into `dist/client` and is served by `src/server/http-server.ts`.
- [x] (2026-04-11 13:27Z) Moved the dashboard runtime into `src/ui/App.tsx`, feature folders, and `use-export-job.ts`, while preserving smoke-critical ids and `data-*` selectors.
- [x] (2026-04-11 13:29Z) Replaced the browser Markdown string renderer with `src/ui/lib/markdown.tsx` using `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and `rehype-sanitize`.
- [x] (2026-04-11 13:45Z) Completed five screenshot review passes under `docs/generated/ui-review/round-01` through `round-05`, tightening helper-text reservation, chip height stability, muted-text contrast, and inner-panel separation.
- [x] (2026-04-11 13:46Z) Added direct React tests for `App`, `ExportOptionsPanel`, `useExportJob`, API helpers, Markdown rendering, and shadcn wrappers so `pnpm test:coverage` keeps the React runtime inside the 90% gate.
- [x] (2026-04-11 13:47Z) Updated knowledge and runbooks so `src/ui/*` is documented as the primary dashboard runtime.
- [x] (2026-04-11 13:55Z) Removed `src/static/*`, removed legacy server fallback, and changed `pnpm start` to build the React client before serving.

## Surprises & Discoveries

- Observation: there is no frontend build layer today. The repository only has Node server scripts plus `tsc`, and the HTTP server directly serves `src/static/index.html`, `app.js`, and `styles.css`.
  Evidence: `package.json` has no React, Vite, Tailwind, or shadcn dependencies, and `src/server/http-server.ts` hard-codes `/`, `/app.js`, and `/styles.css`.

- Observation: the current TypeScript config only includes `.ts` files, not `.tsx`, and it does not enable JSX.
  Evidence: `tsconfig.json` includes `src/**/*.ts` and `tests/**/*.ts` only.

- Observation: the current browser smoke test is tightly coupled to specific `id` and `data-*` attributes. A “full React rewrite” that casually renames elements would fail immediately even if the UI looks correct.
  Evidence: `scripts/harness/run-ui-smoke.ts` directly uses selectors such as `#blogIdOrUrl`, `#scan-button`, `#preview-markdown`, `#job-file-tree`, and `#markdown-modal-body`.

- Observation: the current design knowledge already contains a drift bug. The design document says the sidebar is `272px`, while the actual CSS uses `248px`.
  Evidence: `.agents/knowledge/product/ui-dashboard-design-system.md` and `src/static/styles.css` disagree on the sidebar width.

- Observation: several layout instabilities are produced by global or DOM-injected styling rather than business logic. These issues will resurface during the React migration if the new component boundaries do not explicitly reserve helper-text space and control heights.
  Evidence: `src/static/app.js` appends `.field-help` nodes dynamically, `frontmatter-row` height depends on error state and alias text, and the preview segmented control currently sits under a global mobile `button { width: 100%; }` rule.

- Observation: the current client Markdown renderer is not worth preserving. It is a custom string parser using `innerHTML`, and its known failure mode is that richer Markdown support always becomes an ad-hoc regex change.
  Evidence: `src/static/app.js` defines `renderMarkdownToHtml` inline and manually handles only a small subset of Markdown blocks.

## Decision Log

- Decision: this work will use a new ExecPlan file instead of rewriting `docs/plans/active/2026-04-11-export-options-job-filetree-coverage.md`.
  Rationale: the old plan is about feature expansion inside the static dashboard, while this task changes the UI runtime itself and needs a separate migration story.
  Date/Author: 2026-04-11 / Codex

- Decision: use React for state and rendering, Vite for browser bundling, Tailwind CSS plus shadcn/ui for component styling, and keep the Node HTTP server plus existing API routes.
  Rationale: the user explicitly rejected Next.js, the repo already has a Node server that owns the export APIs, and Vite is the smallest browser build tool that fits the current single-server workflow.
  Date/Author: 2026-04-11 / Codex

- Decision: create `components.json` manually instead of running a one-shot `shadcn init` that rewrites the repository around a pure frontend template.
  Rationale: this is not a blank frontend app. The repository must preserve its existing server scripts, tests, and layout, so manual configuration is more predictable than letting the CLI reshape the project.
  Date/Author: 2026-04-11 / Codex

- Decision: preserve the current HTTP API contract and preserve the current smoke-critical DOM selectors during the first React migration pass.
  Rationale: `scripts/harness/run-ui-smoke.ts` and the browser runbook both assume those contracts today. Keeping them stable reduces the number of simultaneous failures.
  Date/Author: 2026-04-11 / Codex

- Decision: replace the custom browser Markdown renderer with `react-markdown` plus `remark-gfm`, `remark-math`, and a sanitizing HTML pipeline rather than porting the existing regex parser.
  Rationale: the current renderer is already a maintenance problem, and the user explicitly called out the modal renderer as too weak.
  Date/Author: 2026-04-11 / Codex

- Decision: keep the current visual design system rather than adopting shadcn defaults blindly.
  Rationale: the user explicitly asked to keep the design system, and the repository already has documented color, typography, spacing, and layout rules that must remain the source of truth.
  Date/Author: 2026-04-11 / Codex

- Decision: the screenshot review loop will be a first-class milestone, not an informal “final polish” step.
  Rationale: the reported problems are specifically visual regressions such as alignment drift and chips changing height, which are easiest to catch through repeated screenshots instead of unit tests alone.
  Date/Author: 2026-04-11 / Codex

## Outcomes & Retrospective

This plan is now implemented. The dashboard runtime is React + Vite with shadcn source components, the Node server still owns the export APIs, and the browser entry path is now only the built client bundle under `dist/client`. The migration kept smoke-critical selectors stable, replaced the modal and preview renderer with a real React Markdown pipeline, and added direct React tests so the new UI stays inside the existing coverage gate.

The five screenshot passes were not decorative. Round 1 established parity, Round 2 exposed muted-text and helper-space instability, Round 3 surfaced low-contrast labels inside the status board, Round 4 fixed chip and badge readability, and Round 5 confirmed that the final panel separation and mobile layout were stable enough to stop. The legacy static runtime was removed after parity and coverage were proven, so the repository now has a single browser implementation path.

## Context and Orientation

This repository has two major surfaces today. The first surface is the export engine, which fetches and parses Naver Blog posts into Markdown. That work lives under `src/modules/*`, `src/shared/*`, and `src/server/*`. The second surface is the browser dashboard, which is currently a single static page plus one large browser script. That dashboard lives in `src/static/index.html`, `src/static/app.js`, and `src/static/styles.css`.

The Node HTTP server in `src/server/http-server.ts` serves two kinds of things. It serves files for the dashboard, and it serves JSON APIs such as `/api/export-defaults`, `/api/scan`, `/api/preview`, `/api/export`, and `/api/export/:jobId`. Those APIs already power the current dashboard and must remain stable during this migration. The browser smoke test in `scripts/harness/run-ui-smoke.ts` drives the page through scan, preview, export, filter, and modal interactions using fixed DOM selectors.

React in this plan means that the browser interface is rendered from component functions instead of string templates and direct DOM mutation. A React hook is React’s way to keep component state and browser side effects, such as interval polling, inside ordinary functions. Vite in this plan means a browser build tool that turns `.tsx`, CSS, and imported assets into a production-ready client bundle that the existing Node server can serve. shadcn/ui in this plan means source files copied into this repository, not a closed external widget library. The copied component source will live in this repository and can be styled to match the existing design system.

The current dashboard behavior is already feature-rich. It can scan a blog, render category selection, show option descriptions and frontmatter alias controls, build a preview in source/split/rendered modes, submit exports, poll in-memory job state, show completed items, filter warning/error results, and open a Markdown modal. This plan must migrate that behavior, not shrink it. The current active plan at `docs/plans/active/2026-04-11-export-options-job-filetree-coverage.md` is useful historical context for what the static dashboard already does, but this document includes the migration-specific instructions and does not rely on the reader knowing that older plan.

## Plan of Work

Milestone 1 establishes the new client runtime without changing the export APIs. Add browser dependencies and build tooling at the repository root: React, React DOM, Vite, the Vite React plugin, Tailwind CSS, the shadcn CLI dependency path, and testing dependencies for React component tests. Update `tsconfig.json` so it can type-check `.tsx` files, set `jsx: "react-jsx"`, and add a path alias that maps `@/*` to the new browser source tree. Create `vite.config.ts` so the client builds into `dist/client` and imports from `src/ui/*`. Create `components.json` manually so shadcn knows the CSS entry file, alias paths, icon library, and that this repository is not using React Server Components. Create the initial client entry files: `src/ui/main.tsx`, `src/ui/App.tsx`, `src/ui/styles/globals.css`, `src/ui/lib/cn.ts`, and a minimal mount shell that renders the existing dashboard frame. Update `src/server/http-server.ts` so `/` and browser asset requests serve the Vite output from `dist/client`. The milestone is complete when `pnpm build:ui` produces `dist/client/index.html`, the Node server serves that bundle, and the rendered shell still contains the smoke-critical root elements the later milestones will fill.

Milestone 2 moves state and interaction logic out of `src/static/app.js` into React features and hooks while preserving behavior. Create feature folders under `src/ui/features/scan`, `src/ui/features/options`, `src/ui/features/preview`, and `src/ui/features/job-results`, plus shared hooks under `src/ui/hooks`. Move the current global browser state into React state and hooks. The export job polling logic must become a hook that starts and stops safely, avoids stale interval closures, and exposes `status`, `summary`, `items`, `logs`, and `manifest` to the components that need them. Keep the existing HTTP payload shapes from `src/server/http-server.ts`; the React client should adapt to those payloads rather than demanding API rewrites. Preserve the existing selectors used by `scripts/harness/run-ui-smoke.ts` by keeping the same stable `id` or `data-*` markers on the new React-rendered DOM. The frontmatter alias validation should become ordinary React form state instead of the current “append nodes, then bind listeners” sequence. The milestone is complete when scan, category selection, option editing, preview loading, export submission, job polling, file-tree filtering, and modal opening all work from React while the API routes remain unchanged.

Milestone 3 swaps raw markup for shadcn/ui composition and replaces the browser Markdown viewer. Before adding any components, inspect the project context again with the shadcn CLI and fetch component docs for the exact primitives needed. Use shadcn source components for the parts that match the current UI: `Button`, `Input`, `Select`, `Checkbox`, `Card`, `Dialog`, `ScrollArea`, `Badge`, `Separator`, `ToggleGroup`, `Table`, and `Alert`. If a dedicated `Sidebar` primitive is available and fits the current shell, use it; otherwise keep the existing two-column shell but build its inner parts from shadcn primitives. Keep the documented bright dashboard tokens from `.agents/knowledge/product/ui-dashboard-design-system.md` by mapping them into the new Tailwind CSS variables instead of accepting shadcn defaults. In the same milestone, add a proper React Markdown pipeline in `src/ui/lib/markdown.tsx` using `react-markdown`, `remark-gfm`, `remark-math`, and sanitized HTML handling so preview rendered mode and the modal can display tables, lists, blockquotes, inline code, fenced code, and formulas without `dangerouslySetInnerHTML`. The milestone is complete when the preview’s `결과보기` and the modal both use the React Markdown path and the UI still matches the established design direction rather than a stock shadcn demo.

Milestone 4 is the deliberate visual hardening pass. Normalize the known alignment and chip-height risks before calling the migration done. First, remove the `272px` versus `248px` sidebar drift by choosing one width and updating both code and knowledge. Second, fix toolbar and pill sizing so status pills and action groups do not change row height when labels grow. Third, reserve space for helper text in option cards so cards do not become visibly uneven when descriptions or validation messages appear. Fourth, stabilize frontmatter rows so long descriptions, alias fields, disabled state, and error state stay aligned. Fifth, ensure segmented controls, filter pills, badges, and chips keep a fixed height on both desktop and mobile. This milestone must include five screenshot review passes. Each pass captures one desktop screenshot at `1440px` width and one mobile screenshot at `375px` width, then records the observed issues and the fixes made before the next pass. The passes must cover the five states identified during planning: idle shell, post-scan category list, option/frontmatter validation stress, completed job with warning/error filters plus modal open, and mobile layout with preview toggle and filter chips. The milestone is complete only after all five passes are recorded in this document and no pass reveals unresolved layout drift.

Milestone 5 finishes the migration by updating tests, coverage, documentation, and removing the legacy browser runtime. Add React component tests under `tests/ui/*.test.tsx` with a `jsdom` environment and shared setup so the client state hooks, segmented preview modes, alias validation, filter pills, modal scroll container, and Markdown renderer all have direct tests. Update `vitest.config.ts` so the new React source tree counts toward coverage and so the React tests run in the correct environment without weakening the existing 90% gate. Update `scripts/harness/run-ui-smoke.ts` only where the React migration truly requires it; do not broaden its scope gratuitously. Once the React client is feature-complete and the smoke harness passes against it, remove the legacy browser runtime files and server fallback branches. Then update `README.md`, `.agents/knowledge/engineering/stack.md`, `.agents/knowledge/engineering/validation.md`, `.agents/knowledge/product/product-outline.md`, `.agents/knowledge/product/ui-dashboard-design-system.md`, `docs/runbooks/browser-verification.md`, and `docs/index.md` so the repo no longer describes the static dashboard as the primary runtime. The milestone is complete when the repository’s documented UI source of truth is the React client and `pnpm check:full` plus `pnpm test:coverage` still pass.

## Concrete Steps

Work from `/Users/mj/projects/farewell-naver-blog`.

Start by creating the browser toolchain and shadcn project metadata. Run these commands from the repository root:

    pnpm add react react-dom react-markdown remark-gfm remark-math rehype-katex rehype-sanitize
    pnpm add -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom @testing-library/react @testing-library/user-event @testing-library/jest-dom

Create `components.json` manually instead of using a one-shot frontend template. The file must point shadcn at the new UI tree and CSS entry file. Use `rsc: false`, `tsx: true`, a CSS path under `src/ui/styles/globals.css`, and aliases rooted at `src/ui`.

After the manual config exists, inspect the available component docs and add the primitives needed for the dashboard:

    pnpm dlx shadcn@latest info
    pnpm dlx shadcn@latest docs button dialog scroll-area badge separator toggle-group input select checkbox card table alert
    pnpm dlx shadcn@latest search @shadcn -q "sidebar"

If the search returns a suitable sidebar primitive, install it. Otherwise keep the shell custom and only install the other primitives:

    pnpm dlx shadcn@latest add button dialog scroll-area badge separator toggle-group input select checkbox card table alert

Add the Vite client entry points and build command. At the end of this step, `package.json` must include:

    "build:ui": "vite build",
    "smoke:ui": "pnpm build:ui && tsx scripts/harness/run-ui-smoke.ts"

The server must then serve `dist/client/index.html` and the files under `dist/client/assets/` for non-API browser requests. Do not change the JSON APIs.

When the React shell exists, migrate the static logic from `src/static/app.js` in pieces rather than rewriting everything in one component. Move browser code into these units:

    src/ui/hooks/use-export-job.ts
    src/ui/features/scan/*
    src/ui/features/options/*
    src/ui/features/preview/*
    src/ui/features/job-results/*
    src/ui/lib/markdown.tsx

As each unit moves, keep the same visible behavior and keep the selectors used by `scripts/harness/run-ui-smoke.ts`.

For the five-pass screenshot review loop, add a capture option to the Playwright harness or a companion script so the review can be repeated. The command should be stable and should write screenshots into a generated folder, for example:

    pnpm smoke:ui -- --capture-dir docs/generated/ui-review/round-01

Repeat that command five times after each batch of UI fixes, storing the captures under `round-01` through `round-05`, and update the `Progress`, `Surprises & Discoveries`, and `Outcomes & Retrospective` sections after each pass.

## Validation and Acceptance

Acceptance is behavior-based and must be checked from the repository root.

The build foundation is accepted when `pnpm build:ui` succeeds and produces `dist/client/index.html`, `dist/client/assets/*`, and a server start followed by visiting `http://localhost:4173/` loads the React-rendered dashboard instead of the old source-served static script.

The React state migration is accepted when `pnpm smoke:ui` passes without relying on the old `src/static/app.js`, and the following behavior is still true in the browser:

1. Enter `mym0404`, click scan, and see scan completion plus category options.
2. Trigger a frontmatter alias collision and see export become disabled.
3. Request preview and see source mode, split mode, and rendered mode all update from the same preview payload.
4. Start an export and see status, summary, logs, completed items, filters, and modal content update while the job runs.

The Markdown renderer is accepted when the preview `결과보기` and the modal both render frontmatter as a readable metadata block, render GFM tables and lists correctly, preserve blockquotes and fenced code blocks, and do not rely on `dangerouslySetInnerHTML`. A human should be able to compare the current exported Markdown against the rendered view and recognize tables, lists, code, and warning callouts as structured content instead of plain text.

The screenshot hardening milestone is accepted only when five review rounds are stored and recorded. Each round must include one desktop and one mobile screenshot and must explicitly say what was checked and what changed. The final screenshots must show:

1. Sidebar, topbar, and KPI strip aligned on desktop.
2. Status pills, filter chips, preview segmented buttons, and badges staying at a stable height.
3. Option cards and frontmatter rows staying aligned even with long helper text and error states.
4. Modal content scrolling correctly inside the dialog instead of the whole page locking up.
5. Mobile `375px` layout showing no horizontal scrolling.

The final repository validation is accepted when all of the following commands pass:

    pnpm typecheck
    pnpm test:offline
    pnpm test:coverage
    pnpm samples:verify
    pnpm smoke:ui
    pnpm check:full

Coverage is only accepted if the new React client code is included in the measured set rather than sitting outside the gate.

## Idempotence and Recovery

This migration should be carried out so that each step is safe to rerun. `pnpm build:ui` must be repeatable and should simply replace the client bundle under `dist/client`. The server should not mutate source files while serving the built UI.

If a React migration step breaks the browser flow halfway through, recover by keeping the API contract stable and restoring the previously passing smoke selectors before making deeper design changes. If the client bundle fails to build, the safe recovery move is to fix the Vite or TypeScript configuration first rather than editing the export APIs. If a screenshot review pass reveals a visual regression, do not continue to the next pass until the current pass’s issues are either fixed or explicitly recorded as blockers in this plan.

During the transition, do not delete the legacy runtime until the React client has reached feature parity and `pnpm smoke:ui` passes against the new client. This migration now satisfies that condition and uses only the React path.

## Artifacts and Notes

The most important evidence for this plan should remain short and reproducible.

Expected build evidence:

    $ pnpm build:ui
    vite vX.Y.Z building for production...
    dist/client/index.html
    dist/client/assets/...

Expected smoke evidence:

    $ pnpm smoke:ui
    smoke:ui passed (<job-id>)

Expected screenshot evidence:

    docs/generated/ui-review/round-01/desktop-overview.png
    docs/generated/ui-review/round-01/mobile-overview.png
    ...
    docs/generated/ui-review/round-05/desktop-overview.png
    docs/generated/ui-review/round-05/mobile-overview.png

Expected React Markdown evidence:

    preview rendered pane shows frontmatter section, table rows, list items, blockquotes, and fenced code
    modal body scrolls inside the dialog and keeps header/actions visible

## Interfaces and Dependencies

At the end of this work, the repository must contain a browser source tree rooted at `src/ui/`. The minimum stable files are `src/ui/main.tsx`, `src/ui/App.tsx`, `src/ui/styles/globals.css`, `src/ui/lib/cn.ts`, `src/ui/lib/markdown.tsx`, and feature directories for scan, options, preview, and job results.

`src/server/http-server.ts` must keep the existing JSON API routes and their payload shapes. It must additionally serve the Vite-built client bundle from `dist/client`. The route handling for browser assets must no longer assume only three files. It must handle the generated bundle and asset files that Vite emits.

`components.json` must exist at the repository root and be configured for a Vite-based React project with `rsc: false`, a CSS entry file under `src/ui/styles/globals.css`, and aliases that point into `src/ui`. The copied shadcn component source must live inside this repository, not behind a runtime package abstraction.

The React Markdown path must use:

1. `react-markdown` for block rendering.
2. `remark-gfm` for tables, task lists, and GitHub-flavored Markdown.
3. `remark-math` so formulas are not dropped.
4. A sanitizing HTML path so the client does not reintroduce the current `innerHTML` risk.

The design system source of truth must stay in `.agents/knowledge/product/ui-dashboard-design-system.md`, but the code implementation must move from `src/static/styles.css` to the new Tailwind CSS and shadcn variable layer in `src/ui/styles/globals.css`. The actual color values, spacing intentions, typography, sidebar shell, KPI strip, bright cards, and ghost-button hierarchy must remain recognizable.

The test system must end with direct React component coverage. Add `tests/ui/*.test.tsx` and any required Vitest setup so the UI state, rendered preview modes, modal scroll container, and filter chips can be tested without relying only on Playwright.

Revision note: 2026-04-11. This ExecPlan was created after the user changed the UI direction from the existing static dashboard to a React + shadcn runtime, explicitly rejected Next.js, required the current design system to survive the migration, and required a five-pass screenshot self-review loop. The plan also incorporates sub-agent findings about missing frontend build tooling, smoke-selector fragility, coverage/CI risks, and known layout drift.
