# UI Style

Use this reference when mounting the package `AdvancedFilterPanel` inside a host UI.

Desktop/tablet uses the Popover defaults below. Phone uses a mobile-safe host sheet with `AdvancedFilterPanel layout="mobile"`, no CanvasTable and no header linkage; it retains the same controller and fixed header/body/footer. The mobile layout is a public package capability, not a host CSS variant. Check field popups, focus, keyboard and scroll containment at 390px/767px through public component APIs; unsupported panel behavior is an adaptation blocker, not permission to copy internals.

## Placement

Desktop/tablet filter trigger belongs in the local list toolbar:

```text
search input -> 筛选 -> 刷新 -> optional view switch
```

The phone toolbar instead contains a medium search control and, when filtering is in scope, a medium filter trigger with matching visible heights. Phone refresh is the list's pull gesture, not a toolbar action. Use `makeui` for toolbar sizing and placement; this skill owns the package-backed trigger behavior and panel contents.

Default desktop/tablet trigger:

- button text: `筛选`
- icon: filter icon from the host icon library
- active text: `已筛选 N 个条件`
- active style: green-tinted border/background/text

## Phone sheet

When filtering is in scope because the user requested it or the project already has it, the phone filter trigger opens a host-owned mobile Sheet (bottom or full-screen according to available height). Otherwise the phone toolbar has search without a filter trigger or package panel. Do not use the desktop Popover, even if it is wrapped by a compact phone toolbar. The same package controller, candidate sources, draft/confirm/persist flow and Service expression remain shared with desktop/tablet, but the package panel receives `layout="mobile"`:

Keep the package's mobile defaults: the header title is `设置筛选条件` and the confirm action is `完成`. Do not override these merely to copy desktop `筛选` / `确认`, and do not force desktop connected inline condition rows onto the phone's grouped touch-friendly cards. Clear remains a draft action; the applied filter changes only after `完成` persists successfully. Keep the header and footer fixed while the condition body scrolls.

Place the following inside a phone host using the `open`, `controller`, `handleOpenChange` and async `handleConfirm` lifecycle from [package-integration.md](package-integration.md). Wire the phone filter trigger to `handleOpenChange(true)`; closing the Sheet uses `handleOpenChange(false)` to discard the draft. The phone must not introduce a second save/apply handler.

```tsx
<HostMobileSheet open={open} onClose={() => handleOpenChange(false)}>
  <AdvancedFilterPanel
    layout="mobile"
    candidateSources={candidateSources}
    components={components}
    fields={filterableFields}
    value={controller.draftValue}
    validationErrors={controller.validationErrors}
    onChange={controller.setDraftValue}
    onClear={controller.clearDraft}
    onConfirm={() => void handleConfirm()}
  />
</HostMobileSheet>
```

`HostMobileSheet` above is a host-owned placeholder, not a filter-package export. Use an actual public Sheet primitive from the host's UI stack; the filter package does not render the Sheet, mask, close action or safe-area policy. Follow `makeui`'s mobile visual standard for phone-side gutters and safe-area space, constrain the height, and let only the condition body scroll so the header and footer actions stay visible. Verify no horizontal overflow or clipped field/operator/value controls at 390px and 767px, including with the keyboard, long labels and nested groups. The toolbar's medium search/trigger size and the package panel's `size="middle"` are separate contracts; custom field adapters must honor the latter. Before mounting, check that the resolved package React declaration supports `"mobile"`; versions 1.0.0–1.0.3 do not.

## Host overlay

The package does not render Popover, Modal, Drawer, or scroll containers. The host chooses the mounting surface. Default desktop/tablet Make object lists use a bottom-left Popover; phones use the sheet described above.

Default desktop/tablet host Popover behavior:

- trigger: click
- placement: `bottomLeft`
- close without confirm calls package `resetDraft`
- open calls package `beginDraft`
- content width: `min(724px, calc(100vw - 48px))`
- content max height: `min(560px, calc(100vh - 160px))`
- host outer wrapper overflow: `hidden`; host CSS must make `.advanced-filter__body` the only vertical scrolling region with `overflow-y: auto`
- border radius: `8px`
- shadow: `0 14px 40px rgb(15 23 42 / 16%)`

Do not hard-code a fixed initial height when content is shorter than the max height.

## Fixed three-region panel layout baseline

