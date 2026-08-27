---
name: make-app-group
description: "Use when integrating, generating, refactoring, reviewing, or debugging Make App record-list grouping with @qfei-design/make-app-group and @qfei-design/canvas-table GroupTableComponent. Triggered by 分组, 高级分组, 多级分组, 分组条件, 拖拽分组, 表头分组, 表头分组 openWithField, capabilities.groupable, Entity Preset group save/load/echo, record-groups, groupFilter, grouped leaf pagination, or grouping tests. Covers one integrated toolbar, CanvasTable grouped rendering, Entity Preset, Service group contracts, Make Data ListResources grouping mode, groupFilter expression composition, and leaf-record pagination. When make-app-actions is present, a successfully applied group must clear its selection and invalidate pending action work; draft edits and failures preserve selection. Does not own page shell/layout, CanvasTable internals, package internals, permission policy, auth, runtime packaging, DSL modeling, Make CLI execution, filtering, sorting, or cell editing."
metadata:
  version: 0.1.5
---

# make-app-group

Treat toolbar grouping, optional CanvasTable header grouping entry, Entity Preset
persistence, Service `record-groups` requests, records `groupFilter`, and
CanvasTable grouped rendering as one integrated capability.

This Skill owns the consumer contract and grouping semantics. Related Skills own
their implementation surfaces.

## Workflow

1. Inspect the host package manager, normalized runtime schema, permission gate,
   Preset hook/routes, records lifecycle, existing CanvasTable integration, and
   tests.
2. Install `@qfei-design/make-app-group@^0.1.0`. Read its `package.ai.json` first,
   parse `package.ai.json.readOrder`, read every declared file in order, import
   only public exports and `styles.css`, and remove copied UI model, panel,
   styles, or drag behavior.
3. Ensure `@qfei-design/canvas-table` is installed. Use `canvas-table-integration`
   to read the installed package docs and verify `GroupTableComponent`,
   `group:load`, `group:data:load`, `setGroup`, `setData`, and
   `markGroupPageLoadFailed` are public.
4. Build grouping candidates from normalized runtime fields with a non-empty key
   and `capabilities.groupable === true`. Do not use visible columns, sample rows,
   local DSL, or field-type allowlists as the source of truth.
5. Use ordered `{ fieldKey, order }[]` as the only grouped-list value. Persist it
   in Entity Preset `group`; use at most three unique fields.
6. Establish a permission-aware object context. Load schema and Entity Preset,
   sanitize saved group, and only then choose plain-record or grouped-record
   loading.
7. Use one controlled, click/press-opened host Popover/Drawer/Modal with package
   `RecordGroupPanel`, `useRecordGroupController`, the host component adapter, and
   a stable `resetKey`. Treat all portalled/teleported child popups as part of the
   outer interaction boundary; never close from hover, pointer leave, blur, child
   value selection, or child-overlay close.
8. Let `onConfirm` persist only `{ group }`, let synchronous `onApplied` replace
   applied group state, and let a separate data lifecycle react to object context
   plus applied filter/sort/group. Always provide `onApplyError`.
9. When the writable list uses `make-app-actions`, hand off the successfully
   applied group generation so actions clear selection and invalidate pending
   precheck/submit work. Draft edits, cancel, and save/apply failure preserve the
   current action selection.
10. In Service, parse raw Preset and query input with a strict transport parser,
   validate group fields against current runtime schema, then forward the ordered
   group value to Make Data. Tolerant sanitization is only for saved/upstream reads.
11. When applied group is empty, use ordinary records mode and omit Data API
    `group`. When applied group is non-empty, first request the root group page,
    then initialize or refresh `GroupTableComponent`.
12. Compose `groupFilter` from the initial group filter plus selected group path
    conditions using the backend DNF expression rules. Do not concatenate complex
    expressions by hand.
13. Wire CanvasTable `group:load` to the remaining group levels and
    `group:data:load` to ordinary records with full group path `groupFilter`.
14. Add the model, UI, Preset, Service, groupFilter, CanvasTable, permission,
    concurrency, stale request, and failure-page tests listed in the testing
    reference.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Group value, capability source, Lookup support, `group: []` semantics | `references/group-model.md` |
| Package UI, dnd-kit, draft lifecycle, `openWithField`, styles | `references/ui-and-drag.md` |
| Preset hydration, save-before-apply, group data timing, stale requests | `references/preset-and-data-flow.md` |
| CEL literal handling, DNF append, null and Lookup path conditions | `references/group-filter-expression.md` |
| UI-Service routes, Make Data grouping mode, validation and payload | `references/service-contract.md` |
| CanvasTable group events, root/child/leaf loading, render reset | `references/canvas-table-flow.md` |
| TDD, integration checks, regressions and readiness | `references/testing-and-pitfalls.md` |
| Toolbar placement and object-list layout | Use `makeui` |
| CanvasTable construction and header menu mechanics | Use `canvas-table-integration` |
| Service route/adapter code and boundary logs | Use `make-app-service` |
| Object/list access policy and permission gates | Use `make-app-permission` |
| Grouped record selection actions and batch editing | Use `make-app-actions` |
| Advanced-filter expression semantics | Use `make-app-filter`; read `makedsl` filter references when generating CEL |
| Record sorting and table-header asc/desc behavior | Use `make-app-sort` |

