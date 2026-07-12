# Post Evidence

## Purpose
- Post evidence compares a public blog source with this repo's Markdown conversion.
- Use it for parser investigation, ingest reports, PR descriptions, and README examples.
- Evidence artifacts are harness/report output, not exported blog output.

## Entrypoints
- `scripts/single-post/export-single-post.ts` exports or inspects one public post; `scripts/single-post/SinglePostArgs.ts` defines its current CLI surface.
- `scripts/post-evidence/capture-post-evidence.ts` captures source screenshots and rendered Markdown. Run it with `--help` for current options.
- The evidence CLI accepts one inline case or a JSON case file for multiple captures.

## Single-Post Workflow
- Open the public post and note its editor family, visible block types, and unusual structure.
- Use single-post `--inspect` when a parser failure only names an unsupported editor node. Inspect reports the DOM path, tag, class, editor module type, text, and HTML snippet without writing export output.
- Export into `tmp/manual-audit/<postId>/`, then compare the source, Markdown, and structured report.
- Classify the result as `as-expected`, `mismatch`, `error`, or `not-checked`.
- Capture post evidence when the comparison needs a reusable source image and Markdown section.

## Capture Targets And Options
- `post` captures the full source body and renders full Markdown with frontmatter.
- `inspect-path` captures one node selected by the single-post inspect path and renders its parsed block without frontmatter.
- `--optionsPath` uses the same export option shape as single-post export.
- Defaults keep remote asset references, disable image and thumbnail downloads and compression, and omit `exportedAt`.
- Do not download source images unless an explicit options file requires it.

## Output And Storage
- Each run writes `evidence.md`, `report.json`, and source capture images.
- Temporary output defaults under `tmp/harness/post-evidence/`; `--assetProfile tmp` keeps assets with the run.
- `--assetProfile readme` stores durable README assets under `.agents/knowledge/reference/assets/readme`.
- `--assetProfile figure` stores durable report assets under `.agents/knowledge/reference/assets/figure`.
- Persistent profile links use repo-root-relative paths; temporary links are relative to `evidence.md`.
- Treat any section error or nonzero `report.json.errorCount` as incomplete evidence.

## Evidence Shape
- Render one `###` section per case in this order: short metadata heading, `원문 보기` source link, source capture image, fenced `markdown` output.
- Keep metadata focused on the parser behavior, failure family, or conversion scenario.
- Full-post capture targets the concrete blog's main body; inspect capture resolves the same editor path reported by single-post inspect.
- Hide unrelated fixed or sticky mobile UI and capture the selected node rather than only the viewport.

## Ingest Reports
- Ingest uses the shared helpers under `scripts/post-evidence` and writes `report.md`, `report.json`, `evidence.md`, and durable figure assets.
- Reuse a completed ingest manifest and rerun only failed posts unless a full rerun is explicitly requested.
- Focused parser-fix reports include the changed block, representative fixture, knowledge changes, verification, and unresolved failures.
- Add report summaries or evidence to a PR only when the user explicitly requests PR creation.

## Verification
- Run the evidence CLI `--help` after changing its command surface.
- After capture changes, run one full-post case and one inspect-path case, then check `report.json.errorCount`.
- Visually inspect an asset when screenshot target selection or framing changes.
