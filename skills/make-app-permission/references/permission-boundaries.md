# Permission boundaries

Use this reference before choosing scope, resource, permissionKey, Schema collection, or field access state.

## Contents

- Front-end App scope
- Single-App operations and resources
- Independent field dimensions
- Schema and permission intersection
- Matching semantics
- Route and backend boundaries
- Common mistakes

## Front-end App scope

This skill only consumes the front-end App permission response. Use the exact App scope `make://<tenantId>/meta/app/<appKey>` with `data.record.*`, `meta.field.*`, and `*.*.*`; do not use tenant-root or unrelated permission results for App routes, fields, buttons, or records.

## Single-App operations and resources

Common record keys:

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Entity metadata key:

```text
meta.entity.read
```

Normal edit/cell edit uses `data.record.update`; batch edit uses `data.record.bulkUpdate`. Keep all operation keys independent.

Common resources:

```text
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/meta/app/<appKey>/entity/*
make://<tenantId>/*/app/<appKey>
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>/entity/*
*
```

The namespace `*` in `make://<tenantId>/*/app/<appKey>` represents the same App family as response scope `make://<tenantId>/meta/app/<appKey>`; it is not tenant-wide platform permission.

## Entity metadata, table structure, and record data

The object, its visible columns, and its record values are three independent read surfaces:

| Surface | Required permission | Behavior when denied |
| --- | --- | --- |
| Sidebar/navigation and object route | `meta.entity.read` | Hide the entity and reject its dynamic object route. |
| Table shell and headers | `meta.entity.read` plus `fields ∩ meta.field.read` | Keep only the authorized field headers; an empty visible-field set uses the host's zero-column state. |
| List rows, record details, pagination, and any record-backed header action | `data.record.read` | Do not issue a record request and do not render record values. |

Schema membership remains an upper bound: an entity must exist in the permission-aware Schema before it can be displayed in navigation or entered by route. Within that bound, do not let `data.record.read` decide entity navigation or table-header visibility, and do not let `meta.entity.read` or `meta.field.read` authorize a record request.

For an entity that has `meta.entity.read` and readable fields but lacks `data.record.read`, mount the normal table shell with `visibleFieldsForEntity(...)` as its columns, provide an empty row array, and use a clear no-record-access state if the host has one. Derive the table rows as `canReadRecords ? sourceRows : []`, or clear the record store that actually supplies the table rows before render; disabling only the next request is insufficient because previously loaded rows may remain cached. Do not replace the table with a forbidden page or remove its headers. Record-backed controls such as load-more, detail opening, filtering, sorting, grouping, or selection remain disabled unless their own record-read contract is satisfied.

## Independent field dimensions

Creation, visibility, and editability are independent:

| Surface | Schema upper bound | permissionKey | Allowed access states |
| --- | --- | --- | --- |
| Create form | `createFields` | `meta.field.create` | `creatable`, `*` |
| List/detail/filter | `fields` | `meta.field.read` | `readonly`, `editable`, `partialMask`, `fullMask`, `*` |
| Edit/cell edit | already-visible `fields` | `meta.field.update` | `editable`, `*` |

Therefore:

- `creatable` does not grant visibility or editability.
- `editable` does not grant creation.
- Selecting edit permission does not synthesize visibility. The value `editable` is readable only when it is actually returned in a matched `meta.field.read` row.
- `data.record.create` allows the operation entry/handler but grants no create-field access.
- `meta.field.create` grants create-field access but does not allow opening or submitting the create operation. The operation and field dimensions are independent and neither may synthesize the other.
- `meta.field.read` does not add fields to a create form.
- An editable-but-invisible field remains absent from edit/list/detail.
- A create-only invisible field appears in create mode and nowhere else.

`partialMask` and `fullMask` are read/display states only. `hidden` grants no dimension.

## Schema and permission intersection

Treat the permission-trimmed Schema collections as separate contracts:

- `fields`: visible structural upper bound for list, detail, filter, and edit.
- `createFields`: create structural upper bound; missing or invalid means empty, with no fallback to `fields`.
- `editableFields`: currently ignored. Preserve unknown response fields when appropriate, but do not consume this collection for edit behavior.

Compute:

```text
entity = permission-aware Schema entity ∩ meta.entity.read
create = createFields ∩ meta.field.create(creatable|*) ∩ create-capable UI fields
display = fields ∩ readable permission
edit = display ∩ editable permission ∩ edit-capable UI fields
records = data.record.read ? fetched rows : []
```

ID and audit fields listed by `system-field-contract.md` must not enter the create set. An audit field may remain editable when it is in visible `fields`, has update permission, and has a supported editor.

