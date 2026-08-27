# Testing and pitfalls

## TDD order

Use TDD: add a failing test first, implement the smallest contract, then refactor.
Cover pure selection/target helpers separately from UI and Service side effects.

## Required test matrix

Package integration:

- public package entries and one `styles.css` import
- no copied action reducer, permission matcher, Canvas adapter, or modal
- no package network calls or deep imports
- AntD host uses the published adapter; Arco/shadcn/non-AntD React host uses the
  generic action bar/modal, injects its own components, and does not import AntD
- AntD `renderValueControl(field, control)` forwards `control.disabled`; generic
  controls forward the complete controlled-value contract

Action permissions:

- independent combinations of update/delete/bulkUpdate
- bulkUpdate without update still shows batch edit for multiple selection
- batch edit is hidden when `batchEditableFields.length === 0`
- no allowed actions renders scheme two
- principal cache is reused on click/submit; identity/tenant/explicit refresh can
  replace it
- local partial denial returns exact row keys and drives toast/highlight cleanup
- explicit Service denial with HTTP 200, business code `20000032`, and
  `noPermissionRecordIds` drives the same canonical toast plus exact whole-row
  error-red feedback
- on a real CanvasTable path, a selected or hovered denied row keeps the
  error-red color visible; deselect/close calls `clearRowColors` and restores the
  applicable `rowStyleOptions`, selected, hover, or default background

Selection and limits:

- manual and Shift selection stay `include`, including manually selecting all
- one Shift range-selection gesture covers 199/200/201 boundaries, accepts at
  most 200 through the installed public CanvasTable contract, and never adds
  host-owned range-selection internals
- header select-all produces `exclude` and preserves exclusions
- never convert selection mode from `selectedCount === totalCount`
- explicit 199/200/201 boundaries and exclusion 199/200/201 boundaries
- over-limit toast keeps selection
- virtual loaded records may be partial while explicit IDs remain complete
- grouped child selection reaches the host once, without duplicate parent/group subscriptions
- CanvasTable 1.3.1 grouped mode does not emulate unsupported Shift selection
- filter, search, sort, group, group path, object, and access changes clear state
- header select-all under search/status/quick filters reuses one canonical
  effective filter for list, precheck, and mutation
- CanvasTable recreation publishes exactly one empty selection snapshot, rejects
  disposed-instance events, invalidates pending work, and does not replay the old
  action selection
- same-query `totalCount` growth re-normalizes the current public snapshot and
  invalidates pending work when the normalized intent/count changes
- same-query `totalCount` shrink calls public `clearSelection()` and produces one
  canonical empty notification without a duplicate host `selection:change`

Operation snapshot and races:

- snapshot is captured before precheck and deeply copies target/query expressions
- precheck and mutation receive the same target values
- selection change invalidates an old allowed, denied, or failed precheck
- object/query/access A -> B -> A transitions reject stale generations
- stale submit success does not clear a newer selection
- duplicate submit is blocked and lock releases after success/failure

Service:

- explicit/select-all strict union parsing and unknown-property rejection
- exact 1-200 ID and 0-200 exclusion limits
- one Service request causes exactly one Make `/data/v1/permission` call
- denied multi-record request causes no per-ID diagnostic calls
- explicit denial maps HTTP 200 + `code: 20000032` + numeric
  `data.noPermissionRecordIds` to ordered canonical string
  `unauthorizedRecordIDList`
- raw-response lossless decoding preserves `9007199254740993` and maps it to the
  exact frozen request row key without JavaScript `Number` coercion or rounding
- malformed, duplicate, or out-of-target `noPermissionRecordIds` remains an
  operational contract failure without guessed row feedback
- select-all 403 maps to denied with an empty ID list; other upstream failures
  remain failed
- bulk route causes exactly one Make `/data/v1/field` call and zero
  `/data/v1/record` update loops
- precheck and bulk forward identical select-all filter/groupFilter values
- boundary logs contain safe counts/mode but no IDs, expressions, auth, or values

UI:

- one row shows edit/delete; two rows show batch edit
- detail surface has no duplicate edit/delete actions
- no-action bar, close, selected count, and row-alert cleanup
- the default modal title is exactly `批量编辑`
- batch field list enforces meta.field.update and package capability
- Select, Input, DatePicker, User, and Department controls submit normalized values
- for FieldSelect and each popup value control, open the dropdown/picker and assert
  its popup DOM is mounted outside the modal panel/body or other overflow clipping
  ancestor; then verify in a real browser that it appears above the dialog, its
  border and final option/date row remain visible, and modal scrolling does not
  clip it
- in both an Arco adapter and a shadcn/ui or Radix adapter, verify focus remains
  in the active overlay stack, keyboard navigation works, Escape closes the
  popup before the dialog, outside-click behavior follows the installed library,
  and focus returns to the trigger
- clear mode uses `resolveBatchEditClearValue`
- no automation-flow control exists
- precheck denial does not open Drawer/modal
- explicit `20000032` denial marks only the returned whole rows with the host
  error-red style, preserves the selection, removes one row alert on deselect,
  and clears all alerts when the action bar closes
- the row-alert integration test uses a real CanvasTable instance or package
  component path rather than only a method mock: selected/hovered denial remains
  visibly error red, then `clearRowColors` restores the underlying row state; run
  the same assertion for grouped tables when grouped actions are in scope
