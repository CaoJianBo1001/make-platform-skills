# UI Style

Use this reference when mounting the package `AdvancedFilterPanel` inside a host UI.

## Placement

The filter trigger belongs in the local list toolbar:

```text
search input -> 筛选 -> 刷新 -> optional view switch
```

Use `makeui` for the surrounding toolbar layout. This skill owns the package-backed trigger behavior and panel contents.

Default trigger:

- button text: `筛选`
- icon: filter icon from the host icon library
- active text: `已筛选 N 个条件`
- active style: green-tinted border/background/text

## Host overlay

The package does not render Popover, Modal, Drawer, or scroll containers. The host chooses the mounting surface. Default Make object lists use a bottom-left Popover.

Default host Popover behavior:

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

Every Make advanced filter popover/panel must preserve the fixed three-region layout. Pixel values may follow the host theme, but the structure, button placement, and scroll ownership are mandatory:

- top fixed header: left title `筛选`, right action `清空所有`; the header is outside the scrollable condition area and uses a bottom divider
- middle body / condition area: contains condition rows and nested condition groups only; it is the only vertical scroll region, and host CSS must set `.advanced-filter__body { overflow-y: auto; }`
- bottom fixed footer: left actions `+ 添加条件` and `+ 添加条件组`, right primary action `确认`; the footer is outside the scrollable condition area and uses a top divider
- container: the host Popover/Drawer/Modal content wrapper clips overflow with `overflow: hidden`, then lets `.advanced-filter__body` scroll inside the max-height panel

Minimum host CSS:

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

Readiness blocker: do not deliver a single-scroll / full-panel scroll implementation where `筛选`, `清空所有`, `+ 添加条件`, `+ 添加条件组`, or `确认` scroll away with condition rows. 单一滚动或全弹层滚动导致按钮滚走时就是交付阻断，必须在报告高级筛选可交付前修复。

## Package panel

Render package `AdvancedFilterPanel` inside the host container:

```tsx
function handleConfirm() {
  const validation = controller.confirm();
  if (validation.valid) setOpen(false);
}

<AdvancedFilterPanel
  candidateSources={candidateSources}
  components={components}
  fields={filterableFields}
  value={controller.draftValue}
  validationErrors={controller.validationErrors}
  onChange={controller.setDraftValue}
  onClear={controller.clearDraft}
  onConfirm={handleConfirm}
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

- row controls share one connected line
- value editor and delete button are attached with no gap
- every value editor type supports the same error status
- validation failure keeps the popover open
- fixed value controls clear their red state immediately after a valid draft change
- `清空所有` clears draft first and clears applied filters only after `确认`

## Defaults to avoid

- Do not build a custom advanced-filter panel when `AdvancedFilterPanel` satisfies the requirement.
- Do not use a full-screen Drawer for the default advanced filter.
- Do not style host overlay internals by copying package CSS into the app.
- Do not make the whole Popover content a single `overflow: auto` region; only the condition body scrolls.
- Do not place `清空所有`, `+ 添加条件`, `+ 添加条件组`, or `确认` inside the condition body.
- Do not render the delete button as a detached block with a gap from the value editor.
- Do not submit on every keystroke.
- Do not place advanced filter controls inside the CanvasTable header row.
- Do not add saved views, saved filters, import/export/group/sort controls as part of this skill.
