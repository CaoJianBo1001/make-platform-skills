---
name: make-app-actions
description: "Use when generating, integrating, refactoring, reviewing, or debugging Make CanvasTable record-list 操作按钮 and selection actions; this is the 默认 behavior for writable Make record lists unless explicitly opted out. Triggered by 复选框, 行操作, 选择操作栏, 编辑, 删除, 批量编辑, 暂无可用的操作, selectAll, Shift selection, Shift 200 条上限, selectionIntent, CanvasTable 重建, totalCount 变化, 行级写权限预检, noPermissionRecordIds, 无权限行爆红, record-write-permission, records/bulk, @qfei-design/make-app-actions, or action tests. Covers package integration, independent update/delete/bulkUpdate permissions, Canvas selection intent, immutable snapshots, effective write filters, Service precheck/bulk contracts, UI-adapter compatibility, exact denial-row feedback, stale safety, and tests. Does not own CanvasTable internals, principal IAM policy, general Service layering, page shell, field editor internals, auth, runtime packaging, DSL, Make CLI, or filter/sort/group semantics."
metadata:
  version: 0.1.10
---

# make-app-actions

Treat record selection, the bottom action bar, permission behavior, row-level
precheck, single edit/delete, and batch edit as one integrated Make record-list
capability. Enable it by default for Make record lists backed by CanvasTable;
omit it only when the user explicitly rejects record operations or the list is
strictly read-only.

This Skill owns the consumer-side action workflow. The package owns reusable
selection/action models and standard UI; the host owns principal state, Service
requests, query context, field controls, business feedback, and list refresh.

## Workflow

1. Inspect the host package manager, Node/React/UI-library compatibility,
   installed CanvasTable version and docs, normalized runtime schema, principal
   permission model, records query state, Service routes, edit/detail surfaces,
   and related tests.
2. Install `@qfei-design/make-app-actions@^0.3.1` and
   `@qfei-design/canvas-table@^1.3.1`. Read each installed `package.json` first
   and verify its resolved version satisfies the required range; then
   read `package.ai.json`, parse `package.ai.json.readOrder`, read every declared
   file in order, and use public exports only. Read
   `references/package-integration.md` before changing package integration.
3. Use the published CanvasTable 1.3.1 contract for the public selection snapshot,
   `clearSelection`, `setRowColors`, and `clearRowColors` APIs required by the
   package adapter. Its public docs must also guarantee that business row colors
   remain visible above selection and hover backgrounds. If the cleanup API or
   precedence guarantee is missing, report a CanvasTable upgrade blocker. Use
   `canvas-table-integration` for CanvasTable mechanics; do not deep-import table
   internals or patch the rendering order with host CSS.
4. Enable multiple selection and normalize every public Canvas selection event
   with `resolveCanvasSelectedRecordSnapshot`. Preserve `selectionIntent`; never
   infer select-all from selected and total counts. Treat CanvasTable instance
   replacement and same-query `totalCount` changes with the lifecycle in
   `references/selection-and-operation-snapshot.md`; never replay an action-owned
   selection into a replacement instance. Limit one supported Shift range gesture
   to at most 200 records through the installed CanvasTable public contract; if
   that contract cannot enforce the limit, report a capability blocker instead of
   emulating private selection state in the host. CanvasTable 1.3.1
   `GroupTableComponent` does not support Shift range selection; do not emulate
   Shift ranges in the host unless the installed grouped-table public contract
   explicitly adds that capability.
5. Build single edit, single delete, and multiple batch-edit actions from the
   current cached principal snapshot. Keep `data.record.update`,
   `data.record.delete`, and `data.record.bulkUpdate` independent.
6. On action click, validate the resolved selection and package batch limit,
   perform package local row validation, then freeze one immutable operation
   snapshot before any asynchronous precheck starts.
7. Before opening single edit or batch-edit UI, send that complete frozen target
   to one host Service precheck. Do not call Make from UI and do not split a
   denied multi-record request into diagnostic requests. For explicit selection,
   map authoritative `noPermissionRecordIds` from the documented HTTP 200 business
   denial to exact whole-row error-red feedback. Select-all denial has no row IDs
   and remains toast-only.
8. For batch edit, filter fields by runtime read/update permissions and package
   capability. Ant Design hosts render package `AntdRecordBatchEditModal` with
   host field controls. Other React hosts render package `RecordBatchEditModal`,
   inject their design-system shell/select/mode controls, and provide Make field
   controls through `renderValueControl`; never mix in AntD or copy the modal.
   The host must use its installed design system's public overlay API to keep
   injected popups outside clipping ancestors and above the owning dialog while
   preserving focus, Escape, and outside-click behavior.
   Reuse the frozen operation snapshot on submit.
9. Send one host Service batch request. Service sends one Make
   `/data/v1/field` request; do not loop single-record updates and do not use
   `runRecordBatchMutation` as the Make default path.
10. Invalidate stale prechecks and submissions on selection, object, access, or
    query-context changes. Clear selection when keyword, filter, sort, group, or
    object context changes. A successful applied-query handoff clears selection;
    draft edits and failed saves/queries do not redefine the action target.
11. Remove edit/delete commands from detail surfaces when these actions are owned
    by the selection bar. Keep detail open as a read/display action.
12. Add the tests in `references/testing-and-pitfalls.md` before reporting the
    workflow complete.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Package installation, UI-library compatibility, public imports, host/package boundary | `references/package-integration.md` |
