# Action and permission model

App permission keys and cached principal rules apply to every presentation.
Selection, scheme-two and CanvasTable row-color feedback below apply only to
desktop/tablet. Phone card/detail actions use [mobile-card-actions.md](mobile-card-actions.md)
for single-record resolution and toast feedback without selection or row colors.

## Principal lifecycle

Load and cache principal permissions at application initialization. Reload them
only when identity changes, tenant changes, or the user performs an explicit
permission refresh. Use the current cached principal snapshot for action clicks
and submissions; never refetch principal permissions for every click or submit.

Use `make-app-permission` to normalize IAM resources, wildcard rules, deny
precedence, and field access. This Skill consumes that result.

## Independent operation keys

Keep these operation permissions independent and do not couple them:

```text
data.record.update      -> single edit
data.record.delete      -> single delete
data.record.bulkUpdate  -> batch edit for two or more records
```

These three keys are independent; they must not be coupled or inferred from one
another.

Having `data.record.bulkUpdate` without `data.record.update` must still allow batch
edit for multiple selection, subject to the field and approval visibility gates below. Having `data.record.update` without
`data.record.bulkUpdate` must not expose batch edit. Delete never implies either
update permission.

Use `meta.field.read` for field visibility. Field editability follows the current
operation state: `data.record.update` for single edit and `data.record.bulkUpdate`
for batch edit. Do not use field counts to infer record-operation permission.

## Action state

Build package action definitions from the cached principal result:

- `visible` combines the current App/entity operation permission with the field and approval visibility gates below.
- `scope: "single"` applies to edit/delete.
- `scope: "multiple"` applies to batch edit.
- `canOperateRecord` may consume row operation metadata already loaded with a
  record for immediate local validation.

Batch-edit visibility requires the independent operation permission, at least
one field after permission/capability filtering, and no known approval-restricted
record within the current selection:

```ts
visible: canBulkUpdate && batchEditableFields.length > 0 && !hasSelectedApprovalRestriction
```

When no batch-editable field remains, hide the batch-edit action before precheck;
do not expose an action that can only end in `当前账号无可批量编辑字段`.

Pass all definitions to `resolveRecordSelectionActionState`:

- one selected row: show allowed edit/delete actions
- two or more selected rows: show allowed batch actions
- no available selected action: use scheme two, retaining `已选 n/total`, lock
  icon, `暂无可用的操作`, and close

For ordinary row-level IAM denial, do not hide an action merely because some
loaded selected rows fail local row checks. Keep the App-level action visible
and call `validateRecordSelectionAction` on click.

Approval write restrictions are an explicit exception: follow the shared
[approval restriction](../../make-app-approval/references/status-display.md#锁与范围)
to hide single edit for a restricted target and batch edit when any known
selected record is restricted. Apply this to buttons and menu items, not just
their disabled state; keep `canOperateRecord`, precheck and final write checks
as well. Do not infer safety for unloaded selected records or silently drop
restricted records from a bulk mutation. Other allowed actions and ordinary
IAM denial feedback remain independent; no actions still uses scheme two.

## Denial feedback

Use `勾选范围中存在无权限数据，请检查勾选范围` for both explicit and
select-all precheck denial.

When package local validation or an authoritative explicit-selection Service
precheck returns exact unauthorized row keys:

1. Block the action without clearing the current selection, so the user can
   inspect or deselect the denied rows.
2. Show the canonical toast above.
3. Keep an alert set keyed by the normalized exact row IDs and mark only those
   whole rows with the host's error-red row style through the installed
   CanvasTable public `setRowColors` API. A denied/error-red row that is selected
   or hovered must remain visible; the checkbox continues to show selection.
4. Remove a row highlight when that row is deselected by calling
   `clearRowColors([rowKey])` for that action-owned alert key.
5. Clear all action highlights when the action bar is closed or query context is
   reset by calling `clearRowColors(alertRowKeys)` before dropping the alert set.
   This restores `rowStyleOptions`, the current selection background, or the
   default background according to the installed CanvasTable contract.
6. Reconcile the alert set when rows are loaded or rendered again in the same
   selection generation, and ignore a stale precheck result after the generation
   changes.

Treat the published CanvasTable 1.3.1 row-color precedence and cleanup as required
installed capabilities.
`setRowColors(rowKeys, undefined)` keeps the package default error color and is
not a clear operation. If the installed public docs do not expose
`clearRowColors` or do not guarantee that business colors remain above selected
and hover backgrounds, report a CanvasTable package-upgrade blocker. Do not add
host CSS, deep imports, or private canvas painting to compensate.

Keep durable row state such as dirty-data color in `rowStyleOptions`, and keep
the action denial color as the temporary `setRowColors` layer. If the host already
has another temporary command-color owner, coordinate both through one host
row-color controller so clearing an action alert cannot erase unrelated feedback.

For explicit mode, the Service maps backend `noPermissionRecordIds` to normalized
`unauthorizedRecordIDList`; this is the authoritative backend source for exact
row feedback. Do not replace it with loaded-record guesses or per-ID diagnostics.

When select-all mode is denied, the backend returns no exact unauthorized row
IDs. Show the same canonical toast and block safely without row highlighting. Do
not mark the full selection as unauthorized, invent IDs, or issue diagnostic
calls.

## Action surfaces

On desktop/tablet, detail surfaces remain display only: the selection bar owns
edit/delete, so the detail must not duplicate those commands. The row-head
open-detail icon remains owned by `canvas-table-integration`.

On phone, detail shows independent edit/delete actions through
`MobileBottomActionBar` as defined in `mobile-card-actions.md`. Card actions do
not replace detail actions. Containers and confirmation UI may differ; phone
and desktop/tablet reuse the same host edit/delete controllers, permission
model, Service routes and error handling. Phone routes must not add an
independent precheck or choose a different delete policy.

Single edit requires the cached `data.record.update` permission, local selection
validation, and one Service row-write precheck before opening the edit Drawer.

Single delete follows the [shared single-delete contract](#shared-single-delete)
in every presentation.

## Shared single delete

PC and phone use the same host delete controller. It owns cached
`data.record.delete` and local row validation, one frozen target, confirmation,
the existing precheck policy, the authoritative delete Service request,
stale-target protection and error handling. Only the confirmation renderer and
entry placement differ; mobile does not construct a second business pipeline.
Keep the same route, request body, record identity, permission snapshot and
failure semantics. Do not send presentation-dependent permission or API fields.

The following labels describe existing host choices for regression coverage;
they are not new configuration keys. Counts apply after local authorization,
confirmation and target validity checks succeed:

| Host delete policy | Precheck calls, PC/phone | Final delete calls, PC/phone |
| --- | --- | --- |
| `final-endpoint-only` | 0 | 1 |
| `precheck-and-final` | 1 | 1 |

If the existing PC controller has no delete precheck, phone adds none. If it
uses `record-write-permission`, both views reuse that one call with
`data.record.delete` and the same frozen target. Cancellation, local denial or
a stale target sends no delete; precheck denial/error also sends no delete.
Final endpoint denial remains authoritative in both policies; a successful
precheck never grants deletion or triggers an automatic retry. Do not add
per-record diagnostics or change the PC policy to accommodate phone UI.

单条编辑使用 data.record.update，批量使用独立的 data.record.bulkUpdate 及其字段状态；批量不能额外要求单条 update。meta.field.update 只管字段结构，业务授权只使用文档列明的记录操作。只读、隐藏、脱敏、deny 和撤权必须在 UI 提交及 Service 写入两处拒绝；前端缓存不替代后端最终授权。
