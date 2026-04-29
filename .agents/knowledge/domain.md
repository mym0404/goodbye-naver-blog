# Domain

## Product Surface
- The tool exports public Naver Blog posts into portable Markdown sets.
- Users can scan a blog, select categories or scope, tune frontmatter/Markdown/assets options, run export, optionally upload images, and recover the last job from `manifest.json`.
- Output contains Markdown files, YAML frontmatter, local or remote image references, shared assets under `output/public`, and a `manifest.json` that is also the UI recovery source of truth.

## Core Entities
- `blogIdOrUrl`: scan and export input.
- `CategoryInfo`: category tree node with path and post count.
- `ScanResult`: public post count, categories, and post summary snapshot.
- `ExportOptions`: scope, structure, frontmatter, Markdown, block output, asset, and link export options.
- `ParsedPost`: common AST blocks, tags, videos, warnings, and optional per-block output selection metadata.
- `ExportManifest`: post results, summary, upload summary, logs, and UI recovery job snapshot.
- `ExportJobState`: server/UI state for export, upload, result, failure, and recovery.
- `UploadCandidate`: local asset selected for post-export upload.

## Output Rules
- Default output is GFM Markdown with YAML frontmatter.
- Default post folder name is date plus snake_case slug; Markdown body file is `index.md`.
- Category path can group output folders when enabled.
- Custom post folder names use the path template code in `src/shared/PostPathTemplate.ts`.
- Downloaded assets are stored under `output/public/<sha256>.<ext>`.
- Same bytes share one asset file even when source URLs differ.
- `manifest.json` is both final result record and resume/bootstrap state.
- Naver media/link card/video blocks render as Markdown links when no richer Markdown form exists.
- Simple tables render as GFM tables; complex tables can use HTML fallback.
- Raw HTML fallback should preserve warning context and extracted text instead of silently dropping content.
- Block output defaults use Editor+ParserBlock selection keys in `ExportOptions.blockOutputs.defaults`; `manifest.json.options` preserves those keys.

## Frontmatter Rules
- `category` is a display string.
- `categoryPath` is a path array.
- Editor identity is not exported as frontmatter.
- Each frontmatter field has enable/disable, description, and alias controls in the UI.
- Empty alias uses the default field name.
- Alias must start with a letter or `_`, and may then contain letters, numbers, `-`, or `_`.
- Enabled fields cannot share the same alias.

## UI And State Rules
- `.cache/scan-cache.json` stores scan cache.
- `.cache/export-ui-settings.json` stores persisted UI settings, last output directory, theme, and export options.
- `강제로 불러오기` invalidates the scan cache for the current blog input.
- UI bootstrap reads the last `outputDir` and its `manifest.json` to recover prior job state.
- `running`, `upload`, and `result` stages share the same result table surface.
- DOM/test hooks such as `data-step-view`, `#blogIdOrUrl`, `#scan-button`, `#export-button`, `#job-file-tree`, `[data-job-filter]`, `#summary`, `#status-text`, and `#logs` are part of the UI regression contract.
