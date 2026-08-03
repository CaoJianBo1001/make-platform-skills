# Drawer layout

## Contents

- [Default mode](#default-mode)
- [Header actions](#header-actions)
- [Create / edit Drawer](#create--edit-drawer)
- [Detail Drawer](#detail-drawer)
- [Stacked Drawers](#stacked-drawers)
- [Drawer scrolling](#drawer-scrolling)

## Default mode

Create, edit, and detail UIs use a right-side panel surface by default. For generated Make App object create/edit/detail, this is a hard layout rule unless the user explicitly requests a different surface.

- surface: right-side panel; do not require a concrete component named `Drawer`
- implementation mapping: shadcn/ui uses `Sheet` with `side="right"` by default
- if stacked panels, fullscreen mode, or custom mask behavior exceed the stock `Sheet` API, build a project-local `SidePanel` wrapper from shadcn/Radix primitives while preserving the same right-side behavior and shadcn visual tokens
- default width: `60%`
- small screens: may use `100%`, but the surface still enters from the right
- mask closable: enabled by default; clicking the mask or blank area closes the current surface
- header action area contains close and primary/secondary actions
- no fixed footer by default
- body scrolls inside the side-panel shell

Do not use bottom Drawer/Sheet, mobile bottom sheet, centered Modal/Dialog, or page-level replacement for object create/edit/detail unless the user explicitly requests that different presentation.

Mask click uses the same close path as the header close control. If a form has an explicit unsaved-change guard, apply that same guard to mask close instead of silently ignoring the mask click.

Treat these as Make UI defaults. For Make object create/edit/detail, right-side placement is not overridden by a generic existing bottom-sheet pattern; use a different surface only when the user explicitly asks for it or the task is not an object CRUD Drawer.

Use route pages only when the user explicitly asks for an independent page, route, navigation, page jump, or standalone screen.

Right-side panel presentation can still be driven by dynamic child routes when URL-addressable create/edit/detail state is required. In that case, keep the side-panel UI and use route params for object and record identity.

## Header actions

Use a compact header layout:

- left title area: fullscreen toggle when supported, then mode tag or record status, then title
- right action area: contextual actions first, then one close control as the final far-right item
- detail actions usually include edit/delete or other requested record actions before the close control
- create/edit actions usually include save/submit and the final close control; do not add a separate cancel button when it only duplicates close
- keep button spacing compact
- avoid decorative icons on text actions; reserve icons for compact controls such as fullscreen, exit fullscreen, and close
- do not place a close icon/button in the left title area
- do not render duplicate close controls, such as a left `X` plus a right `关闭` button
- close should be icon-only by default, with accessible name/title `关闭`; avoid visible `关闭` text unless an existing project pattern explicitly requires text buttons
- title text must be readable within the available header space. Give the title container `min-width: 0` plus a flexible width, and only apply ellipsis after real overflow; keep the full title available through `title`/tooltip. Do not shrink the title slot so otherwise displayable titles are truncated.

Use `lucide-react` for fullscreen controls and the project-standard close control for closing.

If fullscreen is not implemented or not useful for a simple Drawer, keep a normal close control in the header.

## Create / edit Drawer

Recommended structure:

1. Side-panel header: left fullscreen toggle plus mode/title; right save/submit and final icon-only close
2. Side-panel body: form content

Form layout:

- group fields into sections
- create/edit forms use a dedicated modifier class or style scope when their visual treatment differs from detail Drawers
- default to vertical labels in a two-column grid for metadata-driven forms, because field labels may be long or unpredictable
- horizontal label/value alignment remains acceptable when labels are short, stable, or already established by the project
- use a subtle neutral side-panel body with one lightweight white form panel or section panels; avoid visually heavy cards and nested cards
- keep form panels compact: moderate padding, 6-8px radius, thin neutral border, and low shadow at most
- common fields use a two-column grid on desktop; do not render every field as full-width one-column rows unless the user explicitly asks
- long text, descriptions, URL/link fields, attachments, lookup/relation controls, and rich content span full width
- collapse to one column on small screens
- show form-level save errors as a compact status/alert surface above the first form panel
- keep control height and radius consistent, for example 36px controls with 6-8px radius unless the selected library's density tokens require another value

Unless the user or existing project asks otherwise, use the platform create/edit side-panel as the default visual baseline:

- right-side surface, width `60%`, fullscreen toggle can expand to `100%`
- vertical labels in the form layout; do not prescribe library-specific form props such as `layout` or `colon` unless the selected library and host project already use them
- header badge shows mode such as `新建` or `编辑`; right side contains primary save and final close
- one white form panel for normal writable fields, and a second section panel for relation/association fields when needed
- panel padding around `16px`, thin neutral border, 8px radius, low shadow at most
- grid `repeat(2, minmax(0, 1fr))` with roughly `10px 18px` gaps
- field item margin around `10px`, label padding around `6px`, 36px controls, and textarea min-height around `96px`
- normal metadata-driven fields occupy one grid column by default
- full-span rows only for wide controls: `Make.Field.TextArea`, URL/link fields, `Make.Field.File`, `Make.Field.Lookup`, relation/association selectors, long text, attachment-heavy values, or otherwise wide controls
- body scrolls inside the side-panel; the page behind it does not scroll

Default create/edit field span mapping:

| Field type / group | Desktop span |
| --- | --- |
| `Text`, `Number`, `Currency`, `Percent`, `Date`, `DateTime`, `DateRange`, `SingleSelect`, `MultiSelect`, `SingleUser`, `MultiUser`, `SingleDepartment`, `MultiDepartment` | one column; two fields per row |
| `TextArea`, long text, URL/link, `File`, `Lookup`, relation/association selector, rich custom control | full row |
| `ID`, generated, readonly-only fields | usually omit from create/edit; if shown in edit, one column unless value is long |

Field-metadata-driven Make forms:

- consume host-provided field metadata before rendering create/edit side-panel fields
- derive field labels, readonly/editable presentation, and control choice from field metadata when available
- use the field component mapping in `component-usage.md`
- use the host-form controlled field contract in `component-usage.md` for every custom form field control; user, department, lookup, select, date, file, and relation selectors must forward `value/onChange/onBlur/id/disabled` so the displayed value and form store stay synchronized
- use date pickers for date fields, searchable selectors for user/department fields when candidate data is available, select controls for select fields, mode-safe attachment controls for file fields, and read-only/association displays for lookup fields
- do not silently fall back to a bare text `Input` for `Date`, `User`, `Department`, `Select`, `File`, or `Lookup` fields
- user and department selectors show search, loading, empty, error, and retry UI states around the host-provided candidate source; use the canonical candidate contract in `component-usage.md`
- user selector options use `userId` as value and `userName` as label; department selector options use `departmentId` as value and `departmentName` as label; merge current record values into options so detail/edit views display labels before async candidates load
- create mode must omit `Make.Field.File` upload controls when upload requires a saved record identity
- edit mode may render `Make.Field.File` controls only when a stable persisted record identity exists
- detail mode may display file fields as attachments, thumbnails, or file links and may offer explicit follow-up actions when supported
- if field metadata or candidate data is missing, state the UI dependency and render an explicit unsupported/degraded UI state only with user confirmation

Action placement:

- save / submit as the primary action
- add a cancel action only when it performs distinct behavior beyond closing, such as an explicit discard flow required by the product
- destructive actions should not be primary
- fixed footer is optional and should be added only when the user or existing project pattern requires persistent bottom actions

Do not define business validation rules here. Only provide visual error, loading, and saving states.

## Detail Drawer

Recommended structure:

1. Side-panel header: left fullscreen toggle plus record title or generic detail title; right contextual actions and final icon-only close
2. detail body: compact read-only information grid
3. related sections: related data and attachments when supported

Read-only information can use:

- description list
- information grid
- sectioned cards or panels

Use horizontal label/value alignment by default on desktop:

- two-column grid for common fields
- user fields render read-only avatar/name values; department fields render read-only tag/name values
- detail identity fields should use labels from the record or host candidate source and should not degrade to raw ids or disabled text inputs without an explicit dependency/error state
- every value is rendered through a field-type display adapter before JSX. Detail components must not display raw arrays, objects, or JSON wrappers directly.
- date fields display formatted dates; `DateRange` values such as `[begin, end]` or `{ begin, end }` display as `YYYY-MM-DD 至 YYYY-MM-DD`, not as `{"begin":...,"end":...}`.
- select, user, department, file, and lookup fields use their read-only display renderers from `component-usage.md`; unknown fields fall back to safe text, and empty values display `-`.
- each item has a stable label column and a flexible value column
- subtle bottom borders are preferred over boxed cards for dense record detail
- long text, `TextArea`, file, lookup/relation, URL/link-rich, attachment-heavy, or rich values span the full width
- labels use subdued color and consistent width; values use stronger text color and wrap safely

Default detail field span mapping:

| Field type / group | Desktop span |
| --- | --- |
| `ID`, `Text`, `Number`, `Currency`, `Percent`, `Date`, `DateTime`, `DateRange`, `SingleSelect`, `MultiSelect`, `SingleUser`, `MultiUser`, `SingleDepartment`, `MultiDepartment` | one column; two fields per row |
| `TextArea`, long text, URL/link-rich values, `File`, `Lookup`, relation/association values, attachment-heavy values, rich custom values | full row |

Detail side panels should not have a footer unless the user explicitly asks for persistent bottom actions.

Edit and detail side panels should look related but not identical: edit uses vertical form labels in panel sections, while detail uses compact label/value rows. Do not render detail fields as a loose unstyled list.

If a related-data section is tabular, route the table implementation to `@qfei-design/canvas-table` through `canvas-table-integration`.

Non-mutating Detail Drawer interactions are UI state only. Opening/closing detail,
fullscreen toggles, tab switches, header buttons, copy/link actions, and other
read-only controls must not refresh or reload the object list, grouped
`record-groups`, records, or table data. Trigger list/group/table refresh only
after a successful data mutation such as save, delete, relation update, or an
explicit user refresh command.

Do not add activity, dynamic records, timeline, comments, or operation logs by default. Add them only when the user explicitly asks.

## Stacked Drawers

When a user opens edit from detail, keep the detail Drawer mounted underneath and open the edit Drawer above it.

- closing the edit Drawer returns to the detail Drawer
- closing the detail Drawer returns to the list page
- clicking the mask or blank area must close only the topmost Drawer
- if the implementation cannot guarantee topmost-only mask close, fix the Drawer stack close handler; do not change the default behavior to mask-close disabled
- use increasing z-index values or a Drawer stack manager so layers do not collapse together
- avoid shared state handlers that close all active Drawers at once

When a user opens a related record from a Lookup value, use the same Drawer stack model:

- only make Lookup values clickable when the display item has a target object key and saved record identity, and is not marked deleted
- append the related detail Drawer above the source detail Drawer
- close only the topmost Drawer
- bind edit/delete/detail actions to the Drawer instance's own entity and record id, not to a shared "current detail" singleton
- guard async loads with the source Drawer identity so a stale response cannot reopen a closed Drawer

## Drawer scrolling

The side-panel shell remains fixed. The body scrolls.

Do not let the underlying page scroll when the side panel is open.
