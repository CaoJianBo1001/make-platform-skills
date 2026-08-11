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
- Explicit mode accepts `recordIDList` with 1-200 unique positive numeric string
  IDs and rejects exclusions/filter/groupFilter.
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

- Upstream success with `data: true` maps to `allowed: true` and an empty list.
- Upstream 403 maps to denied.
- Other upstream errors remain operational errors and must not be downgraded to permission denial.
- A denied single explicit target may return that one ID without another call.
- For a denied multiple explicit or select-all target, `unauthorizedRecordIDList` is empty; do not perform diagnostic calls because the boolean upstream cannot identify rows.

UI shows the standard denial toast and blocks opening the edit surface. When the
response does not contain exact unauthorized row IDs, use toast-only feedback and
do not highlight rows. This applies to both multi-record explicit and select-all
targets. Highlight only exact row IDs already known from local validation or a
future authoritative response contract.

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
precheck. Preserve its error status/message through the Service's documented
error envelope.

## Boundary safety

- Forward the established request login context to Make gateway.
- Log route/adapter entry, success, failure, target mode, operation key, and safe
  ID counts. Do not log cookies, tokens, Authorization, full IDs, expressions, or
  record values.
- Use a request-scoped `AbortSignal` where the host stack supports cancellation.
- Update `apps/docs/api.md` before or with route changes.
