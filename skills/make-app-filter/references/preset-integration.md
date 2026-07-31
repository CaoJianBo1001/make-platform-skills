# Filter Preset Integration

Use this reference when an entity object list saves and restores advanced filters
through the current user's Entity Preset.

## Persisted boundary

Persist only the advanced-filter expression:

```json
{
  "filter": {
    "expression": "<filterExpression>"
  }
}
```

Clear it with `filter: null`.

Keyword search stays separate and is not persisted. Search may participate in the
current records query through `compileListFilter`, but it must never appear in an
Entity Preset PATCH.

Saving filter is a sparse update. Do not send a possibly stale `sort` or `group`
dimension.

## Permission-aware context

Use `make-app-permission` for object/list access policy. Filtering a user's
Preset follows the list-access gate even though it does not require record-edit
permission. Represent each request context explicitly:

```ts
const presetContext = { enabled, entityKey, generation };
```

Increment `generation` whenever `entityKey` or permission-enabled state changes.
Use that stable monotonic generation as the host filter wrapper `resetKey`;
never allocate a new object token on every render.

When permission becomes disabled or access is revoked, block new schema/Preset
GET, Preset PATCH, and records requests. Invalidate in-flight UI results, close
the filter panel and header menu, and clear entity-scoped draft/error state. If
an already-sent save commits upstream, reload the Preset after access is enabled
instead of applying its stale response.

## Load and hydration

Only while `presetContext.enabled`, load normalized runtime fields and:

```text
GET /api/entities/:entityKey/preset
```

before the first records query. Capture the complete permission-aware context
for both requests. Hydrate a non-empty saved expression with the package's
public parse/echo APIs and the same normalized field metadata used by the panel.

On the first Preset load failure, show a non-blocking error and use the documented
empty fallback only after the failed request settles. On a same-context reload
failure, preserve the last-known-good applied filter. Neither case may leave the
records query waiting indefinitely.

If the saved expression is not editable by the installed package:

- preserve the unsupported raw expression so backend filtering remains active
- keep the toolbar trigger in its active state and surface a visible compatibility warning
- do not overwrite it with an empty expression
- allow an explicit clear or replacement
- do not hand-write a parser or CEL/DNF merge in the host

If package public APIs cannot safely combine an unsupported raw expression with
search, report the package/backend capability mismatch rather than inventing a
host expression transformer.

## Confirm barrier

Filter confirmation follows:

```text
validate package draft
  -> compile advanced-filter expression
  -> PATCH Entity Preset with only { filter }
  -> save success for the active entityKey
  -> replace applied filter
  -> compile current records filter with session search
  -> records query reacts to applied state
```

Save success happens before applied state changes. Save failure keeps the previous
applied filter and records, leaves the panel open, and preserves the current draft
and validation state.

`清空所有` changes only draft until confirm. Confirming an empty valid draft sends
`filter: null`; it does not send `{ expression: "" }`, `{}`, or `[]`.

## Context transitions

Capture `{ enabled, entityKey, generation }` for every load/save. Increment the
generation on every entity or permission-enabled transition, including
`A -> B -> A`. Comparing only the final key is unsafe because an old A request
can otherwise look current again. When the context changes:

- close the panel and table header menu
- clear transient draft/search state
- load and hydrate the new entity's Preset
- ignore stale load/save responses whenever the captured generation no longer matches
- do not let an old response update applied state or trigger records

Preset loading errors and saving errors are separate. A local save error must not
replace the whole list page with a load-error screen.

Track concurrent sparse filter and sort saves in one shared Preset coordinator
using a `Set` of request IDs or an equivalent identity-aware pending-request
state. A panel-local submit lock prevents only duplicate submits from that panel;
it does not replace shared pending state. One request finishing removes only its
own request ID and must not clear shared saving state or a sibling request's
error while another save is still pending.

## Tests

Cover:

- first records request waits for Preset hydration
- supported expression round-trip
- unsupported expression is preserved, warned, and not overwritten
- save payload contains only `filter`
- `filter: null` clear
- search is not persisted
- save success updates applied state and reloads records
- save failure preserves old applied state and current draft
- stale entity load/save results are ignored
- an old `A -> B -> A` result is ignored by request generation
- permission disable blocks new schema/Preset/records requests and invalidates old results
- same-entity permission disable/enable advances generation and reloads Preset
- first-load failure settles to the documented fallback; same-context reload failure preserves last-known-good state
- concurrent sparse filter/sort saves keep saving active until all requests settle
- each concurrent save removes only its own request ID and preserves sibling errors
- sort and group dimensions are not overwritten
