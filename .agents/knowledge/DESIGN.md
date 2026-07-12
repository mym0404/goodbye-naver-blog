# Design System

## Source Of Truth

- This file is the durable design guide for `packages/web`.
- UI primitives come from Primer React and Octicons.
- Screen styling should use Primer component props and `sx`.
- Use Primer design tokens through `sx`; do not create app-specific color systems for normal UI states.
- Reusable local UI helpers live under `packages/web/src/components/primer/`.
- A local helper is allowed only when it preserves Primer component anatomy and removes repeated wiring.
- Global CSS is reserved for reset and base document concerns: box sizing, root sizing, font inheritance, base text resets, and scrollbar styling.
- Do not put component styling, theme color overrides, dropdown/select restyling, button restyling, layout surfaces, or Primer lookalike rules in global CSS.
- If a visual detail exists in Primer, use the Primer React component, its props, or `sx` with Primer tokens instead of recreating the style globally.
- Do not add shadcn, Radix UI wrappers, Remix icons, Tailwind utilities, or compatibility shims.

## Visual Direction

- The app is a GitHub-style operational wizard with light and dark themes.
- Prioritize dense, readable, task-focused layouts over marketing-style sections.
- Screens should feel like GitHub repository/settings/productivity pages, not landing pages.
- Use quiet borders, compact spacing, clear section hierarchy, and Primer status labels.
- Keep the main workflow immediately usable; do not add explanatory UI copy for implementation instructions.
- Do not add decorative GitHub mimicry such as meaningless side menus, fake repository chrome, or navigation that does not help the task.
- Prefer one clear work surface over many floating cards on a background.
- A page should not reveal unrelated background bands while scrolling; use `canvas.default` or a deliberate full-width section background consistently.

## Layout Rules

- Follow Primer Layout foundations before inventing page structure: organize pages into header, content, pane, and footer regions.
- App headers and page headers scroll with the page; do not make them fixed.
- All app-level and Storybook page headers use Primer `PageHeader` through the shared header component.
- Do not hand-roll page headers with custom `Heading` plus ad hoc grid/flex wrappers.
- The shared page header sits in a full-width top band with `canvas.subtle` and no top page gap.
- Page headers show the page title, responsive actions, and compact metadata only.
- Do not put page descriptions in `PageHeader.Description` for this app.
- Do not show wizard step progress in the page header.
- Use `PageHeader.Actions` for right-aligned actions. Show a menu button there on narrow and regular viewports, and expand it into direct actions only when they fit without wrapping.
- Metadata such as 대상 글, 카테고리, 선택, and 상태 belongs in Primer `LabelGroup`.
- Do not add repository-style under-navigation tabs unless the app has real peer page destinations that need them.
- App-level headers span the viewport with breakpoint padding and no max-width. Primary content stays centered at Primer `medium` width (`768px`).
- Split pages are only for real side navigation, filtering, overview, or list-detail flows.
- Split-page left panes must be flush to the left edge, use their own scroll area for long lists, and sit beside the content region rather than inside a floating card.
- Do not add side panes for decorative step progress or GitHub mimicry.
- On narrow viewports, replace heavy side panes with a single-column `ActionMenu` choice or a dedicated drill-in view.
- Avoid card-wrapped single controls. A lone input, choice menu, checkbox, radio, or small checkbox group should live in a plain field row or compact grid.
- Use bordered panels only when the surface is a distinct work area, repeated result item, table/list container, preview, editor, dialog, or status panel.
- Do not nest panels just to create spacing. Use grid gaps, section rhythm, or inline rows before adding another wrapper.
- Keep every form in a single vertical column at all viewport widths. Do not place fields side by side to use extra desktop space.
- Keep gaps compact. Use `gap: 2` for dense form rows, `gap: 3` for section groups, and larger spacing only for page-level separation.
- Dividers are optional. Use them only when the user needs a boundary to understand a change in scope.

## Component Decision Map

| Need | Primer component | Usage rule |
| --- | --- | --- |
| Page shell | `Box` with Primer `sx` tokens | Use semantic regions and width constraints. Do not build decorative wrappers. |
| Main page header | Primer `PageHeader` through the shared header component | Show title, responsive menu/actions, and LabelGroup metadata. Do not show page descriptions or wizard step progress. |
| Contextual side navigation | `NavList` | Use only when choosing an item changes the main content area. |
| Mobile replacement for side navigation | `ActionMenu` + `ActionList` | Use single select state and group headings when the desktop pane uses grouped navigation. |
| Primary or secondary command | `Button` | Use Primer variants. Do not restyle buttons globally. |
| Icon command | `IconButton` or `Button` with Octicon | Use Octicons when the icon is a standard action. |
| Status | `Label`, `Flash`, or local `PrimerStatusLabel` | Use `Label` for compact state, `Flash` for messages that need attention. |
| Header metadata | `LabelGroup` + `Label` | Use for compact page metadata and status such as 대상 글, 카테고리, 선택, 완료, 실패, and 업로드. |
| Text input | `TextInput` inside `FormControl` | Label first, input second, caption/validation third. |
| Long text input | `Textarea` inside `FormControl` | Use when the value is paragraph-like or multi-line. |
| Boolean setting | `Checkbox` inside horizontal `FormControl` | Use for a single independent yes/no setting. |
| Boolean setting list | `CheckboxGroup` + `Checkbox` | Use when the section is a related list of independent toggles. |
| Mutually exclusive visible modes | `RadioGroup` or `SegmentedControl` | Use radio for descriptive choices, segmented control for compact mode switches. |
| Single dropdown choice | `ActionMenu` + `ActionList selectionVariant="single"` | Use for every dropdown-style single choice in this app. |
| Multiple dropdown choice | `ActionMenu` + `ActionList selectionVariant="multiple"` | Keep the menu open while toggling when the user may choose more than one value. |
| Plain action dropdown | `ActionMenu` + `ActionList` | Use for command menus such as item actions. Do not mark items selected. |
| Searchable long choice list | Primer filtered choice pattern before custom UI | Prefer a Primer list/menu pattern; do not introduce a custom select library. |
| Tabbed views | Primer tab component or existing Primer-backed tabs | Use only for peer views inside the same task context. |
| Dialog | Primer `Dialog` | Keep copy short and actions explicit. |
| Table/list container | Primer-compatible table/list surface | Use bordered container only when rows need a scannable boundary. |
| Preview/editor surface | Bordered `Box` or local panel helper | Use only when the surface is an actual work area. |

