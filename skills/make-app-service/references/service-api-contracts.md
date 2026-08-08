# Service API Contracts

Use this reference when designing or reviewing `apps/service` routes and `apps/docs/api.md`.

## Contract source

`apps/docs/api.md` is the UI-Service contract source.

Before changing code:

1. read the existing API doc
2. identify which UI calls depend on the route
3. update the API doc with route, query/body, response, and error semantics
4. then update Service code and tests

Do not leave undocumented routes as the only integration path for generated UI.

For Make Deploy Service-fronted Apps, published browser-facing Service routes live under `/api/**` because the default HTTPRoute sends `/api` to App Service and `/` to UI. In Make App projects that use `gatewayBaseUrl: "/api/make"`, document the browser-facing paths under `/api/make/**`. Prefix-free routes such as `/app/**` or `/auth/**` may exist for local Service tests or compatibility, but they must not be the only documented or tested published path.

## Public routes

Default public routes:

- `GET /api/health` -> `{ status: "ok" }` for published App Service access
- `GET /health` -> `{ status: "ok" }` when the host uses prefix-free local health or k8s probes
- `GET /api/config` -> public config only, for example `{ listPageSize }`

Public config must not expose `appKey`, tokens, Make API base URLs, session cookies, service keys, or private deployment details.

## Auth proxy routes

For Service-fronted unified-login Apps, auth implementation details belong to `make-app-auth`, but the Service route contract must expose the browser-facing proxy paths used by the host project. For `gatewayBaseUrl: "/api/make"` projects, use `/api/make/auth/**` and `/api/make/oauth/**`; for older `/api` projects, use `/api/auth/**` and `/api/oauth/**`.

- `GET/POST /api/make/auth/**` -> transparent proxy to make-gateway auth scope
- `GET/POST /api/make/oauth/**` -> transparent proxy to make-gateway oauth scope

Rules:

- Preserve upstream status, `Set-Cookie`, `Location`, and body for auth proxy responses.
- Select the upstream gateway scope by runtime mode: local preview uses makecli resolve `make_api_origin` plus `/api/make/auth|oauth/**`; published runtime uses the k8s-internal gateway plus `/make/auth|oauth/**`.
- Do not forward `/api/make/auth/**`, `/api/make/oauth/**`, `/api/auth/**`, or `/api/oauth/**` unchanged to the internal gateway.
- If local development keeps `/auth/**`, also test the published browser-facing path.

## Schema routes

Default:

- `GET /api/schema` -> normalized `MakeAppSchema`
- `GET /api/entities/:entityKey/fields` -> normalized `MakeFieldSchema[]`

Rules:

- Normalize schema variants at the Service/API boundary before UI sees them.
- Keep entity key, entity display name, field key, field name, field type, options, relation metadata, required/read-only flags, and lookup target metadata when available.
- Preserve normalized field `capabilities`, including `sortable` and `groupable`,
  so UI candidates and Service validation use the same runtime Schema contract.
- Do not require local DSL/YAML files to serve schema in published runtime.
- If remote schema is unavailable, return a visible error status; do not silently serve stale generated fields unless the project explicitly has an offline-dev fallback.

## Record routes

Default:

- `GET /api/entities/:entityKey/records`
  - query: `fields`, `filter`, `groupFilter`, `sort`, `pagination`
  - complex values should be JSON strings unless the host contract says otherwise
  - response: `{ records, total }`
- `GET /api/entities/:entityKey/record-groups`
  - query: `filter`, `groupFilter`, `group`, `pagination`
  - complex values should be JSON strings unless the host contract says otherwise
  - response: `{ groups, pagination: { page, size, total } }`
- `GET /api/entities/:entityKey/records/:recordID` -> record
- `POST /api/entities/:entityKey/records`
  - body: `{ data }`
  - response: `{ recordID }`
- `PATCH /api/entities/:entityKey/records/:recordID`
  - body: `{ data }`
  - response: `{ ok: true }`
- `DELETE /api/entities/:entityKey/records/:recordID`
  - response: `{ ok: true }` or the host documented empty success
- `PATCH /api/entities/:entityKey/records/:recordID/cells/:fieldKey`
  - body: `{ value }`
  - response: `{ ok: true }`

Rules:

