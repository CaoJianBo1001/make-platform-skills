# field editor patterns

Use this file to map business field types to host editor patterns.

This file is about host-side editor integration, not about forcing one UI library.

When the host backend exposes Make-style field schemas, handle the currently supported 18 field types explicitly enough to avoid ambiguous value shapes:

- read-only / generated: `Make.Field.ID`, `Make.Field.Lookup`
- text-like: `Make.Field.Text`, `Make.Field.TextArea`, `Make.Field.URL`
- number-like: `Make.Field.Number`, `Make.Field.Currency`, `Make.Field.Percent`
- date-like: `Make.Field.Date`, `Make.Field.DateTime`, `Make.Field.DateRange`
- option-like: `Make.Field.SingleSelect`, `Make.Field.MultiSelect`
- identity-like: `Make.Field.SingleUser`, `Make.Field.MultiUser`, `Make.Field.SingleDepartment`, `Make.Field.MultiDepartment`
- attachment-like: `Make.Field.File`

This grouping is guidance, not a requirement to use these exact file or component names. If the host schema has equivalent names, map them into the same groups before choosing editors.

## 1. Common editor interface

Prefer a shared editor interface such as:

- `focus()`
- `updateVal()`

The field editor should return enough information for the host save layer to distinguish:

- display value
- submit value
- optional extra render mapping data

A useful value contract is:

```ts
type CellEditorValue = {
  renderValue: unknown
  submitValue: unknown
  displayValue?: unknown
  renderExtra?: unknown
}
```

Use this shape or an equivalent host contract so the canvas renderer, editor UI, and API payload do not fight over one overloaded value.

## 2. Make field-type grouping

Start from field metadata, not column names. A practical mapping is:

| Field type | Editor group | Default editability | Submit value |
| --- | --- | --- | --- |
| `Make.Field.ID` | read-only | read-only unless backend explicitly allows writes | none |
| `Make.Field.Text` | text inline | editable | string |
| `Make.Field.TextArea` | textarea inline | editable | string |
| `Make.Field.URL` | text/url inline | editable | string |
| `Make.Field.Number` | number inline | editable | number |
| `Make.Field.Currency` | number inline | editable | number |
| `Make.Field.Percent` | number inline | editable | number |
| `Make.Field.Date` | date popup | editable | agreed date string |
| `Make.Field.DateTime` | date-time popup | editable | agreed date-time string |
| `Make.Field.DateRange` | date-range popup | editable | `{ begin, end }` or backend equivalent |
| `Make.Field.SingleSelect` | select popup | editable | option value |
| `Make.Field.MultiSelect` | select popup | editable | option value array |
| `Make.Field.SingleUser` | identity/user popup | editable when candidates or current value can be resolved | user id |
| `Make.Field.MultiUser` | identity/user popup | editable when candidates or current values can be resolved | user id array |
| `Make.Field.SingleDepartment` | identity/department popup | editable when candidates or current value can be resolved | department id |
| `Make.Field.MultiDepartment` | identity/department popup | editable when candidates or current values can be resolved | department id array |
| `Make.Field.File` | attachment popup/panel | editable when a saved record identity exists if upload requires it | backend file value or normalized file payload |
| `Make.Field.Lookup` | read-only | read-only unless backend explicitly allows writes | none |

Do not hard-code these field names as the only possible universe for every project. They are the current Make backend contract; adapt only when the host backend exposes a different but equivalent schema.

For Make schema-driven editable tables, also read `make-cell-edit-defaults.md`. Popup groups open immediately after edit mode starts; inline groups fill the active cell.

## 3. Text fields

Examples:

- single-line text
- multi-line text
- URL text

Recommended pattern:

- host Input / 文本输入框 for single-line text and URL fields; host TextArea / textarea for multi-line text
- full-cell, non-popup, borderless inline editor; the CanvasTable active edit border is the only editing border
- submit-style editing
- `updateVal()` returns the edited string for both display and submit in simple cases
- URL fields may share the text editor; link rendering belongs in the display/render layer

Good fit for:

- `contenteditable`
- host input component
- textarea-like component when needed

## 4. Number-like fields

Examples:

- `Make.Field.Number`
- `Make.Field.Currency`
- `Make.Field.Percent`

