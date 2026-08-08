# Track workflows and checklists

Use this reference after selecting base Track A or Track C from `SKILL.md`. Add
Track B as an enhancement layer when cell editing is in scope.

## Contents

- [Choose a display base first](#choose-a-display-base-first)
- [Track B pragmatic host-edit guidance](#track-b-pragmatic-host-edit-guidance)
- [Track A workflow](#track-a-workflow)
- [Track B workflow](#track-b-workflow)
- [Track C workflow](#track-c-workflow)
- [Capability checklists](#capability-checklists)
- [What to avoid](#what-to-avoid)
- [Deferred topics](#deferred-topics)
- [Required output](#required-output)

## Choose a display base first

Choose Track A for non-Make columns or Track C for Make schema fields before
coding. Track B may be layered onto either base and never replaces it.

### Track A / `basic local table`

Use when the page already has all rows in client memory and is still using `@qfei-design/canvas-table`.

Start from the basic-local-table recipe/example discovered through the installed
package's `package.ai.json.readOrder` documentation.

### Track A / `virtual remote table`

Use only when the user explicitly asks for pagination, virtual loading, or paginated backend integration, and still use `@qfei-design/canvas-table`. Do not choose this path just because the page contains a table.

Start from the virtual-remote-table recipe/example discovered through the
installed package documentation, then read `references/virtual-table-patterns.md`.

### Track A / `meta -> columns`

Use when column configuration comes from JSON/meta instead of handwritten `IColumn[]`.

Treat this as a supporting path, not the primary first-pass path, unless the page is clearly meta-driven.
If the JSON/meta is Make schema field metadata, use Track C as the display base and treat column conversion as one step inside the Make field-display workflow.

### Track B / `host cell-edit architecture`

Use when the page must edit business fields in-place or through editor overlays.
For Make schema fields, complete the Track C display workflow first and then add
Track B; keep Track C normalization, renderers, and registry-derived display
metadata intact.

Before changing code, identify:

- framework: React or Vue
- existing component library
- existing business field editors
- existing upload / date / select / people / department widgets
- field metadata shape: editability, required, field type, precision, format, multi/single mode, attachment value structure
- stable backend identity: the host backend's system id or equivalent row key for persisted rows and attachment upload
- whether the host Drawer form already maps Make field types; reuse that mapping so table cell editors and Drawer forms submit the same value shapes

Do not invent a new editor system if the project already has one.

## Track B pragmatic host-edit guidance

Use these defaults for first-pass editable-list work. Adapt them to the host project's real component system, save model, and backend contract.

1. Declare `editType: "custom"` on target editable columns; do not assume `customEdit` alone is enough.
2. Start with the smallest working editor bridge before abstracting the editor container.
3. Prefer page-level draft state over table-internal edit state. The page owns draft values, dirty rows, save/discard actions, and unsaved-change guards.
4. Use `edit:end` as the stable post-commit boundary. Do not hide all data mutation inside the table wrapper.
5. Prefer canvas-table native row coloring such as `setRowColors(rowKeys, color)` for dirty-row highlighting.
6. Define unsaved-change behavior for context changes such as tab switch, query reset, open detail, or create new.
7. Keep text, number, select, date, and attachment metadata as reusable editor patterns, not fixed component choices.
8. Use `editApplyMode: "controlled"` when a business save or draft layer owns writes; after save accepts a commit, backfill with `setCellData(...)` or `setRowData(...)`.
9. For popup editors, return `relatedElements()`, use `overlayOptions` when overflow is needed, and prefer object `autoClose`.
10. Pointer users enter Make cell editing by double-clicking the editable cell; popup editors must open immediately when edit mode starts and must not require a third click.
11. Before mounting/opening the real editor or popup, scroll a partially hidden target cell fully into the visible body viewport, then calculate editor geometry from the post-scroll cell position.
12. Inline editors must fill the active cell and avoid nested bordered wrappers, cards, form items, margin, and outer padding.
13. Keep table initialization stable during draft updates; do not recreate the table just because merged rows or callbacks changed.
14. Preserve current table scroll after edit commit/cancel/rollback. Same-object saves and row refreshes must not reset the table to the left/top.
15. Restore focus to the current canvas only inside the canvas edit lifecycle; never steal focus from host modal, drawer, dialog, popover, or form interactions.
16. Guarantee usable canvas height before initialization; padding-only containers are not enough.
17. Date editors must resolve typed input before OK commits.
18. Use stable backend identity for persisted editable rows; keep mutable business codes out of technical row keys.
19. Attachment editors are host popups with data-source upload boundaries; real upload/delete/download proxy logic belongs to the host data-source or Service API adapter.

## Track A workflow

1. Check whether the package is installed.
2. If missing, install it with the lockfile-based package-manager rule in `SKILL.md`.
3. Read the package docs in the required order.
4. Choose the local or virtual Track A variant.
5. Open the corresponding recipe and minimal example.
6. Adapt that example to the current project with the smallest reasonable diff.
7. Preserve the local framework and state-management patterns.
8. Add only the capabilities the user explicitly needs now. Pagination is not a default table capability.
9. Avoid unrelated refactors.
10. Run at least one concrete verification step if the environment allows it.

## Track B workflow

1. Check whether the package is installed and read package editing docs through `package.ai.json.readOrder`.
2. Select and preserve the display base. For Make schema fields, complete Track C before adding Track B.
3. Identify the host framework, component library, and existing field-editor components.
4. Identify the field metadata that drives editability and field type.
5. Identify the stable row identity used by backend reads, saves, dirty state, and detail routes.
6. Read the host Make schema and Drawer form field mapping before coding editors.
7. Classify supported field types into text, number, date, option, identity, attachment, and read-only groups before coding editors.
8. For date, user, department, select, file, and lookup fields, choose a type-appropriate editor, read-only display, or explicit documented fallback before implementation.
9. Apply `make-cell-edit-defaults.md`: double-click enters edit, clipped cells scroll fully into view before editor mount, popup editors open immediately, inline editors fill the cell, current values echo on entry, and unchanged commits do not call save APIs.
10. Design or reuse a host edit controller and common editor-container abstraction before field-specific code.
11. Implement or reuse field editors through a common editor interface and distinguish submit-style from realtime-style editors.
12. For attachment fields, identify whether upload requires a saved record id and where the data-source / Service API adapter upload/delete/download boundary lives.
13. Validate positioning, scroll-into-view, post-edit scroll preservation, scroll-follow behavior, click-outside close, and rollback behavior.
14. Verify at least one real editable field flow in the target project.

## Track C workflow

1. Check whether the package is installed and read the package docs in the required order.
2. For new Make App projects, apply the platform table-display baseline unless the user explicitly asks for another visual style.
3. Identify the Make field schema shape and the actual backend value formats.
4. Normalize backend schema variants, such as `entity.properties.fields` or `entity.fields`, before the table layer consumes them.
5. Create or reuse the shared Make field type registry at `apps/ui/src/lib/make-field-types.ts`; it should expose `displayGroup`, `renderKind`, default `width`, `align`, multiplicity, and UI capability hints for all current Make field types.
6. Gate table initialization until normalized schema fields are available; missing schema is a loading/error state, not a reason to infer columns from row data.
7. Build or reuse a pure display adapter by field type before writing canvas shapes.
8. Derive column configs from normalized schema fields and the shared registry; avoid hand-maintained static columns for dynamic schemas.
9. Route display groups to focused renderers: text/clickable URL, tag list, compact user avatar/name list, attachment list, lookup reference text, and generic text fallback.
10. Keep option/candidate loading outside cell renderers; pass normalized rows and field schemas into the table.
11. Enable default row affordances: `showSN` sequence numbers and hover-revealed detail entry through `bodyRowHeadSuffixOptions`, unless explicitly disabled.
12. Keep the latest rows in the table host/controller and call `setData(latestRows)` after instance creation; do not gate table creation on `records.length`, `rows.length`, or data totals.
13. Add focused tests for registry coverage, schema normalization, value normalization, renderer overflow/empty states, schema-gated initialization, latest rows synchronization, empty rows table shell behavior, and the row-head defaults.
14. Verify at least one table path with representative backend values.

## Capability checklists

Track A common capabilities:

- base columns: `key`, `title`, `width`, `align`, `headerAlign`, `fixed`, `showEllipsis`
- local data updates via `setData(rows)`
- local empty rows via `setData([])`: table header stays visible and `emptyStateOptions` / 暂无数据 renders
- rows arrive before the table instance is ready: after ready, apply latest rows with `setData(latestRows)`
- virtual paged updates: identity-aware contracts use `setData(rows, page, request)` with the claimed request; legacy page-only contracts use `setData(rows, page)` only when the installed docs expose no request context
- `updateProps(...)` for column / size / config updates
- default sequence numbers via `showSN`
- default detail entry via `bodyRowHeadSuffixOptions`
- optional row selection via `selectable` + `selection:change`
- row drag via `rowSortable`
- column drag using the built-in header interaction
- summary rows via `showSummary`, `summaryData`, `summaryRenderer`
- empty states via `emptyStateOptions`
- custom cell rendering via `render`
- lightweight clickable shapes via `TextShape` and shape-level click behavior

Track B common capabilities:

- editable column declaration via `editType`
- `customEdit` contract handling
- editor-container pattern with a stable editor interface
- edit controller for old/new value, save, reset, rollback, and outside-click handling
- submit-style and realtime-style field editors
- field-editor mapping by business field type
- Make-style field coverage: `ID`, `Text`, `TextArea`, `URL`, `Number`, `Currency`, `Percent`, `Date`, `DateTime`, `DateRange`, `SingleSelect`, `MultiSelect`, `SingleUser`, `MultiUser`, `SingleDepartment`, `MultiDepartment`, `File`, `Lookup`
- double-click edit activation, editor overlay positioning, scroll-into-view, popup flip/shift, post-edit scroll preservation, and scroll-follow behavior
- `commit(...)` / `cancel(...)` / `updateValue(...)` usage, with `close(commit)` and `changeValue(...)` treated as legacy compatibility only
- `edit:end` as the post-commit event surface, with accepted `renderValue` backfilled to the visible table cell
- attachment field integration using host upload/file components or drag/drop DOM editors plus canvas-table render support
- backend system identity handling for row keys, dirty keys, detail routes, and attachment preconditions

Track C common capabilities:

- `@qfei-design/canvas-table` as the only product table implementation
- raw Make schema variants normalized before table code sees them
- normalized Make schema fields converted to `IColumn[]` at runtime
- initialization waits for schema fields instead of inferring columns from row keys
- initialization waits for schema/columns and real host size, not for positive row count
- latest rows are synchronized after CanvasTable instance creation, including the race where rows arrive before instance ready
- empty rows / `setData([])` render headers plus the empty state instead of hiding or skipping the table
- shared registry in `apps/ui/src/lib/make-field-types.ts` maps all current Make field types to `displayGroup`, `renderKind`, default `width`, `align`, multiplicity, and UI capability hints
- 18 Make field types mapped to display group and kind
- pure field-display adapter before canvas rendering
- text/link renderer with ellipsis, tooltip, empty `-`, and safe click handling
- tag renderer for select and department values, including `+N` overflow
- user renderer with fixed 22px compact avatar image/fallback circle, restrained stable avatar color, one-or-two-character fallback text at 9px, separate ellipsized name text, and `+N` overflow
- attachment renderer with image thumbnails, file-extension blocks, safe open behavior, and `+N` overflow
- lookup renderer with clickable valid references, muted deleted references, strikethrough, and fallback label extraction
- row-head defaults: `showSN` and `bodyRowHeadSuffixOptions`
- object/entity/schema switch resets table scroll and transient state; same-object data refresh may preserve scroll
- user/department edit candidates come from host candidate sources using the canonical `makeui` identity/label mapping; route implementation belongs to `make-app-service`

## What to avoid

Track A:

- building a grouped-table solution when a flat table is enough
- designing a full edit flow when the page only needs display + click actions
- overusing custom shapes when plain columns are sufficient
- relying on internal events or internal classes
- stuffing raw meta directly into runtime props
- skipping resize / cleanup handling

Before finishing Track A or C, read `references/common-pitfalls.md`.

Track B:

- forcing a brand-new component library into the project
- putting all editor logic directly into `customEdit`
- failing to separate display value and submit value
- treating all field types as the same commit model
- not updating editor position during scroll
- closing complex editors without save / rollback logic
- writing attachment support as render-only without an editor contract
- putting real attachment upload calls into canvas-table or a generic table wrapper
- defaulting date, user, department, select, file, or lookup fields to bare text inputs without explaining the missing schema/API reason
- using a business display code as the row key when persisted edits need a backend system id
- copying a Vue pattern into React without converting it into hook/ref-based host patterns

Before finishing Track B, read `references/edit-common-pitfalls.md`.

Track C:

- branching by field name for generic display behavior; branch by field type or explicit business role
- rendering raw objects or JSON wrapper strings when a useful label can be extracted
- fetching options, users, departments, or files inside a cell renderer
- creating generic text columns from row object keys when schema fields are unavailable
- flattening select, user, department, file, or lookup values into plain text when the schema type supports richer default rendering
- mixing display formatting with submit/edit payload conversion
- making unknown future field types crash the table; use a safe text fallback
- forcing exact folder/file names when the host project already has clear ownership boundaries

## Deferred topics

These topics exist in the package or adjacent project patterns, but are not the primary focus of this skill version:

- grouped tables (`GroupTableComponent`, `group:load`, `group:expand`, grouped hydration)
- grouped-table editing workflows
- rich text / relation / advanced composite field editors
- advanced shape animation systems
- full event matrix beyond the stable consumer path
- deep upload-service protocol design for attachments

If the user explicitly needs those, treat them as a later enhancement path and read the package feature docs plus the host project's real implementation first.

## Required output

For Track A, report:

- which display base was selected and whether Track B was layered on it
- which recipe and example were used
- which files were changed
- which core capabilities were added
- any important paging or meta-conversion constraints
- what was verified
- whether anything is still blocked by missing data or APIs

For Track B, report:

- which editable field path was selected
- which project component library and business editor components were reused
- where the edit controller logic lives
- whether a shared editor-container abstraction was used
- which field types were implemented or documented
- which fields use submit-style updates vs realtime-style updates
- how click-outside close is handled
- how overlay positioning and scroll-follow behavior are handled
- how edit commit/cancel/rollback preserves the current table scroll position
- which stable row identity is used for persisted edits, dirty rows, detail routes, and attachment preconditions
- how attachment fields are represented and edited
- what was verified in the target project
- whether anything is still blocked by missing field metadata, APIs, or host components

For Track C, report:

- which Make field types were covered
- whether the platform default table-display baseline was applied or intentionally overridden
- how table initialization is gated on schema availability
- where schema-to-column config lives
- where value normalization lives
- which renderer groups were added or reused
- whether `showSN` and `bodyRowHeadSuffixOptions` are enabled
- how empty values, overflow, URLs, attachments, users, departments, and lookup wrappers are handled
- what tests or visual checks were run
- whether any display behavior is still blocked by missing backend value examples