## Non-negotiable invariants

- Grouping is optional until requested or already present. Once in scope, deliver
  toolbar grouping, Preset persistence, Service contracts, grouped CanvasTable
  rendering, and grouped leaf pagination together.
- Use only ordered `{ fieldKey, order }[]`. Reject legacy `groupFieldKey`,
  `field`, `sort`, direction aliases, map objects, duplicates, unknown properties,
  and more than three entries.
- A Data API group item only allows `fieldKey` and `order`; `properties` is always
  invalid for grouping, including an empty string.
- Array order is the hierarchy contract: index 0 is the root group, index 1 is the
  second level, and index 2 is the third level.
- A field is groupable only when its normalized runtime schema has a non-empty key
  and `capabilities.groupable === true`. Service remains authoritative when the UI
  or Preset contains stale values.
- Do not blanket-disable `Make.Field.Lookup` in platform guidance. Lookup grouping
  support is determined by runtime schema capability and backend relation rules.
  A project may add a temporary V1 policy, but this Skill must not encode that as a
  platform rule.
- Keep applied group and panel draft separate. Editing, dragging, adding,
  deleting, clearing, true outside click, child-overlay interaction, and header
  `openWithField` must not request groups or records before confirm.
- The outer grouping overlay is controlled and opens only by explicit click/press,
  never hover or focus. Close it after confirm succeeds or after a verified true
  outside pointer interaction. A Select, picker, menu, tooltip, popover, or drag
  overlay rendered through portal/teleport remains inside the owned interaction
  boundary and must not close the grouping panel.
- Use package `useRecordGroupController` with `resetKey`, `onConfirm`,
  synchronous `onApplied`, and required `onApplyError`. Do not put group-data
  requests in `onConfirm` or `onApplied`.
- Save before apply. Preset writes are sparse, clear uses Preset `{ group: [] }`,
  and filter, sort, and group never overwrite one another.
- Data API records mode uses `group` omitted or `null`. Data API `group: []` is
  invalid and must never be used as the grouped leaf-record request.
- Grouping mode requests omit `fields` and ordinary `sort`; Make Data ignores them
  in grouping mode. Leaf-record requests return to ordinary records mode and may
  include `fields`, `filter`, `groupFilter`, `sort`, and `pagination`.
- Schema/Preset hydration and access checks gate the first records or group
  request. Entity or permission changes invalidate the old generation, panel,
  header menu, applied state, group cache, leaf cache, and table query context.
- `groupFilter` is independent from `filter`. Do not merge them into one
  expression. Backend applies them as an AND relationship.
- Appending group path conditions to an existing OR expression must preserve DNF:
  append the new condition to every top-level OR branch rather than producing a
  nested expression that the backend cannot parse.
- Grouped leaf page failure or cancellation must call
  `markGroupPageLoadFailed(groupValue, page)` so CanvasTable can retry that page.
- Grouped V1 should treat cell editing as disabled unless the product explicitly
  defines and tests a grouped edit lifecycle.
- Writable grouped record lists may use the default `make-app-actions` selection
  workflow. Under CanvasTable 1.3.1, `GroupTableComponent` does not support Shift
  range selection; do not emulate it in the host.
- When that action workflow is present, only a successfully applied group
  generation clears selection and invalidates pending action work. Group drafts,
  cancel, validation/Preset failure, and failed group queries preserve selection.
- Add safe boundary logs at UI-Service adapters and Service route/adapters for
  entry, success, failure, and stale-result branches. Never log cookies, tokens,
  secrets, Authorization, full expressions, or record payloads.

## Handoffs

- With `makeui`: place the optional group trigger after filter and before sort;
  this Skill owns group behavior and state.
- With `canvas-table-integration`: it owns `GroupTableComponent` construction and
  CanvasTable public API mechanics; this Skill owns when and what to request and
  how to translate grouping results into the table.
- With `make-app-service`: this Skill defines group query and Preset semantics;
  Service owns strict parsing, routes, Make adapters, schema capability validation,
  logs, and tests.
- With `make-app-permission`: it owns access policy; this Skill treats permission
  enable/disable as an object-context transition that invalidates group requests.
- With `make-app-filter`: filter and group share expression semantics but stay in
  separate request fields. Filter panel state is persisted as `filter`; grouping
  path state is transient and sent as `groupFilter`.
- With `make-app-sort`: sort and group share one Entity Preset lifecycle but update
  dimensions independently. Sort applies only to ordinary records and grouped leaf
  records, not to grouping-mode requests.
- With `make-app-actions`: only for writable grouped lists using the action
  workflow, hand off a successfully applied group generation so actions clear
  selection and invalidate pending work. Draft and failure paths preserve the
  current selection; this Skill does not emit CanvasTable selection events.
