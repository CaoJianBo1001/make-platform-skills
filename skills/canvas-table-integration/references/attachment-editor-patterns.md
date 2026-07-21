# attachment editor patterns

Use this file when attachment/file fields are part of the editable canvas-table workflow.

Attachment fields belong in the second-version editing scope, but they should be designed as host-driven editors, not as canvas-table-native uploaders.

Observed host implementations may support attachment metadata editing, drag/drop/click local file selection, local preview data, and attachment cell rendering. Treat those as transferable patterns, not as required UI details.

## 1. Three-layer model

Treat attachment fields as three cooperating layers.

### Table-render layer

Canvas-table can support:

- image thumbnails
- file icons
- preview/open click interactions
- multi-item visual layout

### Host-editor layer

The host project usually provides:

- file selection UI
- drag/drop and click-to-upload interaction
- replacement / removal logic
- ordering logic if needed
- render payload construction

### Data-source / adapter layer

The host data layer usually provides when real upload is in scope:

- real upload API calls
- submit payload construction
- saved-record identity checks
- mapping between backend file structures and render-friendly attachment values

Do not put upload-service calls inside canvas-table, a generic table wrapper, or a canvas render function.

For Make FileField-style APIs, keep the host route/API contract separate from the Make backend payload. A Service route may name its path parameter `:fieldKey`, but the Make `/data/v1/file` payload uses the key `field`, alongside the app/entity/record identity expected by the host backend. Map the host `fieldKey` to Make `field` at the Service adapter boundary; do not forward `fieldKey` into the Make file payload. Add tests for upload, read, and delete bodies so this does not regress.

## 2. In-table rendering

A common pattern is:

- parse the attachment value structure
- detect image vs non-image files
- render image thumbnails through `ImgShape`
- render non-image file extension chips or file icons
- show a bounded number of attachments, for example first 3 items plus `+N`
- attach click behavior to preview/open the file URL

Do not confuse this with the editing workflow itself.

## 3. Why `ImgShape` matters

`ImgShape` gives the table-render layer a good foundation for:

- image display
- icon display
- click interaction
- loading/error fallback behavior

But `ImgShape` is not an uploader and not a file manager.

## 4. Normalized attachment value

Normalize backend and editor values before they reach rendering, dirty comparison, or submit logic.

Recommended render/editor shape:

```ts
type CanvasAttachment = {
  uid: string
  name: string
  url?: string
  filePath?: string
  size?: number
  type?: string
}
```

For Make FileField-style values, map:

- `fileName` -> `name`
- `fileURL` -> `url`
- `filePath` -> `filePath`
- `fileSizeInBytes` -> `size`

Keep compatibility normalization in the data layer or a pure helper. It may tolerate:

- an array of normalized attachments
- a single Make FileField object
- an array of Make FileField objects
- a JSON string
- a plain URL string

After normalization, table/render/editor code should work with an array of `CanvasAttachment`.

### Dirty comparison

Do not compare attachment arrays by reference.

Dirty comparison should ignore `uid` and compare stable business/file fields:

- `name`
- `url`
- `filePath`
- `size`
- `type`

This prevents generated local ids from leaving a row permanently dirty.

## 5. Record identity and create-flow rule

Attachment upload often requires a saved backend record identity.

For backends that require a saved record before file upload, use the backend's stable system id for attachment persistence. Do not use mutable display fields as technical row keys or upload identifiers.

Recommended behavior:

- persisted editable rows use a stable backend id as `rowKey`
- create forms do not expose real attachment upload when the backend requires a saved record id
- new-record create payloads omit attachment fields when upload is a separate file API
- after create succeeds, reload or merge the returned backend id, then enable attachment editing

## 6. Attachment editor responsibilities

The host editor should be responsible for:

- selecting files
- accepting drag/drop files
- accepting paste files when the product expects clipboard workflows
- accepting click-to-upload through a hidden file input or host upload component
- enforcing `field.properties.maxCount` from the Make File schema before accepting click-to-upload, drag/drop, paste, append, or replacement actions that would exceed the limit
- replacing files
- removing files
- reordering files when the business requires it
- returning the correct render/editor value

If the product allows local mock behavior before real upload integration, the editor may create local preview metadata. Mark this as mock behavior and keep the future real upload boundary in the data-source / adapter layer. Do not mistake transient preview URLs for persisted backend file values.

## 7. Value structure guidance

Keep these concepts distinct:

