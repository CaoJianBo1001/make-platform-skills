# Testing and Pitfalls

Use TDD for grouping behavior: add a failing test, implement the smallest behavior,
then refactor pure model, UI state, Service parsing, and CanvasTable I/O separately.

## Pure model tests

Cover in one focused suite:

- zero through three valid group rules
- fourth rule rejected
- missing/blank field
- invalid order and exact `asc`/`desc` acceptance
- duplicate field rejection
- `groupable === true`, `groupable === false`, and missing capability
- arbitrary field type with `groupable === true`
- Lookup field with `groupable === true` allowed by generic platform helper
- array hierarchy retained after drag moves
- invalid/no-op move returns unchanged order
- placeholder rows excluded from persisted output
- sanitization preserves first valid occurrence and discards stale entries
- `properties` and every unknown group item field rejected at transport boundaries
- inputs remain immutable

## GroupFilter tests

Cover:

- empty path returns no `groupFilter`
- primitive string, number, boolean, and null literal formatting
- string escaping through JSON literal formatting
- object, array, Date, `NaN`, and `Infinity` rejected
- one, two, and three-level path conditions
- null group value generates `<groupFieldKey> == null`
- initial groupFilter preserved
- top-level OR expression appended by DNF distribution
- no generated `(A || B) && C` shape
- leaf-record request omits Data API `group`

## UI component tests

Verify:

- toolbar trigger label is `分组` or `N 分组`
- trigger is hidden when no groupable fields exist
- opening copies applied value into draft and adds a placeholder when empty
- no applied change or records/group request before confirm
- add action disappears at three rows
- `清空所有` affects draft until confirm
- outside close and escape discard unconfirmed changes
- validation failure keeps the panel open
- save success closes and updates applied state
- save failure keeps previous applied state and current draft
- duplicate confirm is blocked while saving
- package panel drag changes hierarchy from the handle and remains keyboard accessible
- host source has no direct dnd-kit imports or copied drag implementation
- `onConfirm` persists only, synchronous `onApplied` changes controlled state, and
  `onApplyError` observes post-persistence application/close failures
- `openWithField` rejects non-groupable fields, updates an existing row, and
  appends a new row when allowed
- `openWithField` at three rows preserves draft and shows a limit error
- non-sortable but groupable field has disabled direction controls and persists
  `asc`

## Integration tests

Verify:

- toolbar order is search, filter when enabled, group, sort, refresh
- first records or groups request waits for schema plus Preset load
- saved group is sanitized against current schema before data requests
- group confirm PATCHes only `{ group }`
- clear sends Preset `{ group: [] }`
- filter update does not send group; sort update does not send group; group update
  does not send filter or sort
- save success updates applied group and resets table/query/group cache context
- save failure does not reload records or groups
- Preset save success followed by root-group failure keeps the new applied group
  and retries without rolling back
- entity switch resets panel/header/table state
- entity switch discards stale responses from Preset load/save, old group pages,
  old leaf pages, and old records
- `A -> B -> A` rejects the first A result through `resetKey` and request
  generation
- permission enabled-to-disabled invalidates in-flight load/save results, closes
  group UI, blocks new Preset/records/record-groups requests, and does not apply
  stale save success
- a stable permission-aware context token resets the controller without changing on
  ordinary rerenders
- concurrent sparse filter, sort, and group saves keep shared saving active until
  all settle
- one concurrent save success does not clear another save's error
- refresh keeps current applied filter, sort, and group

## Service tests

Route and adapter tests cover:

- GET/PATCH Entity Preset success and upstream failure
- normalized `{ filter, sort, group }` response
- partial update payload and sibling dimension preservation
- Preset `group: []` clear
- malformed JSON, non-array group, empty Data API group query, more than three,
  duplicate, invalid direction, unknown property, unknown field, non-groupable
  field, and unauthorized field return stable failures
- Preset and record-groups both validate `capabilities.groupable`
- Preset GET sanitizes stale upstream group rules while PATCH/record-groups remain
  strict
- record-groups rejects `group: []`
- record-groups forwards `group` and pagination to `MakeService.ListResources`
- record-groups omits `fields` and ordinary `sort`
- records forwards `groupFilter` and omits `group` for leaf pages
- Data API `pagination.total` for record-groups maps to current-layer group total
- leaf records map ordinary records `pagination.total` to `totalRowCount`
- grouped mode does not filter records locally
- entry/success/failure logs redact credentials, expressions, and sensitive values

## CanvasTable tests

Verify:

- applied group creates `GroupTableComponent` with `groups` from field keys
- grouped mode adds `fixed: "left"` only when no left-fixed data column exists
  before creating `GroupTableComponent`
- existing left-fixed data column is not duplicated, modified, or replaced by the
  grouped-mode default
- ordinary non-grouped `CanvasTableComponent` mode does not get a first-column
  fixed-left default from this grouping rule
- root groups feed `setGroup(rootGroups, undefined, 0)`
- `groupVirtualOptions.totalRowCount` uses root group total
- child `group:load` sends remaining group levels and calls `setGroup`
- leaf `group:data:load` sends full path groupFilter and calls
  `setData(rows, groupValue, page, { totalRowCount })`
- failed or cancelled leaf load calls `markGroupPageLoadFailed`
- Detail Drawer open/close/fullscreen/header actions do not recreate
  `GroupTableComponent`, do not repeat `setGroup(rootGroups, undefined, 0)`,
  and do not trigger `fetchLeafPage`, `group:data:load`, or other leaf reloads
- rerendering with an equivalent but newly allocated grouping config object does
  not resync root groups or reload grouped leaf pages
- root group sync is guarded by `rootGroups`/`dataVersion` or an equivalent
  semantic token, not by parent object identity
- group/context changes clear loading-page dedupe sets and destroy old instances
- grouped V1 disables or omits cell editing unless separately specified

## Completion gate

Before reporting complete:

- tests were written and observed failing before implementation
- runtime schema, not local DSL or type allowlist, controls groupable candidates
- Lookup grouping is not blanket-disabled by platform code
- package UI model functions remain pure; Service transport parsing and I/O are
  isolated
- the first records/group request cannot race ahead of permission, schema, and
  Preset hydration
- save-before-apply, concurrent sparse saves, permission loss, and stale
  generations have success/failure coverage
- CanvasTable grouping and toolbar state share one applied group
- Service docs and UI adapter agree on route and payload shape
- `@qfei-design/make-app-group@^0.1.0` is consumed through public exports and its
  `package.ai.json.readOrder`; no host fallback exists
- `@qfei-design/canvas-table` grouping uses public `GroupTableComponent` APIs
- Data API `group: []` is never used for ordinary leaf records
