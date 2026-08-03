# Sorting UI and Drag

Use this reference for the sorting trigger, panel, dnd-kit behavior, and CanvasTable
header linkage.

## Contents

- Package and public controller choice
- Draft lifecycle and visible states
- Package-owned drag acceptance
- Layout, styles, and CanvasTable header linkage

## Package choice

Install `@qfei-design/make-app-sort@^0.1.0` and consume its public core, React
component/controller, adapter, and stylesheet after reading
`package.ai.json.readOrder`.

dnd-kit is a package-internal dependency. The host does not install,
configure, or directly import dnd-kit and must not implement drag behavior again.
If a required drag behavior is missing, fix and release the shared package rather
than adding a host fallback.

Use shadcn/ui or project-local shadcn-compatible controls to build the sorting
panel component adapter, and pass it through the package `components` prop. Use
those adapters for `Popover`, `Select`, `Button`, `Tooltip`, icons, and messages.
Do not introduce another UI library only for sorting.

Before implementing table-header actions, read the installed CanvasTable
`package.ai.json` and every `readOrder` entry through
`canvas-table-integration`. Confirm that the installed version exposes a public API
for the required header menu/suffix click, close, refresh, and positioning
mechanics. A missing public API is a blocker: stop and report the package version
and missing capability instead of deep-importing internals or guessing canvas
coordinates.

## Public component contract

Use the package controller contract:

```ts
const controller = useRecordSortController({
  fields,
  value: appliedSort,
  onConfirm: persistSortOnly,
  onApplied: setAppliedSortSynchronously,
  onApplyError: reportSafeApplyError,
  resetKey: presetContextToken,
  onOpenChange: setOpen,
});

<RecordSortPanel
  components={components}
  {...controller.panelProps}
/>
```

`onConfirm` only PATCHes the Preset. `onApplied` synchronously replaces controlled
applied state and must not return a Promise. Records are requested by a separate
lifecycle keyed by the permission-aware object context plus applied filter/sort and
other session query inputs, with cancellation and stale-result protection.
`onApplyError` is required because persistence may have succeeded even if applying
state or closing the host container fails.

`presetContextToken` is a stable primitive renewed only when entity or
permission-enabled context changes. Do not pass a newly allocated object on every
render.

The header integration calls
`controller.openWithField(fieldKey, order?)`. This opens the same panel used by
the toolbar:

- update the existing draft row when the field is already present
- otherwise append a row when fewer than five rules exist
- reject unknown or non-sortable fields
- default a missing direction to `asc`
- do not save, close, or reload records

At five (5) rules, `openWithField` for a new table-header field keeps the current draft
unchanged, opens the panel, and shows the same five-level limit error/message used
by validation. Do not fail silently.

Do not create a separate table-header sort state.

## Draft lifecycle

Keep `value` as applied state and internal rows as draft state:

1. open: copy sanitized applied rules; create one empty row only when applied is
   empty and sortable fields exist
2. edit/add/delete/clear/drag: update draft only
3. close by outside click, escape, or trigger: discard draft and restore applied
4. confirm: validate draft, await `onConfirm`, then close on success
5. save failure: keep the panel open, keep the draft, show the local error

Before confirm, the component must not call the records endpoint or change applied
sort. Disable conflicting edits while a save is in flight, and prevent duplicate
confirm requests.

Use package default panel labels and behavior. The host trigger shows `排序` or
`N 排序`; do not add `恢复默认`. Hide all sort triggers/header actions when no
sortable fields exist. Optional header priority badges derive only from applied
sort.

## Package-owned drag acceptance

The package owns all dnd-kit implementation and accessibility mechanics. The host
must not reproduce or configure them. Consumer acceptance tests verify only
observable behavior:

- dragging from the visible handle changes array priority
- dragging Select, direction, or delete controls does not reorder
- keyboard reordering remains available from the handle
- cancelled or no-op drops preserve order
- overlay feedback does not resize or shift the panel

When behavior is missing, fix and release the shared npm package. Keep package
implementation recipes and tests in the package repository, not in a generated
Make host or this consumer Skill.

## Layout and styles

Import package `styles.css` once. The package owns panel layout and internal styles;
the host owns outer shadcn `Popover` placement, padding, arrow, portal, z-index, and active
trigger styling. Scope any necessary outer override to this overlay only.

## CanvasTable header linkage

Use `canvas-table-integration` for the actual header menu/suffix API. The host menu
may show `升序` and `降序` only for fields that pass
`isSortableRecordField(field)`.

Clicking a direction:

1. close the table header menu
2. call `recordSortRef.current?.openWithField(fieldKey, order)`
3. leave applied sort and records untouched until panel confirm

Table scroll, entity switch, outside click, and unmount close the header menu and
restore the header suffix to its normal hover-only state.
