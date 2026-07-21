# Make Field Display Patterns

Use this reference when a canvas-table page must display Make platform schema fields and backend values. This is display guidance, not an editing contract.

## Goal

Turn schema fields plus raw backend values into stable canvas-table display:

1. schema field -> column config
2. raw value -> normalized display value
3. display group -> focused canvas renderer

Keep the adapter pure. Keep I/O such as option, department, or user candidate loading outside cell renderers.

## Default Make Schema Table Baseline

For new Make App projects, any Make schema-driven business table should follow this ExpensePoc-derived display baseline unless the user explicitly asks for a different table style.

Default structure:

- use `@qfei-design/canvas-table` as the table implementation; this baseline is not for UI-library tables
- in new Make POC projects, create or reuse `apps/ui/src/lib/make-field-types.ts` as the shared Make field type registry before building table-specific config or renderers
- wait for runtime schema fields before creating or updating the table columns
- normalize remote schema variants before the table layer consumes them; handle shapes such as `entity.properties.fields`, `entity.fields`, or the host documented equivalent in a boundary adapter
- derive `IColumn[]` from normalized runtime schema fields, not from a hand-maintained static column list
- keep `fieldType`, `fieldSchema`, and `renderKind` or equivalent metadata on each generated column
- derive `displayGroup`, `renderKind`, default `width`, `align`, multiplicity, host-owned display/editor hints, and normalized `field.properties` from the shared registry; do not duplicate field-type string lists inside table display modules. Advanced-filter capability remains owned by `make-app-filter` and `@qfei-design/make-filter`
- keep business ordering or primary-link roles as a thin config layer; generic rendering still branches by field type
- normalize each raw cell value once through a pure field-display adapter before rendering
- route normalized display groups to focused canvas renderers: `text`, `tag`, `user`, `attachment`, `lookup`, and generic fallback
- keep option, user, department, file, and lookup candidate loading in hooks/data sources; never fetch from a cell renderer
- when Track B is layered onto this Make display base, pass host-provided candidate sources into table editors. Use `makeui` for candidate UI identity/label rules and `make-app-service` for route implementation; never fetch from a cell renderer
- keep `showSN` sequence numbers and the hover-revealed row detail entry through `bodyRowHeadSuffixOptions`
- create or update the CanvasTable after schema/columns are ready and the host has real size; do not wait for `records.length`, `rows.length`, or data totals to become positive. Empty rows still render headers and the configured empty state after `setData([])`
- keep latest rows in the table host/controller and call `setData(latestRows)` after the CanvasTable instance is created, because backend rows can arrive before `ResizeObserver` or schema readiness finishes creating the instance
- treat object/entity/schema key as table identity. Switching to another object must reset scroll to the top-left and clear old table interaction state; data refresh within the same object may preserve scroll

Default visual rules:

