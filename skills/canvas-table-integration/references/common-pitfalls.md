# common pitfalls

Read this file before finalizing a canvas-table integration.

## 1. Instantiating during SSR

Symptom:

- `window` / `document` / canvas errors

Fix:

- instantiate only in a client lifecycle hook
- keep the package client-only

## 2. Container has no real size

Symptom:

- blank table
- wrong first render
- broken scroll area
- canvas stays at fallback size such as `960x480` while the host is larger

Fix:

- make sure the container has explicit width and height
- if the host layout is responsive, synchronize size after mount
- measure the host before creating `CanvasTableComponent`; do not create with fallback dimensions and rely on a later resize to repair the first render
- keep size state nullable or otherwise gate table creation until a real host size is known

## 3. Forgetting `destroy()`

Symptom:

- leaked listeners
- repeated callbacks
- stale table instances

Fix:

- always destroy on unmount / cleanup

## 4. Wrong event namespace

Symptom:

- no event callbacks
- callbacks wired to the wrong instance

Fix:

- use `globalEventBus.onWithNamespace(event, table.tableId, handler)`

## 5. Using virtual mode but forgetting the page argument

Symptom:

- paging errors
- missing data updates

Fix:

- in virtual mode, always include the page argument. On the identity-aware installed contract, claim the request synchronously and call `setData(rows, page, request)` with the same request; on a legacy page-only installed contract, use `setData(rows, page)` and document that request identity is unavailable.

## 6. Switching to advanced features too early

Symptom:

- integration becomes hard to maintain
- too much custom rendering for a first pass

Fix:

- start with local or virtual base path
- add only the few business interactions actually needed now

## 7. Passing raw meta into runtime props

Symptom:

- table does not understand the schema shape
- renderer/editor wiring becomes inconsistent

Fix:

- convert meta into `IColumn[]` before creating the table

## 8. Initializing Make schema tables before schema is ready

Symptom:

- columns come from `Object.keys(row)` or sample data
- select, user, department, file, lookup, or URL fields render as plain text
- the table first appears with generic columns and later changes shape after schema arrives

Fix:

- wait for runtime schema fields before building `IColumn[]`
- build columns from field type and keep `fieldSchema`, `fieldType`, and `renderKind` metadata or equivalents
- show loading or error UI around the canvas host while schema is unavailable
- do not infer Make schema columns from row object keys

## 9. Treating internal source as public API

Symptom:

- fragile downstream integration
- breakage after library changes

Fix:

- import only from the package root
- rely on `PUBLIC_API.md` and documented consumer guides

## 10. Overusing shape rendering

Symptom:

- complex code for simple cells
- difficult maintenance

Fix:

- start with plain text columns
- add `render + TextShape` only for high-value business interactions

For Make schema-driven tables, this pitfall does not mean complex Make field types should be flattened into text. Use the Track C display adapter and focused renderers for select, user, department, file, lookup, and URL fields; keep plain text only for field groups where text is the intended display.

## 11. Hiding the focusable visual canvas host

Symptom:

- browser logs `Blocked aria-hidden` or similar focus accessibility warnings
- the package-created canvas has `tabIndex=0` but an ancestor is `aria-hidden`
- table focus or keyboard interaction becomes inconsistent

Fix:

- do not put `aria-hidden` on the visual canvas-table host or a focusable canvas ancestor
- do not use `inert` on the visual host unless the table is intentionally disabled
- keep any screen-reader fallback table as a separate visually-hidden structure
- give the visual host a non-hidden accessible label, for example `role="group"` plus `aria-label`

## 12. Replacing the canvas host during loading

Symptom:

- wrapper has correct `100%` width and height, but the host contains no `<canvas>`
- the table appears after initial load, then disappears or keeps an old size after records refresh
- React StrictMode, route switches, or loading state toggles expose stale/destroyed table instances

Fix:

- keep the canvas host mounted whenever schema columns exist
- render loading as an overlay sibling above the host instead of returning a different loading node
- use one lifecycle path to create/update/destroy the table: when ready, create if missing, then call `updateProps`, `updateCanvasSize(width, height, true)`, and `setData(rows)`
- use a separate unmount cleanup to call `destroy()` once; avoid splitting create and update effects so that cleanup from one effect can remove the instance expected by another
- verify in the browser by comparing wrapper, host, and canvas rectangles; host and canvas CSS size should match, while canvas `width`/`height` attributes may be larger due to DPR scaling

## 13. Dropping rows that arrive before the table instance

Symptom:

- summary cards or other React/Vue state show records, but the CanvasTable body still shows the empty state
- the first API response has rows, yet the table only appears after a manual refresh, route switch, or second data update
- empty datasets accidentally hide the whole table instead of showing headers plus the built-in empty state

Cause:

- records or rows arrive before the CanvasTable instance is created later by `ResizeObserver`, real-size measurement, or schema/column readiness
- the rows effect checks `tableRef.current` and returns while it is `null`
- the later instance-creation path does not reapply the latest rows with `setData(latestRows)`
- initialization is incorrectly gated by `records.length` / `rows.length`, so empty rows never create a valid table shell

Fix:

- keep `latestRowsRef.current = rows` or an equivalent latest rows holder in the host wrapper
- when rows change, update the latest holder and call `tableRef.current?.setData(rows)` if the table already exists
- when the CanvasTable instance is created or recreated, immediately call `setData(latestRowsRef.current)`, even when it is `[]`
- gate creation on real container size plus schema/columns readiness, not on row count, API totals, or summary card values
- empty rows must render the table header and `emptyStateOptions` / 暂无数据 state; they are not a reason to skip the CanvasTable host
- if a non-empty latest rows array still renders empty, verify whether filters, pagination, permissions, or a deliberate business transform reduced the table rows before `setData`

## 14. Carrying scroll position across object switches

Symptom:

- user scrolls object A's table to the far right or down
- user clicks object B in the left navigation
- object B renders with the table already scrolled to object A's previous horizontal or vertical position

Cause:

- React reuses the same route component for `/objects/:objectKey`
- the integration updates columns/data but keeps the same canvas-table instance or same scrollable host state
- table identity is not tied to the object/entity/schema key

Fix:

- treat object/entity/schema key as table identity, not just data
- when that identity changes, either remount/recreate the canvas-table instance with a React `key`, or reset the existing instance through documented public APIs when available
- reset both horizontal and vertical scroll to the top-left before or immediately after applying the new columns/data
- clear transient state that belongs to the old object: selection, active edit, hover row, header menu, open column menu, pending row patches, and object-scoped event handlers
- keep data refreshes within the same object separate from object switches; normal refresh may preserve scroll, object switch should not
- add a smoke check: scroll object A horizontally, switch to object B, verify the table starts at the left edge

## 15. Recreating the table from parent state churn

Symptom:

- opening a Detail Drawer visibly refreshes the table behind it
- clicking Drawer header buttons, row action popovers, or other non-mutating UI controls calls table list APIs again
- grouped tables repeat `setGroup(rootGroups, undefined, 0)` or trigger `group:data:load` without a real group/data change

Cause:

- parent state such as Detail Drawer stack, fullscreen, popover, or header menu state creates new table config objects on every render
- a React/Vue effect depends on the whole config object or callback identity instead of semantic table inputs
- row-detail or loader callbacks are placed in the table creation dependency list even though the table instance should not change

Fix:

- keep table identity tied to entity/schema/group/page size/container size and real data generation, not unrelated UI state
- parent state or unrelated UI state such as Detail Drawer, popover, and header menu changes must not recreate, destroy, call `setData`, call `setGroup`, reload, or refresh the CanvasTable instance
- keep callback refs for latest row actions, detail open handlers, and data loaders; callback identity changes must not recreate the table instance or `GroupTableComponent`
- for grouped tables, guard root group synchronization with `rootGroups` plus `dataVersion` or another semantic token before calling `setGroup(rootGroups, undefined, 0)`
- add a regression test that opens/closes detail UI and clicks non-mutating Drawer actions, then verifies no list, `record-groups`, or leaf-page request was issued

## 16. Hiding or incorrectly clearing semantic row colors

Symptom:

- a denied/error row is red until the user selects or hovers it, then the built-in selection background hides the business feedback
- clearing a temporary row alert leaves the package default error color behind
- clearing a temporary alert also removes a dirty-row or other durable business color

Cause:

- the installed CanvasTable contract does not guarantee business row-color precedence over selected and hover backgrounds
- the host treats `setRowColors(rowKeys, undefined)` as a clear operation even though it means the package default error color
- multiple host features independently overwrite the same command-style row-color slot

Fix:

- verify from the installed public contract that business row colors have higher priority than selected and hover backgrounds
- require the installed public `clearRowColors(rowKeys)` API and use it to remove command-style colors; never use `setRowColors(rowKeys, undefined)` to clear
- keep durable, derived state such as dirty-row color in `rowStyleOptions`; use `setRowColors` for temporary imperative feedback so `clearRowColors` can restore the underlying row style
- if two temporary features must own one row, coordinate them in one host row-color controller instead of allowing independent last-writer cleanup
- if the resolved package is older than CanvasTable 1.3.1 or its installed public docs lack `clearRowColors` / the precedence guarantee, upgrade to `@qfei-design/canvas-table@^1.3.1` instead of adding CSS overrides, private imports, or host canvas painting
- test selected and hover states while the business color is active, then call `clearRowColors` and verify restoration to `rowStyleOptions`, selected, hover, or default background as applicable
