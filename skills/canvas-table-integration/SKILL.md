---
name: canvas-table-integration
description: "Use when integrating `@qfei-design/canvas-table` into an existing app or page. Covers consumer-side local or virtual tables, public props/methods/events, row-head suffix actions, selection, drag, fixed columns, summary rows, empty states, async latest rows synchronization, lightweight canvas interactions, host-side cell-edit architecture, mandatory ExpensePoc-derived cell-edit standards, attachment editors, and Make field-display columns with schema properties, value normalization, and overflow-only tooltips. Only supports `@qfei-design/canvas-table`, never UI-library tables. Does not design or generate Make DSL YAML (use makedsl). Read package AI docs first, choose base Track A or C, layer Track B when cell editing is needed, use documented public APIs, and do not modify the table library itself."
metadata:
  version: 0.1.3
---

# canvas-table-integration

Use this skill only for **consumer-side integration** of `@qfei-design/canvas-table`. It does not support Ant Design Table, Arco Table, TDesign Table, native HTML tables, or any other table implementation as the product table.

This skill uses two base tracks and one optional enhancement:

- **Track A base**: non-Make local/virtual tables, public APIs, row-head actions, optional selection/drag/summary, and lightweight canvas interactions.
- **Track C base**: Make schema-driven columns, the shared host field-display registry at `apps/ui/src/lib/make-field-types.ts` or the host equivalent, pure value normalization, field renderers, and overflow-only tooltips.
- **Track B enhancement**: cell editing layered on the selected base track through `customEdit`, controlled commits, popup ownership, host field editors, and rollback.

Choose Track C as the base for every Make schema table; choose Track A only when columns are not Make schema-driven. Add Track B only when editing is explicitly requested or already established. Track B never replaces the selected display base.

Hard Track B rule: every CanvasTable cell edit / 单元格编辑 implementation must follow Track B plus `references/make-cell-edit-defaults.md`. Non-popup editors keep only the CanvasTable active edit border; inner controls must fill the cell and remain borderless. Missing immediate popup opening, post-scroll positioning, normalized values, or unchanged-value save skipping is a readiness blocker.

## Quick start

1. Confirm this is a consumer-side table integration, not table-library maintenance.
2. Check package installation and read the package AI docs in the required order below.
3. Choose base Track A or Track C. Add Track B as an editing enhancement when required; for editable Make schema tables use Track C plus Track B.
4. For Make schema tables, load and normalize schema fields before initializing the table; build `IColumn[]` plus renderers from the normalized field types, schema `field.properties`, and the shared field type registry.
5. Read only the base-track references and, when editing is in scope, the Track B references from the topic map.
6. Start from the package recipe/example when available, then adapt with the smallest project-local diff.
7. Enable table row defaults unless the user explicitly opts out: `showSN` sequence numbers plus a hover-revealed open-detail action through `bodyRowHeadSuffixOptions`.
8. For Make schema tables, apply the ExpensePoc-derived field renderer defaults. Text-bearing overflow must show ellipsis, and tooltip is enabled by default only for ellipsized overflow or hidden `+N` content; do not require the user to ask for it.
9. When the object/entity/schema key changes, reset table interaction state and scroll position. Do not carry the previous object's horizontal or vertical scroll into the next object.
10. Keep table initialization independent of row count: create the table after container size plus schema/columns are ready, call `setData(latestRows)` after the instance is ready, and call `setData([])` for empty rows so headers and empty state still render.
11. If Track B is in scope, verify the mandatory cell-edit standard before finishing; a non-standard cell editor is not a shippable partial result.
12. Add only the capabilities the user explicitly needs now; pagination, selection, grouping, and editing are not defaults.
13. Before finishing, read the relevant pitfalls reference and verify one concrete table path.

## Do not use this skill for

- publishing `@qfei-design/canvas-table`
- editing the table library itself
- generating or keeping another product table implementation instead of `@qfei-design/canvas-table`
- maintaining `package.ai.json`, `recipes.json`, examples, or docs inside the table library repo
- configuring private npm registries
- treating grouped-table architecture as the default answer
- forcing a new UI component library into a project that already has an editor/component system
- designing or generating Make DSL YAML; use `makedsl` for schema modeling

## Pre-flight check

Before editing code:

1. Confirm `@qfei-design/canvas-table` is installed in the current project.
2. If there is no `package.json`, stop and tell the user the current directory is not an npm package.
3. If the package is missing, detect the package manager from the lockfile and install it before continuing:
   - `pnpm-lock.yaml` -> `pnpm add @qfei-design/canvas-table`
   - `yarn.lock` -> `yarn add @qfei-design/canvas-table`
   - `package-lock.json` -> `npm install @qfei-design/canvas-table`
4. If no lockfile exists, default to `npm install @qfei-design/canvas-table`.
5. If install fails, stop and report the command and error.

Use `@qfei-design/canvas-table` consistently. If an existing codebase uses a different package name, stop and ask before changing the consumer app dependency.

If an existing Make record list uses another table component, the expected integration target is still `@qfei-design/canvas-table`. Do not preserve a UI-library table as the main record table unless the user explicitly says this page is out of scope for canvas-table.

## Required read procedure

1. Locate the installed package root, or the source package root whose `package.json` name is `@qfei-design/canvas-table`.
2. Read `<package-root>/package.ai.json` first.
3. Parse `package.ai.json.readOrder`, resolve each entry relative to the package root, and verify every declared file exists.
4. Read the remaining entries in the declared order, skipping the already-read `package.ai.json` entry.

