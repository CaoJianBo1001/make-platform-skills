# Group Model

The UI consumer uses the package's public pure, immutable helpers before wiring
React state. Do not recreate package model, draft, validation, sanitization, or
reordering helpers in host UI code.

The Service has a different boundary: raw HTTP input requires a Service-owned
strict transport parser before schema capability validation. That parser is not a
duplicate UI helper because it rejects unknown properties and malformed transport
shapes that package draft helpers do not accept responsibility for.

## Canonical value

The package contract fixes `MAX_RECORD_GROUP_COUNT = 3`.

The canonical output is an ordered `{ fieldKey, order }[]`. `asc` means 升序 and
`desc` means 降序. Array order is the hierarchy contract:

- index 0 is the root group
- index 1 is the second-level group
- index 2 is the third-level group

Field keys must be unique. Duplicate fields are invalid.

Do not accept or emit `groupFieldKey`, `{ field, order }`, `{ fieldKey, sort }`,
map objects keyed by field, direction aliases, or an unordered set.

Unlike record sorting, grouping items must not include `properties`. Date range
sort properties do not apply to grouping. A group item containing `properties`,
including an empty string, is invalid at the Service boundary.

## Data API `group` versus Preset clear

The same ordered value is persisted in Entity Preset `group`, but empty-array
semantics differ by boundary:

- Preset `{ "group": [] }` means clear the user's saved grouping.
- Data API `group` omitted or `null` means ordinary Record pagination mode.
- Data API `"group": []` is invalid because it enters grouping mode with no group
  item.

When a grouped leaf row page is requested, return to ordinary Record pagination
mode by omitting `group` or passing `group: null`. Do not send `group: []`.

## Groupable candidates

Use runtime schema capabilities, not field types:

Package `getGroupableRecordFields` and `isGroupableRecordField` accept a field only
when its normalized key is non-empty and
`capabilities?.groupable === true`.

Do not infer groupable support from:

- `Make.Field.*` type allowlists
- current visible columns
- form `disabled` or read-only state
- row values or sample data
- local DSL/YAML
- the `capabilities.sortable` flag

The UI and Service must use the same normalized runtime schema capability. The
Service remains authoritative when a client sends stale or handcrafted rules.

## Lookup grouping

Do not make a platform rule that all `Make.Field.Lookup` fields are unavailable
for grouping. Lookup grouping is allowed only when the runtime schema marks the
Lookup field `capabilities.groupable === true`; that flag represents backend
validation of relation shape and target-field support. After reading runtime
schema, this must not become a blanket Lookup exclusion in platform guidance.

Backend-supported Lookup grouping requires a supported one-to-one or standard
one-to-many many-side FK shape. The final target field is selected by the Lookup
configuration and must itself be groupable; nested Lookup targets are unsupported.
Unsupported relation shapes must not surface as groupable in normalized schema.

A product may temporarily hide Lookup grouping as a scoped V1 decision, but the
skill must keep that as a project policy instead of a platform invariant.

## UI draft validation

Validate in this order:

1. no more than `MAX_RECORD_GROUP_COUNT = 3`
2. every selected row has a non-empty `fieldKey`
3. every direction is `asc` or `desc`
4. every field is unique
5. every field exists in the current entity schema
6. every field has `capabilities?.groupable === true`
7. no group row contains unsupported transport properties

Package validation may allow an empty placeholder row while the panel is open.
`toRecordGroupValue` filters placeholders before persistence. Never persist a
placeholder row.

`sanitizeRecordGroup` is for UI hydration from untrusted saved or response data.
It should:

- return `[]` for non-arrays
- preserve the first valid occurrence and source order
- trim field keys
- discard invalid directions, duplicates, missing fields, and non-groupable fields
- stop after three valid rules
- never mutate the input

Do not silently sanitize a user's current invalid draft on confirm. Validate and
show the error so the user understands which rule must change.

Do not use `sanitizeRecordGroup` as the Service parser for Preset PATCH or
record-groups queries. Those client boundaries must reject malformed values
instead of silently discarding them. Preset GET remains a tolerant read boundary in
both Service and UI.

## Direction controls

Grouping order controls the order of group items within each level. The package
uses `capabilities.sortable === true` to decide whether a grouped field can switch
between `asc` and `desc`. A groupable but non-sortable field can still be selected
for grouping, but its direction control is disabled and the saved order remains
`asc`.

Do not interpret `capabilities.sortable` as group eligibility.

## Clear and defaults

`[]` means no user Preset group. Persist clearing as `{ "group": [] }`.

Do not invent a default grouping field. If a product has a documented business
default group, hydrate it as an applied state only after schema confirms every
field is available, and do not present it as a saved user Preset unless it was
persisted.
