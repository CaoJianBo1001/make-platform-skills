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

## Outer overlay interaction boundary

Keep the outer grouping overlay controlled. Open it from an explicit click or
press. Never derive its `open` state from `hover`, `mouseenter`, `mouseleave`,
focus, `blur`, or `focusout`; moving the pointer or focus between the panel and a
child popup must not close the panel.

Treat the panel and every overlay it owns as one interaction boundary. A Select,
DatePicker, cascader, menu, tooltip, popover, color picker, or drag overlay may be
rendered through a portal or teleport outside the panel DOM subtree, but its popup
root remains inside the owned interaction boundary. Opening or closing a child
overlay, choosing a value, searching its options, scrolling it, or dragging a
group rule updates only child or draft state and must not close the outer panel.

Allow an ordinary user dismissal only when:

- the controller's confirm flow succeeds; or
- an outside-interaction is a true outside pointer interaction, meaning its event
  path belongs to neither the panel nor any registered child-overlay root. Close
  and `discardDraft()` on this path.

Use an explicit close-reason allowlist in the host adapter:

```ts
type GroupOverlayCloseReason =
  | "confirm-success"
  | "true-outside-pointer";
```

Only these reasons may enter the ordinary close path. Do not map a raw child
`onOpenChange(false)`, value change, focus change, or pointer leave directly to
the outer `setOpen(false)`.

Preset failure, validation failure, child-overlay close, value selection,
pointer leave, and focus transfer are not outer close reasons. Context reset,
permission loss, and unmount may still tear down the surface as lifecycle events.
Outer Escape dismissal is off by default. A product may explicitly opt in; then
the topmost child overlay consumes Escape first, and only an Escape with no child
overlay open may discard and close the grouping panel.

Use the installed component library's public nested-overlay facilities. Prefer a
host-owned portal container inside the boundary, or register portalled content as
an overlay branch/owned layer with the library's dismissable layer. If the
library exposes only an outside callback, classify the original pointer event
from `event.composedPath()` against registered panel and child roots before a
child popup unmounts. Do not add a competing document-level outside-click
listener or use `stopPropagation()` as the primary fix; both break nested-layer,
keyboard, and focus behavior easily.

Translate the contract through the active UI library rather than copying one
library's props:

- Ant Design / AntD: use a controlled outer Popover with `trigger="click"`; route
  child popups through the adapter or ConfigProvider's public popup-container API
  so the parent treats them as owned. This is an adapter example, not the generic
  contract or a platform rule.
- Radix/shadcn-style primitives: use controlled roots plus their public Portal
  container or nested dismissable-layer/branch mechanism.
- MUI-style components: use controlled Popover/Menu state plus their public
  container, portal, and click-away composition mechanisms.
- Vue and other UI libraries: use the equivalent teleport/append target or
  outside-interaction include list so owned child roots remain inside.

When the component library has no safe nested-overlay composition API, prefer a
Drawer or Modal that contains the grouping panel and its child portal root. Do not
fall back to hover-driven Popover behavior.

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

Panel opening calls `beginDraft()`. A verified true outside close calls
`discardDraft()`. Confirm success closes after apply; save failure preserves the
previous applied group, keeps the draft and panel open, and displays a local
error.

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
