# Abstract editor parser classes

## Goal
Make Naver Blog editor parsing class-based and easier to extend without changing parsed output.

## Proposed Changes

| Area | Current | After |
|---|---|---|
| Editor dispatch | `parsePostHtml()` detects `EditorVersion` and calls parser functions directly. | `parsePostHtml()` selects a concrete editor class and calls `parse()`. |
| Editor abstraction | No shared editor class boundary. | Add an abstract Naver Blog editor class with shared `parse()` input/output contract. |
| Concrete editors | `parseSe2Post`, `parseSe3Post`, `parseSe4Post` are standalone parser entry functions. | Add `NaverBlogSE2Editor`, `NaverBlogSE3Editor`, `NaverBlogSE4Editor` under `src/modules/parser/editors/`. |
| Existing behavior | SE2, SE3, SE4 are all supported. | SE2, SE3, SE4 output stays compatible. |

## Scope

| Included | Excluded |
|---|---|
| Add `src/modules/parser/editors/` class files. | Markdown renderer behavior changes. |
| Keep `parsePostHtml()` as the public parser entry point. | AST shape changes. |
| Update parser tests for class dispatch and editor behavior. | Exporter public API changes. |
| Preserve SE3 support even though examples named SE2 and SE4. | Fixture output meaning changes. |

## Known Facts

| Fact | Source |
|---|---|
| `parsePostHtml()` currently dispatches by editor version. | `src/modules/parser/post-parser.ts:48` |
| SE3 is an existing supported parser path. | `src/modules/parser/post-parser.ts:72` |
| Parser output contract is `ParsedPost`. | `src/shared/types.ts:593` |
| Required local verification is `pnpm check:local`. | `package.json:24` |

## Verification Direction

| Check | Expected Signal |
|---|---|
| Focused parser tests | post parser and editor parser tests pass. |
| Final verification | `pnpm check:local` passes. |