Every Make advanced filter popover/panel must preserve the fixed three-region layout. Pixel values may follow the host theme. The structure and scroll ownership are shared; the following labels, button placement and wrapper dimensions are desktop/tablet defaults, not phone overrides:

- Desktop/tablet top fixed header: left title `筛选`, right action `清空所有`; the header is outside the scrollable condition area and uses a bottom divider
- middle body / condition area: contains condition rows and nested condition groups only; it is the only vertical scroll region, and host CSS must set `.advanced-filter__body { overflow-y: auto; }`
- Desktop/tablet bottom fixed footer: left actions `+ 添加条件` and `+ 添加条件组`, right primary action `确认`; the footer is outside the scrollable condition area and uses a top divider
- Desktop/tablet container: the host Popover content wrapper clips overflow with `overflow: hidden`, then lets `.advanced-filter__body` scroll inside the max-height panel. Phone uses the host Sheet's own height/safe-area bounds and the package mobile panel layout.

Minimum desktop/tablet host CSS (do not apply these Popover dimensions to the phone Sheet):

```css
.advanced-filter-popover {
  display: flex;
  max-height: min(560px, calc(100vh - 160px));
  overflow: hidden;
}

.advanced-filter-popover .advanced-filter__panel {
  max-height: inherit;
}

.advanced-filter-popover .advanced-filter__body {
  overflow-y: auto;
}
```

The user must be able to clear, add conditions/groups, and confirm without scrolling to the top or bottom of the condition list. Header and footer controls must remain visible while the condition body scrolls.

Readiness blocker in either mode: do not deliver a single-scroll / full-panel scroll implementation where the header, clear/add actions, or the active confirm action (`确认` on desktop/tablet; `完成` on phone) scroll away with condition rows. 单一滚动或全弹层滚动导致按钮滚走时就是交付阻断，必须在报告高级筛选可交付前修复。

## Package panel

Render package `AdvancedFilterPanel` inside the host container. On phones add `layout="mobile"` as shown above; the generic example below is desktop/tablet-only. Reuse the async
`handleConfirm` from [package-integration.md](package-integration.md): validate,
persist the Preset, then only on success for the active context apply and close.
Failure keeps the old applied filter, open panel and current draft. This applies
to both desktop Popover and phone sheet; the example below is only panel wiring.

```tsx
<AdvancedFilterPanel
  candidateSources={candidateSources}
  components={components}
  fields={filterableFields}
  value={controller.draftValue}
  validationErrors={controller.validationErrors}
  onChange={controller.setDraftValue}
  onClear={controller.clearDraft}
  onConfirm={() => void handleConfirm()}
/>
```

Package `styles.css` owns:

- single white panel surface
- fixed header/footer inside the panel
- header/body/footer flex structure inside the host container
- required header/body/footer button placement
- condition rows
- nested group surface
- attached value editor and delete button
- control-level error states
- compact relation selector

Host CSS must size `.advanced-filter-popover` or equivalent outer wrapper and must set `.advanced-filter__body` overflow for the scrollable condition region. It must not fork package internals such as `.advanced-filter__row`, `.advanced-filter__condition-line`, or `.advanced-filter__value-action` unless there is a documented package bug and a local compatibility shim is temporary.

## Condition and validation behavior

Keep the package defaults:

- Desktop/tablet row controls share one connected line; phone `layout="mobile"` keeps the package's grouped touch-friendly condition cards instead.
- On desktop/tablet, the value editor and delete button are attached with no gap; phone uses the package mobile layout rather than a host CSS override.
- every value editor type supports the same error status
- validation failure keeps the owning Popover or Sheet open
- fixed value controls clear their red state immediately after a valid draft change
- the clear action changes the draft first and clears applied filters only after the active mode's `确认` / `完成` persists successfully

## Defaults to avoid

- Do not build a custom advanced-filter panel when `AdvancedFilterPanel` satisfies the requirement.
- On desktop/tablet, do not use a full-screen Drawer for the default advanced filter; this does not prohibit the phone sheet.
- Do not style host overlay internals by copying package CSS into the app.
- Do not make the whole Popover content a single `overflow: auto` region; only the condition body scrolls.
- Do not place `清空所有`, `+ 添加条件`, `+ 添加条件组`, or `确认` inside the condition body.
- Do not render the delete button as a detached block with a gap from the value editor.
- Do not submit on every keystroke.
- Do not place advanced filter controls inside the CanvasTable header row.
- Do not add saved views, saved filters, import/export/group/sort controls as part of this skill.
