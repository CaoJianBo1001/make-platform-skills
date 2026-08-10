# Testing and pitfalls

## TDD order

Use TDD: add a failing test first, implement the smallest contract, then refactor.
Cover pure selection/target helpers separately from UI and Service side effects.

## Required test matrix

Package integration:

- public package entries and one `styles.css` import
- no copied action reducer, permission matcher, Canvas adapter, or modal
- no package network calls or deep imports
- AntD host uses the published adapter; Arco/shadcn/non-AntD host does not import
  AntD and reports the missing batch-modal adapter as a readiness blocker

Action permissions:

- independent combinations of update/delete/bulkUpdate
- bulkUpdate without update still shows batch edit for multiple selection
- batch edit is hidden when `batchEditableFields.length === 0`
- no allowed actions renders scheme two
- principal cache is reused on click/submit; identity/tenant/explicit refresh can
  replace it
- local partial denial returns exact row keys and drives toast/highlight cleanup

Selection and limits:

- manual and Shift selection stay `include`, including manually selecting all
- header select-all produces `exclude` and preserves exclusions
- never convert selection mode from `selectedCount === totalCount`
- explicit 199/200/201 boundaries and exclusion 199/200/201 boundaries
- over-limit toast keeps selection
- virtual loaded records may be partial while explicit IDs remain complete
- grouped child selection reaches the host once, without duplicate parent/group subscriptions
- CanvasTable 1.3.0 grouped mode does not emulate unsupported Shift selection
- filter, search, sort, group, group path, object, and access changes clear state
- header select-all under search/status/quick filters reuses one canonical
  effective filter for list, precheck, and mutation

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
- 403 maps to denied; non-403 upstream error remains failed
- bulk route causes exactly one Make `/data/v1/field` call and zero
  `/data/v1/record` update loops
- precheck and bulk forward identical select-all filter/groupFilter values
- boundary logs contain safe counts/mode but no IDs, expressions, auth, or values

UI:

- one row shows edit/delete; two rows show batch edit
- detail surface has no duplicate edit/delete actions
- no-action bar, close, selected count, and row-alert cleanup
- batch field list enforces meta.field.update and package capability
- Select, Input, DatePicker, User, and Department controls submit normalized values
- clear mode uses `resolveBatchEditClearValue`
- no automation-flow control exists
- precheck denial does not open Drawer/modal
- opaque precheck denial shows toast without marking the whole explicit selection
- selected-count fallback uses frozen count when select-all updatedCount is null

## Readiness blockers

Do not report completion when any of these remain:

- action permissions reuse single-edit permission for batch edit
- principal permissions refetch on every action
- select-all is inferred from counts
- filter/groupFilter are taken from live state after precheck
- query changes retain old selection
- a denied precheck is split to identify rows
- batch edit loops single-record updates or uses `runRecordBatchMutation`
- complex fields are downgraded to plain input
- old requests can open UI, show feedback, or clear newer selection
- details duplicate edit/delete buttons already owned by the selection bar
- a non-AntD host imports AntD only to obtain the batch modal
- select-all drops keyword, status, or quick-filter membership conditions
- an opaque denied precheck marks rows without exact unauthorized IDs

## Fresh-agent forward tests

This is a complex orchestration Skill. Before release, run these prompts with a
fresh agent that receives only the repository and normal Skill discovery. Save
the resulting plan/diff or a compact evaluation record; do not reveal the desired
implementation in the prompt.

1. `为一个 Ant Design Make CanvasTable 可写记录列表接入默认编辑、删除和批量编辑。`
   Accept only when the agent uses package AntD adapters, independent permissions,
   one precheck, and one bulk request.
2. `在有搜索条件的列表中点击表头全选后批量编辑。`
   Accept only when the agent forms one canonical effective filter containing the
   search condition and reuses it for list, precheck, and mutation.
3. `为使用 Arco 的 Make 列表接入同样的批量编辑。`
   Accept only when the agent refuses to mix AntD or copy the modal and reports the
   missing public adapter as a blocker.
4. `为分组 CanvasTable 增加选择操作和 Shift 连选。`
   Accept only when the agent keeps supported selection actions but rejects Shift
   emulation under the installed 1.3.0 grouped-table contract.
5. `批量权限预检返回 403，但没有无权限 ID。`
   Accept only when the agent shows the standard toast without marking all selected
   rows or issuing diagnostic requests.

## Verification

Run the host's focused pure/UI/Service tests first, then its full test, typecheck,
and build commands. Verify one explicit selection path, one header select-all with
search path, one permission-denied path, one 201-record limit path, and one
stale-request path in a real browser when the host supports browser automation.
