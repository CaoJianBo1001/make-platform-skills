# edit common pitfalls

Read this file before finalizing a canvas-table cell-edit integration.

## 1. Putting everything inside `customEdit`

Symptom:

- one large callback handles field detection, saving, rollback, outside-click, API calls, and UI logic

Fix:

- split responsibilities into edit controller, editor container, field editors, and save layer

## 2. Adding another UI library into the editor path

Symptom:

- the editor path ignores shadcn/ui, project-local adapters, or existing business controls and adds another UI library for a missing widget

Fix:

- first inspect the current project and use shadcn/ui primitives, project-local adapters, or existing business controls that satisfy the editor contract

## 3. Mixing display value and submit value

Symptom:

- select/person/department/attachment editors save the wrong shape

Fix:

- explicitly separate display-friendly values from API submission values

## 4. Treating all field editors as the same interaction model

Symptom:

- text, date, select, attachment, and people pickers all use the same close/save policy

Fix:

- distinguish submit-style editors from realtime-style editors

## 5. Ignoring scroll-follow behavior

Symptom:

- the editor opens correctly, then drifts away from the cell while scrolling

Fix:

- update editor position during scroll and respect fixed-column behavior

## 6. Editing a partially hidden cell without scrolling it into view

Symptom:

- clicking a cell near the left/right/top/bottom viewport edge enters edit mode while part of the active cell is clipped
- the editor opens partly outside the visible table body
- dropdowns or date pickers appear detached because the editor anchor was calculated from stale pre-scroll coordinates

Fix:

- before mounting the editor, detect whether the target cell is fully visible in the body viewport
- use public table scroll APIs such as `scrollTo(...)` to reveal the cell first
- account for fixed-left columns and row-head width so normal cells are not hidden behind the fixed region
- after scrolling, recalculate cell geometry or wait for the next frame before focusing/opening the editor
- do not scroll when the target cell is already fully visible

## 7. Blindly closing on outside click

Symptom:

- complex editors lose changes or close in the middle of host-controlled interaction

Fix:

- outside-click should usually flow through value extraction, validation, save/rollback, and reset
- popup roots should be declared with `relatedElements()` before adding host-owned global listeners

## 8. No stable editor interface

Symptom:

- each field editor exposes different methods or none at all

Fix:

- normalize around a shared interface such as `focus()` and `updateVal()`

## 9. Letting canvas-table write before the business layer accepts the value

Symptom:

- draft save or immediate API save fails, but the canvas cell already shows the new value
- rollback has to fight table-internal row data

Fix:

- use `editApplyMode: "controlled"` when a save/draft layer owns writes
- call `setCellData(...)` or `setRowData(...)` only after commit acceptance

## 10. Recreating the table on every draft update

Symptom:

- editor closes unexpectedly
- focus returns to `body`
- dirty row colors or selection state disappear

Fix:

- keep table initialization dependencies stable
- use refs for latest rows/callbacks where needed
- update table data with `setData(...)`
- reapply dirty row colors when recreation is unavoidable

## 11. Using `autoClose: false` for every popup editor by default

Symptom:

- every editor needs its own keyboard/outside-click listener
- Esc/Tab behavior drifts across field types

Fix:

- prefer object `autoClose`
- use `relatedElements()` for popup roots
- use `enter: "ignore"` only for editors whose popup owns Enter

## 12. Attachment support stops at render

Symptom:

- the table shows file/image thumbnails, but there is no real attachment editor contract

Fix:

- explicitly design the host attachment editor workflow and value structure

## 13. Upload logic bypasses the data-source layer

Symptom:

- attachment editor code or table-wrapper code calls the backend upload API directly
- create flow tries to upload files before the backend has returned a saved record id

Fix:

- keep real upload calls in the host data-source / adapter layer
- require a stable backend record id before enabling persisted attachment upload
- let the editor produce normalized attachment metadata or pending files, then let the save/data layer decide how to persist them

## 14. Dirty checks depend on generated attachment ids

Symptom:

- an attachment row stays dirty after save/discard even though visible file data matches
- local generated `uid` values differ between normalization passes

Fix:

- normalize attachment arrays before comparing
- ignore generated `uid` fields during dirty comparison
- compare stable file fields such as `name`, `url`, `filePath`, `size`, and `type`

## 15. Copying a Vue sample directly into React

Symptom:

- Vue-style exposed methods and composable assumptions are copied without React equivalents

Fix:

- convert the pattern into hooks, refs, and imperative handles while preserving the same contract