- ellipsis is the default text overflow behavior. Text-bearing content that exceeds its available width must visibly show ellipsis or a shortened tag/user/lookup label before exposing a tooltip
- tooltip is a default renderer behavior, not an opt-in feature. Show tooltip only when content is ellipsized, clipped by a non-text custom shape, or hidden behind `+N`; do not show tooltip when the visible content fully fits the column
- text/link cells use 14px sans-serif text, 8px horizontal padding, `#1f2937`, ellipsis, and overflow-only tooltip
- empty values render muted `-` with `#9ca3af`
- clickable text, safe URLs, and openable lookup references use `#1677ff`
- number, currency, and percent cells accept only finite numbers or pure numeric strings from backend/API data. Parse through a finite-number guard before display formatting. Invalid, blank, formatted, `NaN`, `Infinity`, or unparseable values render muted `-`, never `NaN`, `Infinity`, or parser error text. `Make.Field.Number` display uses `field.properties.precision` when present.
- currency and percent display formatting is frontend-owned and driven by field type. `Make.Field.Currency` renderers add `field.properties.symbol`, defaulting to `￥` when absent, use `field.properties.decimalPlaces`, and honor `field.properties.useGrouping` when the host formatter supports grouping. `Make.Field.Percent` renderers add `%` after finite validation and use `field.properties.decimalPlaces`. API payloads, row data used for editing, and submit values stay numeric or pure numeric strings.
- date and date-range cells render formatted text, ellipsize when clipped, and use the same overflow-only tooltip. `Make.Field.Date` and `Make.Field.DateTime` use `field.properties.format` when present; `Make.Field.DateRange` displays the record value range, while schema `begin` / `end` remains the editor selectable-boundary contract.
- tags are 22px tall, 4px radius, 12px text, 8px horizontal text padding, and use `+N` overflow when space runs out. A visible tag's tooltip appears only when that tag label is ellipsized; a `+N` tag's tooltip contains the full label list joined with `、`
- select tags use `#eef4ff` background and `#1677ff` text, with option labels resolved from field properties before falling back to raw values
- department tags use `#f2f4f7` background and `#344054` text, with the same tag overflow and tooltip behavior as select fields
- user values render a fixed compact avatar plus name text and `+N` overflow. Avatar image and fallback color circle both use the ExpensePoc avatar token: fixed 22px diameter, 11px radius, no layout-driven resizing, and no content-sized background. Fallback avatar background follows the project primary/avatar token, defaulting to a restrained blue when no token exists; only use a hash color palette when the host already has that convention and the colors are muted. Fallback avatar text uses 9px white centered text, 400 weight, and at most two display characters. The renderer may use the last two Chinese characters like ExpensePoc, but it must never shrink the circle, enlarge the font, or draw a small pill/tag background around the text. Visible user names get tooltip only when ellipsized; `+N` gets a tooltip with all names
- file values render 22px image thumbnails for images, otherwise a 22px file-extension block, and `+N` overflow when width cannot fit all attachments. Do not flatten attachments into plain filenames; `+N` tooltip should expose the full attachment name list when names are available
- lookup references render blue clickable text only when entity + `recordID` exist and the reference is not deleted; deleted references render muted with strikethrough. Multiple lookup references render inline with gaps, collapse to `+N` when width runs out, and use overflow-only tooltip for ellipsized labels or collapsed lists

## Initialization Contract

Before constructing `CanvasTableComponent` or rendering a project wrapper around it for a Make schema table:

1. load the runtime schema fields from the host API
2. normalize backend schema variants and de-duplicate schema fields by stable field key
3. build `IColumn[]` from schema field type, width, alignment, ellipsis, and renderer kind
4. prepare a render registry by display group
5. keep a pure value adapter available to every render callback
6. pass `showSN` and `bodyRowHeadSuffixOptions` unless explicitly disabled
7. create/update the table when schema/columns and host size are ready, not when `records.length` or `rows.length` is positive
8. after creating the CanvasTable instance, immediately call `setData(latestRows)`; use `setData([])` when rows are empty so headers and empty state render
9. on object/entity/schema identity change, reset or recreate the canvas-table instance before presenting the new object's table

Do not initialize a Make schema table from `Object.keys(row)` or temporary generic text columns while schema is loading. Show loading/error/empty chrome around the canvas host until schema is ready.

## Suggested Ownership

Use these folders when the host project does not already have a clearer structure:

- `apps/ui/src/lib/make-field-types.ts`: the shared registry for all current Make field types, including `displayGroup`, `renderKind`, default `width`, `align`, multiplicity, and UI capability hints
- `config/`: schema-to-column mapping, width, alignment, `renderKind`, `showEllipsis`
- `renderers/`: canvas shape renderers by display group
- `hooks/`: preloaded display data, for example department candidates
- `types/`: shared display/table contracts
- `lib/`, `adapters/`, or `field-display/`: pure field display normalization

Do not force these exact names into an existing codebase if it already separates responsibilities clearly.

## Display Model

A useful display adapter returns a small object like:

```ts
type FieldDisplayValue = {
  group: "text" | "url" | "number" | "date" | "select" | "user" | "department" | "file" | "lookup" | "unknown";
  kind: string;
  text: string;
  labels: string[];
  empty: boolean;
  href?: string;
  attachments: AttachmentDisplayItem[];
  users: UserDisplayItem[];
  lookupReferences: LookupReferenceItem[];
};
```

