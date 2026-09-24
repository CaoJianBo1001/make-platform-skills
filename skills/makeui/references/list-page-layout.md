# List page layout

## Contents

- [Default list page](#default-list-page)
- [Phone list override](#phone-list-override)
- [Recommended structure](#recommended-structure)
- [Optional actions](#optional-actions)
- [Table boundary](#table-boundary)
- [Density](#density)

## Default list page

Default desktop/tablet Make list pages are simple object lists. Phone uses the override below.

They must live inside the Make App shell. Do not generate a list page that owns the app title, user identity, and object navigation in the page body. Those belong to `app-shell-layout.md`.

Default object-list scaffold:

1. App shell
2. Left sidebar with module/object navigation
3. Workspace header with selected object name on the left and current user shown on the right as a 32px circular avatar plus plain display name
4. Local page toolbar
5. CanvasTable container

The default layout should match the platform dense list-screen baseline:

- left app sidebar; background color follows the project theme
- flat workspace header with title only
- local toolbar directly under the header
- search/filter/refresh on the toolbar left
- create/new on the toolbar right
- canvas-table directly under the toolbar
- no separate object-title card, count summary card, schema-source card, or descriptive band above the table

Sidebar and workspace header labels are terse by default:

- sidebar object items show only the object/module label, with no subtitle or description line
- workspace header shows only the current object/module title, with no subtitle or helper line
- schema descriptions, source summaries, and "overview" copy belong in an explicit detail or help surface only when requested

Do not add pagination by default. Pagination is an explicit user requirement, not a default list-page behavior.

Unless the user asks for pagination, do not add:

- visible pagination controls
- page-size selectors
- page state
- page query params
- total-count handling
- paginated fetch logic

Do not create a view switcher. A default list page includes only:

- search
- refresh
- create/new
- table area

This section is the desktop/tablet default. Phone list pages use the package-backed card presentation from `mobile-defaults.md` for both read-only and writable resources and must not render CanvasTable. Both presentations reuse metadata, permissions, queries and request caches. Unmounting CanvasTable clears its action selection through [make-app-actions](../../make-app-actions/) and its `selection-and-operation-snapshot.md` reference; returning to desktop starts with an empty selection, not a replayed target. Do not mount the desktop CanvasTable and phone list simultaneously merely to hide one with CSS.

## Phone list override

The standard phone list is a separate View composition over the shared business Controller:

1. phone page header
2. phone-local compact toolbar with search and, only when advanced filtering is enabled or requested, a filter trigger
3. vertically scrolling record cards
4. in-flow list end state
5. permission-gated floating create action

Do not pass the desktop `listToolbar`, `listContent`, CanvasTable host, or desktop action-bar fragment directly into the phone shell and rely on responsive CSS. The phone View owns its layout and card rendering; the shared Controller owns records, query state, permissions, requests, routes, and mutations.

Phone defaults:

- card body click opens the full-screen detail task route and does not create record selection
- writable cards load [`make-app-actions`](../../make-app-actions/) and use its `mobile-card-actions.md` reference for clicked-record edit/delete permission and precheck behavior
- no CanvasTable, record checkbox, select-all, selection action bar, batch edit, or other batch operation
- no group or sort trigger, even when the desktop/tablet View already supports those capabilities
- search stays in one compact phone toolbar; when advanced filtering is enabled or requested, place its filter trigger beside search instead of stacking desktop buttons vertically. Use medium visual controls (`size="middle"`, the library's default medium size, or equivalent) with matching visible heights, not CSS-enlarged small controls, while retaining at least 44px touch targets. A `search-only` list has no filter trigger.
- pull-to-refresh starts only at the top of the list's own scroll region and preserves applied search/filter context; do not show a separate refresh button or refresh icon on the phone toolbar, even if desktop/tablet has one
- when advanced filtering is enabled or requested, the filter trigger opens the package panel in a host mobile Sheet with `layout="mobile"`; do not reuse the desktop Popover trigger/content fragment
- create uses the permission-gated floating action and full-screen new task route

Phone card visual contract:

- 手机卡片使用扁平白底、无边框、无阴影和无大圆角；相邻卡片由 8–12px 的页面灰底间隔分组，不再嵌套外层卡片。
- 内容按标题、状态、2–3 个已授权摘要字段的顺序展示；字段不足时不补占位，字段过多时也不把详情页搬进卡片。
- 编辑／删除入口视觉保持紧凑，但每个入口提供至少 44px 触控目标。没有可用单条操作时不渲染空的操作区、分隔线或“暂无可用操作”。
- 卡片字段、状态和动作颜色使用主题 token；对象语义不明确时只使用统一保底图标，不根据字段名硬编码颜色。

An explicit custom product requirement may replace this phone presentation. Do not treat an existing desktop toolbar or project-level “all record lists use CanvasTable” rule as a valid reason to override the phone default silently.

## Recommended structure

On desktop/tablet, use this order:

1. local page toolbar
2. table container

Add pagination below or inside the table container only when the user explicitly requests it.

Do not add an intermediate card or panel that repeats the object title and record count before the toolbar/table. Record count can appear only when the host table component already supports it in a compact table status area or when the user asks for it.

Desktop/tablet toolbar placement:

- search input on the left
- optional filter next to search only when requested or already established by the project
- optional group after filter and before sort when requested; route behavior to `make-app-group`
- optional sort after group and before refresh when requested; route behavior to `make-app-sort`
- refresh near the search input or in the secondary action group
- create/new as the rightmost primary action
- refresh must sit in this local toolbar above the table; do not place it in the global header, object title header, table header row, canvas-table header area, or column header area

The table container fills remaining height. The list page itself must not scroll.

The local toolbar sits below the workspace header, not inside the header. Keep page actions out of the global header unless there is no local toolbar.

## Optional actions

On desktop/tablet, only add these when the user explicitly asks:

- pagination
- filter
- group
- sort
- column settings
- import
- export

Recommended placement:

- filter: near search, usually immediately after search or refresh
- group: after filter and before sort; use `make-app-group` for the component, Preset, record-groups, groupFilter, drag, and grouped table flow
- sort: after group and before refresh; use `make-app-sort` for the component, Preset, records, drag, and header linkage
- column settings: near the table's right side or after sort/group
- import/export: right action group, usually left of create/new or inside a more-actions menu
- writable Make record actions: use `make-app-actions`; its standard selection bar
  appears only after rows are selected and stays centered near the bottom of the
  table viewport, above summary/scroll affordances without changing table geometry
- non-Make custom batch actions: follow the host's established placement; do not
  override the Make action-bar contract
- pagination: bottom-right or bottom-center inside the list/table container; do not reserve pagination space when pagination is not requested

Do not add optional actions as decorative placeholders. Phone does not surface group, sort, column settings, import, export, record selection, or batch actions in the standard presentation.

## Table boundary

On desktop/tablet, use `@qfei-design/canvas-table` through `canvas-table-integration` for table implementation. This table boundary does not apply to the phone card View.

This skill only specifies:

- where the table sits
- how much space it gets
- how toolbar and optional pagination wrap around it
- where optional controls should appear

Do not use the selected UI library's Table component or a hand-written HTML table for Make record lists.

For Make object lists, table columns and headers come from host-provided object/field metadata:

- pass normalized UI field metadata to `canvas-table-integration` to build columns
- do not hard-code static canvas-table columns as the default for metadata-driven object lists
- do not construct a table from raw row keys as a fallback

If field metadata is loading, missing, or invalid, keep the object shell visible and show a controlled loading/error/retry state above or around the table container. `makeui` defines the UI state placement only; data fetching and metadata normalization belong outside this skill.

If the user asks for cell editing, still use `canvas-table-integration`; do not design a separate DOM-table editor system in `makeui`.

The table region should have:

- stable height
- `width: 100%`
- `height: 100%`
- `flex: 1`
- `min-height: 0`
- `min-width: 0`
- `overflow: hidden` around the canvas table host
- internal table scroll instead of page scroll

Treat page-level scrolling on desktop/tablet object-list pages as a defect. If records overflow vertically or horizontally, the CanvasTable/table region owns that scroll. On phones, the card-list region owns vertical scrolling. If the left object navigation overflows, the sidebar navigation area owns that scroll. Do not fix overflow by allowing `body`, app root, shell, workspace, or list-page containers to scroll.

CanvasTable sizing requirements:

- the list content region, table wrapper, and CanvasTable host all fill the available width; do not leave a right-side blank area because the table was sized only to the sum of column widths
- do not set fixed table widths, fixed viewport widths, or arbitrary max widths for default object lists
- if schema-derived columns are narrower than the container, use public canvas-table integration patterns to stretch/distribute remaining width or add an intentional flexible display area; do not let the visible table stop mid-page
- table height is dynamic: it fills the remaining content height below the workspace header and toolbar
- prefer a flex height chain; if `calc()` is unavoidable, subtract the actual header, toolbar, padding, and border sizes instead of using a guessed constant
- when the canvas-table instance needs explicit dimensions, observe the host container resize and update the table through documented public APIs

Default desktop/tablet CanvasTable row behavior for every table unless the user explicitly says the table does not need a detail entry:

- enable `showSN` row sequence numbers by default
- enable `bodyRowHeadSuffixOptions` with an open-detail icon by default
- normal state shows only the sequence number; row hover or keyboard focus reveals the detail icon
- clicking the open-detail icon opens the row detail Drawer or the project's established detail surface
- do not make the whole row a default detail trigger unless the user or existing project pattern requires it
- writable Make record lists enable multiple selection by default through
  `make-app-actions`; opt out only for an explicitly rejected action workflow or
  an object/product that is strictly read-only, not merely for a user with no
  available actions
- non-Make and strictly read-only tables keep row selection opt-in

## Density

Object list pages may be dense. Prefer compact, scan-friendly controls over large hero sections or marketing-style layouts.

Avoid:

- large page hero blocks
- nested cards around the table
- view tabs unless requested
- page-level vertical scrolling for normal list browsing
- body/app-root/shell scrolling caused by long sidebar navigation or many table rows