- render value: normalized attachments for table display and editor state
- submit value: API-specific payload, upload token, file id, or backend file field value
- preview value: optional local URL or data URL for host-side preview before real upload
- pending file value: optional editor-local files that still need the data-source adapter to upload
- optional extra mapping data when the host render layer needs thumbnails or icon hints

Do not assume one attachment value can always serve rendering, editing, and API submission directly.

## 8. Interaction model

Attachment editing is usually a submit-style editor.

Common behavior:

- open attachment panel
- drag files into a drop zone, paste files, or click the drop zone/button to choose local files when the host supports those inputs
- modify attachment list
- commit on explicit save/close or on a controlled outside-click flow

When the current attachment count reaches `field.properties.maxCount`, disable add affordances or reject extra files through the host validation/error state while still allowing preview, remove, and replace. Do not silently truncate the submitted attachment array.

Do not default to instant commit unless the host project already uses that model.

When an attachment panel is open from `customEdit`, use the table's popup coordination contract:

- return the editor root or popup root from `relatedElements()`
- set `overlayOptions: { overflow: "visible" }` when the panel overflows the cell
- use object `autoClose`
- use `enter: "ignore"` when the panel owns Enter handling
- dispose framework roots from `destroy`, but defer root unmount if needed to avoid unmounting during the same click event that committed the editor

## 9. Popup placement and cell coverage

Attachment panels often need to be wider and taller than the edited cell.

Recommended placement behavior:

- choose a placement that keeps the panel in view and visually connected to the edited cell
- default to left alignment from the edited cell when the panel fits in the visible viewport
- switch to right alignment only when the right-side viewport space from the edited cell is smaller than the panel width
- calculate placement from the post-scroll anchor rectangle, not from stale cell coordinates captured before the table scrolled
- covering the edited cell border is acceptable when it prevents the active cell outline from showing through the popup
- handle placement with host-side CSS or a host-side positioner before considering canvas-table package changes

Default visual baseline for Make schema table editing:

- use an ExpensePoc-style attachment panel connected to the edited cell
- default panel width is about `450px`, with a viewport max such as `calc(100vw - 32px)`; do not make the panel as narrow as a single cell
- use one flat blue panel border connected to the active cell, with `border-radius: 0`, no card chrome, and no nested border that competes with the canvas active-cell outline
- render existing image/file thumbnails or cards at the top of the panel
- when there are no attachments, render no placeholder attachment card, no `-` row, and no empty bordered list; show only the upload drop zone
- existing attachment thumbnails/cards stay compact and square, roughly `64px` by `64px`, with file name ellipsis below; do not render oversized previews by default
- render one drag/drop/click upload zone in the same panel
- use a single active/panel border; do not add a nested card border inside the active cell
- do not default to a form-card layout with a title header, toolbar upload button, and inner list row
- keep preview/remove controls on the attachment item or its hover mask

Do not change the canvas-table package just to solve a host popup placement problem until host-side positioning has been tried.

## 10. Component-library rule

For attachment editors, prefer the current project's existing upload/file component system when it exists.

Do not force the skill to require a specific upload library.

## 11. Verification checklist

For an attachment field integration, verify:

- persisted rows have a stable backend identity before attachment editing is enabled
- create flow omits attachments when backend upload needs a record id
- rendering handles images, non-images, empty values, and more-than-visible counts
- clicking a rendered attachment opens/previews the file without triggering row navigation unexpectedly
- enabled local input modes, such as drag/drop, paste, and click-to-upload, add files in the editor
- `field.properties.maxCount` blocks or disables any upload, drag/drop, paste, or append action that would exceed the configured file count, without silently truncating the submitted attachment array
- empty attachment state shows only the upload drop zone, not a fake `-` attachment or empty list row
- existing attachment cards are compact square thumbnails/icons and the panel is wide enough for normal drag/drop text
- removal updates the normalized array
- dirty comparison clears after save/discard and does not depend on generated `uid`
- popup roots are included in `relatedElements()`
- the panel can overflow the cell and cover the active cell outline
- table focus returns correctly after commit/cancel when the interaction returns to the table, and does not steal focus from host modal/drawer/dialog/form UI
- Make FileField adapters send the backend file field parameter as `field` in the Make API body, even when the host Service route uses `:fieldKey`

## 12. Scope discipline

This skill should document how to integrate attachment editors into canvas-table.

It should not attempt to define the full server-side upload protocol unless the host project already exposes that pattern and the user explicitly asks for it.
