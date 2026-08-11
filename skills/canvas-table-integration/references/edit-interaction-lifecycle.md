# edit interaction lifecycle

Use this file to reason about the full editing lifecycle from activation to close.

## 1. Entering edit mode

Common entry paths:

- double-click on an editable cell, which is the default pointer activation for Make editable tables
- keyboard input starting directly from the active cell

When editing starts from keyboard input, `keyCode` may matter for the host editor.

For pointer users, a single click may activate/select the cell and the double-click enters edit mode. After that double-click activation, there must not be another click just to open the picker/dropdown/panel. For popup-style Make field editors, the popup must open during the same edit activation. If the user activates a date range, select, user, department, lookup selector, or attachment cell and only sees a small inline input until they click again, the integration is wrong. The field editor should mount opened and then focus itself.

Before mounting the real field editor, check whether the target cell is fully visible in the body viewport. If it is partially clipped by horizontal scroll, vertical scroll, fixed-left boundaries, the row header, headers, or container edges, scroll the table just enough to make the full cell visible. While that scroll is being applied, do not render/open the real editor or popup; use a delayed mount, hidden placeholder, or equivalent host bridge if the package needs an edit element synchronously. Then recalculate or wait until the next frame and mount/focus the editor using the updated cell geometry. Do not compute overlay coordinates before `scrollTo(...)` and reuse them after the table moves.

## 2. The editor is a DOM overlay

Treat the editor as a DOM overlay above the canvas.

Do not design complex editors as if they were drawn inside the canvas itself.

## 3. Positioning rules

Editor position typically depends on:

- current cell coordinates
- scroll offset
- header offset
- fixed-left region offset
- canvas bounding rect in the viewport

The editor container should respect the current cell width and height as a starting point.

For inline text, textarea, number, currency, and percent editors, the active-cell editor should fill the cell. The visual result should look like the cell itself became editable, not like a smaller bordered form control was inserted into the cell.

When the host scrolls a partially hidden target cell into view before editing, use the post-scroll cell coordinates for this positioning calculation. Do not compute editor coordinates before `scrollTo(...)` and then reuse stale coordinates after the table moves. Scroll calculation is only about making the cell visible; do not include popup width, guessed popup placement, or a pre-scroll right-aligned dropdown in the scroll target.

Popup/dropdown panels must not be clipped by the active cell, canvas host, table scroll container, or page viewport edge. Render select/date/user/department/lookup dropdowns into a popup root outside the canvas host, usually appended to `document.body`, include that root in `relatedElements()`, and use `overlayOptions: { overflow: "visible" }`. Attachment panels may render as an absolute panel connected to the full-cell editor element or into a popup root, but either way the panel root must be included in `relatedElements()` and allowed to overflow the edited cell. If the panel would be cut off at the right or bottom edge, flip or shift placement before showing it. Prefer start/left alignment when the popup fits; align right or shift left when it would overflow right; flip above or shift upward when it would overflow bottom. Placement must be decided after scroll completion from the visible anchor. A dropdown that first renders right-aligned during the scroll and then jumps left after the scroll is still incorrect, because it means popup placement happened too early. A dropdown that loses its lower-right border, bottom options, calendar footer, or attachment controls is positioned incorrectly.

## 4. Scroll-follow behavior

While editing is active:

- scrolling should update editor position
- fixed-column cells need special positioning behavior
- editors may need to hide when the cell moves out of the visible area

Do not assume an editor can stay static once opened.

## 5. Click-outside close behavior

For complex field editors, click-outside often means:

1. read current value
2. validate
3. save or rollback
4. reset state
5. close

Do not reduce outside-click behavior to a blind close.

For popup editors, do not implement a separate host global outside-click listener first. Prefer:

- `relatedElements()` for popup roots
- object `autoClose.outsideClick`
- `destroy()` for framework cleanup

## 6. Keyboard behavior

Common keyboard semantics:

- `Escape` -> cancel-style exit
- `Enter` -> commit-style exit, often then move to another cell
- `Tab` -> commit-style exit, often then move horizontally

These rules should stay consistent across field editors.

For dropdown/date-like popup editors, `Enter` may need to stay inside the popup component. Prefer `autoClose.enter: "ignore"` for those editors, then commit through the editor's explicit OK/change callback.

