# Parser Blocks

## Scope And Routing
- Parser code in concrete `blog-*` packages converts blog/editor HTML into platform-neutral parsed blocks.
- The blog parser receives post HTML plus parser options, selects an editor, and applies ordered block parsers.
- Editor-specific logic stays inside the editor family that owns the HTML shape.
- Unsupported paths expose enough context for fixtures and evidence without changing normal output.
- Renderer and exporter policy stays outside parser ownership.

## Ownership
- Concrete blog parsers own editor dispatch, diagnostics, and parsed block output helpers.
- Editor folders own block order, editor context, and editor-specific converters.
- Parser blocks own their prop shape and Markdown template presets.
- Shared infrastructure may own editor dispatch, common schemas, asset resolution, and generic template evaluation only.
- Shared parser contracts live in the owning domain `schema/` file; helpers live in the closest owning `util/` folder.
- Do not add parser inventories to knowledge; code and tests are the source of truth.

## Role
- Parser blocks identify one blog/editor block shape and convert it into a parsed block.
- Blocks should preserve user-visible content and avoid adding renderer-specific policy.
- Block output should be deterministic for the same HTML and parser options.

## Block Contract
- Match logic should be narrow enough to avoid stealing another block's HTML.
- Convert logic should return parsed block props and asset metadata only.
- Container blocks may delegate nested content to child parsing.
- Leaf blocks should not parse unrelated surrounding editor structure.
- Each parser block must expose a `templateDefinition`.
- Blocks that intentionally produce no Markdown use the `무시` preset with an empty template.
- Link-like and widget-like blocks expose structured props that name the content being parsed, such as URL, title, caption, file metadata, schedule fields, place lists, or media identifiers. Do not collapse these blocks into a single opaque `text` prop.
- A block exists for one product/content responsibility. If one parser can only extract some props for one content shape and different props for another, split the parser block instead of widening one block.
- Split blocks by user-visible content responsibility, not incidental DOM variation alone.
- DOM variation is a split signal only when fixtures and parsing behavior prove a different feature or prop contract.
- List-like blocks expose structured arrays and keep nested asset paths resolvable through asset metadata.

## Templates
- Template definitions describe available Markdown output presets and interpolation props.
- Template keys are stable contracts used by UI options, generated Storybook catalog, and renderer tests.
- Output option behavior belongs to parser/editor tests, not shallow UI tests.
- The first preset is the default and preserves every source meaning Markdown can express, including heading levels, inline/display math, list order and nesting, links, captions, and thumbnails.
- Additional presets exist only for distinct output intents. A preset that intentionally omits information names that scope in its label.
- Preset labels describe the actual output shape. Do not use generic labels.
- Every preset renders without errors or `undefined` when optional values are absent.
- Raw HTML is reserved for structures such as complex tables whose meaning Markdown cannot preserve.
- Empty templates are valid only for explicit `ignore`/`무시` or child-delegation presets.
- Group media blocks expose arrays, such as `images[]`, and templates render the array into Markdown strings instead of printing the object directly.

## Prop Schema
- Expose stable normalized source data even when the built-in preset does not use it.
- Preserve user-visible text, links, captions, thumbnails, list hierarchy, and table structure.
- Do not expose output-only values such as a list `prefix` or heading `marker` when templates can derive them from normalized props.
- Do not expose request-scoped tokens or values whose persistence is unproven.
- Array props define `items`; object props define `properties`; nested arrays and objects continue recursively to scalar fields.
- Optional schema markers match values the parser can return as absent, `null`, or `undefined`.
- Labels stay short. Add a description only when the value's format or purpose is not clear from the label and type.

## Utilities
- Editor-local helpers stay in that editor's `util/` folder.
- Shared utilities must have a clear owner and current import path.
- Utility files with one export use the function name.
- Do not centralize block parsing, block output, or block template helpers across block files. Keep block-specific template strings and parsed-output construction inside the owning block file, even when this creates small duplication.
- Core parser dispatch, shared schema contracts, and generic template evaluation may remain shared infrastructure.

## Quality Criteria
- Preserve source links, captions, table text, code, media metadata, and visible fallback text when available.
- Do not fail normal export just because an optional block detail is missing.
- Keep unsupported behavior observable through diagnostics and evidence tools.
- Judge Naver and Tistory independently against the same criteria.
- P0 covers parser/template render failure and schema/type violations.
- P1 covers visible information loss, wrong URLs or hierarchy, incorrect Markdown semantics, and ignored visible blocks.
- P2 covers derived duplicate props, inaccurate or duplicate presets, unnecessary HTML, and incomplete nested schemas.
- P3 covers wording and naming polish that does not change meaning and does not block acceptance.
- A catalog passes only when P0, P1, and P2 are all zero.

## Evidence
- Judge each block from representative source HTML or module data, an exact parsed-props assertion, and exact Markdown output for every preset.
- Focused parser specs are the default evidence and use the recursive checks in `tests/support/parser-test-utils.ts`.
- Deterministic checks compare nested schemas to actual props, reject duplicate preset IDs and labels, and render representative and optional-absent values.
- Semantic preservation remains a full block review; do not replace it with a shallow automated heuristic.
- Update an existing public fixture for changed or high-risk blocks when one exists. Add a live fixture only when a suitable public post is available.

## Verification
- Block implementation changes require offline tests that cover the changed block behavior.
- Parser routing changes require the offline suite.
- Output contract changes require offline tests and Storybook catalog checks.
- Fixture changes must prove current live HTML still matches expected Markdown.
