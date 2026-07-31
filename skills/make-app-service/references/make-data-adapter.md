# Make Data Adapter

Use this reference when implementing Service adapters that call Make platform APIs.

## Adapter ownership

The adapter layer owns Make/backend-specific details:

- gateway-origin config and adapter-owned path construction
- deployment-injected `appKey` from `config.appKey`
- `X-Make-Target`
- consuming already-prepared auth or forwarded request context from the host auth/runtime layer without inventing auth policy
- forwarding the incoming request login context required by Make gateway
- Make response envelope parsing
- Make API error detection
- pagination translation
- request/response shape normalization
- file upload/download body mapping

Route handlers and UI code should not know these details.

## Request wrapper

Use a shared request wrapper for Make calls.

The wrapper should:

- build the URL from normalized gateway origin, runtime mode, the correct Make service scope, and a relative path
- attach or encode `config.appKey` according to the Make Meta/Data API contract
- attach required Make headers
- attach forwarded login/session context required by Make gateway, including `Cookie` for cookie/unified-login apps and host-approved auth headers from the incoming request
- send JSON or multipart bodies
- parse JSON envelopes safely
- treat non-2xx HTTP as errors
- treat Make `code !== 200` as errors
- throw a typed adapter error with path, target, status, and Make code
- log start/success/failure with redacted context

Do not duplicate Make fetch logic in each route.

Do not implement Make-backed Service APIs by shelling out to `makecli` or reading makecli command output. `makecli` is a developer/deployment tool, not a published Service runtime dependency, and online Service containers should be assumed not to have it installed.

## Make API references

Use the Make backend API designs as the source of truth for Service-to-Make calls:

- Meta API: `https://git.qtech.cn/make/AgenticDSL/-/blob/main/Design/MetaAPIDesign.md?ref_type=heads`
- Data API: `https://git.qtech.cn/make/AgenticDSL/-/blob/main/Design/DataAPIDesign.md?ref_type=heads`

Do not infer Meta/Data payload shapes from UI components, local DSL files, screenshots, or demo data. If those docs are unavailable in the current environment, preserve the host project's existing adapter contract and mark the missing API reference as a blocker before inventing new Make request shapes.

## Runtime base URL config

Adapters consume normalized Service config. Route handlers should pass adapter parameters only; they should not know Make domains or stitch absolute gateway URLs.

Default base selection:

- Published runtime: `MAKE_API_BASE_URL` / `MAKE_SERVER_URL` configure the k8s gateway origin only, for example `http://make-gateway.make-dev`.
- Local preview runtime: when `MAKE_APP_LOCAL_PREVIEW=true`, derive the gateway origin from `makecli configure resolve --target local-preview --output=json` field `make_api_origin`. Public gateway calls pass through nginx and use the `/api/make` scope.
- schema/meta calls follow Meta API design and use runtime-mode scope plus `makeSchemaPath`: local preview `${publicGatewayOrigin}/api/make/meta/**`, published `${internalGatewayOrigin}/make/meta/**`. Schema reads are upstream `POST` calls with `X-Make-Target: MakeService.GetResource` and body `{ appKey: config.appKey }`.
- business/data calls follow Data API design and use runtime-mode scope plus Data API paths: local preview `${publicGatewayOrigin}/api/make/data/**`, published `${internalGatewayOrigin}/make/data/**`.
- `/make` and `/api/make` are adapter path scopes selected by runtime mode, not generic env var values.
- auth forwarding belongs to `make-app-auth`; when Service-fronted auth proxy code needs the gateway, it should also join the gateway origin with its documented service scope instead of changing `MAKE_API_BASE_URL`.
- candidate, lookup, record, and file adapters use the relevant normalized base from config, not inline environment reads.
- all Make Meta/Data calls that require an app key must use `config.appKey` from `MAKE_APP_KEY`; route handlers must not accept `appKey` from UI query/body/header input.
- record reads use the Make gateway/Data API path selected by runtime mode after joining the gateway origin with the Make service scope. Do not replace this with makecli command output, local files, demo data, or direct UI-supplied record payloads. Local preview may use makecli credentials to call the public API, but it must still call the Make API, not makecli subcommands, for runtime records.

