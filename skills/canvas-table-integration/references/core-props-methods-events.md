# core props, methods, and events

Use this file for the first-version consumer-facing API surface.

Keep to documented public APIs. Prefer `PUBLIC_API.md` plus the package feature docs over internal source assumptions.

## 1. Common `IColumn` fields

Use these first:

- `key`: unique field key
- `title`: header title
- `width`: column width
- `minWidth`: minimum width when needed
- `align`: body-cell text alignment
- `headerAlign`: header text alignment
- `fixed`: currently use only `left`
- `showEllipsis`: truncate long content
- `render`: custom body-cell rendering hook
- `headerRender`: custom header rendering hook
- `prefixRender` / `suffixRender`: lightweight header prefix/suffix icon rendering

First-pass guidance:

- Prefer plain text columns first.
- Add `fixed: 'left'` only to key identity columns such as id, name, code, or action anchors.
- Use `showEllipsis` for long business text.
- Use `render` only when built-in text rendering is not enough.

For Make schema-driven tables, read `make-field-display-patterns.md`; complex Make field types such as select, user, department, file, and lookup normally require the Track C renderers instead of plain text columns.

## 2. Common `TableCanvasProps`

Use these props first:

- `columns`
- `canvasWidth`
- `canvasHeight`
- `style`
- `rowKey`
- `virtualOptions`
- `showSN`
- `selectable`
- `rowSortable`
- `bodyRowHeadSuffixOptions`
- `showSummary`
- `summaryRowHeight`
- `summaryData`
- `summaryRenderer`
- `emptyStateOptions`
- `rowStyleOptions`
- `showHeader`
- `showBody`

### Useful notes

#### `rowKey`

Can be:

- a string field name, e.g. `rowKey: 'id'`
- a function, e.g. `(row, index) => ...`

Prefer a stable backend identity field whenever possible. For persisted records, use the system record id returned by the backend, for example `id`, `recordId`, or a platform-specific system id.

Do not use a mutable or business-only display field as the technical row key when row state, drafts, detail routes, or attachment uploads depend on the key.

#### `showSN`

Useful for sequence numbers.

- `enabled: true`
- optional `formatter(row, index)` for custom numbering

Enable sequence numbers by default for every table unless the user explicitly says the table does not need row sequence numbers.

#### `selectable`

Use for row selection:

- `enabled: true`
- `type: 'single' | 'multiple'`

For a writable Make record list, enable multiple selection by default through
`make-app-actions`. Opt out only when the user explicitly rejects record actions
or the object/product is strictly read-only. A current user with no write actions
does not make the list strictly read-only; retain selection so scheme two can show
`暂无可用的操作`. For non-Make tables, selection remains opt-in.

For ordinary Make `CanvasTableComponent` lists, cap one Shift range-selection
gesture at 200 records through the installed public selection contract. If the
installed contract exposes no such capability, report a blocker and do not
emulate Shift anchors or ranges in host code. Under CanvasTable 1.3.0,
`GroupTableComponent` does not support Shift range selection at all.

#### `rowSortable`

Use for row drag sorting:

- `enabled: true`
- optional `rowDisabled(row, index)`

#### `bodyRowHeadSuffixOptions`

Use for compact row-head actions that visually belong beside the sequence number, selector, or drag handle.

- `enabled: true`
- `width`: the reserved suffix width
- `render({ group, cell, x, y, height, rowData, index })`: add shapes to the provided row-head group

For every table, add an open-detail icon after the sequence number by default unless the user explicitly says the table does not need a detail entry. The normal row-head state shows the sequence number; row hover or keyboard focus reveals the icon; clicking the icon opens the row detail Drawer or the host project's established detail surface. Read `row-head-action-patterns.md`.

#### `emptyStateOptions`

Useful fields:

- `text`
- `imageUrl`
- `render`

#### `rowStyleOptions`

Use for lightweight row highlighting based on business state.

## 3. Common instance methods

Use these methods first:

- `setData(data, page?, request?)`
- `setVirtualPageData(data, page, totalRowCount, request?)`
- `markPageLoadFailed(page, request?)`
- `updateProps(newProps)`
- `updateCanvasSize(width, height, refresh?)`
- `refreshCanvas()`
- `scrollTo(x, y)`
- `scrollToRow(rowIndex)`
- `getScrollState()`
- `getPagesInView()`
- `getTableData()`
- `setRowData(rowKey, data)`
- `setCellData(rowKey, columnKey, data)`
- `setRowColors(rowKeys, color)` when exposed by the installed public contract
- `getSelectionInfo()`
- `clearSelection()`
- `updateSummaryData(newSummaryData)`
- `setSummaryLoading(loading, columnKey?)`
- `refreshEmptyState()`
- `clearData(params?)`
- `destroy()`