The exact type name can change. The important part is that renderers do not parse backend objects directly.

## Supported Field Types

The current backend supports these 18 field types. Treat this list as the current contract, with a safe fallback for unknown future types.

In new Make POC code, this table should be represented in the shared registry instead of being re-created separately in CanvasTable, detail, form, filter, and editor modules.

| Field type | Group | Expected value formats | Display behavior |
| --- | --- | --- | --- |
| `Make.Field.ID` | text | primitive, object fallback | text with ellipsis + overflow-only tooltip |
| `Make.Field.Text` | text | string/number/boolean/object | text with ellipsis + overflow-only tooltip |
| `Make.Field.TextArea` | text | string/object | wider text column, ellipsis + overflow-only tooltip |
| `Make.Field.URL` | url | string or `{ href/url/value, label/name }` | clickable text only for safe hrefs |
| `Make.Field.Number` | number | finite number or finite numeric string; invalid/non-finite is empty | right-aligned ellipsized number text using `field.properties.precision` when present, overflow-only tooltip, never `NaN` |
| `Make.Field.Currency` | number | finite number or pure numeric string; formatted strings are invalid | ellipsized currency text with `field.properties.symbol`, `field.properties.decimalPlaces`, and optional `useGrouping`, default symbol `￥`, right-aligned, overflow-only tooltip, never `NaN` |
| `Make.Field.Percent` | number | finite number or pure numeric string; formatted strings are invalid | ellipsized percent text with `%` and `field.properties.decimalPlaces`, right-aligned, overflow-only tooltip, never `NaN` |
| `Make.Field.Date` | date | parseable date string/value | ellipsized text using `field.properties.format` or host date format, overflow-only tooltip |
| `Make.Field.DateTime` | date | parseable date-time string/value | ellipsized text using `field.properties.format` or host date-time format, overflow-only tooltip |
| `Make.Field.DateRange` | date | `[begin,end]` or `{ begin/end/start/from/to }` | format as `YYYY-MM-DD 至 YYYY-MM-DD` or host date-range text; schema `field.properties.begin` / `end` is not displayed as the value but must be passed to editors; apply ellipsis only when the column clips the rendered text, with overflow-only tooltip |
| `Make.Field.SingleSelect` | select | raw value, option object, one-item array | one select tag; ellipsized tag tooltip only |
| `Make.Field.MultiSelect` | select | array of raw values/option objects | select tag list with `+N`; `+N` tooltip contains full label list |
| `Make.Field.SingleUser` | user | object or backend one-item array | avatar/name renderer; name tooltip only when ellipsized |
| `Make.Field.MultiUser` | user | array of user objects | avatar/name list with `+N`; `+N` tooltip contains full name list |
| `Make.Field.SingleDepartment` | department | object or id/string | department tag; ellipsized tag tooltip only |
| `Make.Field.MultiDepartment` | department | array of objects/ids | department tag list with `+N`; `+N` tooltip contains full department list |
| `Make.Field.File` | file | URL string, JSON string, object, or array | thumbnail/file-extension list with overflow count; `+N` tooltip contains full attachment names |
| `Make.Field.Lookup` | lookup | object/JSON, often `{ entity, field, data }` | extract references from `data`; openable references are blue links, deleted references are muted strikethrough, overflow uses `+N` plus tooltip |

## Value Extraction Rules

Use tolerant extraction. Do not fail the cell because one key is absent.