- Make-backed list and detail routes read records through the Service Make adapter using the runtime-mode gateway scope: local preview calls `/api/make/data/v1/record` with the Service-side makecli token, while published runtime calls `/make/data/v1/record` with the incoming request's login/session context forwarded to gateway.
- Do not serve record routes from `makecli`, local makecli config, makecli stdout, generated fixtures, or local DSL/YAML in published runtime.
- List and detail are separate contracts. Use Make single-record reads for detail when available.
- Validate `sort` shape. Prefer `{ fieldKey, order }`; reject ambiguous legacy `{ field, order }` in new contracts.
- Validate `filter` shape before passing to Make. New Record list contracts should use `{ expression }` for CEL-style filters and omit `filter` when no expression exists.
- Validate `groupFilter` shape before passing to Make. It is separate from `filter`; do not merge the two expressions in Service.
- Do not generate new Service contracts that send `filter: []`, `filter: {}`, blank raw strings, or old object-array DSL to Make Data. Raw non-blank CEL strings are legacy compatibility only when the host API already documents them.
- For grouped leaf records, ordinary records mode must omit `group` or pass `group: null`; never send `group: []` to Make Data.
- Record-groups uses Make Data grouping mode: `group` is required and non-empty, each item is `{ fieldKey, order }`, and `properties` is invalid.
- Record-groups should not forward `fields` or ordinary `sort`; grouping mode ignores them.
- Make Data upstream returns `{ data, pagination: { page, size, total } }`; Service
  maps `data` to `groups` and preserves `pagination.total` as the current-layer
  group total. If an existing host exposes a flat `total` alias, document it as a
  Service alias derived from `pagination.total`, not as the upstream response shape.
- Do not infer returned fields from arbitrary UI row keys. The UI should request fields by schema keys when it needs a smaller payload.
- Create/update payloads carry raw submit values, not formatted display labels.

Use `make-app-sort` for the canonical five-level ordered sort model, sortable-field
capability, save-before-apply behavior, and CanvasTable header linkage. Service
owns parsing and authoritative validation.

Use `make-app-group` for the canonical three-level ordered group model,
groupable-field capability, `groupFilter` path semantics, record-groups timing, and
CanvasTable grouped leaf pagination. Service owns parsing and authoritative
validation.

## Request cancellation

Use request cancellation for long-running, paginated, or supersedable Service calls when the UI may abandon an earlier request, including large-data virtual scrolling. Cancellation is an execution concern and must not become a query parameter, request body field, or response-shape change in `apps/docs/api.md`.

At the Service boundary:

1. Reuse the framework's request signal when it provides one; otherwise create one request-scoped `AbortController`.
2. Detect only a premature client disconnect or closed response through the host framework's documented lifecycle hook and abort the controller. Normal completion must not abort the downstream request signal: in Node/Express-style handlers, guard `close` with `if (!res.writableEnded) controller.abort()`; in other frameworks, use the equivalent completed flag, response finished state, or request-aborted signal. Cleanup should be idempotent because finish, close, and error hooks may arrive in different orders.
3. Pass the same `AbortSignal` through the service layer and every downstream Make adapter or `fetch` call for that work.
4. Treat `AbortError` as expected control flow. Do not map it to a user-visible 5xx, retry it automatically, or write a response after the connection has closed.
5. In `finally`, remove disconnect listeners and release request-local resources so completed requests do not retain handlers. Listener cleanup must not itself abort a normally completed response.

Keep cancellation scoped to the request that created it. Do not reuse an `AbortController` across users, routes, query contexts, or independent page requests. If one request starts several downstream calls, either pass the same signal to all calls or derive child controllers that are all aborted when the request ends.

The adapter must pass `signal` to the actual network client. Merely ignoring a late response protects state but does not save Service or Make gateway work. If an intermediate library cannot propagate `AbortSignal`, document that boundary as a performance limitation and retain stale-response guards; do not claim end-to-end cancellation.

Log safe route, entity, page, and cancellation reason at the route/adapter boundary. Do not log row payloads, filter contents, credentials, cookies, or tokens. Expected cancellation may use debug/info logging; non-abort failures retain the normal error contract.

## Entity Preset routes

Generate these routes when advanced filtering, record sorting, or record grouping
is enabled:

- `GET /api/entities/:entityKey/preset`
  - response: `{ filter: { expression } | null, sort: { fieldKey, order }[], group: { fieldKey, order }[] }`
- `PATCH /api/entities/:entityKey/preset`
  - sparse body containing at least one supported dimension
  - filter clear: `{ filter: null }`
  - sort clear: `{ sort: [] }`
  - group clear: `{ group: [] }`
  - response: `{ ok: true }` or the host's documented update result

For `gatewayBaseUrl: "/api/make"` hosts, also document and test the actual
published mapping under `/api/make/app/**`. Do not leave prefix-free compatibility
routes as the only path.

Rules:

- Call Make Preset `/preset/v1/entity` with
  `X-Make-Target: MakeService.GetResource` or
  `X-Make-Target: MakeService.UpdateResource`.
- Inject `appKey` from normalized deployment config and `entityKey` from the
  validated route. Never accept `appKey` from UI input.
- Forward the current login/session context because Preset is scoped to the
  current user, App, and Entity.
- Normalize missing filter to `null`, missing sort to `[]`, and missing group to
  `[]`; do not leak the raw Make response envelope.
- PATCH is sparse. Send only dimensions present in the request and preserve
  sibling dimensions, including `group`. Do not implement client-side read-modify-write
  of the whole Preset.
- Verify upstream sparse merge semantics with an integration test that updates one
  dimension and proves existing sibling dimensions remain unchanged. If the
  upstream contract is not atomic, report the blocker instead of adding a racy
  read-modify-write fallback.