Schema membership never replaces principal permission checks, and principal permission never permits fields outside the relevant Schema upper bound.

## Matching semantics

- Match exact permission keys, `data.record.*`, `meta.field.*`, `*.*.*`, and valid three-part wildcards.
- Reject malformed permission rows: `permissionKey` must have exactly three non-empty segments, `effect` must be `allow` or `deny`, and the current scope must be an exact `make://<tenantId>/meta/app/<appKey>` App scope. Derive the current App resource from that scope; an extra `appResource` value must exactly equal the scope, while explicit `null`, blank, non-string-equivalent, or conflicting values fail closed. One malformed row poisons the whole access snapshot; never drop it and retain sibling allows.
- Treat requested entity and field keys as concrete string identifiers, not policy patterns. Non-strings (including `null`, numbers, arrays, and objects), blank/whitespace strings, and the literal `*` must fail closed before resource or field wildcard matching; `*` is valid only inside permission statements.
- Accept only the documented permission resource families: global `*`, or the current tenant/App with namespace `meta` or IAM alias `*`, optionally followed by an exact or wildcard entity. Do not treat arbitrary namespaces or wildcard tenant/App segments as App permission.
- Resource specificity is a fixed semantic order: global `*` < current App (canonical or namespace alias) < current App `entity/*` < current App `entity/<exactEntityKey>`. Prefer the highest matching level for allow field ranges and merge allows only at that same level. Canonical `.../meta/app/<appKey>` and IAM namespace-alias `.../*/app/<appKey>` resources at the same App/entity level have equal semantic specificity; string length or wildcard character counts must not change this order.
- Apply a matching `effect: deny` before allows; it denies the matching permission dimension. A `data.record.*` deny therefore denies its operation, while a `meta.field.*` deny denies only that field-access dimension. Do not encode a field-only hidden exception as a deny statement.
- Let a named field entry override both `*` and empty/unrestricted baselines across all same-specificity allow ranges so broad policies can retain named exceptions. If any same-specificity allow names the field, evaluate only the named values and do not fall back to another row's `*` or empty `fieldAccess`. Within that named set, `hidden` is deny-like and wins over `creatable`, `readonly`, `editable`, masks, or `*`; conflicting same-level named allows must never widen a hidden field. This field decision does not convert the allow statement into an operation-level deny.
- Treat empty `fieldAccess` on the most-specific allow as unrestricted for that permissionKey:
  - all `createFields` for `meta.field.create`;
  - all `fields` for `meta.field.read`;
  - all already-visible `fields` for `meta.field.update`.
- Distinguish an omitted or empty `fieldAccess` from a malformed value. An omitted property or empty object is the intentional unrestricted form; explicit `null`, a non-object, an array, a blank field key, an empty state list, an unknown state, or a state list containing non-strings is invalid IAM data and the access snapshot must fail closed instead of being normalized to `{}`. Null/primitive envelopes or rows and non-array `permissions` must return denied access without throwing.

Interpret access states inside the matched permissionKey. Do not treat a value such as `*` as a global field grant detached from its create/read/update dimension.

In an expanded IAM runtime response, a wildcard field baseline may coexist with a named exception, for example `{ "*": "creatable", "secret": "hidden" }`; evaluate that shape defensively as runtime `fieldAccess`. Reserve `effect: deny` for denying the whole matched permission dimension; a matching `data.record.*` deny correctly fails closed for that operation.

## Route and backend boundaries

- Protect App, object, create, and fixed routes; require `meta.entity.read` inside the dynamic object route as well as navigation, because menu hiding is insufficient and direct URLs bypass the sidebar.
- Do not load list/detail without `data.record.read`; this must stop record requests and rows without hiding an entity-authorized table shell or its `meta.field.read` headers.
- Recheck create/update/delete/cell/batch handlers immediately before mutation.
- Let backend record APIs enforce row-level `dataCondition` and final write authorization.
- Do not cache permission-trimmed Schema across principals. Refresh permission and Schema together when access is refreshed.

## Common mistakes

- Using tenant-root scope or a platform filter for App permissions.
- Using `data.record.read` as the left-navigation, object-route, table-shell, or table-header gate.
- Removing authorized table headers when record read is denied instead of rendering the authorized columns with no rows.
- Rendering create forms from `fields` or `editableFields`.
- Falling back from missing `createFields` to visible `fields`.
- Treating `creatable` as readable because another permission statement also contains `meta.field.read`.
- Using `data.record.update/create` as field create/read/edit permission.
- Hiding create/edit because no writable field exists.
- Filtering visible controls but submitting the complete form store.
- Refreshing permissions without invalidating permission-trimmed Schema.