- generic object label priority: `label`, `name`, `title`, `displayName`, `value`
- numeric values: accept finite numbers directly; for trimmed pure numeric strings, parse to a number first and accept only when `Number.isFinite(parsed)` is true. Treat `null`, `undefined`, blank strings, `NaN`, `Infinity`, formatted strings, and unparseable strings as empty. Do not render `Number(value)` directly. Use `Number.precision` for display precision when the schema provides it.
- currency and percent display may apply symbols, separators, precision, or `%` only after finite validation. Backend/API values for `Make.Field.Currency` and `Make.Field.Percent` must be finite numbers or pure numeric strings; strings already containing currency symbols, percent signs, thousands separators, or display units are data-contract defects and should not be silently normalized as the standard path. Currency formatting uses `symbol`, `decimalPlaces`, and `useGrouping`; percent formatting uses `decimalPlaces`.
- keep percent scale consistent with host metadata or documented backend semantics. Do not multiply or divide percent values by 100 unless the field metadata or project contract explicitly says backend stores fractions.
- select labels: `field.properties.options[]` with `{ value, label }`, fallback to raw value
- user candidate API results: value/id is `userId`, label is `userName`, optional avatar is `avatar`
- user label priority: `name`, `userName`, `displayName`, `label`, `userId`, `id`, `recordID`
- user identity priority: `recordID`, `userId`, `id`; fallback to name for display-only avatar color
- user avatar priority: `avatar`, `avatarM`, `avatarL`, `avatarS`, `avatarOrigin`, `userAvatar`
- user fallback avatar text: derive from the normalized display name, using one or two short display characters. Chinese names may use the last two characters, matching ExpensePoc; non-CJK names use up to two uppercase initials. The full name remains outside the avatar as ellipsized text.
- department candidate API results: value/id is `departmentId`, label is `departmentName`; flatten trees before option display
- department label priority: `name`, `departmentName`, `displayName`, `label`, `departmentId`, `id`, `recordID`
- URL href priority: `href`, `url`, `value`; text priority: `label`, `name`, href
- attachment URL priority: string value, `url`, `fileURL`; allow `http(s)`, absolute app paths, protocol-relative URLs, `data:`, and `blob:` for local previews
- attachment name priority: `name`, `fileName`, filename from URL
- attachment metadata: `uid`, `filePath`, `size`, `fileSizeInBytes`, `type`, optional local `File`
- lookup wrapper: if object or JSON string has `data`, extract labels from `data`; if `data` is empty, show empty
- lookup references: when `data` items contain target entity, `recordID`, display value, and deletion status, normalize those into explicit reference items before rendering. Only clickable references with entity + `recordID` and not-deleted status should trigger detail navigation.

## Renderer Guidance

Keep renderers focused and canvas-only:

- Every text-bearing shape should calculate whether it actually overflows, render ellipsis when it does, and only then set `tooltip`. Do not assign a tooltip just because a value exists.
- `text` / `number` / `date` / unknown: `TextShape`, ellipsis, overflow-only tooltip, muted `-` for empty
- `url`: validate href; render clickable text only for safe `http(s)`, protocol-relative, or absolute app paths; use overflow-only tooltip
- `select` and `department`: tag renderer; reserve room for `+N`; visible tag tooltip only when its label is ellipsized; `+N` tooltip contains the complete label list
- `user`: avatar image if present, otherwise a stable compact color circle plus fallback text; use an actual 22px circle/image, not a text tag or content-sized background. Render the full display name outside the avatar with ellipsis and overflow-only tooltip; use `+N` with full-name tooltip for hidden users
- `file`: image attachments use `ImgShape`; other files use a file icon/extension block; bind click to open safe URL; show `+N` only when width cannot fit all visible items; use the `+N` tooltip for full attachment names instead of flattening the cell to text
- `lookup`: normalize to explicit reference items when possible; render openable references as blue clickable text, deleted references muted with strikethrough, collapsed references as `+N` with full-label tooltip
- clickable lookup text should use shape-level click handlers only for valid reference items; missing `recordID` or deleted references render as plain text

Use package text utilities such as `textEllipsis` and `getTextWidth` when available. Add an estimate fallback so unit tests and non-browser environments do not break.

## Column Defaults

Reasonable starting widths:

- number/currency/percent: 120, right-aligned
- date: 140
- date-time, lookup, multi-select, multi-user, multi-department: 180
- URL and date range: 220
- file: 150, no built-in text ellipsis because custom renderer owns overflow
- text area: 240
- default: 160

These widths are starting points, not a design law. Tune them to the host layout.

## Testing

Add focused tests before or with implementation:

- field type -> display group/kind mapping covers all 18 supported types
- table initialization waits for schema fields and never infers Make columns from row keys
- table initialization gates on schema/columns and real host size, not on `records.length`, `rows.length`, or data totals
- rows arriving before the table instance is ready are applied after creation by calling `setData(latestRows)`
- empty rows / `setData([])` still render table header plus `emptyStateOptions` / 暂无数据 state
- Make schema table defaults include `showSN` and `bodyRowHeadSuffixOptions` unless explicitly disabled
- object switch resets horizontal and vertical scroll instead of reusing the previous object's scrollLeft/scrollTop
- overflow tooltips are default behavior, but only appear when text/tag/user/attachment/lookup content is ellipsized, clipped, or hidden behind `+N`; text-bearing overflow must visibly show ellipsis before tooltip
- number/currency/percent values cover `0`, negative, decimal, pure numeric string, `null`, empty string, non-numeric string, formatted strings, `NaN`, and `Infinity`, and never render `NaN`
- number display tests cover `field.properties.precision`; currency and percent display tests verify that backend values such as `"1000.00"` and `"85.00"` remain pure numeric input values while the frontend renderer adds `Currency.symbol`, `Currency.decimalPlaces`, optional grouping, or `%` plus `Percent.decimalPlaces` according to field type
- date display tests cover `field.properties.format`; date-range editor handoff tests preserve `field.properties.begin` and `field.properties.end`
- backend variants: primitive, object, array, JSON string, empty value
- select option label fallback
- user backend shapes with `name`, `userName`, `recordID`, `userId`, and avatar keys
- user renderer uses a fixed compact avatar: 22px circle/image, 11px radius, 9px fallback text, one or two short display characters, and a separate ellipsized user-name text. It must not render oversized Chinese characters, shrink the avatar background around text, or replace the circle with a pill/tag.
- department backend shapes with `name`, `departmentName`, `recordID`, and tree/candidate data when relevant
- file URL/object/JSON normalization and image vs file rendering
- lookup `{ entity, field, data }` object and JSON-string wrappers
- renderer overflow: tags, users, attachments, and lookup references keep a visible `+N` and expose the complete hidden list via tooltip
- empty values render `-` without throwing

Mock canvas-table shapes in unit tests when the host test environment cannot draw real canvas.

## Pitfalls

- Do not parse backend values inside every column render callback. Normalize once through the display adapter.
- Do not initialize Make schema tables before schema fields are available.
- Do not infer Make columns from returned row object keys.
- Do not gate CanvasTable creation on row count. Empty rows are valid and must still render headers plus the empty state.
- Do not drop rows that arrive before the table instance is ready. Reapply the latest rows with `setData(latestRows)` after instance creation.
- Do not carry scroll position or object-scoped interaction state across different object/entity/schema keys.
- Do not branch generic display behavior by business field name. Field names are only for explicit business roles, such as a claim number link.
- Do not let custom renderers fetch data per cell.
- Do not call user or department candidate APIs inside canvas renderers. Load candidates at the page/table-controller layer and pass normalized options into editors or display adapters.
- Do not call `Number(value).toLocaleString()` or similar formatting without first checking `Number.isFinite`.
- Do not treat formatted strings containing currency symbols, percent signs, thousands separators, or display units as valid backend values. The normal API contract for `Currency` and `Percent` is finite number or pure numeric string; display formatting is added only by frontend renderers.
- Do not drop `field.properties` when building CanvasTable columns. Losing `precision`, `format`, `decimalPlaces`, `symbol`, `begin`, `end`, or `maxCount` makes table display and cell editors diverge from Drawer forms.
- Do not flatten select, user, department, file, or lookup values into plain text when the schema type supports richer default rendering.
- Do not show tooltip for every cell unconditionally. Tooltip is for visible ellipsis, unavoidable non-text clipping, or `+N` hidden values.
- Do not render raw JSON wrapper text when a label can be extracted.
- Do not make this display adapter responsible for edit/submit payload conversion.
- Do not crash on unknown field types. Use safe generic text fallback and log only at a boundary if needed.
