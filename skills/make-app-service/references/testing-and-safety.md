# Testing and Safety

Use this reference before finishing Service API changes.

## Test first when changing behavior

For Service behavior changes, add or update tests before implementation when practical:

1. route contract test that fails
2. minimal implementation
3. adapter/unit tests for parsing or Make payload mapping
4. refactor while keeping tests green

If the repository has no Service test setup, add the smallest test harness consistent with the project stack or call out the blocker.

## Required test coverage

Route tests should cover:

- `/api/health`, local/probe `/health` when present, and `/api/config` do not expose secrets
- Service-fronted published routes for `gatewayBaseUrl: "/api/make"` projects use `/api/make/**`: at minimum test `/api/make/auth/**`, `/api/make/oauth/**`, and `/api/make/app/**` or the documented business paths; prefix-free compatibility routes alone are not enough. Older `/api` projects may keep `/api/auth/**` and `/api/app/**` only as an explicit legacy contract
- schema routes return normalized schema and fields
- record list parses `fields`, `filter`, `groupFilter`, `sort`, `pagination`
- record list sends Make filters as `{ expression }`, omits empty filters, and rejects malformed filter query/body values before calling the adapter
- record-groups parses `filter`, `groupFilter`, `group`, `pagination`, requires non-empty group, and validates `capabilities.groupable === true`
- Entity Preset GET/PATCH routes normalize filter/sort/group, update dimensions sparsely, and forward current login/session context
- Preset and records sort accept at most five unique `{ fieldKey, order }` entries, reject `{ field, order }`, and validate runtime `capabilities.sortable === true` before Make calls; use `make-app-sort` for the behavioral contract
- record list/detail call the Make adapter path selected by runtime mode and forward the required login/session context: local preview public gateway `/api/make/data/v1/record` with server-side makecli auth, published k8s gateway `/make/data/v1/record` with browser session context
- cancellable list/page routes abort their request-scoped signal when the client disconnects, propagate that signal to the downstream adapter, avoid writing a response or reporting a user-visible 5xx for `AbortError`, and remove lifecycle listeners after success, failure, or cancellation
- normal completion does not abort downstream work; test the framework's completion guard such as `res.writableEnded`, a completed flag, or response finished state separately from premature close
- invalid query/body returns 400 and does not call Make adapter
- create/update/delete/cell-update call the adapter with the documented payload
- detail uses the single-record adapter
- user and department candidates return `{ users,total }` and `{ departments,total }`
- lookup options reject non-lookup fields and return `{ options,total }`
- file upload/delete/download call the file adapter with safe path/body mapping
- file download proxy returns binary bytes or a stream with content type/disposition preserved where safe
- when a Service-side download token is configured, unauthenticated download requests fail before the Make download adapter is called
- when a Service-side download token is configured, authenticated download requests validate the App session through make-gateway before the adapter attaches the token
- custom orchestration routes cover success, unsupported input, and Make failure

Config tests should cover:

- `MAKE_APP_KEY` is required for Make-backed Services and is not replaced by an invented production default
- `MAKE_API_BASE_URL` takes precedence over `MAKE_SERVER_URL`
- `MAKE_SERVER_URL` works as a compatibility fallback
- gateway origins are trimmed and trailing slashes are removed
- internal make-gateway base URLs are strict gateway origins, for example `http://make-gateway.make-dev`
- `MAKE_API_BASE_URL=http://make-gateway.make-dev/make` and `MAKE_API_BASE_URL=http://make-gateway.make-dev/api/make` are rejected for new generated Service config
- Make Meta/Data adapters add the runtime-mode service scope when building upstream URLs: `/api/make` only for `MAKE_APP_LOCAL_PREVIEW=true`, `/make` for published runtime
- no Service runtime config or `.env.example` field is added for the fixed Make Meta/Data scope
- Service upstream base URLs reject `/api/make`; that prefix is only for browser or ingress access
- local preview tests cover `makecli configure resolve --target local-preview --output=json`: `make_api_origin` plus `/api/make`, never k8s-internal `/make`
- published-mode tests cover `MAKE_APP_LOCAL_PREVIEW=false` or absent: k8s-internal gateway origin plus `/make`, never public `/api/make`
- missing `MAKE_API_BASE_URL` and `MAKE_SERVER_URL` fails config loading with a non-secret error
- `/api/config` does not expose `appKey`, Make base URLs, tokens, cookies, service keys, or deployment-internal details

Adapter tests should cover:

- Make Meta/Data requests include the configured `appKey` when the backend API requires it
- route handlers do not accept `appKey` from UI query/body/header input
- record reads use `/api/make/data/v1/record` in local preview and `/make/data/v1/record` in published mode
- request wrappers preserve required inbound login context for gateway, such as `Cookie` for cookie/unified-login apps and host-approved auth headers when applicable
- no record/candidate/lookup/file/custom route shells out to `makecli` or reads makecli command output as runtime data
- Make response envelope `code !== 200`
- invalid JSON response
- non-2xx HTTP response
- headers and target names
- pagination defaults
- filter/sort translation, including `{ expression }` pass-through and empty-filter omission
- group translation, including record-groups `MakeService.ListResources`, records `groupFilter`, Data API `group: []` rejection, and grouped leaf records with omitted group
- Entity Preset `/preset/v1/entity` adapter targets `MakeService.GetResource` / `MakeService.UpdateResource`, injects deployment `appKey`, and sends only submitted dimensions
- file multipart body field names
- download path stripping and query redaction
- download adapter strips inbound browser `Authorization` before attaching a Service-side file download token
- schema variant normalization

## Safety review checklist

Before reporting Service work as ready:

- `apps/docs/api.md` matches changed routes and response shapes
- `apps/docs/api.md` documents the published browser-facing `/api/**` Service paths for Make Deploy Service-fronted Apps, not only local prefix-free paths
- generated Make POC Service code is not left as a flat `apps/service/src` tree; it uses route/app registration, `make-client/`, `services/`, `utils/`, config/logger, and colocated tests or host-equivalent layered folders
- route handlers remain thin: validation, delegation, error mapping, safe logs, and response sending only
- Make request construction, schema normalization, lookup/file orchestration, and custom workflows live in adapters/services/helpers instead of route-local files
- no runtime code reads local DSL/YAML as required schema/data source
- no published runtime route uses `makecli`, `npx makecli`, local makecli config, or makecli stdout as a data source
- Make-backed record reads go through the runtime-mode gateway scope and preserve the established login/session context: makecli token only in local preview, browser Cookie only in published runtime
- no route leaks raw Make response envelopes unless documented
- invalid client input is rejected before Make calls
- Entity Preset updates cannot overwrite sibling filter/sort/group dimensions
- no tokens, cookies, service keys, or signed URLs appear in logs or public config
- no Make Data raw download URL is used directly as an image/PDF preview URL in UI; previews point to the Service download proxy
- Make adapter gateway origins come from normalized Service config or `makecli configure resolve --target local-preview --output=json` in local preview, and the gateway scope is an explicit runtime-mode decision rather than a route-local string hack or env override
- Published Service internal gateway requests use gateway-origin plus explicit `/make` service scope, such as `/make/meta/**` or `/make/data/**`, not bare-host `/meta|data|auth/**` and not `/api/make/**`
- Local preview Service gateway requests use makecli resolve `make_api_origin` plus `/api/make/**`; tests must prove this branch is gated by `MAKE_APP_LOCAL_PREVIEW=true`
- UI/Service integration tests prove `auth.api("/app/**")` reaches `/api/make/app/**` when `gatewayBaseUrl` is `/api/make`; do not ship a published App whose UI requests `/app/**` directly under the UI static route. For older `/api` projects, keep equivalent legacy tests explicit instead of mixing the contracts
- candidate endpoints use real host/Make data sources, not demo arrays
- lookup updates preserve unrelated relations
- file upload requires persisted record identity
- UI does not bypass Service when the host project contract is `UI -> Service -> Make Data API`
- auth/session changes were handled by `make-app-auth`
- build/start/port changes were handled by `make-app-runtime`

## Suggested commands

Use the host package manager and actual package names. Common examples:

```bash
pnpm --filter <service-package> test
pnpm --filter <service-package> build
```

When route docs changed, also run any UI/service integration tests that consume `apps/docs/api.md` or generated API clients.

## Common regressions

- route behavior changed but `apps/docs/api.md` stayed stale
- Service started reading `apps/dsl/**` at runtime because schema API was missing
- UI candidate dropdowns were backed by local demo arrays
- record detail route called list and returned the first row
- Preset PATCH replaced the full object and erased a sibling sort/filter/group dimension
- records accepted a syntactically valid field that runtime schema did not mark `capabilities.sortable === true`
- Make adapter errors were swallowed and returned `{ ok: true }`
- `qfei_relation` partial update cleared unrelated lookup relations
- file route forwarded `fieldKey` when backend expects `field`
- signed download URL query was logged
- image preview used raw Make `/data/v1/download/**` URL and failed because `<img src>` cannot attach `Authorization`
- Service-side file download token was used without first validating the browser App session
- Service route mixed auth/session handling with business API code
- Service route called `makecli` for runtime records, which fails in online containers
- Service adapter dropped the request `Cookie` / login context before calling published gateway `/make/data/v1/record`, or used makecli token outside the local-preview branch
- runtime build or port rules were added here instead of `make-app-runtime`
