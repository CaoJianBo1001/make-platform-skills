# Testing and Pitfalls

Use TDD for sorting behavior: add a failing test, implement the smallest behavior,
then refactor pure model, UI state, and I/O boundaries separately.

## Contents

- Pure model and UI component tests
- Host integration and Service tests
- Completion gate

## Pure model tests

Cover in one focused suite:

- zero through five valid rules
- sixth rule rejected
- missing/blank field
- invalid order and exact `asc`/`desc` acceptance
- duplicate field rejection
- `sortable === true`, `sortable === false`, and missing capability
- arbitrary field type with `sortable === true`
- array priority retained after drag moves
- invalid/no-op move returns unchanged order
- sanitization preserves first valid occurrence and discards stale entries
- inputs remain immutable

## UI component tests

Verify:

- toolbar trigger label is `排序` or `N 排序`
- opening copies applied value into draft
- no applied change or records request before confirm
- add action disappears at five rows
- `清空所有` affects draft until confirm
- outside close and escape discard unconfirmed changes
- validation failure keeps the panel open
- save success closes and updates applied state
- save failure keeps previous applied state and current draft
- duplicate confirm is blocked while saving
- package panel drag changes array priority from the handle and remains keyboard accessible
- host source has no direct dnd-kit imports or copied drag implementation
- `onConfirm` persists only, synchronous `onApplied` changes controlled state, and
  `onApplyError` observes post-persistence application/close failures
- `openWithField` rejects non-sortable fields, updates an existing row, and appends
  a new row when allowed
- `openWithField` at five rows preserves draft and shows a limit error
- no sortable fields hides the toolbar trigger and header sorting menu
- installed CanvasTable public header APIs are checked before integration

## Integration tests

Verify:

- toolbar order is search, filter when enabled, sort, refresh
- CanvasTable header asc/desc calls the same `openWithField`
- header action only opens draft and does not call records
- first records request waits for schema plus Preset load
- saved sort is sanitized against current schema before records
- sort confirm PATCHes only `{ sort }`
- save success updates the records query and resets table/query context
- save failure does not reload records
- Preset save success followed by records failure keeps the new applied sort and
  retries records without rolling back
- clear sends `{ sort: [] }`
- keyword search is never sent in Preset update
- filter update does not send sort; sort update does not send filter/group
- entity switch resets panel/header state
- entity switch discards stale responses from Preset load/save and old records
- `A -> B -> A` rejects the first A result through `resetKey` and request generation
- permission enabled-to-disabled invalidates in-flight load/save results, closes
  sort UI, blocks new Preset/records requests, and does not apply stale save success
- a stable permission-aware context token resets the controller without changing on
  ordinary rerenders
- concurrent sparse filter and sort saves keep shared saving active until both
  settle
- one concurrent save success does not clear another save's error
- refresh keeps current applied filter and sort

## Service tests

Route and adapter tests cover:

- GET/PATCH Entity Preset success and upstream failure
- `/preset/v1/entity` path
- `MakeService.GetResource` and `MakeService.UpdateResource`
- deployment `appKey` and `entityKey` payloads
- current login/session context forwarding
- normalized `{ filter, sort }` response
- partial update payload and sibling/future group preservation
- `filter: null` and `sort: []`
- malformed JSON, non-array sort, more than five, duplicate, invalid direction,
  unknown property, unknown field, and non-sortable field return 400
- Preset and records both validate `capabilities.sortable`
- Preset GET sanitizes stale upstream rules while PATCH/records remain strict
- PATCH/records use the strict transport parser, reject unknown properties, and do
  not call tolerant `sanitizeRecordSort`
- records `ListResources` preserves ordered `{ fieldKey, order }[]`
- paginated/virtual sorting has a documented backend stability contract and does
  not inject a hidden client tie-breaker
- null ordering, case sensitivity, locale collation, and relation-field behavior
  are verified against Make Data rather than reimplemented in UI/Service
- missing sort omission or the host's documented default
- entry/success/failure logs redact credentials and sensitive values

## Completion gate

Before reporting complete:

- tests were written and observed failing before implementation
- runtime schema, not local DSL or a type allowlist, controls sortable candidates
- package UI model functions remain pure; Service transport parsing and I/O are
  isolated
- the first records request cannot race ahead of permission, schema, and Preset
  hydration
- save-before-apply, concurrent sparse saves, permission loss, and stale generations
  have success/failure coverage
- CanvasTable header and toolbar share one panel/controller
- no local sorting of backend records exists
- Service docs and UI adapter agree on route and payload shape
- `@qfei-design/make-app-sort@^0.1.0` is consumed through public exports and its
  `package.ai.json.readOrder`; no host fallback exists
- no `group` UI/request exists yet, but sparse updates preserve future compatibility
