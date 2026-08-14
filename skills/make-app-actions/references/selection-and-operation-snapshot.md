# Selection and operation snapshot

## Canvas selection source

Enable CanvasTable multiple selection and subscribe through the installed public
API. Feed each public selection snapshot to
`resolveCanvasSelectedRecordSnapshot(selectionInfo, loadedRecords, totalCount)`.

Preserve returned loaded `records` for local row feedback and preserve
`selectionIntent` as the write target source:

- `include.recordIDs`: complete IDs selected manually, by individual clicks, or
  by Shift range selection
- `exclude.excludedRecordIDs`: IDs deselected after the user explicitly clicked
  the table-header select-all checkbox

Manual or Shift selection remains `include` even when every row is selected and
the header checkbox becomes visually checked. Only the header select-all action
creates `exclude`. Do not use `selectedCount === totalCount` to infer select-all.

For the CanvasTable 1.3.0 public contract, `GroupTableComponent` does not support
Shift range selection; Shift is supported only by `CanvasTableComponent`. Re-read
the installed package docs for newer versions. Unless the installed grouped-table
contract explicitly adds Shift, do not emulate it in the host. Grouped records may
still use individual selection and the supported header select-all behavior.

Virtual loading may mean `records` contains only loaded rows while
`include.recordIDs` contains the complete explicit target. Do not reject a valid
server-resolvable target only because not every selected record is loaded.

For grouped tables, first read the installed CanvasTable event contract. When
`GroupTableComponent` already forwards child selection through the parent
`selection:change`, subscribe to that canonical event once; do not simultaneously
subscribe to a second group selection event and report each click twice.

## Limits

- Explicit `include` batch edit allows 1-200 `recordIDs`; 200 is valid.
- More than 200 explicit IDs blocks opening the batch modal and shows
  `单次批量编辑数据上限为200条`.
- Keep selection after that toast so the user can manually deselect rows.
- Select-all does not impose a 200-record target-total limit.
- `excludedRecordIDList` still allows at most 200 IDs. Over 200 exclusions block
  the action and retain selection.

Use package `validateRecordBatchEditSelectionLimit` for explicit batch-edit
limits and a host target validator for the backend exclusion-list limit.

## Write target

Translate the selection intent into a strict discriminated union:

```ts
type RecordSelectionWriteTarget =
  | {
      selectAllMode: false;
      recordIDList: string[];
    }
  | {
      selectAllMode: true;
      excludedRecordIDList: string[];
      filter?: { expression: string };
      groupFilter?: { expression: string };
    };
```

Explicit mode sends no `filter` or `groupFilter`. Select-all mode sends the
latest successfully applied query's exact `filter` and `groupFilter` objects,
when present. Keep both fields separate and copy them immutably.

The select-all `filter` must be the canonical `effectiveFilter` used by the last
successful records query. It must already include every condition that changes
list membership, including advanced filter, keyword/search, status, and quick
filter conditions. The records query, permission precheck, and final mutation use
that same `effectiveFilter`; do not send a UI-only keyword beside one request and
omit it from another.

If a host cannot represent all applied membership conditions in the backend's
supported `filter`/`groupFilter` contract, block select-all actions and report the
contract gap. Never drop search or quick-filter conditions, because doing so
expands the write target beyond the visible result set. Sort and group layout do
not affect membership, while an active group path must remain represented by
`groupFilter`.

## Immutable operation snapshot

Freeze an immutable operation snapshot synchronously before starting precheck:

```ts
type RecordActionOperationSnapshot = Readonly<{
  objectKey: string;
  entityKey: string;
  permission:
    | "data.record.update"
    | "data.record.delete"
    | "data.record.bulkUpdate";
  selectedCount: number;
  target: Readonly<RecordSelectionWriteTarget>;
  selectionGeneration: number;
  queryGeneration: number;
}>;
```

The target includes copied IDs/exclusions plus copied canonical `effectiveFilter`
as `filter` and copied `groupFilter`. The precheck, opened edit surface,
selected-count text, final mutation, and success text all reuse the same snapshot.
Do not capture target fields after precheck starts or reconstruct them from
current React state on submit. Do not invent a `snapshotToken` or other opaque
server handle as a replacement for this target unless the installed host Service
contract already specifies issuance, binding, expiry, and mutation verification.

Use separate monotonic generations for entity/query context and selection
context. An old result is stale when either generation changes. A stale result
must not open UI, show errors, highlight rows, submit, or clear current state.

## Query identity and clearing

Clear the complete selection, alerts, pending precheck, and batch modal whenever
the applied keyword/search, filter, sort, group, group path, object/entity, or
permission-enabled context changes. Changing filter, then sort, then group, or
switching object must each clear selection before the new query can be acted on.

Base the identity on normalized applied values, not draft panel state. Capture
`filter/groupFilter` from the most recent successful list/group query so a failed
query does not silently redefine a select-all target.

The query identity may retain keyword/status/quick-filter values for invalidation,
but target construction uses the exact successful query's canonical
`effectiveFilter`. Add a contract test proving header select-all under active
search sends the same search expression to list, precheck, and mutation.

Selection changes while precheck is pending invalidate the old precheck and
allow a new action immediately. Do not serialize new selections behind an
obsolete request.

## Table instance and total-count lifecycle

Treat a CanvasTable instance replacement or recreation as a selection boundary,
even when the object and normalized applied query identity are unchanged. Before
disposing the old instance, increment `selectionGeneration`, invalidate pending
precheck/submit work, close action-owned edit surfaces, clear alerts, and publish
exactly one empty selection snapshot to the action state. Do not replay the old
action-owned selection into the replacement table: the old public snapshot was
produced by a different Canvas instance and may no longer describe the rendered
rows. Subscribe the replacement instance before accepting new user selection.

Handle `totalCount` changes within the same object/query generation explicitly:

- When `totalCount` increases, read the current public selection snapshot from the
  active CanvasTable and pass it with the new total to
  `resolveCanvasSelectedRecordSnapshot`. Replace action state with that normalized
  result. If its intent or selected count changes, increment `selectionGeneration`
  and invalidate pending action work before the new state becomes actionable.
- When `totalCount` decreases, do not retain or reconstruct the old target. Call
  the active instance's public `clearSelection()` once and use its canonical
  `selection:change` as the sole empty selection snapshot/notification. If the
  installed public contract explicitly says `clearSelection()` emits no event,
  publish one host empty snapshot after the call; never emit both paths.

Coalesce one logical recreation or total transition so it cannot clear the table,
the package selection model, and host action state through separate duplicate
notifications. Add a monotonic table-instance token when asynchronous setup can
settle out of order; events from a disposed instance are stale and must be ignored.