- Validate filter through `make-app-filter` semantics.
- Validate Preset sort and records sort with the same pure shape parser: at most
  five unique `{ fieldKey, order }` entries and only `asc | desc`.
- Before Make calls, resolve current runtime fields and require
  `field.capabilities?.sortable === true` for every sort field. Do not use a
  field-type allowlist.
- Validate Preset group and record-groups with the same strict shape parser: at
  most three unique `{ fieldKey, order }` entries and only `asc | desc`.
- Before Make calls, resolve current runtime fields and require
  `field.capabilities?.groupable === true` for every group field. Do not use a
  field-type allowlist and do not blanket-disable Lookup grouping in platform
  Service guidance.
- Treat Preset GET as a tolerant upstream boundary: sanitize invalid/stale stored
  sort/group entries to a safe response and log discard counts. Keep PATCH,
  records, and record-groups strict with 400 responses for invalid client input.
- Preset `group: []` means clear saved grouping. Data API `group: []` is invalid
  and must not be generated for ordinary records or grouped leaf records.
- Add route and adapter logs at entry, success, failure, and clear branches with
  safe entity/dimension/count context. Redact credentials and filter values.

Use `make-app-sort` for sort UI/model/records timing and `make-app-filter` for
advanced-filter package/hydration/save behavior. Use `make-app-group` for group
UI/model/group-data timing.

## Candidate routes

Default:

- `GET /api/users?keyword=&page=&size=` -> `{ users, total }`
- `GET /api/departments?keyword=&page=&size=` -> `{ departments, total }`

Rules:

- User items expose `userId`, `userName`, and optional `avatar`.
- Department items expose `departmentId`, `departmentName`, and optional hierarchy fields. Flatten nested trees when the selector expects flat options.
- UI should not provide sort controls for these candidate APIs by default. If the Make/backend adapter supports a stable sort internally, keep it in Service.
- Do not return fake demo candidates from Service unless the project is explicitly in demo/mock mode.

## Lookup option routes

Default:

- `GET /api/lookup-options?sourceEntityKey=&lookupFieldKey=&keyword=&page=&size=`
  - response: `{ options: [{ label, value }], total }`
  - `value` is the target record identity, usually `recordID`

Rules:

- Resolve target entity and display field from runtime schema relation metadata.
- Read only the target record identity and target display field by default.
- Read target records through the runtime-mode gateway scope: local preview `/api/make/data/v1/record`, published runtime `/make/data/v1/record` with forwarded login/session context. Do not use makecli command output as runtime data.
- `keyword` applies to the target display field when supported.
- Do not let UI call generic target-record list APIs for every lookup dropdown unless the host contract explicitly chooses that path.
- Reject non-lookup fields and unsupported relation directions with 400.

## Lookup relation updates

Generate lookup update routes only when the UI needs editable lookup relations and the Service can update safely.

Default optional routes:

- `PATCH /api/entities/:entityKey/records/:recordID/lookup-relations`
- `PATCH /api/entities/:entityKey/records/:recordID/lookup-relations/:lookupFieldKey`

Rules:

- Use an allowlist for editable lookup fields.
- Read the current record relation snapshot before update when Make replaces `qfei_relation` as a whole.
- Preserve unrelated relations in the submitted `qfei_relation`.
- Ignore or reject client-provided `qfei_relation`; Service should synthesize it.
- Reject unsupported cardinality, missing target records, and non-allowlisted fields with 400.

## File routes

Default:

- `POST /api/entities/:entityKey/records/:recordID/files/:fieldKey`
  - multipart field: `file`
- `DELETE /api/entities/:entityKey/records/:recordID/files/:fieldKey`
  - body: `{ fileName, filePath? }`
- `GET /api/files/download/*`
  - proxies backend file download stream

Rules:

- Upload requires a persisted `recordID`.
- Map Service route `:fieldKey` to the backend file field parameter expected by Make; do not blindly forward route param names when backend names differ.
- Normalize multipart filenames when the backend cannot handle non-ASCII filenames.
- Do not expose raw signed backend download URLs when a Service download proxy exists.
- Strip or redact signed query strings in logs.
- Attachment previews must use a browser-compatible Service proxy URL, for example the host's `/api/make/app/files/download/*`, `/api/files/download/*`, or legacy `/api/app/files/download/*`, not raw Make Data paths such as `/data/v1/download/*`, `/make/data/v1/download/*`, or `/api/make/data/v1/download/*`.
- When the upstream Make download endpoint needs a bearer token, document that the Service validates the current App session before proxying the binary download with a Service-side token; unauthenticated requests should return 401 and failed auth checks should return a stable 5xx/contracted error.
- `/api/config` and any UI-facing file metadata response must not expose Make download tokens.

## Custom orchestration routes

Custom routes such as OCR or generated artifact creation are allowed when the user asks for them.

Rules:

- Keep them thin and testable.
- Put multi-step orchestration in `services/`, not directly in route handlers.
- Return stable UI-facing records or result objects.
- Do not make custom routes a place for unrelated business rules unless the user explicitly requested those rules.
