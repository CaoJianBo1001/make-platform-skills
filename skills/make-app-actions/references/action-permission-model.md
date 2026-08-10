# Action and permission model

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

Having `data.record.bulkUpdate` without `data.record.update` must still show batch
edit for multiple selection. Having `data.record.update` without
`data.record.bulkUpdate` must not expose batch edit. Delete never implies either
update permission.

Use `meta.field.read` for field visibility and `meta.field.update` for field
editability. Do not use field counts to infer record-operation permission.

## Action state

Build package action definitions from the cached principal result:

- `visible` represents the current App/entity operation permission.
- `scope: "single"` applies to edit/delete.
- `scope: "multiple"` applies to batch edit.
- `canOperateRecord` may consume row operation metadata already loaded with a
  record for immediate local validation.

Batch-edit visibility requires both the independent operation permission and at
least one field after permission/capability filtering:

```ts
visible: canBulkUpdate && batchEditableFields.length > 0
```

When no batch-editable field remains, hide the batch-edit action before precheck;
do not expose an action that can only end in `当前账号无可批量编辑字段`.

Pass all definitions to `resolveRecordSelectionActionState`:

- one selected row: show allowed edit/delete actions
- two or more selected rows: show allowed batch actions
- no available selected action: use scheme two, retaining `已选 n/total`, lock
  icon, `暂无可用的操作`, and close

Do not hide an action merely because only some loaded selected rows fail local
row checks. Keep the App-level action visible and call
`validateRecordSelectionAction` on click.

## Denial feedback

When local validation returns exact unauthorized row keys:

1. Block the action.
2. Show `勾选范围中存在无权限数据，请检查勾选范围`.
3. Highlight the exact rows through CanvasTable public row-color APIs.
4. Remove a row highlight when that row is deselected.
5. Clear all action highlights when the action bar is closed or query context is
   reset.

When the Service denies a precheck without exact unauthorized row IDs, show the
standard toast and block safely without row highlighting. Do not mark the full
explicit selection as unauthorized, invent IDs, or issue diagnostic calls. A
select-all denial follows the same toast-only fallback. Exact row highlighting
requires exact IDs from package local validation or a future authoritative
backend contract.

## Action surfaces

The selection bar owns edit and delete commands. Detail surfaces remain display
only and must not duplicate edit/delete buttons. The row-head open-detail icon is
still valid and is owned by `canvas-table-integration`.

Single edit requires the cached `data.record.update` permission, local selection
validation, and one Service row-write precheck before opening the edit Drawer.

Single delete requires cached `data.record.delete`, local validation, explicit
confirmation, and the normal authoritative delete Service endpoint. If the host
uses the row-write precheck for delete, send `data.record.delete` once; never
replace final delete authorization with the precheck.