`Escape` should remain cancel-style even when the popup component also listens to keyboard events. Current package behavior listens in capture phase, so host editors should avoid stopping Escape unless they intentionally own the cancel behavior.

## 7. `autoClose` behavior split

### `autoClose: true`

Better for lightweight editors where the table can manage more default close behavior.

### `autoClose: false`

Better for complex host-controlled editors where the host needs to manage:

- outside click
- popup interactions
- save timing
- rollback timing
- special focus behavior

### Object `autoClose`

Preferred for first-pass business editors because each close trigger can be configured independently.

Common examples:

- single-line text: outside click commit, Escape cancel, Enter commit, Tab commit and move
- textarea / multiline text: outside click commit, Escape cancel, Enter stays inside the editor when multiline input is enabled, Tab commit and move
- select/date popup: outside click commit, Escape cancel, Enter ignore, Tab commit and move

Popup editor roots must be declared through `relatedElements()`. Without this, clicking inside a date/select/user/department/file popup can look like an outside click and close or commit at the wrong time.

## 8. Submit-style vs realtime-style editors

### Submit-style editors

Examples:

- text
- number / amount / percentage
- person
- department
- multi-select
- attachment

These usually wait until an explicit save/close moment.

### Realtime-style editors

Examples:

- date pickers
- some single-select editors
- some simple state toggles

These may commit immediately on change.

## 9. Post-edit behavior

After commit, the host may need to:

- update the cell data
- update render-side mapped data
- emit or observe `edit:end`
- refresh dependent UI
- restore keyboard focus to the current canvas when the interaction is returning from canvas cell editing back to the table
- preserve the table's current scroll position

If `editApplyMode: "controlled"` is used, the table will not mutate row data by itself. The host must call `setCellData(...)` or `setRowData(...)` only after the draft/save layer accepts the commit. The value backfilled into the visible cell should be the accepted `renderValue`, not a raw `submitValue` id or formatted `displayValue` label unless that is also the field's render contract.

When accepted cell-edit commits trigger host row refreshes, delayed focus should resolve the latest table canvas instead of capturing only the original instance. A practical pattern is immediate focus, next-frame focus, and one short delayed focus against `tableRef.current?.canvas`.

Accepted edit commits must not reset table scroll. If the user edited a far-right or lower-row cell, commit/cancel/rollback should leave the table at that same `scrollLeft` and `scrollTop` unless the edit intentionally navigates to another object/page. Prefer targeted `setCellData(...)` or `setRowData(...)`; if the host must refresh rows with `setData(...)`, snapshot the current public scroll state with `getScrollState()` before the update and restore it with `scrollTo(x, y)` after the table has applied the refreshed data. Do not remount the table or change its identity key for a same-object edit result.

Never run those delayed focus attempts while a host modal, drawer, dialog, popover, or form surface is opening or active. If a row click, action button, or edit commit opens host UI, that host UI owns focus until it closes.

After cancel or rollback, the host may need to:

- restore the old value
- clear transient state
- close the overlay cleanly
- restore canvas focus if the edit session had taken focus into a DOM editor and no other host interaction surface now owns focus

## 10. Behavior consistency rule

The host should enforce one coherent editing lifecycle.

Do not let each field editor invent its own unrelated close / save / rollback semantics unless there is a clear business reason.

## 11. Table recreation rule

Editable host components should keep table initialization stable while editing and while draft rows change.

If recreation is unavoidable, reapply derived canvas state after `setData(...)`, including:

- scrollLeft and scrollTop
- dirty row colors
- selection only when the host owns a non-action selection model and has proved
  that the replacement keeps the same semantic data/selection generation
- any row/cell visual state stored outside row data

For writable Make record lists whose selection drives `make-app-actions`, a table
recreation/replacement is an action-selection boundary. Do not restore, reapply,
or replay the action-owned selection from the old instance. Let
`make-app-actions` publish one empty selection snapshot, invalidate pending action
work, and accept only public selection events from the replacement instance.
Generic edit-state restoration must not override that stricter action lifecycle.

## 12. Container sizing rule

Initialize the table only with a usable canvas height.

Prefer this order:

1. explicit height prop
2. measured container height when it is large enough for rows
3. conservative default height

Do not let a padding-only or collapsed container produce a tiny canvas. It makes hit testing, scroll behavior, editor positioning, and empty-state judgment unreliable.