| Independent operation permissions, cached principal, action visibility, denial UI | `references/action-permission-model.md` |
| Canvas selection intent, 200 limits, query identity, immutable operation snapshot | `references/selection-and-operation-snapshot.md` |
| UI-Service precheck and bulk routes, Make payloads, errors, call-count invariants | `references/service-contract.md` |
| Single action behavior, batch modal fields, submit lifecycle, stale selection safety | `references/batch-edit-flow.md` |
| TDD matrix, integration checks, races, readiness blockers | `references/testing-and-pitfalls.md` |
| Canvas selection events, clearSelection, row colors, Shift selection | Use `canvas-table-integration` |
| Principal IAM endpoint, permission resource matching, field access | Use `make-app-permission` |
| Service layering, adapters, validation, logs, request context | Use `make-app-service` |
| Toolbar/table placement, Drawer layout, field controls | Use `makeui` |
| Global filter expression and applied filter state | Use `make-app-filter` |
| Applied sort state | Use `make-app-sort` |
| Group path and `groupFilter` composition | Use `make-app-group` |

## Non-negotiable invariants

- The installed `package.json` is the authoritative package-version source. For
  this Skill, resolve `@qfei-design/make-app-actions@^0.3.1` before reading
  `package.ai.json`; its published `0.3.1` manifest has stale `0.3.0` version and
  install fields that must not downgrade the integration.
- Resolve `@qfei-design/canvas-table@^1.3.1` for the published row-color
  precedence and `clearRowColors` contract. Do not accept `1.3.0` for a writable
  record-action list and do not emulate the missing behavior in host code.
- Make CanvasTable record lists get selectable rows and the standard action bar
  by default. A strictly read-only list may opt out explicitly only when
  read-only is an object/product capability, not merely the current user's lack
  of write permissions; a user with no actions still gets scheme two.
- Exactly one selected record shows edit/delete according to their independent
  permissions. Two or more selected records show batch edit according only to
  `data.record.bulkUpdate` and available batch-editable fields.
- When no selected action is available, keep scheme two: show the selected count,
  lock icon, `暂无可用的操作`, and close control.
- Use the current cached principal permissions for action clicks and submissions.
  Do not refetch principal per operation.
- Treat package local row checks as immediate feedback, not final authorization.
  The row precheck and final write endpoint remain authoritative.
- Freeze target mode, IDs or exclusions, selected count, object/entity identity,
  `filter`, and `groupFilter` before precheck. Precheck and mutation must use the
  same snapshot. Do not invent an undocumented `snapshotToken`/opaque token or
  replace the target with one; only use such a token when the installed host
  Service contract explicitly defines and verifies it.
- Keep `filter` and `groupFilter` separate and unchanged. They are accepted only
  for select-all targets and are combined by backend semantics, not by UI or
  Service string rewriting.
- Explicit selection and exclusion lists each allow at most 200 IDs. An explicit
  selection over 200 is blocked without opening the modal and keeps selection so
  the user can deselect rows.
- One supported Shift range-selection gesture selects at most 200 records. Enforce
  this through the installed CanvasTable public contract; do not add host-owned
  keyboard/range-selection internals when that capability is unavailable.
- An explicit precheck HTTP 200 business denial with authoritative
  `noPermissionRecordIds` blocks the action, shows the canonical denial toast, and
  marks only those exact rows with the host error-red row style. That semantic
  color must remain visible while a denied row is selected or hovered. Clear the
  action-owned command color through `clearRowColors`; do not use
  `setRowColors(rowKeys, undefined)` as cleanup. A select-all 403 returns no row
  IDs, shows the same toast, and never invents rows to highlight.
- One action produces at most one Make permission-precheck request and one final
  Make mutation request. Never use per-ID diagnostics or per-record update loops.
- Selection/query races must not open stale UI, apply stale feedback, clear a
  newer selection, or submit a target different from the prechecked target.
- CanvasTable instance replacement clears action-owned selection exactly once.
  Same-query total growth re-normalizes the current public snapshot; total shrink
  clears through the installed public `clearSelection()` contract.
- Use runtime schema and field permissions for batch fields. Never downgrade an
  unsupported complex field to a plain input.
- The shared batch modal does not include automation-flow controls.
- Do not introduce Ant Design into an Arco, shadcn/ui, or other non-AntD host.
  Use the package generic `RecordBatchEditModal` with host component injection;
  the host must not copy package modal state or validation behavior.

## Handoffs

- With `canvas-table-integration`: it owns public CanvasTable selection/highlight
  mechanics; this Skill owns how those snapshots drive action state and writes.
- With `make-app-permission`: it owns principal loading and permission matching;
  this Skill consumes the cached result and owns independent action semantics.
- With `make-app-service`: this Skill defines action request contracts and timing;
  Service owns strict parsers, Make adapters, login-context forwarding, logs, and
  tests.
- With `makeui`: it owns the surrounding list, chosen component library, Drawer,
  and field-control visuals; this Skill owns package action state, the standard
  bottom action-bar placement, supported modal adapters, and action lifecycle.
- With filter/sort/group Skills: consume their latest successfully applied query
  context. Any successfully applied query change clears selection and invalidates
  pending action work; draft edits and failed saves/queries preserve the current
  selection. `groupFilter` composition stays with `make-app-group`.