## ActionMenu Rules

- All dropdown-like controls use Primer `ActionMenu`; this includes single select, multi select, and plain choice menus.
- Do not use Primer `Select` for app UI dropdowns.
- Do not use native `<select>` for app UI dropdowns.
- Do not wrap Radix, shadcn, or custom popover/select implementations around Primer styling.
- The standard structure is `ActionMenu`, `ActionMenu.Button`, `ActionMenu.Overlay`, and `ActionList`.
- Single select menus use `ActionList selectionVariant="single"` and mark the current item with `selected`.
- Multiple select menus use `ActionList selectionVariant="multiple"` and mark every selected item with `selected`.
- Plain command menus use `ActionList` without a selection variant unless there is a real selected state.
- Grouped choices use `ActionList.Group` and `ActionList.GroupHeading`.
- Secondary choice explanation belongs in `ActionList.Description`, not appended into the item label.
- The trigger button text should be the selected option label or a short placeholder such as `선택`.
- In forms, the `ActionMenu.Button` id should be the field id so `FormControl.Label` points at the visible trigger.
- Use `data-value` on the trigger only as a test contract for current value; do not style from it.
- Use `data-slot="select-item"` and `data-value` on selectable ActionList items when e2e needs stable choice targeting.
- Do not globally restyle ActionMenu overlays, buttons, or list rows. Use Primer props and local `sx` only for width and layout fit.

## Form Rules

- Follow Primer Forms patterns for all wizard settings forms.
- A field uses `FormControl` anatomy in this order: concise label, input control, then short caption or validation message.
- Label and input should read as one field; avoid large gaps between the label, control, and caption.
- Do not place helper text between the label and the control.
- Do not use placeholder text as the only label.
- Stack all `FormControl` fields vertically. Wide viewports do not change a form into multiple columns.
- Order fields by importance and keep related fields adjacent so keyboard input flows predictably.
- Size inputs to match expected value length, or let them fill a constrained parent when values vary widely.
- Group closely related settings by section heading, vertical rhythm, and proximity first; use borders or dividers only when the group needs a clear boundary.
- Use progressive disclosure for fields that only matter after a checkbox, radio, segmented control, or ActionMenu choice is enabled.
- Use Primer validation states and messages instead of browser-native validation UI.
- For a checkbox with a short caption, use Primer `Checkbox` with horizontal `FormControl`.
- For multiple independent checkboxes under one question, use `CheckboxGroup` and individual `FormControl` rows.
- Do not make a simple checkbox look like a card unless the whole row is a repeated settings item that needs a row boundary.
- Alias fields should use plain labels such as `내보낼 이름`; avoid implementation terms such as `key 별칭` unless the user is editing raw data.
- Small examples can appear as captions when they clarify the expected value. Keep examples short and subordinate to the field.

## Feature UI Rules

- UI text should describe user-facing state or action only.
- Access, visibility, and permissions should be enforced in behavior rather than explained as decorative copy.
- Long-running export/upload/resume states need clear progress and retry affordances.
- Avoid helper text, badges, or labels that only mirror implementation requirements.
- Template editors are the source of truth for template values. Adjacent previews and result panels show only derived output, validation state, or errors.
- Syntax help dialogs should explain capabilities briefly. Do not dump every autocomplete prop into dialog text.
- Prop tables should be compact. Prop names and type badges can be readable, but descriptions should stay smaller and quieter than labels.
- Storybook uses a real left navigation pane on desktop and an ActionMenu chooser on narrow screens.
- Storybook navigation should be flush to the left pane and use `NavList`; do not build custom tree controls for basic grouped navigation.
- Upload provider forms follow GitHub settings style: fields stack vertically, controls stay near their labels, and the form does not need an outer card.

## Verification

- UI logic can use focused pure or hook tests.
- Browser workflow coverage belongs in Playwright local/live e2e tests.
- Meaningful UI changes require browser validation when practical.
- Browser validation should check desktop and mobile width, light and dark theme where relevant, horizontal overflow, console errors, and visible consistency with Primer UI.
- Before opening a PR, run the repo-native static checks, Storybook check, UI build, and Playwright e2e requested by the task.