For published Service-to-internal-make-gateway calls, the normalized base URL is the gateway origin. The adapter adds the Make platform `/make` path scope:

```text
MAKE_API_BASE_URL=http://make-gateway.make-dev
POST ${gatewayOrigin}/make/meta/v1/schema
POST ${gatewayOrigin}/make/data/v1/record
```

For local-preview Service-to-public-gateway calls, the public gateway origin follows makecli's resolved local-preview target. `make_api_origin` is the bare origin. If legacy fallback reads a path-scoped API base such as `https://dev-make.qtech.cn/api/make`, normalize it into origin `https://dev-make.qtech.cn` plus scope `/api/make` inside the local-preview adapter. Example:

```text
MAKE_APP_LOCAL_PREVIEW=true
makecli configure resolve --target local-preview --output=json
POST ${publicGatewayOrigin}/api/make/meta/v1/schema
POST ${publicGatewayOrigin}/api/make/data/v1/record
```

Do not set published `MAKE_API_BASE_URL` to a path-scoped value such as `http://make-gateway.make-dev/make` or `http://make-gateway.make-dev/api/make`. Do not append `/meta/v1/**` or `/data/v1/**` directly to the gateway origin. Do not use the browser-facing `/api/make` prefix for published Service upstream calls; `/api/make/**` is only for browser/ingress access and local-preview public gateway access.

Do not hard-code concrete Make dev/test/prod domains, namespace-local gateway hostnames, or environment-to-domain maps in adapters. K8s, backend, operations, Make tooling, or deployed runtime config inject the actual base URL.

## Schema adapter

Schema adapter should:

- fetch remote runtime schema from Make/backend API
- call the runtime-mode schema path with `POST`, `X-Make-Target: MakeService.GetResource`, JSON `Content-Type`, and body `{ appKey: config.appKey }`
- normalize app display name, entities, fields, relations, options, and lookup metadata
- support known backend variants such as `entity.properties.fields` and `entity.fields`
- expose `getAppSchema()` and `getEntityFields(entityKey)` or host-equivalent methods
- cache or reuse in-flight schema requests when the host project needs it, but provide a clear invalidation path for refresh

Do not use local DSL/YAML as the only schema source for published runtime.

## Record adapter

Record adapter should expose stable operations:

```ts
type MakeRecordAdapter = {
  listRecords(entityKey, params): Promise<{ records: unknown[]; total: number }>;
  listRecordGroups(entityKey, params): Promise<{ groups: unknown[]; total: number }>;
  getRecord(entityKey, recordID): Promise<unknown>;
  createRecord(entityKey, data): Promise<string>;
  updateRecord(entityKey, recordID, data): Promise<void>;
  deleteRecords(entityKey, recordIDs): Promise<unknown[]>;
};
```

Rules:

- list, detail, and lookup target-record reads must call the Make gateway/Data API record endpoint selected by runtime mode: local preview `/api/make/data/v1/record`, published `/make/data/v1/record`
- request wrappers must forward the inbound login/session context expected by Make gateway; do not drop cookies or the host-approved auth context when Service calls the gateway
- do not implement list/detail by invoking `makecli` or by reading local makecli credentials/config at request time
- list response normalizes total count; if backend total is missing, use returned record count as fallback
- detail uses the backend single-record operation when available
- create returns `recordID` only when that is the UI contract; otherwise document the exact response shape
- update/delete return stable success shape to routes
- record list filters should be passed to Make as an `Expression` object, usually `{ expression }`; omit empty filters before calling Make unless the host explicitly documents a different compatibility contract
- record list `groupFilter` should be passed to Make as a separate `Expression` object for grouped leaf rows; do not merge it into `filter`
- do not translate new UI filters to arrays, `{}`, blank raw strings, or old object DSL; raw non-blank CEL strings are only a legacy normalization path when the host already needs it
- record-groups should call `MakeService.ListResources` with non-empty `group`, one-based `pagination`, and no `fields` or ordinary `sort`
- ordinary grouped leaf records should call records mode with `group` omitted or `null`; never send `group: []`
- do not mutate formatted UI display labels into submit payloads

