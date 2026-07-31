# Service Contract

Use this reference for UI-Service routes, strict transport parsing, Make Data
payloads, and response semantics.

## UI-Service routes

Expose grouping only through the Service. The UI must not call Make Data directly
and must not handle Make tokens.

Entity Preset:

- `GET /api/entities/:entityKey/preset`
- `PATCH /api/entities/:entityKey/preset`

Records:

- `GET /api/entities/:entityKey/records`
- accepts JSON-query `fields`, `filter`, `groupFilter`, `sort`, and `pagination`

Record groups:

- `GET /api/entities/:entityKey/record-groups`
- accepts JSON-query `filter`, `groupFilter`, `group`, and `pagination`

In unified-login projects these paths may live under a host auth scope such as
`/api/make/app/**`. Follow the host's existing Service route prefix, but keep the
payload contract unchanged.

Update API docs before changing UI or Service behavior.

## Preset contract

`GET preset` returns normalized dimensions:

```json
{
  "filter": null,
  "sort": [],
  "group": []
}
```

`PATCH preset` accepts sparse updates. The body must contain at least one of
`filter`, `sort`, or `group`. Saving group sends only:

```json
{ "group": [{ "fieldKey": "<groupFieldKey>", "order": "asc" }] }
```

Clearing group sends:

```json
{ "group": [] }
```

Group PATCH is strict: reject non-array group, more than three entries, duplicate
field keys, blank field keys, invalid order, unknown fields, non-groupable fields,
and unknown properties such as `properties`.

Preset GET is tolerant: sanitize stale upstream group values against current schema
and return `[]` when saved values are no longer valid.

## Records contract

Records mode is ordinary Make Data pagination. The Service forwards:

```json
{
  "appKey": "<appKey>",
  "entityKey": "<entityKey>",
  "fields": ["<fieldKey>"],
  "filter": { "expression": "<filterExpression>" },
  "groupFilter": { "expression": "<groupPathExpression>" },
  "sort": [{ "fieldKey": "<sortFieldKey>", "order": "desc" }],
  "pagination": { "page": 1, "size": 50 }
}
```

Rules:

- `pagination.page` is one-based at the Service/Make boundary.
- `filter` and `groupFilter` are independent `Expression` objects.
- Missing, `null`, or blank expressions mean no filter at that position.
- If `groupFilter` object is provided, `expression` must exist and be a string.
- `group` must be omitted or `null` in grouped leaf-record requests.
- Do not send `group: []` to records mode.

`sort` applies to ordinary records and grouped leaf records only.

## Record-groups contract

Record-groups uses the same Make Data `MakeService.ListResources` action in
grouping mode. The Service forwards:

```json
{
  "appKey": "<appKey>",
  "entityKey": "<entityKey>",
  "filter": { "expression": "<filterExpression>" },
  "groupFilter": { "expression": "<groupPathExpression>" },
  "group": [{ "fieldKey": "<groupFieldKey>", "order": "asc" }],
  "pagination": { "page": 1, "size": 50 }
}
```

Rules:

- `group` is required and non-empty.
- `group` contains only the remaining group levels for the current request.
- Root group request uses the full applied group and omits `groupFilter` unless
  the product has a pre-existing groupFilter context.
- Child group request appends selected ancestors to `groupFilter` and passes only
  remaining group levels.
- `fields` and ordinary `sort` should not be forwarded; Make Data grouping mode
  ignores them.
- `pagination.total` is the current layer's group-item total, not a Record total.

Make Data upstream response:

```json
{
  "data": [
    {
      "value": "<groupValue>",
      "label": "<groupLabel>",
      "count": 12,
      "subGroupCount": 3,
      "fieldType": "<Make.Field.Type>"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 50,
    "total": 1
  }
}
```

Default UI-Service response:

```json
{
  "groups": [
    {
      "value": "<groupValue>",
      "label": "<groupLabel>",
      "count": 12,
      "subGroupCount": 3,
      "fieldType": "<Make.Field.Type>"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 50,
    "total": 1
  }
}
```

Map Make Data `data` to Service `groups`. Preserve `pagination.page`,
`pagination.size`, and `pagination.total`. If an existing host already exposes a
flat `total`, it must be documented as a Service alias derived from
`pagination.total`, never as the Make Data upstream shape.

`value` is the stable group path value. `label` is display text. Empty values
return `label` equivalent to 未填写 and `value: null`. `count` is all Records under
that group, including lower levels. `subGroupCount` is the next-level group-item
count; it is `0` when no group level remains. `pagination.total` is the
current-layer group-item total used for CanvasTable root/child group virtual
counts.

## Make Data upstream

Both ordinary records and record-groups call:

- path: `/data/v1/record` or the host gateway equivalent
- header: `X-Make-Target: MakeService.ListResources`

The Service injects deployment `appKey` and route `entityKey`; the browser must not
send `appKey`.

## Validation and errors

Strictly parse raw query/body input before calling Make Data:

- malformed JSON returns 400
- invalid group transport shape returns 400
- unknown group field or non-groupable field returns 400 or permission error
- field access denial returns a stable permission error
- upstream non-200 logical response must not be returned as a fake success

The Service should validate group fields against current runtime schema for both
Preset PATCH and record-groups. Records `groupFilter` is an expression boundary;
Service may parse shape but should not attempt to recompile backend CEL.

## Logs

Log entry, success, failure, and stale branches for:

- Preset get/update
- records with groupFilter
- record-groups
- Make Data adapter calls

Safe context includes entity key, group count, depth, page, size, result count, and
total. Do not log cookies, Authorization, tokens, full CEL expressions, records, or
raw upstream sensitive payloads.
