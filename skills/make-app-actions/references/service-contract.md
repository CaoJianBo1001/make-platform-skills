# Service contract

Use `make-app-service` for implementation structure, strict parsing, auth-context
forwarding, logging, and tests. The routes below are the default action contracts
when the host does not already expose equivalent documented routes.

## Row-write permission precheck

```text
POST /api/make/app/entities/:objectKey/record-write-permission
```

Body is `permission` plus exactly one write-target variant:

```json
{
  "permission": "data.record.bulkUpdate",
  "selectAllMode": true,
  "excludedRecordIDList": ["<recordID>"],
  "filter": { "expression": "<filterExpression>" },
  "groupFilter": { "expression": "<groupFilterExpression>" }
}
```

Rules:

- Accept only `data.record.update`, `data.record.delete`, or
  `data.record.bulkUpdate`.
- Explicit mode accepts `recordIDList` with 1-200 positive integer string IDs
  whose arbitrary-precision numeric identities are unique, and rejects
  exclusions/filter/groupFilter.
- Select-all mode accepts 0-200 unique excluded IDs, rejects `recordIDList`, and
  strictly validates optional nonblank `filter`/`groupFilter` Expression objects.
- Reject unknown properties and mixed target variants with 400. Never silently
  drop an invalid filter because doing so expands a write target.
- Service maps `objectKey` to the configured Entity and injects deployment
  `appKey`; UI does not choose arbitrary app/entity values.

Service makes one upstream Make permission precheck request for the complete
target:

```text
POST /data/v1/permission
X-Make-Target: MakeService.GetResource
```

Do not split or retry the target as per-record, per-ID, or chunked diagnostic
requests. Backend owns any internal batching.

Return a stable UI result:

```json
{
  "allowed": false,
  "unauthorizedRecordIDList": []
}
```

- Upstream success with `code: 200` and `data: true` maps to `allowed: true` and
  an empty list.
- In explicit mode (`selectAllMode=false`), an unauthorized target returns HTTP
  200 with business code `20000032` and
  optional `data.noPermissionRecordIds`. The code `20000032` alone establishes
  `allowed: false`; row metadata only enriches `unauthorizedRecordIDList`.
- `noPermissionRecordIds` accepts decimal strings and numeric integer tokens.
- Decode numeric `noPermissionRecordIds` losslessly from the raw JSON response
  before JavaScript `Number` coercion. Use a documented lossless JSON decoder that
  exposes integer tokens as decimal strings or `BigInt`; never round IDs through
  `Number` or impose an undocumented `Number.MAX_SAFE_INTEGER` limit.
- For row feedback only, canonicalize response IDs and frozen request ID strings
  as arbitrary-precision positive decimal integers, match the request identities,
  map each match back to the exact original request row key, and preserve backend
  order while deduplicating equivalent IDs.
- If metadata is missing, empty, malformed, fractional, non-positive, or contains
  out-of-target IDs, keep `allowed: false` with `unauthorizedRecordIDList: []`;
  never replace the confirmed refusal with a 502/contract error. Omit row
  highlights rather than guessing or reporting a partially trusted list. Records
  reported as missing, deleted, or outside the current tenant are still
  permission-denied targets and must not be reclassified by UI copy.
- In select-all mode (`selectAllMode=true`), preserve the documented opaque 403
  denial with an empty `unauthorizedRecordIDList`; this mode does not return
  `noPermissionRecordIds`.
- Apart from that select-all projection, relay completed HTTP errors with their
  original status, Content-Type and response bytes. In explicit mode, a whole
  object/operation refusal can be HTTP 403 with `reason: "permission_denied"`;
  retain this marker, `permissionKey` and optional administrator contacts for the
  host's scoped operation feedback. Do not replace the payload with code/message
  alone, manufacture denied row IDs, or continue to the real write.
- Unknown 403, 401, 503 and other business failures remain operational errors and
  must not be downgraded to permission denial. HTTP status 403 alone is not a
  permission classifier outside the established select-all projection.

For the stable `allowed: false` row/select-all result, UI shows
`勾选范围中存在无权限数据，请检查勾选范围` and blocks
opening the edit surface. Explicit mode marks only the
exact normalized `unauthorizedRecordIDList` rows with the host error-red whole-row
style when exact IDs are available. Unusable explicit metadata and select-all
denial remain toast-only, and still block the real write. Never mark the
complete selection or perform diagnostic requests to manufacture IDs.

## Batch update

```text
POST /api/make/app/entities/:objectKey/records/bulk
```

The request reuses the exact frozen target sent to precheck and adds normalized
mutation content:

```json
{
  "selectAllMode": false,
  "recordIDList": ["<recordID>"],
  "data": { "<fieldKey>": "<normalizedValue>" },
  "relations": []
}
```

Service sends one upstream Make request:

```text
POST /data/v1/field
X-Make-Target: MakeService.UpdateResource
```

Use the same strict target parser as precheck. In select-all mode, forward the
same exclusions, filter, and groupFilter unchanged. Convert authorized relation
changes to the documented `data.qfei_relation` shape.

The Service bulk route makes a single Make field request. It must not loop the single-record `/data/v1/record` endpoint, call `runRecordBatchMutation`, or issue one request per ID.

Return `{ "updatedCount": <number|null> }`. Explicit success may return the
target count. Select-all may return `null` when Make does not report affected
rows; UI then uses the snapshot's frozen selected count for success text.

The final write remains authoritative and may reject even after a successful
precheck. Preserve completed HTTP failure status, Content-Type and response
bytes, including permission details, just as for precheck.

### Completed action HTTP failures

After the existing select-all 403 projection and before replacing an error with
a host envelope, forward the completed response through the host's normal raw
response boundary. For example, `CompletedMakeResponse` below is a host-owned
response carrier, not an SDK or action-package export; the outer handler must
send its original status, Content-Type and bytes.

```js
function preserveActionHttpFailure(response) {
  if (response.status >= 400) throw new CompletedMakeResponse(response);
}
```

This does not classify permission, parse a raw error message for UI, or change
success/business-code decoding. Preserve code-first HTTP 200/code `20000032`
denial with optional exact-ID feedback and the established select-all 403 result.
The UI must stop on denied
precheck, show one scoped notice only for confirmed `permission_denied`, and
never automatically retry or replay delete/update after recovery.

## Boundary safety

- Forward the established request login context to Make gateway.
- Log route/adapter entry, success, failure, target mode, operation key, and safe
  ID counts. Do not log cookies, tokens, Authorization, full IDs, expressions, or
  record values.
- Use a request-scoped `AbortSignal` where the host stack supports cancellation.
- Update `apps/docs/api.md` before or with route changes.
