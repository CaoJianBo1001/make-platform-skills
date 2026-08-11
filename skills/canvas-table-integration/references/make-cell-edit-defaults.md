# Make cell edit defaults

Use this reference for Make schema-driven editable cells in `@qfei-design/canvas-table`.

These defaults define the validated platform behavior for Make table editing. They are the mandatory baseline / 强制准入规范 for every CanvasTable cell-edit implementation. Host component names may vary, but the lifecycle, value contract, no-double-border visual rule, popup behavior, and save/rollback behavior must not be weakened.

If an implementation misses this baseline, treat it as a readiness blocker / 交付阻断. Do not report the editable table as done, complete, ready, or delivered until the standard is satisfied.

## 1. Required editing baseline

Use `editType: "custom"` plus a host `customEdit(options)` bridge for business fields.

For generated Make App editable tables, the platform-standard cell editor is the required baseline. Do not invent a second cell-edit style for new POC projects.

For Make App editable tables, use the applicable required defaults:

- `editApplyMode: "controlled"`
- a dedicated editor DOM element for the active cell
- a separate popup root appended to `document.body`
- `relatedElements()` returning popup roots so dropdown/date/attachment panels are not treated as outside clicks
- `overlayOptions: { overflow: "visible" }` when a popup can extend outside the edited cell
- `destroy()` that unmounts the framework root, removes popup roots, and releases editor-local resources

Do not let each field editor call backend APIs directly. Field editors extract values; the save or draft layer decides persistence, backfill, and rollback.

Canonical flow:

1. Resolve the editable field config from schema field type, not from column title text.
2. Enter edit mode from the canvas-table edit activation. For pointer users, the default Make table behavior is double-clicking an editable cell. The first click may activate/select the cell, but after the double-click enters edit mode there must not be a third click to open the field popup.
3. Before mounting or showing the real field editor, scroll the target cell fully into the visible table body if it is clipped horizontally, vertically, by fixed-left boundaries, by the row header, by the table header/body boundary, or by the container edge.
4. If scrolling is needed, do not render/open the field control or popup during the pre-scroll frame. Use a delayed mount, hidden placeholder, or equivalent host bridge until `scrollTo(...)` has applied and the post-scroll geometry is available.
5. After any scroll, recalculate or wait until the next animation frame so editor coordinates come from the post-scroll cell geometry.
6. Create a full-cell editor element for the active cell and a separate popup root appended outside the canvas host.
7. Mount the field editor with the normalized current value, then focus it. Popup fields must open immediately after the post-scroll mount.
8. For popup fields, choose placement from the current viewport and post-scroll anchor geometry: prefer left/top-start alignment when the popup fits; flip to right/end alignment or shift within the viewport when the popup would be clipped on the right or bottom edge.
9. Return `element`, `getValue()`, object `autoClose`, `relatedElements()`, `overlayOptions`, and `destroy()` from `customEdit`.
10. On any commit-style close path, call `updateVal()`, compare `oldValue` with `nextValue.submitValue` by field type, and skip all save/backfill work when unchanged.
11. If changed, pass the normalized commit to the host draft or immediate-save layer. With `editApplyMode: "controlled"`, call `setCellData(...)` or `setRowData(...)` only after the host layer accepts the commit. On failure, rollback to the old value.
12. Preserve the current table scroll position after commit, cancel, rollback, and accepted backfill. A same-object edit must not reset horizontal scroll to the left edge or vertical scroll to the top.

## 2. Activation and popup rule

When the table enters edit mode, the editor must be usable immediately.

Default Make editable-cell activation is double-click. A single click may only activate/select the cell; double-click must enter edit mode. Keyboard or programmatic edit entry may exist, but generated POC projects must support the double-click path. Once double-click has entered edit mode, popup-style fields must already be open. It is incorrect to first show a small input and require one more click to open the picker/dropdown.

Before mounting the real field editor, make the target cell visible. If the clicked cell is partially clipped by horizontal scroll, vertical scroll, the fixed-left region, header/body viewport boundary, or the container edge, scroll just enough to bring the full editable cell into the visible body viewport. Only after that scroll has applied should the host mount/open the editor and calculate popup placement from the updated geometry. Do not mount the editor at the old clipped coordinates, do not show a pre-scroll popup, and do not rely on the popup to compensate.

Practical rules:

- if the cell is already fully visible, do not change scroll
- if the row is partially above/below the body viewport, adjust vertical scroll before mounting the editor
- if the column is partially left/right clipped, adjust horizontal scroll before mounting the editor
- fixed-left cells should not trigger horizontal scroll, but normal cells must not be hidden behind the row-head or fixed-left area
- after calling the table's public scroll method, recalculate or wait for the next frame before focusing/opening the editor
- use the installed package's public scroll APIs, for example `scrollTo(...)` when available; do not mutate internal scroll state directly
- do not scroll merely because a popup panel is wider than the cell; first ensure the cell itself is visible, then let popup placement/viewport shifting handle the wider panel
- do not include popup width, guessed popup placement, or a pre-scroll right-aligned dropdown in the scroll calculation. Scroll is based only on making the cell visible; popup placement is decided after scroll completion

Default popup-style fields:

- `Make.Field.Date`
- `Make.Field.DateTime`
- `Make.Field.DateRange`
- `Make.Field.SingleSelect`
- `Make.Field.MultiSelect`
- `Make.Field.SingleUser`
- `Make.Field.MultiUser`
- `Make.Field.SingleDepartment`
- `Make.Field.MultiDepartment`
- `Make.Field.File`
- editable relation/lookup selectors when the host backend explicitly supports them

For React and Ant Design style components, this usually means controlled `open` or equivalent on mount, `getPopupContainer={() => popupRoot}`, and `focus()` in the editor handle after the editor root has rendered.

Popup visibility requirements:

- dropdowns, date panels, identity selectors, and lookup selectors render into the popup root, not inside the clipped canvas/table container
- attachment panels may render as an absolute panel connected to the full-cell editor element or into the popup root; in both cases the panel root must not be clipped
- popup/panel roots are returned by `relatedElements()` so clicks inside them are not outside clicks
- `overlayOptions: { overflow: "visible" }` is enabled for any editor that can extend outside the cell
- select/user/department dropdown min width is at least the active cell width, and panel placement must avoid cutting off the lower/right edges
- if the active cell would be clipped, scroll the cell into view before mounting the editor; if only the popup would be clipped, flip or shift the popup before the user sees it. Do not accept a dropdown whose bottom border, right border, or last options are hidden

Placement baseline:

- select, user, department, date, date range, and lookup popups prefer left/top-start alignment from the edited cell when there is enough viewport space
- if the popup would overflow right, align its right edge with the edited cell or shift it left within the viewport
- if the popup would overflow bottom, flip above the cell or shift upward within the viewport while keeping the anchor visually clear
- attachment panels follow the viewport-aware placement rule: default left alignment from the edited cell; switch to right alignment only when the available right-side viewport space is smaller than the panel width
- all placement decisions use the post-scroll cell geometry, not stale coordinates from before `scrollTo(...)`. A dropdown that chooses right alignment before scroll and then switches left after scroll is a bug; the popup should not be shown or placed until after the scroll has settled

## 3. No double-border rule

The edited cell already has the CanvasTable active editing border / active outline. Field editor controls inside that cell must not draw a second focus border, component border, or focus shadow.

Default visual requirements:

- Non-popup / 非弹窗 inline editors for text, textarea, URL, number, currency, and percent fields keep only the CanvasTable-owned edit border. The inner input is a full-cell editing surface, not a nested form control box.
- Select, user, department, date, and date-range triggers inside the cell are borderless, shadowless, full width, and full height.
- Ant Design style components should use borderless variants and remove selector/picker focus `box-shadow`; the dropdown/picker panel may keep its normal popup shadow.
- Ant Design style `InputNumber` should use `variant="borderless"` and `controls={false}` by default. Other UI libraries should use their equivalent NumberInput / 数字输入框 with hidden steppers for the standard Make cell editor.
- Text and textarea editors should use the host Input / TextArea / 文本输入框 equivalents with `border: none`, no focus ring, no outer margin, and no wrapper border inside the cell.
- Date and date-time editors should use the host `DatePicker` / 日期选择器, and select/user/department editors should use the host `Select` / 选择器 or business selector. Popup-style controls must mount with `open` / controlled-open behavior so the panel is visible immediately after edit activation.
- Single-select and identity tags can render as compact pills inside the cell, but the trigger container itself must not draw another blue rectangle.
- Clear, search, and suffix icons stay inside the same borderless trigger area and must not create a nested input box.
- Visible helper/hint/help text, range tips such as `0-5`, `Form.Item` help, or inline validation instructions must not render inside the active cell editor. Put constraints in `aria-label`, `title`, placeholder text, tooltip, or an external validation/error surface that does not occupy the edited cell.
- The only visible blue border during normal editing is the canvas-table active cell outline. Attachment panels may draw one panel border that covers or replaces the active-cell outline.