## 16. Restoring focus to a stale canvas after immediate save

Symptom:

- Tab commit saves correctly, but focus ends on `body`
- the next keyboard action no longer reaches the table

Fix:

- after accepted cell-edit commit or rollback, focus the current canvas instance, not only the instance captured when editing opened
- in React, resolve `tableRef.current?.canvas` in each delayed focus attempt
- keep this focus restoration scoped to canvas-table cell editing; skip it if a host modal, drawer, dialog, popover, or form surface is open or opening
- cancel or guard delayed focus retries when row clicks or actions open host UI

## 17. Initializing the table with a collapsed container height

Symptom:

- the table renders with a tiny canvas height
- row hit testing, editor coordinates, or empty state behavior feel inconsistent

Fix:

- use explicit height when available
- otherwise use measured container height only when it is usable
- fall back to a conservative default height

## 18. Assuming date picker OK has already parsed typed text

Symptom:

- selecting a date works, but typing a full date-time and clicking OK saves the old value

Fix:

- before OK commits, resolve the current typed input into the editor's selected value/ref
- keep display value and submit value normalized to the agreed date-time format

## 19. Letting canvas focus steal host form focus

Symptom:

- opening a create/edit drawer or modal from a table row works, but inputs cannot keep focus
- clicking a form input briefly focuses it, then focus returns to the canvas
- delayed `requestAnimationFrame` or `setTimeout` focus retries run after host UI opens

Fix:

- treat modal, drawer, dialog, popover, and form components as separate host interaction surfaces that own focus while open
- do not call `table.canvas.focus()` or `tableRef.current?.canvas.focus()` after opening those surfaces
- guard delayed canvas-focus retries with an "is host surface open" check
- only restore canvas focus after canvas-table cell-edit commit/cancel/rollback when the next intended target is the table

## 20. Treating all 18 Make field types as editable

Symptom:

- `ID` or `Lookup` cells enter edit mode but the backend rejects the write
- generated values or derived lookup values are sent through the same save path as normal fields

Fix:

- classify `Make.Field.ID` and `Make.Field.Lookup` as read-only by default
- include them in field coverage documentation, but do not wire save calls unless the backend explicitly supports editing them

## 21. Submitting display strings instead of backend values

Symptom:

- currency fields submit `¥1,234.00`
- percent fields submit a string with `%`
- select, user, or department fields submit labels instead of ids
- date ranges submit `"2026-01-01 至 2026-01-31"` instead of a structured range

Fix:

- keep `renderValue`, `displayValue`, and `submitValue` separate
- normalize field values before dirty comparison and API calls
- keep formatting in render/editor display helpers, not in persisted row data

## 22. Ignoring numeric precision metadata

Symptom:

- entering three decimal places looks valid in the editor but the save API rejects the value
- the cell briefly displays a value that the backend cannot persist
- invalid numeric input or an unparsable backend value displays `NaN`

Fix:

- read precision metadata such as `precision` or `decimalPlaces`
- round or validate before commit according to the host backend rule
- require `Number.isFinite` before formatting, committing, or backfilling numeric values
- render invalid display values as the empty placeholder instead of `NaN`
- test the normalized submit value, not only the input display

## 23. Using fake identity options in production

Symptom:

- person or department dropdowns show local demo values that are not returned by real backend APIs
- saving a selected fake id fails backend validation

Fix:

- use real host APIs or existing business selector data sources for identity candidates
- use current cell values only as display/selection fallback, not as a fake global dictionary
- if the real API returns empty data, keep the candidate list empty unless the product explicitly requests demo mode

## 24. Defaulting complex Make fields to plain text inputs

Symptom:

- date cells use free-text inputs instead of date/date-time/range pickers
- person or department cells use text inputs even though the schema says `SingleUser`, `MultiUser`, `SingleDepartment`, or `MultiDepartment`
- select fields ignore schema options and save display labels
- file fields render attachments but have no host upload/delete path
- lookup fields enter edit mode even though the backend treats them as derived values

Fix:

- read the host Make schema and reuse the same field-type mapping as the Drawer form
- use type-appropriate editors for date, select, user, department, and file fields
- keep `Lookup` read-only unless the schema/API explicitly supports association editing
- if candidate APIs are missing, use a selector shell with current-value display and a documented API integration point instead of fake candidates
- document any explicit fallback and do not silently generate a bare `Input`

## 25. Popup editors require an extra click after edit mode starts

Symptom:

- double-clicking a date range, select, user, department, lookup, or attachment cell enters edit mode but only shows an inline input
- the real picker/dropdown/panel appears only after a third click inside the edited cell

Fix:

- make popup editors open on mount through the editor adapter's controlled `open` or equivalent prop
- render the popup into a dedicated popup root and return that root from `relatedElements()`
- focus the editor after the framework root has rendered
- keep `autoClose.enter: "ignore"` for popup editors whose internal keyboard interaction owns Enter

## 26. Editor UI is inset inside the active cell

Symptom:

- non-popup text, textarea, number, URL, select, user, department, date, or date-range editors show a nested border / 二次边框 inside the CanvasTable active editing border
- edited text, textarea, or number cells show an extra input border, radius, margin, or blank inset
- select, user, department, date, or date-range triggers show a second blue border inside the canvas-table active-cell outline
- the component does not fill the active cell height or width
- the active cell contains visible helper/hint/help text, range tips such as `0-5`, or form validation copy below or beside the editor

Fix:

- treat the CanvasTable active edit border as the only in-cell editing border for normal editors
- set the editor container and actual editor component to `width: 100%` and `height: 100%`
- use borderless or visually merged editor variants
- remove component-level focus border and focus `box-shadow` from the in-cell trigger; keep the popup/dropdown panel styling separate
- do not wrap cell editors in form-item wrappers, cards, or bordered panels
- keep only small inner text padding when needed; do not create an extra outer box
- do not render helper/hint/help text inside the active cell editor; use `aria-label`, `title`, placeholder text, tooltip, or an external validation surface instead
- do not clamp the editor root to a fixed narrow width; it must fill the active cell rather than sizing itself to a smaller input box

## 27. Attachment editor uses form-card chrome

Symptom:

- attachment editing opens a small card with a title header, upload button, inner bordered row, and extra padding
- the edited cell keeps its blue outline while the attachment editor draws another nested card border
- existing attachments are shown as plain text rows instead of thumbnail/file cards plus a drop zone

Fix:

- use the platform-standard attachment panel connected to the edited cell
- render thumbnails/file cards and one drag/drop/click upload zone inside the same panel
- keep only one active/panel border and avoid nested form-card chrome
- keep upload/delete persistence in the host data-source adapter; the cell editor owns only selection, preview, remove, and normalized value extraction

## 28. Current value does not echo when editing starts

Symptom:

- person or department editors open empty even though the cell has a value
- date range editors show raw JSON, formatted text, or blank state
- select editors show ids instead of labels, or labels instead of selectable values

Fix:

- resolve initial editor value with `undefined` checks: prefer `options.value`, then `options.oldValue`, then `row[fieldKey]`
- do not use `??` for this fallback because `null`, `0`, `false`, `""`, and `[]` can be valid current values
- initialize editors from raw backend values, not canvas display strings
- include current record values in option/label mapping while remote candidates are loading
- normalize Make value variants before setting editor state

## 29. Unchanged close still calls the save API

Symptom:

- opening a cell editor and closing it without changes still sends update requests
- selecting the already-selected option, confirming the same date, or closing a popup without changes still calls the single-field update endpoint
- `edit:end` fallback commits a render value even though `submitValue` did not change
- user or department fields appear dirty because returned API shapes differ from record shapes

Fix:

- compare normalized old value with `nextValue.submitValue` before routing the commit
- run that comparison for every close path, including outside click, picker/dropdown close, same-value selection, Enter, Tab, programmatic `commit(...)`, and `edit:end` fallback
- skip save API calls, dirty state creation, draft patch enqueueing, business save events, and `setCellData(...)` when unchanged
- compare numbers as numbers, date ranges by normalized begin/end, select fields by option values, identity fields by stable ids, and files by stable metadata

## 30. Edit completion resets the table to the left edge

Symptom:

- the user scrolls horizontally to edit a far-right field
- after commit, cancel, rollback, or row refresh, the table jumps back to `scrollLeft = 0`
- same-object single-cell saves feel like the whole table has been reinitialized

Fix:

- treat edit completion as a same-object data update; only object/entity/schema identity switches reset scroll
- prefer `setCellData(...)` or `setRowData(...)` for accepted single-field saves
- if `setData(...)` or a full row refresh is unavoidable, snapshot the current public scroll state with `getScrollState()` before the update and restore it with `scrollTo(x, y)` after the table applies the new data
- do not change the React `key`, remount/recreate the table, call `scrollTo(0, 0)`, or rebuild columns merely because one cell changed