Recommended pattern:

- host InputNumber / NumberInput / 数字输入框, not a plain text input
- full-cell, non-popup, borderless inline editor; hide steppers by default with `controls={false}` or the host-library equivalent unless the product explicitly needs stepper controls
- submit-style editing
- keep precision and unit behavior in field metadata or field config
- keep the row value and submit value as a finite number or pure numeric string, according to the backend contract
- put currency, percent, thousands separators, and unit display in the editor formatter or table render layer
- parse formatted input back to a number before commit
- round or clamp to backend precision before submit when metadata such as `precision` or `decimalPlaces` is present
- parser failures are invalid editor state. Do not commit, backfill, display, or submit `NaN`/`Infinity`; show validation or close/cancel according to the host edit flow.

Typical concerns:

- empty string vs null
- precision
- suffix/unit display
- display string vs submit payload
- invalid input fallback and validation policy

Good defaults:

- `Enter` may commit for simple number editors, similar to text fields.
- `Escape` should cancel without writing the candidate value.
- Do not pre-format the row data into a display string before it reaches the editor; that often makes initial values and submit payloads brittle.
- Do not submit formatted values such as `¥3.005`, `3.005%`, or `85%`. If the backend field allows only two decimals, normalize to a finite number or pure numeric string such as `3.01` before calling the save API.

## 5. Date fields

Recommended pattern:

- host DatePicker / 日期选择器 for `Date` and `DateTime`; host RangePicker / 日期区间选择器 for `DateRange`
- often realtime-style editing
- keep date format driven by field metadata
- open popup immediately when the editor mounts
- render the picker popup into the editor popup root and include that root in `relatedElements()`

Typical concerns:

- display format vs submit format
- whether selecting a value should close immediately or not
- whether direct typed input has been parsed before OK / commit

For date-time editors with an explicit OK button, resolve the current input text into the selected value before calling the table commit path. Some UI libraries do not emit `onChange` just because the user typed a complete date-time string.

Date range fields should be their own editor group when the backend uses a structured value such as `{ begin, end }`. Do not flatten the range into a display string before submit.
Date range editors must echo current structured values and submit a structured range. A range cell that shows raw JSON or saves `"begin 至 end"` is using the wrong boundary value.

## 6. Select fields

Examples:

- `Make.Field.SingleSelect`
- `Make.Field.MultiSelect`

Recommended pattern:

### Single-select

- host Select / 选择器 using schema `{ label, value }` options
- often realtime-style
- selecting a new value may commit immediately

### Multi-select

- host Select / 多选选择器 with responsive tags and value arrays
- often submit-style
- editing may remain open while the user manages multiple selections

Typical concerns:

- label/value separation
- search support
- selected item display
- whether display value is a tag list while submit value is ids/values
- responsive tag overflow for narrow cells

For Make-style select fields, prefer schema options such as `{ label, value }`. Submit the raw value or value array; keep tag labels in `displayValue` or render mapping.
Select editors should open the dropdown immediately when the edit session begins. Single-select may commit after a selection change; multi-select usually remains open while the user manages tags and commits on close/Tab/outside-click according to the host policy.

Do not synthesize a `-` option for empty values. Empty display uses the table renderer's muted placeholder, but editor options must contain only real schema/candidate options unless the backend itself defines an option whose value is `-`. For empty single-select state, use `undefined`/clear state plus placeholder text; for empty multi-select state, use `[]`. For generic select fields, the current record value may be merged into options only when it has a real value/id that is not yet present in loaded options. Identity fields follow the person/department echo rules below.

## 7. Person fields

Recommended pattern:

- reuse the host project's existing people selector backed by the host user candidate API
- treat `focus()` as "open the selector" rather than only text focus
- usually submit-style editing

Typical concerns:

- display list vs submit ids
- auxiliary render mapping data for avatars/names
- candidate source: host user API or existing people picker data source; current row values are only for echoing existing selections

For generated Make App projects, consume the host-provided people candidate
source. Use `makeui` for the canonical option identity/label/avatar mapping and
`make-app-service` for route implementation; a host-documented equivalent wins.