If a screenshot shows a blue cell outline plus another blue rectangle around the Select/Input/Pick trigger, the editor is wrong.

Default editor sizing:

- editor root, popup editor wrapper, select trigger, date picker, and number input are `width: 100%` and `height: 100%`
- the input/trigger can keep small horizontal text padding, but must not introduce an inset bordered rectangle
- select/date/number components use borderless style; number steppers are hidden by default
- Any width clamp, fixed narrow width, `min-width`/`max-width` workaround, or 80-120px-style input sizing is forbidden and must not replace full-cell `width: 100%` / `height: 100%` sizing for the editor root and actual control.

## 4. Inline editor visual rule

Inline editors must fill the active cell. These are the default non-popup editors.

Default inline fields:

- `Make.Field.Text`
- `Make.Field.TextArea`
- `Make.Field.URL`
- `Make.Field.Number`
- `Make.Field.Currency`
- `Make.Field.Percent`

The editor root and the actual input/textarea/number component should use `width: 100%` and `height: 100%`. Do not wrap the editor in `Form.Item`, cards, bordered panels, or components that add an extra visible border, radius, margin, or outer padding inside the active cell. The active-cell outline belongs to canvas-table; the input itself should be borderless or visually merged with the edited cell.

Small horizontal content padding is acceptable inside the input text area, but it must not create an extra inset box. Textarea editors must also fill the cell instead of rendering as a smaller bordered textarea floating inside the cell.

Do not add visible helper, hint, range, or validation copy below or beside inline editors inside the active cell. For example, a score editor may expose `0-5` through `aria-label` or validation logic, but it must not render a visible `0-5` span in the edited cell.

Concrete component expectations:

- text and URL fields: host Input / native input, full-cell, borderless, select current value on focus
- textarea fields: host TextArea / textarea, full-cell, borderless, no extra `Form.Item`
- number, currency, and percent fields: host InputNumber / NumberInput / 数字输入框, full-cell, borderless, right-aligned when the table display is right-aligned, `controls={false}` or hidden steppers by default, raw plain-decimal text validation before finite parsing and commit. Number editors use `field.properties.precision`; Currency editors use `field.properties.symbol`, `field.properties.decimalPlaces`, and optional `field.properties.useGrouping` for formatter/parser display; Percent editors use `field.properties.decimalPlaces`

Number-like editors must use the same separate pure decimal-place helper as Drawer/route forms; the field type registry only supplies normalized metadata. Resolve the maximum from `Make.Field.Number -> precision`, `Make.Field.Currency -> decimalPlaces`, and `Make.Field.Percent -> decimalPlaces`. Preserve the untouched input as diagnostic `rawText`, return `normalizedText = rawText.trim()`, and validate `normalizedText` before finite-number parsing. Only `normalizedText` may become the parsed value or backend-approved pure numeric-string submit value; whitespace-only input normalizes to `""`. Accept only plain decimal text, count trailing zeroes as decimal places, and reject scientific notation plus formatted currency, percent, and grouping text. When the raw text exceeds the limit, reject commit, keep the editor active, show `最多保留 N 位小数` through a tooltip or host external validation surface, and do not call the save API. Do not render helper text inside the cell. Silent rounding is forbidden unless the host project explicitly documents that policy; when explicit rounding applies, update the visible editor value before commit so the user sees the value that will be saved.

## 5. Attachment editor visual rule

Attachment editing must preserve the required platform table-editor behavior. A host attachment component may be reused only when it satisfies the same connected-panel, no nested form-card chrome, value, and data-source-boundary rules.

Default attachment editor shape:

- open a single attachment panel directly from the edited cell; do not render a form card inside the cell
- the panel may be wider/taller than the cell and should visually connect to the active cell
- default panel width is about `450px`, with viewport max protection; do not make the panel a narrow one-cell popup
- panel border is the only blue editing border for attachments: `2px` blue border, `border-radius: 0`, flat background, no shadow/card chrome by default
- use one blue panel/active outline, not a blue cell border plus a nested card border
- show existing image/file thumbnails or file cards first, using compact square cards around `64px` by `64px`
- when there are no attachments, do not render a fake attachment card, `-` placeholder, or empty list row; show only the upload drop zone
- provide one drag/drop/click upload zone inside the same panel
- support preview/remove controls on the attachment item itself
- avoid a header row such as field title plus a separate "upload" button unless the product explicitly asks for that form-style layout

A panel that contains a title, toolbar button, inner bordered list row, and card chrome is a form layout, not the default canvas-table attachment cell editor.

## 6. Field-type default behavior

| Field group | Default editor behavior | Submit value |
| --- | --- | --- |
| ID | read-only | none |
| Text / URL | non-popup inline host Input / 文本输入框, full-cell borderless, select current value on focus | string |
| TextArea | non-popup inline host TextArea that fills the cell; commit on outside click or explicit key path | string |
| Number / Currency / Percent | non-popup inline host InputNumber / NumberInput / 数字输入框, borderless, right-aligned display, `controls={false}` or hidden steppers by default; parser failures and decimal overflow must not commit or backfill; apply `Number.precision`, `Currency.symbol/decimalPlaces/useGrouping`, and `Percent.decimalPlaces` from `field.properties`; show `最多保留 N 位小数` outside the cell when over the limit | finite number or pure numeric string |
| Date | popup host DatePicker / 日期选择器 opens immediately; use `field.properties.format` | `YYYY-MM-DD` or host agreed date string |
| DateTime | popup host DatePicker / 日期时间选择器 opens immediately; use `field.properties.format`; resolve typed input before OK commit | `YYYY-MM-DD HH:mm:ss` or host agreed date-time string |
| DateRange | popup host RangePicker / 日期区间选择器 opens immediately; use `field.properties.begin` and `field.properties.end` to disable dates outside the allowed range | `{ begin, end }` or host equivalent |
| SingleSelect | popup host Select / 选择器 opens immediately; single selection may request commit after change; empty value is clear state/placeholder, not a `-` option | option value |
| MultiSelect | popup host Select / 多选选择器 opens immediately; keep responsive tags and `+N` overflow; empty value is `[]`, not a `-` tag | option value array |
| SingleUser / MultiUser | searchable user selector opens immediately; include current value and candidates from `/api/users` or host equivalent; `MultiUser` enforces `field.properties.maxCount` by disabling or preventing extra selection while remove/clear still works; do not add a fake `-` candidate | user id or user id array |
| SingleDepartment / MultiDepartment | searchable department selector opens immediately; include current value and candidates from `/api/departments` or host equivalent; `MultiDepartment` enforces `field.properties.maxCount` by disabling or preventing extra selection while remove/clear still works; do not add a fake `-` candidate | department id or department id array |
| File | attachment panel/editor opens as host popup; empty state shows only upload zone; upload/delete goes through host data-source boundary; `field.properties.maxCount` limits upload, drag/drop, paste, and append actions | normalized file payload |
| Lookup | read-only by default; if editable, use a relation/lookup selector popup, not plain text | backend relation payload |

Reuse the host Drawer form's field-type mapping where possible so Drawer forms and table cell editors submit the same value shapes.

For user editors, the selected value echo and dropdown candidate rows must use the same avatar dimensions as table display: a fixed 22px circular image/fallback, 11px radius, 9px centered fallback text, and the user name outside the avatar. The avatar background must not be a content-sized text pill, and the fallback text must not be enlarged to fill the circle.

## 7. Initial value and echo rule

Resolve the editor's initial value from the table edit options and row data in this order:

```ts
const initialValue =
  options.value !== undefined
    ? options.value
    : options.oldValue !== undefined
      ? options.oldValue
      : options.row?.[fieldKey];
```

Use an `undefined` check instead of `??` here. `null`, `0`, `false`, `""`, and `[]` can all be valid current field values and must not accidentally fall back to `oldValue`.

Never initialize complex editors from formatted display text.

Normalize current backend value shapes before rendering editor state:

- date range accepts `{ begin, end }`, `{ start, end }`, `{ from, to }`, or `[begin, end]`, then edits as picker values and submits the backend range object
- select values separate value and label; options use schema `{ label, value }`
- user values read ids from `recordID`, `userId`, or `id`, and labels from `name`, `userName`, `displayName`, or `label`
- department values read ids from `recordID`, `departmentId`, or `id`, and labels from `name`, `departmentName`, `displayName`, or `label`
- file values normalize to the host attachment display/payload structure