### Behavioral notes

#### `setData`

- local mode: `setData(rows)`
- virtual mode, identity-aware installed contract: `setData(rows, page, request)` after claiming the request synchronously and with the same request that came from `data:load(page, request)`
- virtual mode, legacy page-only installed contract: `setData(rows, page)` only when the installed public docs do not expose a request context
- `setData([])` is valid. Empty rows still keep the table header visible and show the configured `emptyStateOptions` / 暂无数据 empty state; do not hide or skip the CanvasTable host just because rows are empty.

Do not omit `page` in virtual mode. When the response also carries a latest authoritative total and the installed package documents `setVirtualPageData`, commit total and rows atomically with `setVirtualPageData(rows, page, totalRowCount, request)`. On failure or cancellation, release the pending page with `markPageLoadFailed(page, request)` on the identity-aware path or the documented legacy form.

Keep row synchronization independent from instance creation timing. In React/Vue wrappers, API rows may arrive before `ResizeObserver` has produced a real size and before `CanvasTableComponent` exists. Store the latest rows in a ref or equivalent stable holder, update that holder whenever rows change, call `table.setData(latestRows)` whenever the instance already exists, and call `table.setData(latestRows)` again immediately after creating the instance. Do not drop a data update simply because `tableRef.current` was `null` during the first rows effect.

Do not use `records.length`, `rows.length`, or a summary total as the gate for table creation. The gate is container size plus schema/columns readiness. Rows can be empty and still produce a valid table with headers and empty state.

#### `scrollTo(...)` and `getScrollState()`

Use `getScrollState()` to snapshot the current public scroll position before a same-object refresh that must call `setData(...)`. Restore the viewport with `scrollTo(x, y)` after the refreshed data has applied.

Do not call `scrollTo(0, 0)` after a same-object cell edit, row refresh, or Service/API refresh. Reset to the top-left only when the object/entity/schema identity changes or when the user explicitly navigates to another table context.

#### `setRowData(...)` and `setCellData(...)`

Use targeted row/cell updates after accepted single-row or single-cell saves. Prefer these methods over remounting the table or replacing all data when the object/entity/schema identity has not changed.

#### `getTableData()`

Treat this as current in-memory table data.

In virtual mode, do **not** treat it as the guaranteed full remote dataset.

#### `updateProps(...)`

Use for:

- resized width/height
- changed columns
- changed summary config
- changed table behavior flags

When the host layout is responsive, first measure the host container, then create the table with the measured `canvasWidth` and `canvasHeight`. On subsequent size changes, call both:

```ts
table.updateProps({ canvasWidth: width, canvasHeight: height, columns })
table.updateCanvasSize(width, height, true)
```

Do not let the first table instance initialize with a placeholder size such as `960x480` when a real host size is already available.

#### `destroy()`

Always call on unmount / cleanup.

## 4. Stable first-version event surface

Prefer these events in first-pass integrations:

### Data and lifecycle

- `data:load`
- `first-screen-rendered`

### Scroll and selection

- `scroll:change`
- `selection:change`

### Business interaction

- `row:click`
- `cell:click`
- `cell:dbclick`
- `cell:contextmenu`
- `shape:click`

### Example wiring

```ts
const off = globalEventBus.onWithNamespace('selection:change', table.tableId, (snapshot) => {
  console.log(snapshot)
})
```

Prefer `table.tableId` as the namespace key.

## 5. Capability-to-API mapping

### Row selection

- prop: `selectable`
- method: `getSelectionInfo`, `clearSelection`
- event: `selection:change`

### Row drag

- prop: `rowSortable`
- method: `getTableData`
- note: there is no dedicated documented drag-finished event in the first-version path

### Fixed columns

- column field: `fixed: 'left'`
- methods: `scrollTo`, `getScrollState`

### Summary row

- props: `showSummary`, `summaryData`, `summaryRenderer`, `summaryRowHeight`
- methods: `updateSummaryData`, `setSummaryLoading`

### Empty state

- prop: `emptyStateOptions`
- methods: `setData([])`, `refreshEmptyState`, `clearData`

### Clickable business content

- column field: `render`
- shape: `TextShape`
- events: shape click or shape-level event handlers

For render patterns, read `shape-render-patterns.md`.
