# column patterns

Use this file when shaping consumer-facing columns.

## 1. Start simple

Prefer plain columns first:

```ts
const columns: IColumn[] = [
  { key: 'id', title: 'ID', width: 80, align: 'center', fixed: 'left' },
  { key: 'name', title: '名称', width: 180, showEllipsis: true },
  { key: 'status', title: '状态', width: 120, align: 'center' },
]
```

Use this first unless the page clearly needs custom drawing. For Make schema-driven tables, complex field types make custom drawing necessary by default; use Track C and `make-field-display-patterns.md`.

## 2. Alignment patterns

### Left-aligned text

Good for:

- names
- titles
- departments
- descriptions

```ts
{ key: 'title', title: '标题', width: 220, align: 'left', headerAlign: 'left' }
```

### Center-aligned text

Good for:

- status
- owner
- small categorical fields

```ts
{ key: 'status', title: '状态', width: 120, align: 'center', headerAlign: 'center' }
```

### Right-aligned text

Good for:

- amount
- count
- money
- numeric metrics

```ts
{ key: 'amount', title: '金额', width: 120, align: 'right', headerAlign: 'right' }
```

## 3. Fixed-column patterns

Use `fixed: 'left'` sparingly.

Good candidates:

- id / code
- primary name
- the first business identity field

Avoid fixing too many columns in first-pass integrations.

## 4. Long-text patterns

Use `showEllipsis` for:

- titles
- descriptions
- long names
- business identifiers that should not break layout

```ts
{ key: 'description', title: '说明', width: 260, showEllipsis: true }
```

## 5. Keep formatting close to the display boundary

For display-only columns, formatting before `setData(...)` can keep column definitions simple:

```ts
const formattedRows = rows.map((row) => ({
  ...row,
  submitDate: formatDateTime(row.submitDate),
  status: formatStatus(row.status),
}))
```

For editable number-like fields, keep row and submit values numeric, then format in the table `render` function or editor formatter/parser. Do not turn editable numeric row data into a currency string before it reaches the editor.

For display-only number, currency, and percent columns, accept backend values only as finite numbers or pure numeric strings, then format only after a finite-number check. If parsing fails, render the empty placeholder instead of `NaN`, `Infinity`, or exception text.

Currency and percent symbols are frontend display concerns. `Make.Field.Currency` renderers add the field/schema currency symbol, defaulting to `￥` when the host does not provide one. `Make.Field.Percent` renderers add `%`. Do not put these symbols, thousands separators, or formatted text into row data, editor values, submit values, or API payloads.

## 6. Use `render` only when necessary

Use `render` when you need:

- clickable cell content
- custom shapes
- richer visual hints than plain text

Do not use `render` for every column by default.

Exception: for Make schema-driven business tables, use a render registry by display group so select, user, department, file, lookup, URL, and rich empty/overflow states match the default Make field-display baseline. Text, number, and date groups may still share a simple text renderer.

## 7. Header-level customization

For non-Make tables, use these only when the page truly needs them:

- `headerRender`
- `prefixRender`
- `suffixRender`

Good first-pass uses:

- a small filter icon
- a sort hint icon
- a lightweight header badge

Do not turn headers into mini-apps in first-pass integrations.

For desktop/tablet **Make schema-driven field columns**, `prefixRender` is the default field-type icon placement, not an optional header embellishment. Use the field-type mapping and phone exclusion in [makeui's field-type icon contract](../../makeui/references/field-type-icons.md). Return an SVG data URL as the documented `{ icon: svgDataUrl }` prefix result, using Lucide by default or the user's explicitly selected alternative icon library. The validated baseline generates a 16px SVG that CanvasTable 1.3.1 displays at 14px with its built-in 8px gap before the header name; set the SVG stroke to the header text color and cache by type and color. Do not add another gap in the host. Apply the same schema-to-column adapter to ordinary and grouped tables. Keep `suffixRender` free for existing filter/sort menus; selection, sequence, and action columns have no field-type icon.

When `suffixRender` opens a host popup such as a sort/filter menu:

- use `displayMode: "hover"` for inactive lightweight icons, and switch only the active column to always-visible while its popup is open
- position the host popup from the clicked header cell and event; `cell.pointByCanvas` is already canvas-relative in current public types, so do not subtract horizontal scroll again unless the installed package docs say otherwise
- close the popup on table `scroll:change`, because a detached DOM popup will not automatically follow the scrolled header cell
- after changing active suffix state, refresh only header cells when the installed package exposes that public method; do not call `refreshCanvas()` or `scrollTo()` just to repaint header suffix icons, because full refreshes may reset scroll or disturb table state
- test horizontal-scroll positioning, active/inactive `displayMode`, outside click close, and scroll close behavior

## 8. Meta-driven columns

When upstream uses JSON meta:

- convert meta to `IColumn[]`
- resolve renderers through a registry
- do not pass raw meta into runtime props

Treat meta adaptation as a business/middle-layer responsibility.
If the meta is Make schema field metadata, use Track C defaults: field type -> display group/kind, width/alignment/ellipsis, pure value adapter, and renderer registry.