If remote user or department candidates are still loading, the current cell value must still echo from the record value. Do not show an empty select just because the candidate API has not returned yet.
User and department candidate lists must use the same host candidate adapters as Drawer forms and advanced filters. Do not source cell-editor candidates from field schema options, static fixtures, current table rows, or hardcoded demo lists; current values are only an echo fallback.

Person-field echo requirements:

- `SingleUser` may arrive as one object, a one-item array, a scalar id, or an identity API object; normalize all of them before opening the editor.
- `MultiUser` may arrive as an array of record-style or identity-service objects; normalize every item independently.
- When a current user value has a stable id plus label, merge it into the selector options as an echo option before rendering, even if `/api/users` has not loaded or does not include that user in the current page.
- When a current user value has a label but no stable id, display that label as a temporary echo value and require the user to choose a real candidate before committing a changed value. Do not clear the editor to empty.
- The people editor is empty only when the normalized current value has neither stable id nor display label.
- Existing selected users must stay visible while remote search/candidate loading updates; a later candidate response must merge with, not replace, the selected echo options.

Empty value rule:

- display-only cells may render the muted placeholder `-`
- editor dropdowns must not include `-` as an option or selected tag unless the backend schema/candidate API explicitly returned it as a real option
- single empty select/user/department editor uses `undefined` or an empty string internally and shows placeholder text
- multi empty select/user/department editor uses `[]`
- if the current record value is empty, do not merge an echo option into the option list

## 8. Value contract

Every field editor should expose a common handle:

- `focus()`
- `updateVal()`
- optional `getPopupRoot()`

`updateVal()` should return a value contract equivalent to:

```ts
type CellEditorValue = {
  renderValue: unknown;
  submitValue: unknown;
  displayValue?: unknown;
};
```

Use `renderValue` to backfill canvas display data, `submitValue` for dirty comparison and API payloads, and `displayValue` only for user-facing text.

Do not submit formatted values such as `¥1,260,000.00`, `2026-06-01 至 2026-12-31`, option labels, user names, department names, or attachment preview text.

After a changed commit is accepted, the visible cell must receive the accepted `renderValue`. The table renderer then normalizes and displays that value by field type. Do not display `submitValue` directly when it is an id, enum value, date object, attachment payload, or backend relation payload. If the host save layer returns a fresher normalized record value, prefer that returned render value and then call `setCellData(...)` or `setRowData(...)`.

Post-edit scroll preservation:

- editing completion is a same-object data update, not an object/entity/schema identity change
- after commit, cancel, rollback, same-value close, or accepted save backfill, keep the current `scrollLeft` and `scrollTop`
- do not call `scrollTo(0, 0)`, remount/recreate the table, change the React `key`, or reinitialize columns/data just because one field changed
- prefer `setCellData(...)` or `setRowData(...)` for accepted single-cell saves; if a full row refresh or `setData(...)` is unavoidable, snapshot the current public scroll state with `getScrollState()` before the update and restore it with `scrollTo(x, y)` after the update
- only object/entity/schema identity switches reset scroll to the top-left; a Service/API refresh within the same object should preserve the user's current viewport

## 9. Close, save, and rollback rule

Recommended `autoClose` split:

- single-line text and number: `{ outsideClick: "commit", escape: "cancel", enter: "commit", tab: "commitAndMove" }`
- textarea / multiline text: outside click commits, Escape cancels, Tab commits and moves; Enter should stay inside the editor when multiline input is enabled
- popup editors: `{ outsideClick: "commit", escape: "cancel", enter: "ignore", tab: "commitAndMove" }`

### Single-field unchanged close rule

For single-field cell editing, all close paths must run the same normalized equality check before any save side effect:

- outside click close
- dropdown/picker close
- selecting the same option
- date picker OK with the same value
- Tab commit-and-move
- Enter commit for single-line editors
- programmatic `commit(...)`
- `edit:end` fallback when the host did not capture a pending commit

If normalized old and new values are equal, the host must only close/reset the editor. It must not call the Service/API update endpoint, mark the row/cell dirty, call `setCellData(...)`, enqueue a draft patch, or emit a business save event.

