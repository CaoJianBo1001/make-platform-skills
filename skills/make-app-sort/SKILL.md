---
name: make-app-sort
description: "Use when integrating, generating, refactoring, reviewing, or debugging Make App record-list sorting with @qfei-design/make-app-sort. Triggered by 排序, 高级排序, 多字段排序, 排序优先级, 升序/降序, 排序条件拖拽, 表格/表头/列头排序, openWithField, sortable capabilities, Entity Preset sort save/load/echo, records sort payloads, or sorting tests. Covers one integrated toolbar, CanvasTable header, Entity Preset, and Service sorting flow. When make-app-actions is present, a successfully applied sort must clear its selection and invalidate pending action work; draft edits and failures preserve selection. Does not own page shell/layout, CanvasTable rendering internals, Service route implementation, permission policy, auth, runtime packaging, DSL modeling, Make CLI execution, npm package internals, or grouping."
metadata:
  version: 0.1.4
---

# make-app-sort

Treat toolbar sorting, CanvasTable header sorting, Entity Preset persistence, and
Service records `sort` requests as one integrated capability. This Skill owns the
consumer contract and sorting semantics; related Skills own their implementation
surfaces.

## Workflow

1. Inspect the host package manager, normalized runtime schema, permission gate,
   Preset hook/routes, records request lifecycle, CanvasTable header APIs, and tests.
2. Install `@qfei-design/make-app-sort@^0.1.0`. Read its `package.ai.json` and every
   `package.ai.json.readOrder` entry, import only public exports and `styles.css`,
   and remove copied UI model, panel, styles, or drag behavior.
3. Build candidates only from normalized runtime fields with a non-empty key and
   `capabilities.sortable === true`.
4. Establish a permission-aware object context. Load schema and Entity Preset,
   sanitize saved sort, and only then allow the first records request.
5. Use one host-owned outer Popover with package `RecordSortPanel`,
   `useRecordSortController`, the host's public component adapter, and a stable
   `resetKey` token that changes whenever entity or access context changes.
6. Connect CanvasTable asc/desc actions to the same controller through
   `openWithField(fieldKey, order?)`; header actions edit draft only.
7. Let `onConfirm` persist only `{ sort }`, let synchronous `onApplied` replace
   applied state, and let a separate records lifecycle react to object context plus
   applied filter/sort. Always provide `onApplyError`.
8. In Service, parse raw PATCH and records input with a strict transport parser,
   validate fields against current runtime schema, then forward the ordered value
   to Make Data. Tolerant sanitization is only for saved/upstream reads.
9. When the writable list uses `make-app-actions`, hand off the successfully
   applied sort generation so actions clear selection and invalidate pending
   precheck/submit work before the new query is actionable. Draft edits, cancel,
   and save/apply failure preserve the current action selection.
10. Add the model, UI, header, Preset, permission, concurrency, Service, stale
    request, and conditional action-selection tests listed in the testing reference.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Sort value, sortable capability, validation, sanitization, five-level limit | `references/sort-model.md` |
| Panel UI, dnd-kit, draft lifecycle, `openWithField`, styles | `references/ui-and-drag.md` |
| Preset hydration, save-before-apply, records timing, stale requests | `references/preset-and-data-flow.md` |
| UI-Service routes, Make Preset adapter, records validation and payload | `references/service-contract.md` |
| TDD, integration checks, regressions and readiness | `references/testing-and-pitfalls.md` |
| Toolbar placement and object-list layout | Use `makeui` |
| CanvasTable header menu and suffix mechanics | Use `canvas-table-integration` |
| Service route/adapter code and boundary logs | Use `make-app-service` |
| Object/list access policy and permission gates | Use `make-app-permission` |
| Advanced-filter state and Preset filter persistence | Use `make-app-filter` |
| Grouping state, Preset group, record-groups, groupFilter | Use `make-app-group` |
| Writable-list selection actions and applied-query invalidation | Use `make-app-actions` |

## Non-negotiable invariants

- Sorting is optional until requested or already present. Once in scope, deliver
  toolbar sorting, CanvasTable header linkage, Preset persistence, and records sort
  together.
- Use only `{ fieldKey, order }[]`. Reject legacy `{ field, order }`, unknown keys,
  invalid directions, duplicates, and more than five entries.
- Treat array order as priority: index 0 is the highest-priority sort.
- A field is sortable only when its normalized runtime schema has a non-empty key
  and `capabilities.sortable === true`. Do not use a field-type allowlist, visible
  table columns, sample rows, or local DSL as the source of truth.
- Keep applied sort and panel draft separate. Editing, dragging, adding, deleting,
  clearing, outside click, and escape must not query records before confirm.
- Use package `useRecordSortController` with `resetKey`, `onConfirm`, synchronous
  `onApplied`, and required `onApplyError`. Do not put records requests in
  `onConfirm` or `onApplied`.
- Save before apply. Preset writes are sparse, clear uses `sort: []`, and filter,
  sort, and group dimensions never overwrite one another. Shared saving and
  error state must remain correct when filter and sort saves overlap.
- Schema/Preset hydration and access checks gate the first records request. Object
  or permission changes invalidate the old generation, panel, header menu, applied
  state, and table query context, including `A -> B -> A`.
- CanvasTable header asc/desc actions only open or update the shared panel draft
  through `openWithField`; they do not bypass confirm or call records directly.
- Package helpers own UI model/draft behavior. Service owns strict raw-input parsing;
  never use tolerant sanitization to accept an invalid PATCH or records query.
- Search remains session-only. Do not persist keyword search in Entity Preset.
- If `make-app-actions` is present, only a successfully applied sort generation
  clears its selection and invalidates pending action work. Draft edits, panel
  cancel, validation failure, Preset save failure, and failed list queries do not
  clear or redefine the current action selection.
- Add safe boundary logs at UI-Service adapters and Service route/adapters for
  entry, success, failure, and stale-result branches. Never log cookies, tokens,
  secrets, Authorization, or full sensitive record data.

## Grouping boundary

Grouping is owned by `make-app-group` and `capabilities.groupable`; this Skill must
not add group UI, record-groups payloads, `groupFilter` expression composition, or
Preset `group` writes. Sparse sort updates preserve the existing group dimension.

## Handoffs

- With `makeui`: place the optional sort trigger after filter and before refresh;
  this Skill owns sort behavior and state.
- With `canvas-table-integration`: it owns header/menu mechanics; this Skill owns
  the call to the shared sort panel.
- With `make-app-service`: this Skill defines the contract; Service owns strict
  parsing, routes, Make adapters, schema capability validation, logs, and tests.
- With `make-app-permission`: it owns access policy; this Skill treats permission
  enable/disable as an object-context transition that invalidates sort requests.
- With `make-app-filter`: filter and sort share one Entity Preset lifecycle but
  update dimensions independently and may save concurrently.
- With `make-app-group`: group and sort share one Entity Preset lifecycle but
  update dimensions independently. Sort applies to ordinary records and grouped
  leaf records, while grouping-mode record-groups requests ignore ordinary sort.
- With `make-app-actions`: only for writable lists using the action workflow,
  hand off a successfully applied sort generation before the new query becomes
  actionable so actions clear selection and invalidate pending work. Draft and
  failure paths preserve selection; this Skill does not manipulate CanvasTable
  selection APIs directly.
