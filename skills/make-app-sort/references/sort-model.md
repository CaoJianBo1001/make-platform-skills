# Sort Model

The UI consumer uses the package's public pure, immutable helpers before wiring
React state. Do not recreate package model, draft, validation, sanitization, or
reordering helpers in host UI code.

The Service has a different boundary: raw HTTP input requires a Service-owned
strict transport parser before schema capability validation. That parser is not a
duplicate UI helper because it rejects unknown properties and malformed transport
shapes that package draft helpers do not accept responsibility for. See
`service-contract.md`.

## Canonical value

The package contract fixes `MAX_RECORD_SORT_COUNT = 5`.
The canonical output is an ordered `{ fieldKey, order }[]`. `asc` means 升序 and
`desc` means 降序. Array order is the priority contract: the first entry is the
highest priority. Field keys must be unique; duplicate fields are invalid.

Do not accept or emit `{ field, order }`, map objects keyed by field, direction
aliases, or an unordered set.

## Sortable candidates

Use runtime schema capabilities, not field types:

Package `getSortableRecordFields` and `isSortableRecordField` accept a field only
when its normalized key is non-empty and
`capabilities?.sortable === true`.
Do not infer sortable support from:

- `Make.Field.*` type allowlists
- current visible columns
- form `disabled` or read-only state
- row values or sample data
- local DSL/YAML
- the future `capabilities.groupable` flag

The UI and Service must use the same normalized runtime schema capability. The
Service remains authoritative when a client sends stale or handcrafted rules.

Use package `validateRecordSortDraft` and `sanitizeRecordSort`; let
`useRecordSortController` own draft creation, available-field filtering, immutable
updates, and reordering. Read `PUBLIC_API.md` before using lower-level helpers
directly.

## UI draft validation

Validate in this order:

1. no more than `MAX_RECORD_SORT_COUNT = 5`
2. every row has a non-empty `fieldKey`
3. every direction is `asc` or `desc`
4. every field is unique
5. every field exists in the current entity schema
6. every field has `capabilities?.sortable === true`

Return a stable result such as `{ valid: true }` or
`{ valid: false, message, field?: "sort" }`. Do not throw from UI-only pure
validation.

`sanitizeRecordSort` is for UI hydration from untrusted saved or response data. It
should:

- return `[]` for non-arrays
- preserve the first valid occurrence and source order
- trim field keys
- discard invalid directions, duplicates, missing fields, and non-sortable fields
- stop after five valid rules
- never mutate the input

Do not silently sanitize a user's current invalid draft on confirm. Validate and
show the error so the user understands which rule must change.

Do not use `sanitizeRecordSort` as the Service parser for Preset PATCH or records
queries. Those client boundaries must reject malformed values instead of silently
discarding them. Preset GET remains a tolerant read boundary in both Service and UI.

## Clear and defaults

`[]` means no user Preset sort. Persist clearing as `sort: []`.

If a project has a documented business default sort, apply it only in the Service
or query adapter after user sort resolves to empty. Do not display that business
default as though it were a saved user rule, and do not invent a default field.
