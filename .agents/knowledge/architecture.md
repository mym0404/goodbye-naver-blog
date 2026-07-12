# Architecture

## Runtime Shape

- The local server owns process startup, HTTP APIs, static serving, job state, local settings, and upload provider runtime metadata.
- The engine owns blog runtime interfaces, blog-neutral export units, output-profile adapters, document rendering, asset persistence, upload candidate handling, link rewrite, support-file generation, and export manifest writing.
- Concrete `blog-*` packages own blog-specific source parsing, fetching adapters, parser adapters, URL identity resolution, and blog workflows.
- The web package owns the browser wizard, Storybook surface, API client, and UI state.
- The domain package owns shared contracts and pure deterministic logic used across packages.
- Architecture work uses an abstract-first rule: shared contracts and engine flow start from `blogKey`, `sourceId`, `postId`, and `sourceInput`; concrete platform names belong only in the owning `blog-*` package, package-specific tests, fixtures, or user-facing platform selection UI.

## Main Flow

- Scan starts from the server API and delegates retrieval to the selected concrete blog package.
- Blog parser routing chooses the matching editor implementation and converts supported editor blocks into parsed blocks.
- Renderer turns parsed blocks and profile-specific templates into Markdown or MDX, resolves assets, and produces manifest-ready asset records.
- Export workflow writes documents/assets, lets the selected adapter create deterministic support files, updates job progress, persists resume data, and runs automatic upload/rewrite phases when `download-and-upload` is selected.
- Web reads bootstrap/defaults, drives scan/options/upload-provider-test/export actions through HTTP APIs, and displays progress from polled job state.

## Domain Concepts

- `blogKey` selects the concrete blog implementation.
- `sourceInput` is user input; a concrete blog resolves it to stable `sourceId` and source metadata.
- `postId` identifies one post within a source.
- A scan result contains source metadata, categories, and post summaries.
- An export selection combines category selection, date range, and search text.
- Parsed blocks carry a stable block key, props, template definitions, and asset metadata.
- Export options control paths, assets, profile-scoped block templates, frontmatter, upload, and naming.
- `gfm` keeps the category/post `index.md` layout. `fumadocs` writes `content/docs`, hierarchical `meta.json`, and `public`; `docusaurus` writes `docs`, category `_category_.json`, and `static`; `nextra` writes `content`, hierarchical `_meta.js`, and `public`. MDX adapters do not scaffold or overwrite target applications.
- A new export may recreate only a missing directory, an empty directory, or an existing Exitpress output root with a valid `manifest.json`. Never point export directly at a target application root; copy only the generated adapter directories into the application.
- Output adapters own document roots, extensions, path-segment compatibility, asset references, final document assembly, conditional imports, and support-file contents. Concrete blog packages own sparse target templates for their own block keys.
- Document paths are stable and path-safe; MDX adapters encode non-ASCII path segments to URL-safe ASCII while keeping visible titles and category metadata unchanged. Frontmatter includes only enabled fields under configured aliases, plus target-required metadata such as Nextra `asIndexPage`.
- Asset records distinguish local relative paths from remote URLs.
- Manifest state must be sufficient to restore export, upload, and result screens.
- Web state mirrors server bootstrap, scan cache, export options, job state, upload provider catalog, and theme preference.
- Persisted UI settings exclude transient job-only fields; resume state comes from manifest or local state rather than browser-only assumptions.

## Boundaries

- Web runtime may import domain contracts and pure helpers only.
- Server may import domain, engine, and concrete `blog-*` packages.
- Engine may import domain but not web or server.
- Blog-neutral DTOs live in `packages/domain/src/blog/schema/`.
- Blog runtime interfaces, registry, fetch policy, and blog-neutral export units live in `packages/engine/src/blog/` and `packages/engine/src/exporting/blog/`.
- Concrete blogs live in `packages/blog-*`.
- `blog-*` packages may depend on domain and engine, but must not define blog-neutral base types or contracts.
- Blog-specific fetchers, parsers, URL helpers, and workflows must stay inside the owning concrete blog package.
- Package and feature contracts live in the owning folder under `schema/`; cross-package contracts live in domain schema when shared across packages.
- Runtime constants that back literal unions use const assertion values with derived types.
- Shared utilities live under the owning package/folder `util/`.
- Avoid barrel files and compatibility re-export files; import the current owner path directly.

## Storybook Flow

- Storybook source data is committed in the web package.
- A script renders the generated Storybook catalog through blog parser and engine renderer code.
- The web Storybook route reads the committed generated catalog and does not import engine at runtime.

## Change Signals

- Boundary changes require architecture and code-style knowledge updates.
- Parser routing or block output contract changes require parser knowledge updates.
- Shared identity or contract changes require architecture knowledge updates.
- Export, upload, resume, or manifest behavior changes require architecture, upload, and verification knowledge updates.
- UI system or visual behavior changes require design knowledge updates.