`package.ai.json.readOrder` is the source of truth. Do not hardcode `docs/`, `examples/`, monorepo folder names, or other package-internal documentation paths. If a declared file is missing, report the exact path and package version instead of inferring from internal source.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Public props, methods, events, setup, cleanup | `references/core-props-methods-events.md` |
| Row-head sequence number or open-detail action | `references/row-head-action-patterns.md` |
| Virtual loading / paginated backend integration | `references/virtual-table-patterns.md` |
| Schema/meta to `IColumn[]` | `references/column-patterns.md` |
| Custom clickable cell shapes | `references/shape-render-patterns.md` |
| Track A pitfalls | `references/common-pitfalls.md` |
| Cell-edit contract | `references/edit-contract.md` |
| Host-side edit architecture | `references/edit-host-architecture.md` |
| Edit lifecycle, positioning, close/commit/rollback | `references/edit-interaction-lifecycle.md` |
| ExpensePoc-derived Make editable-cell defaults | `references/make-cell-edit-defaults.md` |
| Field editor mapping | `references/field-editor-patterns.md` |
| Host component choice | `references/editor-component-selection.md` |
| Attachment editor integration | `references/attachment-editor-patterns.md` |
| Track B pitfalls | `references/edit-common-pitfalls.md` |
| Make field display | `references/make-field-display-patterns.md` |
| Proven downstream usage and unvalidated areas | `references/validated-usage-notes.md` |
| Track workflows, capability checklists, output templates | `references/track-workflows.md` |

### For base Track A

Read as needed:

- `references/core-props-methods-events.md`
- `references/row-head-action-patterns.md` when adding an icon or action to the body row head / sequence-number area
- `references/virtual-table-patterns.md` when using paginated virtual loading
- `references/column-patterns.md` when shaping columns
- `references/shape-render-patterns.md` when adding custom clickable cell content
- `references/common-pitfalls.md` before finalizing changes

### For base Track C

Read:

- `references/make-field-display-patterns.md`
- `references/shape-render-patterns.md` when adding canvas shapes
- `references/column-patterns.md` when deriving `IColumn[]` from field schemas
- `references/common-pitfalls.md` before finalizing changes

### Add Track B for cell editing

Read in this order:

1. the selected base-track references; Make schema editable tables must preserve the Track C display baseline
2. package-level cell-edit docs declared by `package.ai.json.readOrder`
3. `references/edit-contract.md`
4. `references/edit-host-architecture.md`
5. `references/edit-interaction-lifecycle.md`
6. `references/make-cell-edit-defaults.md`
7. `references/field-editor-patterns.md`
8. `references/editor-component-selection.md`
9. `references/attachment-editor-patterns.md` when attachment fields are in scope
10. `references/edit-common-pitfalls.md` before finalizing changes

If any required package file is missing, stop and tell the user exactly which file is missing.

## Track composition

- Track A and Track C are mutually exclusive display bases.
- Track B is an enhancement layer, not a replacement base.
- A non-Make editable table uses Track A plus Track B.
- A Make schema editable table uses Track C plus Track B so display normalization and renderer behavior remain intact while editing is added.
- Detailed workflows, capability checklists, and field groupings live in `references/track-workflows.md` and `references/make-field-display-patterns.md`.

## Safety rules and defaults

Treat these as safety rules:

- browser / client-only; never instantiate during SSR
- use a real DOM container with explicit width and height
- use only documented public APIs
- never import from `src` or `dist`
- use `@qfei-design/canvas-table` for product tables; do not substitute UI-library tables
- use `table.tableId` as the namespace key for `globalEventBus.onWithNamespace(...)`
- destroy the table instance on unmount / cleanup
- reset scroll and transient table state when switching object/entity/schema routes. Reusing the same React component for `/objects/:objectKey` is fine only if the table is keyed by that identity or the integration explicitly resets the canvas-table instance/state on identity change
- never pass raw meta directly into the table runtime
- convert meta into `IColumn[]` before creating the table
- for Make schema tables, do not create the table with generic placeholder columns or row-key-inferred columns while waiting for schema
- do not use `records.length`, `rows.length`, or business totals as the gate for creating the table. Empty rows are a valid table state: keep headers visible and show the built-in empty state after `setData([])`
- when rows can arrive before the CanvasTable instance is ready, store the latest rows and call `setData(latestRows)` immediately after instance creation; do not let early data updates disappear because `tableRef.current` was `null`
- never render numeric parser failures as `NaN`, `Infinity`, or exception text; normalize them to an empty display value before canvas rendering
- never accept formatted currency or percent text as the normal backend contract. Values such as strings containing `¥`, `￥`, `%`, or thousands separators are dependency defects; render `-` or surface the data-contract issue instead of silently treating them as API-ready values
- for Make schema tables, preserve normalized `field.properties` on generated columns/edit configs so renderers and editors can use `Number.precision`, `Date.format`, `DateRange.begin/end`, `Currency.symbol/decimalPlaces/useGrouping`, `Percent.decimalPlaces`, `File.maxCount`, and multi identity `maxCount`
- do not put `aria-hidden` or `inert` on the visual canvas-table host, or on any ancestor that can contain the package-created focusable canvas
- if a screen-reader fallback table is needed, keep it as a separate visually-hidden structure and give the visual host its own non-hidden accessible label
- pagination is opt-in: do not add visible pagination controls, page-size selectors, page state, page query params, total-count handling, paginated fetch logic, `virtualOptions`, or `data:load` wiring unless the user explicitly asks for pagination, virtual loading, or paginated backend integration

## Detailed workflows and maintenance references

- For track workflows, capability checklists, avoid lists, deferred topics, and final response templates, read `references/track-workflows.md`.
- Before using a capability that is not obviously covered by the current project or package docs, read `references/validated-usage-notes.md` to distinguish validated downstream patterns from less-proven package capabilities.