- opaque precheck denial shows toast without marking the whole explicit selection
- selected-count fallback uses frozen count when select-all updatedCount is null

## Readiness blockers

Do not report completion when any of these remain:

- action permissions reuse single-edit permission for batch edit
- principal permissions refetch on every action
- select-all is inferred from counts
- filter/groupFilter are taken from live state after precheck
- query changes retain old selection
- CanvasTable recreation restores an action-owned selection from the old instance
- total-count shrink retains a stale target or emits duplicate empty notifications
- a denied precheck is split to identify rows
- batch edit loops single-record updates or uses `runRecordBatchMutation`
- complex fields are downgraded to plain input
- old requests can open UI, show feedback, or clear newer selection
- details duplicate edit/delete buttons already owned by the selection bar
- a non-AntD host imports AntD only to obtain the batch modal
- a batch-edit dropdown or picker remains inside an overflow-clipped modal panel
- a non-AntD popup is visually correct but breaks focus, Escape, or outside-click
  behavior after portaling
- select-all drops keyword, status, or quick-filter membership conditions
- an opaque denied precheck marks rows without exact unauthorized IDs
- an explicit `20000032` denial drops `noPermissionRecordIds`, marks the entire
  selection, or fails to mark the exact returned rows error red
- selected or hovered rows hide an active denial color, cleanup uses
  `setRowColors(rowKeys, undefined)`, or clearing an alert loses an underlying
  durable row style
- the installed CanvasTable contract lacks `clearRowColors` or the documented
  business-color-over-selection precedence and the host tries to compensate with
  CSS/private rendering instead of reporting an upgrade blocker
- one Shift gesture can create an explicit selection over 200 records or is
  emulated through host/private selection state

## Fresh-agent forward tests

This is a complex orchestration Skill. Before release, run these prompts with a
fresh agent that receives only the repository and normal Skill discovery. Save
the resulting plan/diff or a compact evaluation record; do not reveal the desired
implementation in the prompt.

1. `为一个 Ant Design Make CanvasTable 可写记录列表接入默认编辑、删除和批量编辑。`
   Accept only when the agent uses package AntD adapters, independent permissions,
   the `0.3.1` two-argument value-control callback with `disabled`, the canonical
   `批量编辑` title, one precheck, and one bulk request.
2. `在有搜索条件的列表中点击表头全选后批量编辑。`
   Accept only when the agent forms one canonical effective filter containing the
   search condition and reuses it for list, precheck, and mutation.
3. `为使用 Arco 的 Make 列表接入同样的批量编辑。`
   Accept only when the agent uses package `RecordBatchEditModal`, injects Arco
   `Modal`/field-select/mode-control components through
   `MakeAppBatchEditComponents`, forwards the generic `renderValueControl` control
   object to real field inputs, portals popup controls outside the modal panel's
   clipping ancestors, keeps the title as `批量编辑`, preserves focus/Escape/
   outside-click behavior, and refuses to mix AntD or copy the modal.
4. `为 CanvasTable 增加 Shift 连选，单次最多 200 条；同时兼容分组表。`
   Accept only when the agent uses the installed public contract to cap one
   ordinary-table Shift gesture at 200, treats a missing public limit as a blocker,
   and rejects Shift emulation under the installed 1.3.1 grouped-table contract.
5. `非全选批量权限预检返回 HTTP 200、code 20000032 和部分无权限 ID；表头全选仍返回 403 且没有 ID。`
   Accept only when the agent normalizes exact explicit IDs, shows the canonical
   toast, marks only those whole rows error red above selected/hover backgrounds,
   cleans alerts with `clearRowColors` on deselect/close while restoring the
   underlying row state, and keeps select-all denial toast-only without diagnostic
   requests.
6. `为使用 shadcn/ui 和 Radix primitives 的 Make 列表接入同样的批量编辑。`
   Accept only when the agent resolves
   `@qfei-design/make-app-actions@^0.3.1` from installed `package.json` before
   reading `package.ai.json`, uses package `RecordBatchEditModal`, injects
   package-neutral host wrappers, uses the installed Radix Portal/container
   contract, explicitly preserves focus/Escape/outside-click ordering, and adds
   no AntD dependency or AntD-shaped generic props. Reject `^0.3.0` even when a
   stale manifest recommends it.
7. `可写列表已有选择操作栏；成功应用筛选或排序后如何处理当前选择？同时，CanvasTable 实例重建且同一查询的 totalCount 先增加后减少时，怎样保证操作选择安全？`
   Accept only when the agent clears selection and invalidates pending work after a
   successfully applied filter/sort change while preserving selection for drafts
   and failed attempts; it must also publish one empty action snapshot on
   recreation without replaying the old selection, re-normalize the active public
   snapshot on growth, call public `clearSelection()` on shrink, reject
   disposed-instance events, and prevent duplicate empty notifications.

## Verification

Run the host's focused pure/UI/Service tests first, then its full test, typecheck,
and build commands. Verify one explicit selection path, one header select-all with
search path, one explicit exact-ID denial path including selected/hover visibility
and `clearRowColors` restoration, one select-all opaque-denial path, one 201-record
action limit, one Shift 199/200/201 boundary, and one stale-request path in a real
browser when the host supports browser automation.
