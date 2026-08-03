# CanvasTable Flow

Use this reference when rendering applied grouping with
`@qfei-design/canvas-table`.

Read the installed CanvasTable package docs through `canvas-table-integration`
before implementation. Verify the public API includes `GroupTableComponent`,
`globalEventBus`, `group:load`, `group:data:load`, `setGroup`, `setData`, and
`markGroupPageLoadFailed`.

## Choose table mode

When applied group is empty, render ordinary records with `CanvasTableComponent`.

When applied group has one to three entries, render grouped data with
`GroupTableComponent`. Recreate or fully reset the table when entity key, schema,
applied group, root group total, page sizes, or data generation changes.

Do not carry ordinary table scroll, selection, active edit state, header menus,
virtual pages, or row caches into grouped mode.

## Initial grouped render

Before creating a grouped table, request root groups page 1 through the host data
lifecycle.

For grouped mode only, ensure there is at least one left-fixed visible data
column before passing columns to `GroupTableComponent`. If no visible data column
is already left fixed, default the first visible data column to `fixed: "left"`:

```ts
const hasLeftFixedDataColumn = columns.some((column) => column.fixed === "left");
const groupedColumns = hasLeftFixedDataColumn
  ? columns
  : columns.map((column, index) =>
      index === 0 ? { ...column, fixed: "left" } : column,
    );
```

If the grouped table already has a left-fixed data column, do not add a second
default fixed column and do not modify or duplicate the existing fixed strategy.
Existing right-fixed columns alone do not satisfy this grouped-mode left-fixed
requirement.

Do not apply this default to ordinary non-grouped `CanvasTableComponent` mode.

Then create:

```ts
new GroupTableComponent(container, {
  columns: groupedColumns,
  groups: appliedGroup.map((item) => item.fieldKey),
  rowKey,
  groupVirtualOptions: {
    enabled: true,
    totalRowCount: rootGroupTotal,
    pageSize: groupPageSize,
  },
  virtualOptions: {
    enabled: true,
    totalRowCount: 0,
    pageSize: leafPageSize,
  },
});
```

After construction, call:

```ts
table.setGroup(rootGroups, undefined, 0);
```

Only call `setGroup(rootGroups, undefined, 0)` during initial construction or
when `rootGroups` or an explicit `dataVersion` has actually changed. Guard the
sync with the last applied `rootGroups`/`dataVersion` pair or an equivalent
semantic token so the same grouped data does not re-enter CanvasTable.

Keep the host `grouping` or group config stable with `useMemo` or the host
framework equivalent. Data-sync effects must not depend on the entire grouping
object when that object is recreated by parent renders. Depend on semantic
inputs instead, such as applied group keys, root group rows, root total, page
sizes, table dimensions, and `dataVersion`.

Unrelated UI state, including opening/closing a Detail Drawer, Drawer fullscreen,
header buttons, row action popovers, or other non-mutating detail controls, must
not request `record-groups`, reload leaf records, trigger `group:data:load`,
repeat `setGroup(rootGroups, undefined, 0)`, or recreate
`GroupTableComponent`. Keep row-detail callbacks and loaders in refs when the
latest function body is needed but the table instance should remain stable.

CanvasTable page indexes are zero-based. Service/Data API page indexes are
one-based. Translate inside the loader callback only.

## Child group loading

Subscribe with the table instance namespace:

```ts
globalEventBus.onWithNamespace("group:load", table.tableId, async (groupValue, page) => {
  const children = await fetchGroupPage(groupValue, page);
  table.setGroup(children, groupValue.length ? groupValue : undefined, page);
});
```

The host loader:

- deduplicates currently loading `{ groupValue, page }`
- builds `groupFilter` from selected ancestors
- passes only remaining group levels
- translates `page + 1` to Service
- ignores stale results after entity/group changes

There is no dedicated group-page retry API. Handle group-page failures with safe
logs and a host refresh/retry path.

## Leaf records loading

Subscribe:

```ts
globalEventBus.onWithNamespace("group:data:load", table.tableId, async (groupValue, page) => {
  try {
    const result = await fetchLeafPage(groupValue, page);
    table.setData(result.rows, groupValue, page, {
      totalRowCount: result.totalRowCount,
    });
  } catch (error) {
    table.markGroupPageLoadFailed(groupValue, page);
    throw error;
  }
});
```

The host loader:

- builds full-path `groupFilter`
- requests ordinary records mode
- omits Data API `group`
- includes fields and applied sort when appropriate
- translates `page + 1` to Service
- returns `{ rows, totalRowCount }`

Always call `markGroupPageLoadFailed(groupValue, page)` when a leaf-page request
fails or is cancelled. Without it, the virtual page can remain pending and will not
retry.

## Group data shape

Pass group rows through as `IGroupData` compatible objects:

- `value`: stable path value
- `label`: display text
- `title`: legacy fallback only
- `count`: all records under this group
- `subGroupCount`: next-level group count
- `fieldType`: optional field type

Prefer `value + label`; do not use `label` as the stable group path.

## Editing and selection

Selection can remain enabled if the product has batch actions for leaf records.
Clear selection on entity/group changes.

Grouped V1 should disable cell editing. If grouped editing is explicitly required,
define and test how an edit that changes a grouped field affects:

- current group counts
- record movement between groups
- leaf virtual caches
- stale row patches
- active selection

Do not silently reuse ordinary cell-edit behavior in grouped mode.

## Cleanup

On unmount or context replacement:

- unsubscribe every `globalEventBus` listener
- clear loading-page dedupe sets
- abort or invalidate in-flight group/leaf requests
- destroy the table instance
- clear table refs and header menu state

Use `table.tableId` as the event namespace. Do not reuse a namespace across table
instances.