`Escape` remains cancel-style and also must not call save APIs.

On commit:

1. Read the current editor value through `updateVal()`.
2. For Number, Currency, and Percent, read the raw plain-decimal input text and validate the schema decimal limit before parsing, dirty comparison, or any save side effect.
3. If decimal validation fails, reject commit, keep the editor active, surface `最多保留 N 位小数` through a tooltip or host external validation surface, and do not call the save API, create draft state, or backfill canvas data.
4. After validation succeeds, parse with a finite-number guard or keep the backend-approved pure numeric string, then compare the normalized old value with `nextValue.submitValue` by field type.
5. If unchanged, close/reset without calling the save API, creating draft state, or calling `setCellData(...)`.
6. If changed, route the commit to the host draft or immediate-save layer.
7. In `editApplyMode: "controlled"`, call `setCellData(...)` or `setRowData(...)` only after the host layer accepts the commit.
8. On save failure, rollback the canvas cell to the old value and surface the error through the host UI.

The equality check must understand field types. Examples:

- number-like fields compare finite numeric values only after raw-text decimal-place validation. Decimal overflow keeps the editor active and never reaches parsing, dirty comparison, or persistence; invalid parser results fail validation and never commit `NaN`
- date range fields compare normalized `begin` and `end`
- select fields compare option values, not labels
- user and department fields compare stable ids
- file fields compare stable file metadata, not generated local `uid`

Field-property checks are part of edit readiness: verify `precision`, `decimalPlaces`, `symbol`, `format`, `DateRange.begin/end`, and `maxCount` behavior in the editor path, not only in Drawer forms.

The default precision policy is validation, not silent normalization. Do not silently round or clamp extra decimal places unless an explicit host product/backend contract requires it. Form and cell editors must share the same pure validation result so the same input cannot pass one surface and fail the other.

## 10. Verification checklist

Before reporting an editable Make table as done, verify at least:

- popup fields open their picker/dropdown/panel immediately after edit mode starts
- pointer activation supports double-click into edit mode; popup fields do not require a third click after the double-click
- clicking a partially clipped editable cell scrolls it fully into view before the real editor or popup is mounted/opened
- editor and popup coordinates are calculated only after any scroll has applied, so the full-cell editor is anchored to the visible cell
- popup/dropdown panels are fully visible; their right and bottom edges, last option rows, date footer, and attachment controls are not clipped
- popup placement is decided from post-scroll geometry; popups default left/top-start when they fit, flip or shift near right/bottom viewport edges, and attachment panels default left and switch right only when right-side space is insufficient
- select, date, user, and department triggers do not draw a second blue border inside the active cell
- inline editors fill the active cell and have no extra nested border or outer margin
- inline editors do not render visible helper/hint/help text, range tips such as `0-5`, or `Form.Item` validation copy inside the active cell
- editor roots and actual controls are full-cell sized; there is no width clamp, fixed narrow width, or min/max-width workaround that makes the editor smaller than the edited cell
- select/user/department empty states do not create a fake `-` option
- attachment fields use one connected popup/panel with compact thumbnails and one upload zone, not a nested form card
- empty attachment editors show only the upload zone, not a fake `-` card or empty list row
- date range, select, user, department, number, textarea, and file fields echo existing values on entry
- Number, Currency, and Percent values at the configured decimal limit commit successfully; values one decimal place over the limit keep the editor active, show `最多保留 N 位小数` through the host validation surface, and make zero save API calls
- form and cell-editor tests apply the same shared pure decimal-place validation cases, including `0`, negative values, numeric strings, trailing zeroes that count toward the limit, scientific notation rejection, and decimal overflow
- user fields with current values from `{ recordID, name }`, `{ userId, userName }`, one-item arrays, or loaded candidate objects all show the selected person on entry; candidate loading must not blank the editor
- unchanged close from outside click, picker/dropdown close, same-value selection, Enter, Tab, or `edit:end` fallback does not call save APIs, create dirty state, or backfill table data
- changed commit sends normalized submit values and backfills accepted render values, not raw ids or formatted display labels
- edit completion preserves the current horizontal and vertical scroll; editing a far-right field must not return the table to the left edge
- `Escape` cancels without writing the candidate value
- clicking inside a popup does not close the editor because the popup root is included in `relatedElements()`
- `destroy()` removes editor and popup DOM roots