## User and department adapters

Default candidate adapter contracts:

```text
listUsers({ keyword, pagination }) -> { users, total }
listDepartments({ keyword, pagination }) -> { departments, total }
```

Rules:

- user id is `userId`; label is `userName`; optional avatar is `avatar`
- department id is `departmentId`; label is `departmentName`
- flatten department trees before returning selector-ready lists when UI expects flat options
- preserve backend pagination where available
- do not fabricate local candidates in production
- do not call these adapters per table cell

## Lookup options adapter/service

Lookup option service should:

1. read runtime schema
2. find the source entity and lookup field
3. resolve relation metadata and target entity
4. find the target display field
5. list target records with only needed fields
6. return `{ options: [{ label, value }], total }`

Rules:

- `value` is target `recordID`
- label comes from the target display field, with a safe fallback only when documented
- target record reads still go through `/make/data/v1/record` with forwarded login context, not makecli
- reject unsupported relation direction, non-lookup fields, and missing target metadata with 400
- do not leak full target records into dropdown APIs by default

## Lookup relation update service

Use a service layer, not a route-local helper, for editable lookup relation updates.

Rules:

- editable lookup fields require an allowlist or host policy
- read current record before updating when Make replaces all relations from submitted `qfei_relation`
- synthesize the full relation snapshot server-side
- preserve unrelated relations
- validate single vs multiple cardinality
- reject client-submitted `qfei_relation` or strip it before update
- test clearing, replacing, multi-field updates, and non-allowlisted fields

## File adapter

File adapter should expose:

```ts
uploadFiles(entityKey, recordID, fieldKey, files)
deleteFile(entityKey, recordID, fieldKey, { fileName, filePath })
downloadFile(downloadPath)
```

Rules:

- upload requires persisted `recordID`
- map host route `fieldKey` to the backend file field key expected by Make
- normalize non-ASCII multipart filenames if the backend cannot handle them
- preserve content type and extension where possible
- download proxy should stream backend status/content-type/content-disposition where safe
- redact download query strings in logs
- do not return JSON for file download bodies unless the UI contract explicitly downloads metadata only; image/PDF previews need binary bytes or a stream
- if the Make Data download endpoint requires `Authorization`, do not expose that endpoint directly to UI or use it as `<img src>`. Browser resource tags cannot attach custom headers.
- in Service-fronted unified-login apps, verify the browser App session with make-gateway, for example `GET ${makeAuthBaseUrl}/auth/current-context` using forwarded Cookie and host context, before using any Service-side download token
- use a deployment-injected token such as `MAKE_API_TOKEN` only inside the Service download adapter and only for the download edge case; do not substitute it for normal schema, record, candidate, lookup, upload, or delete requests that should use the forwarded login context
- remove or overwrite inbound browser `Authorization` before attaching the Service download token so client headers cannot override the server credential
- keep download tokens out of `/api/config`, UI environment variables, logs, error messages, and tests snapshots

## Forwarded headers

Make-backed Service calls to gateway must preserve the request context needed by the gateway to authenticate and resolve the published App:

- `Cookie` for cookie/unified-login apps
- an inbound `Authorization` header only when the host Service contract already uses bearer auth
- `X-Forwarded-Host`
- `X-Forwarded-Proto`

Derive or sanitize forwarded host/proto through the shared helper described by `make-app-auth` / `make-app-runtime`; do not blindly trust arbitrary client-supplied forwarded headers. Redact all auth/session header values in logs and errors.

`make-app-service` owns the requirement that Make-backed record/data adapters must not drop the established login context before calling gateway. The exact login implementation, session lifecycle, 401/403 UX, and auth proxy behavior still belong to `make-app-auth`.
