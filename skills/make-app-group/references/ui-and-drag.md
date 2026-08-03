# UI and Drag

Use this reference for the package-backed grouping panel, host-owned trigger and
container, draft lifecycle, `openWithField`, and drag behavior.

## Package pre-flight

Ensure `@qfei-design/make-app-group@^0.1.0` is installed in the host UI package.
Read package docs before designing code:

1. locate the installed package root
2. read `package.ai.json`
3. parse `package.ai.json.readOrder`
4. read every declared entry in order

Use only public entries:

- `@qfei-design/make-app-group`
- `@qfei-design/make-app-group/react`
- `@qfei-design/make-app-group/adapters/antd`
- `@qfei-design/make-app-group/styles.css`

Import `@qfei-design/make-app-group/styles.css` once from the host UI entry. Do
not import from `src`, `dist`, or generated chunk files.

## Host-owned container

The package does not render the toolbar trigger or the outer Popover, Modal, or
Drawer. The host owns:

- toolbar placement and trigger label
- overlay placement, z-index, portal, and viewport sizing
- disabled state from access and page loading context
- entity-keyed applied group state
- Preset save handler
- data request lifecycle after applied group changes
- safe error formatting

For Ant Design hosts, use `createAntdRecordGroupComponents()` and pass the result
to `RecordGroupPanel`.

Hide the trigger when there are no groupable fields. Do not show a disabled button
as the only feedback for an entity that cannot be grouped.

Toolbar order belongs to `makeui`; for list pages it should be search, filter,
group, sort, refresh when those capabilities are enabled.

## Controller contract

Use `useRecordGroupController`:

```ts
const controller = useRecordGroupController({
  fields,
  value: appliedGroup,
  resetKey,
  onConfirm: async (nextGroup) => {
    await saveEntityPreset({ group: nextGroup });
  },
  onApplied: (nextGroup) => {
    setAppliedGroup(nextGroup);
  },
  onApplyError: reportApplyError,
  onOpenChange: setOpen,
});
```

Rules:

- `onConfirm` persists only. It must reject when Preset persistence fails.
- `onApplied` must be synchronous and update only controlled applied group state.
- `onApplied` must not start group-data, records, or CanvasTable requests.
- Group-data, record-groups, records, and CanvasTable requests must not run
  inside `onConfirm` or `onApplied`.
- `onApplyError` is required and may be sync or async.
- `resetKey` must be a stable token for the current entity/access generation, not a
  new object on every render.

Panel opening calls `beginDraft()`. Outside close, escape, or trigger close calls
`discardDraft()`. Save failure preserves previous applied group, keeps the draft,
and displays a local error.

## Draft behavior

The package owns:

- placeholder rows
- add row
- delete row
- clear draft
- direction toggle
- validation errors
- disabled direction for non-sortable group fields
- dnd-kit priority drag and keyboard reorder
- drag overlay portal

The host must not import or configure dnd-kit primitive components, sensors,
sortable hooks, sorting strategies, or drag overlays for the grouping panel.

The panel defaults to a compact width controlled by
`--make-app-group-panel-width`. Host CSS may style only the outer overlay and may
set package CSS variables; it must not fork package internal class structure.

## Header linkage

A host-owned CanvasTable header grouping action must call the same controller:

```ts
const result = controller.openWithField(fieldKey, order);
```

Header grouping actions:

- only update and open the shared draft
- must not persist Preset immediately
- must not request groups or records
- must close the header menu after invoking the controller
- must not appear for fields that are not currently groupable

`openWithField` updates an existing selected field, fills an empty placeholder, or
adds a new row. When the three-level limit is reached, keep the existing draft and
show the package/local limit error instead of silently replacing another group.

If a product does not expose header grouping, toolbar grouping is still complete
as long as all other contracts are implemented.

## Disabled and read-only states

Disable or hide grouping surfaces while:

- the entity/access context is disabled
- schema or Preset has not completed initial hydration
- a group Preset save is in progress
- the current entity has no groupable fields

Grouped V1 should disable cell editing unless the product explicitly defines
grouped editing semantics, including how edited values update active group counts,
group placement, and leaf caches.
