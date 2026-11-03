# edit contract

Use this file for the stable host-side editing contract of canvas-table.

Prefer documented public APIs plus project-validated host patterns. Do not treat internal source discovery as a license to invent unsupported editor behavior.

## 1. Column-level entry

Editing begins at the column layer.

Common pattern:

- `editType: 'input'`
- `editType: 'custom'`

Use `custom` for most real business-field editing flows.

## 2. Host-level entry: `customEdit`

The host project can provide a `customEdit(options)` function.

Treat this as the bridge between canvas-table and the host editor system.

### Make record approval guard

For Make business records, consume the shared [approval restriction](../../make-app-approval/references/status-display.md#锁与范围) alongside ordinary record/field permissions. A column's editable config does not authorize every row. Check the latest row by stable record ID before mounting an editor for pointer, keyboard or programmatic activation; use the documented cancel path when blocked. Recheck at draft acceptance and final commit (`edit:end` or the host equivalent), including callbacks holding a stale row snapshot. Once the host observes an approval/lock change, end the ordinary edit session without accepting its draft, uploading attachments, saving or backfilling success. Keep other eligible rows editable and retain authoritative backend write checks. This guard does not replace current-node authorization for Workflow task forms.

## 3. `ICustomEditOptions` key fields

The host should expect at least these concepts:

- `column`
- `row`
- `value`
- `oldValue`
- `rowKey`
- `columnKey`
- `cellWidth`
- `cellHeight`
- `keyCode`
- `updateValue(value)`
- `commit(value?, reason?)`
- `cancel(reason?)`

### Notes

#### `column`

Contains the current field definition. Use it to decide:

- field type
- required / optional
- single / multiple mode
- precision / date format / attachment structure

#### `row`

Contains the current row data. Use `value` and `oldValue` for the cell value boundary.

#### `rowKey` / `columnKey`

Use these to build stable host commit payloads. Prefer stable backend/system row keys over row indexes.

For persisted editable data, use the backend's stable record identity when available, for example `id`, `recordId`, or a platform-specific system id. Keep mutable business codes as display/search fields unless the backend explicitly defines them as immutable record identities.

#### `cellWidth` / `cellHeight`

Use these to size the host editor container correctly.

#### `keyCode`

May be present when editing starts from keyboard input rather than pointer interaction.

#### `updateValue(value)`

Use when the host wants to update the table edit session without closing the editor.

#### `commit(value?, reason?)`

Use to explicitly commit and close the editor. Pass the render value when the editor already resolved it.

#### `cancel(reason?)`

Use to cancel and close the editor. This should not write the candidate value.

#### Legacy helpers

`changeValue(...)` and `close(commit)` may still exist for compatibility, but new host integrations should prefer `updateValue(...)`, `commit(...)`, and `cancel(...)`.

## 4. `ICustomEditResult` key fields

The editor bridge returns an object with these concepts:

- `element`
- `getValue()`
- `autoClose`
- `relatedElements`
- `overlayOptions`
- `destroy`

### `element`

A real DOM element used as the host editor container.

For cell editors that appear inside the active cell, this element and the actual input/editor component should fill the edited cell. Avoid nested form items, cards, bordered wrappers, margin, or outer padding that create a smaller input box inside the active cell. Popup editors can still anchor from this full-cell element while their dropdown/panel renders in a separate popup root.

### `getValue()`

Canvas-table uses this to read the current editor value during commit.

### `autoClose`

This is one of the most important switches. Prefer object form for real business editors.

#### `autoClose: true`

Use for lightweight editing where the table may safely manage more of the close behavior.

#### `autoClose: false`

Use only when the host fully owns close behavior.

#### Object `autoClose`

Preferred for popup editors and mixed interaction modes:

```ts
autoClose: {
  outsideClick: "commit",
  escape: "cancel",
  enter: "ignore",
  tab: "commitAndMove",
}
```

Common guidance:

- select
- date
- people / department pickers
- attachment editors

For popup editors, `enter: "ignore"` often avoids committing while the popup component is handling its own keyboard interaction.

Popup editors must be interactive as soon as edit mode opens. Do not return an editor that requires an additional click inside the active cell before the date picker, select dropdown, people selector, department selector, lookup selector, or attachment panel appears.

### `relatedElements`

Return popup roots here so canvas-table does not treat dropdown/date/attachment popups as outside clicks.

```ts
relatedElements: () => [popupRoot]
```

### `overlayOptions`

Use this when the editor or popup must overflow the cell editor box.

```ts
overlayOptions: { overflow: "visible" }
```

### `destroy`

Use this to unmount framework roots, remove popup roots, and release editor-local resources.

## 5. Data write mode

### `editApplyMode: "auto"`

The table writes committed values into row data automatically. This is suitable only when no business save/draft layer needs to approve the write first.

### `editApplyMode: "controlled"`

The table emits edit events but does not mutate row data. Use this when the host has:

- page-level draft state
- immediate API save
- validation before write
- rollback on failure

After the host accepts a commit, call `setCellData(...)` or `setRowData(...)` to backfill canvas data.

If the accepted cell-edit commit triggers a host refresh, restore keyboard focus to the current canvas instance after backfill. In React, prefer a getter such as `() => tableRef.current?.canvas ?? table.canvas` so delayed focus attempts do not target a stale canvas.

This focus restoration is conditional. Skip it when a host modal, drawer, dialog, popover, or form surface is opening or active, or when the user's next interaction has moved focus into that surface. Do not use canvas focus restoration as a generic post-save or post-row-click behavior.

## 6. Event surface related to editing

### `edit:end`

Treat this as the stable post-edit completion event.

Typical payload concepts:

- `newValue`
- `oldValue`
- `rowData`
- `column`
- `rowKey`
- `columnKey`
- `reason`
- `changed`

### `paste`

Exists as part of the editing-related event surface.

Do not over-design paste flows in the first editing pass unless the user explicitly asks for them.

## 7. Recommended contract usage

### For simple fields

Possible path:

- lightweight editor
- simpler close behavior
- less host-controlled orchestration

### For real business fields

Prefer:

- `editType: 'custom'`
- host edit controller
- shared editor container
- object `autoClose`
- `relatedElements` for popup roots
- `editApplyMode: "controlled"` when save/draft ownership is outside the table
- explicit save / reset / rollback behavior

## 8. Keep these distinctions clear

Do not mix these concepts:

- display value vs submit value
- editor widget vs canvas render shape
- field editor logic vs save API logic
- close behavior vs commit behavior
- edit event emission vs row-data write timing
- accepted commit vs focus restoration timing
- canvas edit focus restoration vs host modal/drawer/dialog/form focus ownership
