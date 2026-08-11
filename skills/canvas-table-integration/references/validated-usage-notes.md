# validated usage notes

This file is for maintainers of the skill, not for the primary end-user path.

Use it to track which capabilities have been validated in real consumer projects, and which capabilities are still mainly documented but not yet strongly validated by downstream integration work.

Current validation basis:

- a downstream React host integration with local tables, editable columns, attachment metadata, and host-side save flow
- a production-style React Make App integration with Service-backed schema, remote records, editable cells, and real attachment proxy APIs

## 1. Validated by real project usage

The following first-version capabilities are already validated by a downstream host integration.

### Basic local table integration

Observed patterns:

- `CanvasTableComponent` is instantiated in a React `useEffect`
- the table is bound to a real DOM container
- local rows are injected with `setData(rows)`
- the instance is destroyed in cleanup

### Common column configuration

Validated fields include:

- `key`
- `title`
- `width`
- `align`
- `showEllipsis`

This supports the first-version guidance that these are the most common consumer-facing column fields.

### Formatting outside the table core

Validated pattern:

- display-only formatting may happen before `setData(...)`
- editable number-like fields keep row and submit values numeric, with display formatting in render/editor layers
- number-like display formatting requires finite-number validation; invalid values render the empty placeholder instead of `NaN`

This supports the guidance that formatting belongs near the display boundary, while editable submit values should preserve their business type.

### Row selection

- `selectable.enabled = true`
- `selectable.type = 'multiple'`
- `selection:change`
- namespaced event subscription via `table.tableId`

### `render + TextShape` clickable business anchor

- a business-code field is rendered through `render`
- a `TextShape` is used as a clickable business anchor
- shape events stop propagation before triggering the business jump
- the visible business code remains a display field, while the detail route uses a stable backend id

This strongly validates the first-version emphasis on lightweight clickable shape patterns.

### Responsive width synchronization

- host components use `ResizeObserver`
- host width is synchronized before / during table use

This supports the hard-rule guidance about real container sizing.

### `showSN`

- `showSN.enabled = true`
- custom formatter usage is present

### Stable backend `rowKey`

Validated examples used stable backend/system identifiers as row keys for persisted rows.

This updates the row identity guidance: host code should prefer a stable backend/system identifier for persisted rows. Mutable business fields should remain display/search fields, not technical row keys.

### Detail-page subtable usage

This confirms that canvas-table is not only for main list pages, but also works well for embedded display-oriented subtables.

### Virtual remote table

Validated patterns:

- `virtualOptions.enabled = true`
- `data:load` requests additional pages from a host data source
- the table page contract stays zero-based at the canvas-table boundary
- the host data-source layer translates pagination for the backend when needed

This validates the remote paginated list path for Make record pages.

High-volume virtual loading is also validated by a downstream record-list integration:

- fast-scroll and scrollbar-drag targets are coalesced before network dispatch
- host concurrency is bounded and pages nearest the current viewport are prioritized
- stale queued requests are cancelled, while stale in-flight requests are aborted when `AbortController` is available
- host and CanvasTable caches use aligned bounds, and evicted pages reload during reverse scrolling
- page cancellation propagates through the Service boundary to downstream fetch where the request stack supports `AbortSignal`
- in that legacy downstream path, background pages wrote directly with `setData(rows, page)` while first-page state continued to own totals and page-level status

This validates the large-data scheduler and cancellation rules in `virtual-table-patterns.md`; the documented tuning values remain adjustable for other hosts.

The downstream integration used the legacy page-only CanvasTable contract. It validates viewport coalescing, bounded concurrency, host cancellation, Service propagation, and cache behavior, but the identity-aware request contract has not yet been validated by a downstream host. Identity-aware `request` claiming and round-trip behavior is currently validated by the package's public docs, examples, and package tests; keep that distinction visible until a real downstream integration adopts it.

### Schema-driven Make columns

Validated patterns:

- Make schema fields are converted into canvas-table columns before table creation
- Make `field.key` becomes the stable canvas-table column key when the backend schema is dynamic
- Make `field.name` becomes the visible column title only
- display normalization happens outside the table core
- unsupported or unknown field types fall back to safe display text instead of crashing

This validates the Track C guidance for dynamic Make object lists.

### Cell-edit workflow

Validated field scope:

- text fields
- number / amount field
- select field
- date-time field
- attachment metadata field

Observed patterns:

- editable columns declare `editType: 'custom'`
- React host editors mount into DOM elements returned by `customEdit`
- editor components expose `focus()` and `updateVal()` through refs
- popup editors declare popup roots through `relatedElements()`
- popup editors use `overlayOptions: { overflow: 'visible' }`
- close behavior uses object `autoClose`
- business write ownership uses `editApplyMode: 'controlled'`
- accepted commits backfill canvas data with `setCellData(...)`
- default page behavior can use immediate save while preserving draft mode as a configurable alternative
- accepted immediate cell-edit commits may refresh host rows, so focus restoration resolves the latest canvas instance and retries after the framework updates DOM only when the interaction returns to the table
- focus restoration must be skipped while host modal, drawer, dialog, popover, or form UI owns focus
- usable canvas height is resolved from explicit height, measured container height, or a conservative fallback
- page-level draft state owns dirty row keys, save/discard, and unsaved-change guards
- dirty row colors use `setRowColors(...)`
- number-like fields keep row and submit values numeric while display formatting lives in render/editor formatting
- numeric parser failures must not be committed, backfilled, or displayed as `NaN`
- date-time editors resolve direct typed input before OK commits
- attachment values are normalized into render/editor arrays
- attachment dirty comparison ignores generated `uid` and compares stable file fields
- attachment cells render up to 3 previews/items plus `+N`
- image attachments use thumbnails and non-image attachments use extension/file chips
- attachment editor supports drag/drop and click-to-upload local file selection
- mock local files are stored as data URLs when demo mode is explicit
- real upload remains a data-source / Service API adapter scope
- attachment editing is enabled only for persisted rows with backend identity when real upload requires record identity
- attachment popup placement is handled by the host overlay/CSS, defaults left, switches right when right space is insufficient, and may cover the current edited cell

This supports treating Track B as a validated host-edit integration path for text, number, select, date, and attachment metadata editing.

### Real attachment upload / delete / download proxy

Validated patterns:

- persisted rows use stable backend record identity before upload/delete is enabled
- upload calls are made by the host data-source / Service API adapter, not by canvas renderers
- removed attachments are deleted through the host adapter after comparing previous and next values
- download URLs are normalized to a Service proxy URL instead of exposing raw backend file URLs in the UI

This validates the attachment boundary rule: canvas-table renders and triggers editing, while persistence and file transfer remain host-owned.

Browser validation covered:

- text Enter commit
- text Tab commit and focus restoration
- number edit commit with numeric submit value
- status select commit
- text Escape cancel
- text outside-click commit
- date-time typed input plus OK commit
- attachment popup open/close and local file button visibility
- page reload persistence through the host's configured data source
- no new blocking console errors in the validated route

## 2. Not yet strongly validated by the current sample

The following capabilities still exist in package docs, but are not yet strongly validated by the current downstream sample.

### Numeric decimal-place overflow validation status

The Skill contract is validated by an executable raw-input oracle plus dedicated fresh-agent form and cell-edit scenarios. That validation covers `Number.precision`, `Currency.decimalPlaces`, `Percent.decimalPlaces`, raw plain-decimal text, trailing zeroes, scientific-notation rejection, frontend-only symbols, persistence-request blocking, keeping an invalid cell editor active, external validation guidance, and zero save calls.

This repository does not contain a real downstream Make App browser fixture, so do not describe the Skill-level evidence as browser or production validation. Before reporting a generated app as ready, run the shared behavior vectors against its actual form adapter and CanvasTable editor, then verify the exact-limit and overflow paths in the selected component library. Record any library-specific raw-input mechanism, such as string mode or a wrapper-owned raw buffer, in the downstream test evidence.

### Group table

Not yet validated here.

Implication:

- deferring it from the first-version primary path remains correct

### Built-in summary row

The project has summary information in page UI, but not yet as a validated built-in canvas-table summary integration.

### Built-in empty state

Not yet directly validated in this sample project.

## 3. Known observation points

### Non-public column fields

One downstream host used an extra column field that is not currently part of the public first-version emphasis.

Treat this as an observation point, not as a recommended public integration pattern.

Implication:

- do not promote it into the main skill path yet
- revisit later if multiple real projects rely on it

## 4. Maintenance guidance

Use this file when deciding whether to:

- move a documented capability into the first-version primary path
- keep a capability in references only
- postpone a capability to a later enhancement phase

Prefer real consumer-project validation over purely source-level discovery when deciding what to emphasize in the skill.
