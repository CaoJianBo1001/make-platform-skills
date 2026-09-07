# Sorting Service Contract

Use `make-app-service` to implement these routes and adapters. Document the chosen
browser-facing paths in `apps/docs/api.md`.

## Contents

- UI-Service routes and Make Entity Preset adapter
- Read normalization and strict sort validation
- Records forwarding
- Errors, logs, and group compatibility

## UI-Service routes

Default app-local contracts:

```text
GET   /api/entities/:entityKey/preset
PATCH /api/entities/:entityKey/preset
GET   /api/entities/:entityKey/records?sort=<json>
```

If the host uses `gatewayBaseUrl: "/api/make"`, its published browser path may map
the app-local route under `/api/make/app/**`. Preserve the host routing contract;
do not register only a prefix-free local path.

Preset GET returns a stable shape:

```json
{
  "filter": null,
  "sort": [
    { "fieldKey": "<sortableFieldKey>", "order": "desc" }
  ]
}
```

Missing upstream filter normalizes to `null`; missing upstream sort normalizes to
`[]`. Do not leak the raw Make response envelope.

Preset PATCH accepts a sparse body containing at least one currently supported
dimension:

```json
{ "filter": { "expression": "<filterExpression>" } }
```

```json
{ "sort": [{ "fieldKey": "<sortableFieldKey>", "order": "desc" }] }
```

`filter: null` clears advanced filter and `sort: []` clears user sorting. Saving
one dimension must not send, read-modify-write, or overwrite the other dimensions,
including `group`.

## Make Entity Preset adapter

Call:

```text
POST <runtime gateway scope>/preset/v1/entity
X-Make-Target: MakeService.GetResource
```

with:

```json
{ "appKey": "<deploymentAppKey>", "entityKey": "<entityKey>" }
```

Update uses the same `/preset/v1/entity` path with
`X-Make-Target: MakeService.UpdateResource` and only the submitted dimensions.

Example sparse update:

```text
X-Make-Target: MakeService.UpdateResource
```

```json
{
  "appKey": "<deploymentAppKey>",
  "entityKey": "<entityKey>",
  "sort": [
    { "fieldKey": "<sortableFieldKey>", "order": "desc" }
  ]
}
```

Read `appKey` from normalized Service config such as deployment-injected
`MAKE_APP_KEY`; never accept it from the UI. Reuse the host request adapter and
forward the established login/session context because Entity Preset is
current-user scoped.

Do not assume sparse update semantics from the request shape alone. Add an
integration test that verifies the upstream `UpdateResource` merge preserves an
existing sibling filter and group when only sort is sent. If the upstream cannot
provide atomic sparse merge, stop and report the contract gap; do not add a
racy Service read-modify-write fallback.

## Read normalization

Preset GET is a tolerant upstream read boundary. Normalize missing sort to `[]`
and discard/sanitize malformed, duplicate, over-limit, removed, and currently
non-sortable saved rules while logging safe discard counts. Do not return a 400
for invalid upstream stored data.

Preset PATCH and records query are strict client boundaries: reject the same
invalid rules with 400 before Make calls. This distinction lets old Presets recover
after schema changes without weakening new writes.

## Sort validation

Create one shared, Service-owned strict transport parser for Preset PATCH and
records query parsing. This parser is not a duplicate of the package's UI draft
helpers: it receives raw JSON/query data and rejects unknown properties before any
Make call. It must not use `sanitizeRecordSort` to accept, repair, or silently
discard invalid client input.

The strict parser validates:

- value is an array
- at most five entries
- each entry is an object with only `fieldKey` and `order`
- field key matches the host's normalized Make field-key contract
- direction is exactly `asc` or `desc`
- field keys are unique

The Service may share constants and transport-safe types where the host dependency
layout permits, but strict parsing remains a Service boundary. Use tolerant
sanitization only while normalizing Preset GET data.

Then authoritatively validate both Preset and records sort fields against the
current entity runtime schema:

```ts
field.capabilities?.sortable === true
```

Reject removed, unknown, or non-sortable fields with 400 before calling Make. Do
not validate with a hardcoded field-type list. Preset shape validation alone is not
enough because a client can submit a syntactically valid unsupported field.

Keep filter validation separate from sort validation.

## Records adapter

After validation, forward sort to Make Data `ListResources` in source order:

```json
{
  "sort": [
    { "fieldKey": "<primarySortableFieldKey>", "order": "asc" },
    { "fieldKey": "<secondarySortableFieldKey>", "order": "desc" }
  ]
}
```

Do not rename `fieldKey` to `field`, reorder entries, collapse to a map, or apply
sorting locally in Service/UI.

Null ordering, case sensitivity, locale collation, and relation-field comparison
semantics belong to Make Data/backend. Document and integration-test the upstream
behavior needed by the product; do not reimplement these comparisons in the
client or Service.

When user sort is empty, omit `sort` unless the host has an existing documented
business default. A business default belongs in the Service/query adapter and must
not be written into the user's Preset implicitly.

## Errors and logs

Return 400 for invalid client shape/capability before Make calls. These Preset and
records routes are non-proxy normalization routes: preserve their established
successful UI-Service response shapes. If a completed Make call returns an error,
forward its original HTTP status, body, and Content-Type unchanged instead of
mapping it to a host error contract. Do not return `{ ok: true }` after a failed
update.

New boundary functions add safe logs at:

- route entry, success, and failure
- Preset adapter entry, success, and failure
- records adapter entry, success, and failure
- key branches: clear sort, no user sort, schema capability rejection, and stale
  result handling in the UI boundary

Log `entityKey`, operation, dimension names, sort count, and safe error metadata.
Never log token, cookie, Authorization, secret, full Preset filter expressions,
signed URLs, or record bodies.

## Group compatibility

Do not implement grouping inside this Skill. Preserve any upstream group value by
sending sparse sort/filter updates, and route grouping behavior to
`make-app-group`.
