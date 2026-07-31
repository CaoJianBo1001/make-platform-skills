# Preset and Data Flow

Use this reference for permission-aware Entity Preset hydration, save-before-apply,
concurrent sparse saves, group-data timing, and stale requests.

## State and access context

Keep normalized schema, loaded Preset, applied filter/sort/group, session search,
panel drafts, Preset loading, active save requests/errors, group root data, group
page loading state, leaf page loading state, and ordinary records query state
separate.

Use `make-app-permission` for object/list access policy. Grouping a user's Preset
does not require record-edit permission, but it must follow the list-access gate.

Represent each request context explicitly:

```ts
const presetContext = { enabled, entityKey, generation };
```

Increment `generation` whenever `entityKey` or permission-enabled state changes.
Use that stable monotonic number as `useRecordGroupController.resetKey`; never pass
a new object on every render.

When permission becomes disabled or access is revoked, block new schema/Preset GET,
Preset PATCH, record-groups, and records requests. Invalidate in-flight UI results,
close panels, clear entity-scoped draft/error state, and destroy or reset the
current table instance.

## Hydration

The first-load sequence is:

```text
resolve enabled entity context
  -> load normalized schema + GET /api/entities/:entityKey/preset
  -> hydrate filter, sanitize sort, sanitize group against schema
  -> if applied group is empty: GET records
  -> if applied group exists: GET root record-groups page
  -> initialize CanvasTableComponent or GroupTableComponent
```

Schema and Preset may load concurrently only when access is enabled. Records and
record-groups wait for both and never issue an unhydrated default request first.

On first-load Preset failure, show a non-blocking error and use the documented
empty fallback after the request settles. On same-entity reload failure, preserve
the last-known-good applied Preset. Sanitize saved group so missing, duplicate,
malformed, non-groupable, and fourth-or-later entries never reach records or
record-groups.

## Confirm and sparse persistence

Confirmation follows:

```text
validate draft
  -> PATCH /api/entities/:entityKey/preset with { group }
  -> save success in the active context
  -> replace applied group
  -> reset table/query/group cache context
  -> request records or root groups for the new applied state
```

Save failure keeps previous applied group and data, preserves the open draft, and
shows a local error. Do not optimistically apply and roll back.

Preset save success is the commit point. If the following root-group or records
request fails, keep the new applied group, do not roll back Preset, close the
confirmed panel, and retry with the new query.

Writes are sparse:

```json
{ "group": [{ "fieldKey": "<groupFieldKey>", "order": "asc" }] }
```

Saving group must not send a stale `filter` or `sort`; saving filter or sort must
not send group. Service and upstream update semantics preserve sibling dimensions
without a client read-modify-write. Clearing uses Preset `{ "group": [] }`.
Session search is never persisted.

## Concurrent sparse saves

Package controller `saving` prevents duplicate confirmation of one group draft.
The shared host lifecycle separately tracks concurrent filter, sort, and group
PATCHes with a pending-request count or a Set of active request ids:

- register before PATCH and remove that id once in `finally`
- never decrement a replacement context or below zero
- keep shared saving active while any current-generation request remains
- associate each failure with its request and dimension
- a successful save must not clear an error owned by another concurrent save
- stale completion may release only its registered slot and cannot update current
  values, panels, or errors

Do not serialize independent dimensions to simplify a boolean. Concurrency relies
on the atomic sparse-merge contract in `service-contract.md`.

## Group data lifecycle

Applied group drives data, not the draft. Use a request key that includes:

- enabled state
- entity key
- schema generation
- applied filter expression
- applied sort
- applied group
- group page size
- leaf page size
- manual refresh token

When applied group is empty, use ordinary records. When applied group exists:

1. clear existing root groups and leaf caches
2. request root group page 1
3. store root groups and current-level total
4. initialize or refresh grouped CanvasTable with that total
5. handle child and leaf page loads through CanvasTable events

Use AbortController or equivalent cancellation for Service requests. If the host
request library cannot cancel, compare the captured request key before applying
results.

## Stale results

Capture `enabled`, `entityKey`, `generation`, and request id for every Preset
load/save, record-groups request, and leaf records request. Apply a result only
when all still match the active context.

Treat `A -> B -> A` as three generations. Ignore the first A result even though its
`entityKey` matches again. Permission enable/disable is also a context transition.
The package `resetKey`, host request-generation checks, and CanvasTable instance
namespace are complementary.

For a disabled, changed, or stale context:

- ignore the result and do not update applied filter/sort/group
- do not close a current panel or mark the new context ready
- do not feed rows or groups into a stale CanvasTable instance
- do not request records for the stale context
- log a safe stale-result branch

Entity/access changes close filter/sort/group/header menus, clear drafts and
scoped errors, hydrate only enabled contexts, and reset CanvasTable virtual-page
state.

## Boundary logs

Log Preset adapter/hook entry, success, failure, clear, and stale branches with
`entityKey`, dimensions, and group count. Log record-groups and leaf-page loading
with entity, depth, page, count, and total. Never log expressions, records,
credentials, cookies, Authorization, tokens, or secrets.
