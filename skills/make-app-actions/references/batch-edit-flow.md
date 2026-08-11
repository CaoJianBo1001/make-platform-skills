# Action and batch-edit flow

## Bottom action bar

Use package `AntdRecordSelectionActionBar` for Ant Design hosts. A non-AntD host
may use the generic package action bar with its own primitives, but must not mix
in AntD. Keep the standard bar centered near the bottom of the table viewport,
above table summary/scroll affordances, without changing table geometry when
actions appear.

- One selected record: edit and/or delete based on independent permissions.
- Two or more selected records: batch edit based on
  `data.record.bulkUpdate`.
- No available action: scheme-two selected-count and locked message.
- Close: call CanvasTable `clearSelection`, clear row alerts, invalidate precheck,
  and close the batch modal.

Do not add edit/delete buttons to the detail Drawer. Keep the row-head detail
icon as the read-only navigation entry.

## Single edit

1. Validate selection intent and local row permission.
2. Read cached `data.record.update`.
3. Freeze the one-record operation snapshot.
4. Run one Service row-write precheck with `data.record.update`.
5. Open the edit Drawer only for an allowed, still-current result.
6. Let the normal single-record update endpoint perform final authorization.

Do not refetch principal or reopen the record based on a newer selection after
precheck starts.

## Single delete

Validate cached `data.record.delete` and local row permission, then show the
delete confirmation. Use the host's authoritative delete Service route. A host
may use the same precheck endpoint with `data.record.delete`, but must still call
the final delete endpoint and must not add per-record diagnostics.

## Opening batch edit

Apply this order:

1. Require a resolved `selectionIntent` and at least two selected records.
2. Run `validateRecordBatchEditSelectionLimit`; block explicit selections over
   200 without clearing selection.
3. Validate exclusion-list length for select-all.
4. Run package `validateRecordSelectionAction` for loaded row feedback.
5. Check cached `data.record.bulkUpdate` independently from single edit.
6. Freeze the immutable operation snapshot.
7. Run one Service precheck with `data.record.bulkUpdate`.
8. Recheck generations; ignore stale/busy outcomes.
9. Resolve fields and open the modal only when at least one field is editable.

## Fields and controls

Build batch candidates from runtime normalized schema:

1. Keep fields allowed by `meta.field.read` and `meta.field.update`.
2. Pass those fields to `resolveBatchEditableFields`.
3. Exclude readonly/derived Lookup fields or any field the installed package
   reports unsupported.
4. In an Ant Design host, pass the result to `AntdRecordBatchEditModal`. In other
   React design systems, pass it to `RecordBatchEditModal` and inject
   `MakeAppBatchEditComponents` for the host `Modal`, `FieldSelect`, and
   `ModeControl`.

- `AntdRecordBatchEditModal` in `0.3.1` uses
  `renderValueControl(field, control)`. Forward `control.disabled` to the actual
  field control; one-argument callbacks are compatibility-only.
- `RecordBatchEditModal` uses `renderValueControl(field, control)`. Forward
  `control.value`, `control.onChange`, `control.disabled`, `control.invalid`, and
  `control.ariaDescribedBy` to the real host input; do not replace package-owned
  value or validation state with parallel host state.

Use those callbacks to provide real host field controls:

- Select for select/enum fields
- Input/InputNumber/TextArea for compatible scalar fields
- DatePicker or date-range control for date metadata
- User identity picker for User fields
- Department identity picker for Department fields
- documented relation/lookup control only when mutation support is complete

Do not silently render an unsupported complex field as Input. Candidate IDs, not
display labels, are submitted for user/department fields.

The shared modal owns field selection, selected-count text, `新值 / 清空内容`,
validation layout, and buttons. Use `resolveBatchEditClearValue` for clear mode.
The modal must not include an automation or `是否触发自动化流程` option.

The default title is `批量编辑`. Do not label the same operation `批量修改` in
the modal title. Hosts may override other business copy through the package label
contract, but keep this canonical title unless the product explicitly requires a
different term.

### Popup container contract

The generic modal cannot choose a popup root for host controls. Configure
`FieldSelect` and every popup value control (`Select`, `DatePicker`,
`DateRangePicker`, User, Department, and editable Lookup pickers) through the
installed design system's public portal or overlay API so the popup is outside
every `overflow: hidden` or `overflow: auto` clipping ancestor.

Do not make AntD's `getPopupContainer` name or semantics a generic contract.
AntD hosts may pass the adapter's public `getPopupContainer` for its field
selector and separately configure host-rendered value controls. Arco hosts use
the installed Arco popup-container API. shadcn/ui or Radix hosts use the
installed primitive's `Portal`/`container` mechanism. Read the installed library
contract instead of copying one adapter's props into another design system.

Prefer a library-supported target associated with the owning dialog; use a
document-level overlay root only when the library supports it without breaking
focus containment or dismiss layers. Keep the popup above the owning surface and
mask. A larger z-index under a clipping ancestor cannot fix overflow clipping.
The field selector and value controls must behave consistently, but they do not
have to share one physical root when the design system manages separate layers.

After portaling, verify keyboard navigation, focus return, Escape ordering,
outside-click handling, and dialog scrolling in addition to visual containment.
Opening or closing a popup must not unexpectedly close the batch dialog.

The generic modal does not auto-detect a UI framework. Keep the host adapter
thin: translate component props and render host visuals only. Do not move field
selection, value mode, validation, safe error, or duplicate-submit state back
into the host.

## Submit lifecycle

1. Acquire a single-submit lock; duplicate confirm clicks do nothing.
2. Recheck the current cached `data.record.bulkUpdate` and target field
   `meta.field.update` without refetching principal.
3. Re-resolve current field capability and validate the normalized value.
4. Build `data`/`relations` using the host's existing field mutation builders.
5. Reuse the frozen prechecked target exactly and call one Service bulk route.
6. On success, show the updated count, close the modal, reload records, and clear
   selection only if the original selection generation is still current.
7. If the user changed selection during the request, preserve the newer
   selection and only refresh data.
8. On mutation failure, keep the modal/selection available where recovery is
   possible and show the Service error. Release the submit lock in `finally`.

The precheck is not repeated on submit; the final bulk endpoint is the authority.
Never reconstruct the target from current list state after the modal opens.
