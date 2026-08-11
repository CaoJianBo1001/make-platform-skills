---
name: canvas-table-integration
description: "Use when integrating `@qfei-design/canvas-table` into an app or page. Covers consumer-side local, virtual, large-data fast-scroll, and grouped tables; public props/methods/events; row-head and header menus; selection, drag, fixed columns, summaries, empty states, async row sync, canvas interactions, cell editing, and Make schema field display. Make record lists use make-app-actions for the default selectable record-action workflow. Use make-app-sort for record sorting and header sort controllers. Route Make record-list grouping behavior, Preset, groupFilter, and leaf pagination to make-app-group. Route Service-side AbortSignal propagation to make-app-service. Only supports `@qfei-design/canvas-table`, not UI-library tables. Does not own Make DSL (use makedsl), page layout (use makeui), or table-library maintenance. Read package AI docs, choose Track A or C, layer Track B for editing, and use public APIs only."
metadata:
  version: 0.1.11
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
8. For every writable Make record list, enable multiple selection and route the default edit/delete/batch-edit action workflow to `make-app-actions`. Only an explicitly read-only list opts out.
9. For Make schema tables, apply the platform field-renderer defaults. Text-bearing overflow must show ellipsis, and tooltip is enabled by default only for ellipsized overflow or hidden `+N` content; do not require the user to ask for it.
10. When the object/entity/schema key changes, reset table interaction state and scroll position. Do not carry the previous object's horizontal or vertical scroll into the next object.
11. Keep table initialization independent of row count: create the table after container size plus schema/columns are ready, then apply the latest rows with `setData(latestRows)` in local mode. In virtual mode, select the page-only or identity-aware callback from the installed public docs and preserve its page/request contract. Empty rows remain valid and must still render headers and the empty state.
12. For large-data, fast-scroll, or scrollbar-drag virtual loading, follow `references/virtual-table-patterns.md`; installed-contract selection, request identity, bounded scheduling, stale-request cancellation, pending-page release, atomic total/page writes, and cache limits are delivery requirements for that path.
13. If Track B is in scope, verify the mandatory cell-edit standard before finishing; a non-standard cell editor is not a shippable partial result.
14. Add only the capabilities the user explicitly needs now. Pagination, sorting, grouping, and cell editing remain opt-in; Make record-list selection actions are the default through `make-app-actions`.
15. When table-header sorting is requested, use this Skill only for the documented header menu/suffix mechanics and route sorting behavior, `openWithField`, Preset, and records timing to `make-app-sort`.
16. When Make record-list grouping is requested, use this Skill only for `GroupTableComponent` public API mechanics and route grouping behavior, Preset, `record-groups`, `groupFilter`, and leaf-page timing to `make-app-group`.
17. Before finishing, read the relevant pitfalls reference and verify one concrete table path.

## Do not use this skill for

- publishing `@qfei-design/canvas-table`
- editing the table library itself
- generating or keeping another product table implementation instead of `@qfei-design/canvas-table`
- maintaining `package.ai.json`, `recipes.json`, examples, or docs inside the table library repo
- configuring private npm registries
- treating grouped-table architecture as the default answer
- forcing a new UI component library into a project that already has an editor/component system
- designing or generating Make DSL YAML; use `makedsl` for schema modeling
- designing Service routes, server disconnect handling, or downstream cancellation adapters; use `make-app-service`

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
| Make record-list default selection and edit/delete/batch-edit actions | Use `make-app-actions` |
| Virtual loading, paginated backend integration, large-data fast scrolling, or scrollbar dragging | `references/virtual-table-patterns.md` |
| Schema/meta to `IColumn[]` | `references/column-patterns.md` |
| Custom clickable cell shapes | `references/shape-render-patterns.md` |
| Track A pitfalls | `references/common-pitfalls.md` |
| Cell-edit contract | `references/edit-contract.md` |
| Host-side edit architecture | `references/edit-host-architecture.md` |
| Edit lifecycle, positioning, close/commit/rollback | `references/edit-interaction-lifecycle.md` |
| Platform Make editable-cell defaults | `references/make-cell-edit-defaults.md` |
| Field editor mapping | `references/field-editor-patterns.md` |
| Host component choice | `references/editor-component-selection.md` |
| Attachment editor integration | `references/attachment-editor-patterns.md` |
| Track B pitfalls | `references/edit-common-pitfalls.md` |
| Make field display | `references/make-field-display-patterns.md` |
| Proven downstream usage and unvalidated areas | `references/validated-usage-notes.md` |
| Track workflows, capability checklists, output templates | `references/track-workflows.md` |
| Table-header asc/desc behavior, shared sort panel, Preset and records sort | Use `make-app-sort` |
| Make record grouping, Preset group, record-groups, groupFilter, grouped leaf pagination | Use `make-app-group` |
| Service route cancellation, server disconnect handling, downstream `AbortSignal` propagation | Use `make-app-service` |

### For base Track A

Read as needed:

- `references/core-props-methods-events.md`
- `references/row-head-action-patterns.md` when adding an icon or action to the body row head / sequence-number area
- `references/virtual-table-patterns.md` when using paginated virtual loading, especially for large data, fast scrolling, or scrollbar dragging
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
- number, currency, and percent cell editors must preserve raw plain-decimal input text and enforce `Number.precision`, `Currency.decimalPlaces`, or `Percent.decimalPlaces` before parsing and commit. Decimal overflow keeps the editor active, shows `最多保留 N 位小数` through a tooltip or external validation surface, and must not call the save API; silent rounding is forbidden unless the host project explicitly documents it
- do not put `aria-hidden` or `inert` on the visual canvas-table host, or on any ancestor that can contain the package-created focusable canvas
- if a screen-reader fallback table is needed, keep it as a separate visually-hidden structure and give the visual host its own non-hidden accessible label
- pagination is opt-in: do not add visible pagination controls, page-size selectors, page state, page query params, total-count handling, paginated fetch logic, `virtualOptions`, or `data:load` wiring unless the user explicitly asks for pagination, virtual loading, or paginated backend integration
- when installed docs expose a virtual-page request context, claim it synchronously and pass the same request to the network signal plus `setData` / `setVirtualPageData` or `markPageLoadFailed`; use the legacy page-only path only when that is the installed public contract
- virtual loading failures and cancellations must release the package pending-page marker through the installed package's documented public API; large-data or fast-scroll paths must also use a bounded host scheduler instead of firing every transient viewport page immediately
- sorting is opt-in: when requested, expose header asc/desc only through the host's documented CanvasTable header menu/suffix API, then call the shared `make-app-sort` controller. Do not sort records locally, keep separate header sort state, or call records directly from a header action
- grouping is opt-in: for Make record lists, use `make-app-group` for the package panel, Preset, Service, `groupFilter`, and records timing. This Skill may instantiate `GroupTableComponent` and wire `group:load` / `group:data:load`, but must not define grouping semantics itself
- Make record actions are default: this Skill wires public selection snapshots, `clearSelection`, supported Shift/select-all behavior, and row colors; `make-app-actions` owns action state, permissions, precheck, batch modal, and mutation timing. Under the CanvasTable 1.3.0 contract, `GroupTableComponent` does not support Shift range selection; do not emulate it in the host

## Detailed workflows and maintenance references

- For track workflows, capability checklists, avoid lists, deferred topics, and final response templates, read `references/track-workflows.md`.
- Before using a capability that is not obviously covered by the current project or package docs, read `references/validated-usage-notes.md` to distinguish validated downstream patterns from less-proven package capabilities.
