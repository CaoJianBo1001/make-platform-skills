# Route-based form and detail pages

## When to use

Use route-based pages only when the user explicitly asks for:

- independent page
- route page
- page navigation
- page jump
- standalone create/edit/detail screen
- full-page form/detail

Otherwise use the default Drawer mode.

## Object route model

Object navigation should use React Router dynamic params.

Preferred default pattern:

```text
/objects/:objectKey
```

When create/edit/detail must be URL-addressable, use dynamic child routes:

```text
/objects/:objectKey/new
/objects/:objectKey/:recordId
/objects/:objectKey/:recordId/edit
```

Presentation is still right-side Drawer by default for create/edit/detail. URL-addressable Drawer state does not change placement; keep `placement="right"` or `side="right"`. Only render these child routes as full pages when the user explicitly asks for page-route mode.

Do not generate a separate hard-coded route per object such as `/customers`, `/orders`, and `/opportunities` unless the host project already uses that convention or the user explicitly requests it.

## Create / edit page

Recommended structure:

1. page header: back action, title, secondary metadata if needed
2. action area: cancel, save, submit, or other requested actions
3. form body: sectioned form content

The content area may scroll inside the app content region. Global header and sidebar remain fixed.

Form layout:

- two-column desktop grid for common fields
- do not render every field as full-width one-column rows on desktop unless the user explicitly asks
- full-width rows for `TextArea`, long text, URL/link fields, `File`, `Lookup`, relation/association selectors, descriptions, and rich controls
- normal fields such as text, number, date, date-time, date range, select, user, and department occupy one column by default
- derive fields and control types from host-provided field metadata
- create routes render the host permission layer's authorized `createFields` / create field set; edit routes render visible fields and apply the editable subset. Do not substitute visible fields when the create set is missing or empty.
- required validation applies only to authorized fields rendered in the current mode
- when creation is allowed but there are no creatable fields, show `暂无可新建字段`, disable submit, and preserve back/navigation actions
- use type-appropriate controls; date, select, user, department, file, and lookup fields must not silently become plain text inputs
- custom form field controls must follow the host-form controlled field contract from `component-usage.md`; forward `value/onChange/onBlur/id/disabled` through user, department, lookup, select, date, file, and relation adapters so the visual selection matches the submitted form value
- user and department selectors use the host-provided candidate source and must include search/loading/empty/error UI states; use the canonical identity/label and generated-app transport contract in `component-usage.md`
- create pages must omit attachment upload fields when upload requires a saved record identity; edit pages may show attachments only when the persisted record identity exists
- one-column layout on small screens
- section headings rather than deeply nested cards

### Zero-field page state

Apply the same zero-field empty state as Drawer create/edit/detail surfaces. When the mode-specific renderable field collection is empty, render only the centered empty state in the available route content area; do not render a field grid, form/detail panel, section panel/card, placeholder `Form.Item`, border, shadow, or fixed minimum-height field wrapper. A zero editable set does not trigger this state while visible read-only fields remain. Create uses `暂无可新建字段` and disables submit; edit/detail use the host equivalent of `暂无可展示字段` while preserving navigation and non-mutating actions.

## Detail page

Recommended structure:

1. summary header: record title, status, key metadata, and main actions
2. detail body: sectioned read-only information
3. related sections: related records and attachments when requested

Do not add activity, dynamic records, timeline, comments, or operation logs by default. Add them only when the user explicitly asks.

The detail content can scroll inside the content region. Do not introduce a second global shell.

Detail layout:

- use a two-column label/value grid for common fields on desktop
- make `TextArea`, long text, URL/link-rich values, file/attachment values, lookup/relation values, and rich custom values span the full row
- render values through the same field-type display adapter used by Detail Drawers. Do not display raw objects, arrays, or JSON wrapper strings in route detail pages.
- `Date`, `DateTime`, and `DateRange` values must use formatted display text. `DateRange` values such as `[begin, end]` or `{ begin, end }` display as `YYYY-MM-DD 至 YYYY-MM-DD`.
- select, user, department, file, and lookup values use their type-specific read-only display renderers; empty values display `-`.
- route detail titles use the record/object title with real overflow handling only. Do not allocate a tiny title slot that truncates otherwise displayable titles.
- collapse to one column on small screens
- when the visible renderable field collection is empty, apply the zero-field page state above instead of rendering an empty detail grid, panel, or card

## Navigation

Use React Router for route-based create/edit/detail pages and dynamic object navigation.

Keep routes predictable and shallow. Do not invent route semantics beyond what the user requested or what the host project already uses.
