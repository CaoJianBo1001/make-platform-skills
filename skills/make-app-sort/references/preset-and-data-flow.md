# Preset and Data Flow

Use this reference for permission-aware Entity Preset hydration, save-before-apply,
concurrent saves, records timing, and stale requests.

## Contents

- State and access context
- Hydration and sparse persistence
- Concurrent saves and stale results
- Records query and logs

## State and access context

Keep normalized schema, loaded Preset, applied filter/sort, session search, panel
drafts, Preset loading, active save requests/errors, and records query state
separate. A save failure must not replace the page with a load-error state.

Use `make-app-permission` for object/list access policy. Sorting a user's Preset
does not require record-edit permission, but it must follow the list-access gate.
Represent each request context explicitly:

```ts
const presetContext = { enabled, entityKey, generation };
```

Increment `generation` whenever `entityKey` or permission-enabled state changes.
Use that stable monotonic number as `useRecordSortController.resetKey`; never pass a
new object on every render.

When permission becomes disabled or access is revoked, block new schema/Preset GET,
Preset PATCH, and records requests. Invalidate in-flight UI results, close panels,
and clear entity-scoped draft/error state. If an already-sent save commits upstream,
reload Preset after access is enabled instead of applying its stale response.

## Hydration

The first-load sequence is:

```text
resolve enabled entity context
  -> load normalized schema + GET /api/entities/:entityKey/preset
  -> hydrate filter and sanitize sort against schema
  -> GET /api/entities/:entityKey/records with applied filter/sort
```

Schema and Preset may load concurrently only when access is enabled. Records wait
for both and never issue an unhydrated default request first.

On first-load Preset failure, show a non-blocking error and use the documented empty
fallback after the request settles. On same-entity reload failure, preserve the
last-known-good applied Preset. Sanitize saved sort so missing, duplicate, malformed,
non-sortable, and sixth-or-later entries never reach records.

## Confirm and sparse persistence

Confirmation follows:

```text
validate draft
  -> PATCH /api/entities/:entityKey/preset with { sort }
  -> save success in the active context
  -> replace applied sort
  -> reset table/query context
  -> request records
```

Save failure keeps previous applied sort and records, preserves the open draft, and
shows a local error. Do not optimistically apply and roll back.

Preset save success is the commit point. If the following records request fails,
keep the new applied sort, do not roll back Preset, close the confirmed panel, and
retry records with the new query.

Writes are sparse:

```json
{ "sort": [{ "fieldKey": "<sortableFieldKey>", "order": "desc" }] }
```

Saving sort must not send a stale `filter` or future `group`; saving filter must not
send sort. Service and upstream update semantics preserve sibling dimensions
without a client read-modify-write. Clearing uses `{ "sort": [] }`. Session search
is never persisted.

## Concurrent sparse saves

Package controller `saving` prevents duplicate confirmation of one sort draft. The
shared host lifecycle separately tracks concurrent filter and sort PATCHes with a
pending-request count or, preferably, a Set of active request ids:

- register before PATCH and remove that id once in `finally`
- never decrement a replacement context or below zero
- keep shared saving active while any current-generation request remains
- associate each failure with its request and dimension
- a successful save must not clear an error owned by another concurrent save
- stale completion may release only its registered slot and cannot update current
  values, panels, or errors

Do not serialize independent dimensions to simplify a boolean. Concurrency relies
on the atomic sparse-merge contract in `service-contract.md`.

## Stale results

Capture `enabled`, `entityKey`, `generation`, and request id for every Preset
load/save. Apply a result only when all still match the active context.

Treat `A -> B -> A` as three generations. Ignore the first A result even though its
`entityKey` matches again. Permission enable/disable is also a context transition.
The package `resetKey` and host request-generation checks are complementary.

For a disabled, changed, or stale context:

- ignore the result and do not update applied filter/sort
- do not close a current panel or mark the new context ready
- do not request records for the stale context
- log a safe stale-result branch

Entity/access changes close filter/sort/header menus, clear drafts and scoped
errors, hydrate only enabled contexts, and reset CanvasTable virtual-page state.

## Records query

Records use applied state only:

```ts
const query = {
  ...(filter ? { filter } : {}),
  ...(appliedSort.length ? { sort: appliedSort } : {}),
};
```

Encode query-string JSON once in the UI adapter and parse once in Service. Any
applied filter/sort change creates a new query context: cancel or ignore old
responses, clear cached virtual pages, and return to the first row/page. Search may
reload records without Preset persistence; refresh retains current applied state
and does not overwrite drafts.

Paginated/virtual lists require a documented stable ordering contract from Make
Data/backend. Forward user sort exactly and never inject a hidden tie-breaker. If
equal values cannot produce stable pages, treat pagination sorting as a blocker
rather than accepting duplicate or missing rows.

## Boundary logs

Log Preset adapter/hook entry, success, failure, clear, and stale branches with
`entityKey`, dimensions, and sort count. Never log expressions, records,
credentials, cookies, Authorization, tokens, or secrets.