For Make identity values, tolerate both record-style values and current identity-service values. Read ids from `recordID`, `userId`, or `id`, and labels from `name`, `userName`, `displayName`, or `label`. For multi-user fields, normalize arrays with the same priority before dirty comparison and submit conversion.

People selector options, selected values, and inline echo UI should reuse the same ExpensePoc avatar token as table display: fixed 22px circular image/fallback, 11px radius, 9px centered fallback text, 400 weight, and a separate name label. Do not render user initials with a content-sized pill/tag background, do not enlarge the avatar text, and do not shrink the circular background around the text. Empty user values use placeholder/clear state, not a fake `-` avatar or candidate option.

Current-value echo is mandatory. `SingleUser` may arrive as one object, a one-item array, a scalar id, or an identity API object; `MultiUser` may arrive as an array. Normalize these shapes before rendering the selector. If a selected user has an id and label, merge it into the selector options as an echo option even when `/api/users` is still loading or the current page of candidates does not contain that user. If the selected user has only a label and no stable id, keep that label visible as a temporary echo and require a real candidate selection before committing a changed value; do not render the editor empty. Candidate responses must merge with selected echo options rather than replacing them.

Do not use field schema `options`, table row samples, hardcoded fixtures, or mock users as candidate lists in production. If no user API exists, preserve the current cell value for display and allow editing only to the extent the host selector/data source supports it.
The people editor must echo the current record value even while remote candidates are loading. Normalize ids from `recordID`, `userId`, or `id`; normalize labels from `name`, `userName`, `displayName`, or `label`.

## 8. Department fields

Recommended pattern:

- reuse the host project's department selector backed by the host department candidate API
- treat `focus()` as opening the selector
- usually submit-style editing

Typical concerns:

- display list vs submit ids
- extra mapped render data for downstream cell rendering
- candidate source: real department API or host department selector data; current cell values are only for echoing existing selections

For generated Make App projects, consume the host-provided department candidate
source. Use `makeui` for the canonical option identity/label and tree-flattening
rules and `make-app-service` for route implementation; a host-documented
equivalent wins.

For Make department values, tolerate both record-style values and current department-service values. Read ids from `recordID`, `departmentId`, or `id`, and labels from `name`, `departmentName`, `displayName`, or `label`. For multi-department fields, normalize arrays with the same priority before dirty comparison and submit conversion.

Do not use field schema `options`, table row samples, hardcoded fixtures, or mock departments as candidate lists in production. Do not replace an empty real department API result with local fallback data unless the product explicitly asks for demo/mock mode. Submitting a fake department id usually creates backend validation failures.
The department editor must echo the current record value even while remote candidates are loading. Normalize ids from `recordID`, `departmentId`, or `id`; normalize labels from `name`, `departmentName`, `displayName`, or `label`.

## 9. Attachment fields

Attachment fields are special and should usually be treated as their own category.

Recommended pattern:

- render in-table previews/icons through canvas-table rendering
- reuse the host project's upload/file components for editing when available
- otherwise provide a host DOM editor with drag/drop and click-to-upload file selection
- usually submit-style editing
- require a saved backend record identity when the backend upload API needs one

Typical concerns:

- image vs non-image file display
- preview/open behavior
- submit payload vs render payload
- replacement/removal/reordering
- max file count
- mock local data URL behavior vs real upload adapter behavior

For details, read `attachment-editor-patterns.md`.

## 10. Distinguish display value and submit value

This distinction matters most for:

- number-like fields with formatted display
- select fields
- person fields
- department fields
- attachment fields
- date fields with formatted display

Do not assume one field value can always serve both rendering and API submission directly.

## 11. Suggested code organization

Keep field-type handling discoverable. Exact names can vary by host project, but avoid one large editor file.

Common folders:

- `config/`: schema-to-column and schema-to-editor mapping, including editability and field metadata
- `editing/`: shared types, value adapters, equality/dirty checks, commit strategies, rollback/backfill helpers
- `editors/`: DOM editor components grouped by text, number, date, select, identity, and attachment
- `renderers/`: canvas display renderers for tags, users, departments, attachments, links, and formatted numbers
- `hooks/`: framework-specific edit controller and draft state helpers

If the host already has another folder convention, keep that convention but preserve these responsibility boundaries.
