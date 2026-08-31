---
name: make-app-service
description: "Use when generating, refactoring, reviewing, or debugging Make App apps/service APIs and UI-Service contracts. Covers route design, apps/docs/api.md, layered structure, Make adapters, schema normalization including independent fields/createFields collections, record CRUD, record-write-permission and records/bulk, list filter/sort/groupFilter parsing, record groups, Entity Preset, candidate/lookup/file proxies, runtime config, login-context forwarding, AbortSignal propagation, validation, logging, and tests. When single-app permissions are in scope, coordinate /api/make/app/principal/permission through make-app-permission. Use make-app-actions for action semantics, make-app-sort for sorting, make-app-filter for filtering, and make-app-group for grouping. Does not own UI layout, auth, permission policy, build/runtime, DSL, Make CLI deployment, or CanvasTable internals."
metadata:
  version: 0.1.8
---

# make-app-service

Use this skill for Make App Service API work in `apps/service`.

`make-app-service` owns the Service API contract between `apps/ui` and `apps/service`, thin Make Data API orchestration, Service route shape, Make adapter runtime config semantics, request/response normalization, Service-side validation, error mapping, boundary logging, and Service API tests.

It does not own record-action behavior (`make-app-actions`), sorting behavior (`make-app-sort`), filtering behavior (`make-app-filter`), grouping behavior (`make-app-group`), Make AI 助手 Artifact/transport semantics (`make-ai-assistant`), UI layout (`makeui`), authentication implementation (`make-app-auth`), single-app permission logic (`make-app-permission`), runtime build/start contracts (`make-app-runtime`), DSL modeling (`makedsl`), Make CLI execution (`makecli`), or CanvasTable rendering/editing (`canvas-table-integration`).

## Quick start

1. Inspect `apps/docs/api.md`, `apps/service/src`, `apps/service/src/config.ts` or host-equivalent config entry, existing tests, and the host project's declared data flow.
2. Preserve the host API contract. Update `apps/docs/api.md` before or with any Service route or response-shape change.
3. For Make Deploy's default route split, treat published browser-facing Service routes as `/api/**`. Prefix-free `/app/**`, `/auth/**`, or `/health` routes may be local compatibility only; do not document them as the published UI contract unless the deploy route actually exposes them.
4. Keep Service thin: validate UI input, normalize request/response shapes, call Make adapters, and return stable UI-facing contracts.
5. For a new Make POC Service, use the platform layered source tree by default: `app.ts`, `server.ts`, `config.ts`, `logger.ts`, `make-client/`, `services/`, `utils/`, with tests beside the route/adapter/helper they cover.
6. Do not read local DSL/YAML as a published runtime data source. Runtime schema and data come from Make/backend APIs or the host Service adapter.
7. Use shared adapters for Make Meta/Data/Preset calls, candidate APIs, lookup, files, and schema normalization. Build Make adapter URLs and `appKey` from normalized runtime config, not from route-local domains or UI input.
8. When single-app permission enforcement is requested or required by a repository-local delivery baseline, implement its Service proxy through `make-app-permission`. Otherwise preserve the existing permission flow and do not add `/api/make/app/principal/permission` solely because unrelated Service work is changing.
9. Preserve permission-trimmed Schema collections independently: normalize `fields` and `createFields` separately; missing `createFields` means an empty create collection with no fallback to `fields`. Preserve unknown response properties, including `editableFields`, but leave their permission semantics to `make-app-permission`.
10. If Schema is cached, isolate permission-trimmed results by tenant, principal/session, App, and access generation, and expose explicit invalidation for permission refresh.
11. For Make record actions, implement the documented `record-write-permission` route before edit UI and the `records/bulk` route for batch edit; use `make-app-actions` for target, permission, and one-request semantics.
12. For cancellable or supersedable requests, propagate a request-scoped `AbortSignal` from the Service boundary into every downstream adapter; read `references/service-api-contracts.md` before implementation.
13. If the Service change is for Make AI 助手, AI助手, AI 对话框, Artifact, SSE, Agent Gateway, or `@qfei-design/make-ai-assistant`, use `make-ai-assistant` for adapter selection and the assistant protocol first. Service then implements only the selected adapter's documented route handlers, proxy adapter, config validation, logging, cancellation, and tests. A Console selection uses the fixed Console BFF allowlist; it must not become a generic proxy.
14. Add or update Service tests for every changed route, adapter, validation path, and error path.
15. Read only the needed reference files from the map below.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Service route shapes and UI-Service response contracts | `references/service-api-contracts.md` |
| Request cancellation, client disconnect handling, downstream `AbortSignal` propagation | `references/service-api-contracts.md` |
| Service folder structure, layering, logging, errors | `references/service-layering.md` |
| Make Data API adapter rules, schema `fields` / `createFields`, records, files, lookup, candidates | `references/make-data-adapter.md` |
| Test requirements, contract checks, safety review | `references/testing-and-safety.md` |
| Single-app permission proxy, Make IAM principal permission, app-scope permission payloads | Use `make-app-permission` |
| Auth proxy, cookies, unified login, 401/403 behavior | Use `make-app-auth` |
| Service build output, port `3000`, `dist/server.js`, package scripts, publish readiness | Use `make-app-runtime` |
| UI layout, forms, detail display, visual states | Use `makeui` |
| Make field/table rendering in CanvasTable | Use `canvas-table-integration` |
| Record sorting, sortable capabilities, Preset sort, records sort | Use `make-app-sort` |
| Advanced filter package behavior and Preset filter | Use `make-app-filter` |
| Record grouping, groupable capabilities, Preset group, record-groups, groupFilter | Use `make-app-group` |
| Record action precheck, strict selection target, one-request batch update | Use `make-app-actions` |
| Make AI 助手, AI助手, AI 对话框, Artifact, SSE, Agent Gateway, assistant capabilities, interface domain config | Use `make-ai-assistant`; select `make-app` only for a confirmed App AI Chat contract, or `make-console` for configured/queryable Console Agent/Gateway. Service owns only the selected routes, validation, logs, cancellation, and runtime config consumption; Console is never a generic proxy |

## Scope boundary

- `make-app-service` defines Service-owned app APIs such as schema, records, candidates, lookup options, file proxy, and thin custom orchestration.
- It may document route names, query/body shapes, response envelopes, and adapter behavior.
- It may define Service-side Make adapter config semantics and environment variable names used by Service source, such as `MAKE_APP_KEY` and `MAKE_API_BASE_URL`, while leaving deployment injection to runtime/operations.
- It must not decide authentication implementation or OAuth/session mechanics; those belong to `make-app-auth`. It may still mount and document the App Service auth proxy path required by the host contract, normally `/api/make/auth/**` and `/api/make/oauth/**` for Make Deploy Service-fronted Apps that use `gatewayBaseUrl: "/api/make"`.
- It must not define single-app permission logic, IAM permission matching, route guards, operation buttons, or field editability; those belong to `make-app-permission`. It should still provide the Service layering, logging, tests, and docs needed by that permission proxy.
- It must not decide build output, Service port, Docker/K8s entrypoint, package scripts, workspace manifests, or publish readiness; those belong to `make-app-runtime`.
- It must not define business models, entities, field meanings, relations, or DSL YAML; those belong to `makedsl`.
- It must not decide UI layout, component choice, Drawer layout, or CanvasTable rendering; those belong to `makeui` and `canvas-table-integration`.
- It must not define Make AI 助手 Artifact kinds, template selection, SSE event semantics, capability negotiation, history Artifact semantics, or action intents; those belong to `make-ai-assistant`.
- It must not hard-code environment-to-domain mapping. Make API base URL, gateway routing, and secret injection come from runtime config, backend/operations, or Make tooling.

## Default Service responsibilities

Generated or refactored Make App Service code should provide these capabilities when the UI needs them and the host project does not already have equivalent routes:

- public health/config: `/api/health`, `/api/config` for published UI access; `/health` may exist as local or k8s-probe compatibility
- runtime schema: `/api/schema`, `/api/entities/:entityKey/fields`
- single-app permissions, when requested or required by a repository-local delivery baseline: `/api/make/app/principal/permission` through `make-app-permission`
- Make AI assistant routes only when requested by the host and specified by `make-ai-assistant`: a selected `make-app` adapter may expose `/api/make/app/ai/chats/locate`, `/api/make/app/ai/chats/:chatId/messages`, and `/api/make/app/ai/chats/:chatId/events`; a selected `make-console` adapter instead follows its public recipe and the five-operation allowlist in `make-ai-assistant/references/make-console-service-contract.md`, never a generic proxy
- records: list, get, create, update, delete, cell update
- record actions when the list is writable: row-write permission precheck and one-request batch field update through `make-app-actions`
- current-user Entity Preset: get and sparse filter/sort update when filtering or sorting is enabled
- lookup options and safe lookup relation updates
- user candidates and department candidates
- file upload/delete/download proxy
- thin custom orchestration when requested, for example OCR result creation

Keep route handlers small. Put Make/backend calls in adapter modules, cross-route business orchestration in `services/`, and pure schema/value helpers in `utils/`.

## Hard rules

- `apps/docs/api.md` is the UI-Service contract source. Do not change Service route behavior without updating it.
- For Make Deploy Service-fronted Apps that use `gatewayBaseUrl: "/api/make"`, `apps/docs/api.md` must document published browser paths under `/api/make/**`, for example `/api/make/auth/**`, `/api/make/oauth/**`, and `/api/make/app/**`. Do not document prefix-free `/app/**` as the published path unless the deploy HTTPRoute exposes it. Older `/api` projects may keep `/api/auth/**` and `/api/app/**` only as an explicit legacy contract.
- New generated Make POC Services and non-trivial generated/refactored `apps/service` code must use a layered, componentized source structure instead of flat route/adapter/helper files. For new Make POC Services, default to the platform tree: `app.ts`, `server.ts`, `config.ts`, `logger.ts`, `make-client/` for Make/backend adapters, `services/` for multi-step orchestration, `utils/` for pure helpers, and colocated tests.
- A flat `apps/service/src` tree is a readiness defect for generated POC work when it mixes route registration, Make request construction, schema normalization, lookup/file orchestration, config parsing, logging, and helpers side by side. Split it before reporting the Service as complete.
- Route handlers in `app.ts` or `routes/` only validate input, call a service/adapter, map errors, log safe boundary context, and send the documented response. Do not put raw Make payload construction, schema variant parsing, record lookup orchestration, file proxy mapping, or custom workflow steps directly into route handlers.
- UI-facing APIs return stable, normalized shapes. Do not leak raw Make response envelopes unless the route contract explicitly says so.
- Service route handlers validate query/body/path params before calling Make adapters and return 400 for invalid client input.
- Service adapters own Make request details such as `appKey`, `X-Make-Target`, Make response code checks, pagination translation, file body mapping, and consuming a prepared login/session forwarding context. Auth/session mechanics and shared forwarding helpers belong to `make-app-auth`; publish/runtime proxy header contracts belong to `make-app-runtime`.
- Make-backed record read APIs must call Make gateway Data API through the Service Make adapter. Published runtime uses k8s-internal `/make/data/v1/record`; local preview with `MAKE_APP_LOCAL_PREVIEW=true` uses `makecli configure resolve --target local-preview --output=json` field `make_api_origin` plus `/api/make/data/v1/record`. This applies to record list, record detail, lookup target-record reads, and any custom Service route that reads Make records.
- Service Make adapters must forward the incoming request's established login context to Make gateway for Make-backed data reads and writes. At minimum, preserve the browser `Cookie` session header when the host uses cookie/unified-login auth, preserve an existing `Authorization` header only when the host contract already uses bearer auth, and apply the host gateway context headers such as `X-Forwarded-Host` and `X-Forwarded-Proto` through the shared auth/runtime helper. Do not invent auth policy here; use `make-app-auth` for auth mechanics, but do not drop the login context before calling gateway.
- Published/runtime Service APIs must never use `makecli` as a data source. Do not shell out to `makecli`, `npx makecli`, local makecli config, or makecli JSON stdout to serve schema, records, candidates, lookup options, files, or custom API data. Online Service containers do not have makecli, so runtime data must come from Make gateway/API adapters.
- Make-backed Service config must read `appKey` from deployment-injected `MAKE_APP_KEY`. Generated production code must not invent, hard-code, or accept `appKey` from UI requests.
- If `MAKE_APP_KEY` is missing for a Service that calls Make Meta/Data APIs, config loading must fail with a clear non-secret error before the Service is reported ready. Local test fixtures may inject `MAKE_APP_KEY` explicitly.
- New generated Service code reads Make adapter runtime config from `apps/service/src/config.ts` or the host equivalent. `MAKE_API_BASE_URL` is the preferred published gateway-origin env var; `MAKE_SERVER_URL` is a compatibility alias only. Local preview derives its public gateway origin from `makecli configure resolve --target local-preview --output=json` instead of deployment env.
- If neither `MAKE_API_BASE_URL` nor `MAKE_SERVER_URL` is configured for a Make-backed Service, config loading must fail with a clear non-secret error before the Service is reported ready.
- Published `MAKE_API_BASE_URL` / `MAKE_SERVER_URL` values are strict k8s gateway origins such as `http://make-gateway.make-dev`. New generated Service code must not put `/make`, `/api/make`, `/meta`, `/data`, `/auth`, or another service path scope in this env var. Local-preview resolve output must be consumed as `make_api_origin`; if older makecli fallback returns or reads a path-scoped public `/api/make` API base, normalize that only inside the local-preview adapter.
- Make platform adapters own the service path scope. Generated Service code derives upstream URLs from an explicit runtime mode: local preview uses public gateway origin + `/api/make/**`; published uses k8s gateway origin + `/make/**`, such as `http://make-gateway.make-dev/make/meta/**` and `http://make-gateway.make-dev/make/data/**`.
- For a selected `make-app` Make AI 助手 adapter only, follow `make-ai-assistant`: browser and local same-origin paths are `/api/make/app/ai/**`; published Service-to-gateway upstream paths are gateway-origin plus `/make/app/ai/**`. A selected `make-console` adapter must not use that route family: read its public recipe and `make-ai-assistant/references/make-console-service-contract.md`, expose only the Agent query, Session, durable event, send message, and Run SSE BFF operations, and never mount a generic proxy. The same strict origin validation applies to `MAKE_API_BASE_URL` / `MAKE_SERVER_URL`; Service source must not configure an assistant-only domain or hard-code Agent Gateway domains.
- If the same Service calls other gateway services, those adapters define their own explicit service scopes from the same gateway origin. Do not strip `/make` out of `MAKE_API_BASE_URL`, and do not overload a path-scoped base URL to reach unrelated services.
- Service-to-gateway calls inside the cluster must not use the browser-facing `/api/make` prefix. `/api/make/**` belongs to same-origin browser access, Service ingress, and local-preview public gateway calls; published Service internal upstream URLs use gateway-origin plus `/make`.
- Service source must not hard-code concrete Make dev/test/prod domains, infer namespace-local gateway addresses, or map deployment environments to domains.
- Runtime Service code must not require `apps/dsl/**`, `/dsl/**`, or copied `*.yaml` files to start or serve schema/data in published Apps.
- Schema APIs normalize backend schema variants before UI sees them. Handle known variants such as `entity.properties.fields`, `entity.fields`, or the host-documented equivalent at the Service/API boundary, and preserve field `capabilities.sortable` / `capabilities.groupable` for sorting and grouping.
- Permission-trimmed Schema normalization keeps `fields` and `createFields` as separate collections. Normalize each collection independently; a missing or invalid `createFields` becomes `[]` and never falls back to `fields`. Preserve `editableFields` as response metadata when the host contract requires lossless forwarding, but do not use it to derive current edit behavior.
- Schema caches and in-flight reuse must not share permission-trimmed entities across principals. Key by tenant, principal/session identity, App, and access generation (or use a request-local cache), and provide an invalidation/reload path that permission refresh can call before data refresh.
- Record list and detail are separate contracts. Do not implement detail by calling list and guessing the first row when a single-record Make call exists.
- Entity Preset GET/PATCH routes must use the Make Preset `/preset/v1/entity` adapter with `MakeService.GetResource` / `MakeService.UpdateResource`, preserve the established login context, and update only submitted dimensions. Use `make-app-sort`, `make-app-filter`, and `make-app-group` for dimension semantics.
- Preset sort and records sort must share shape validation and authoritatively validate fields against current runtime schema `capabilities.sortable === true`. Reject invalid, duplicate, non-sortable, or more-than-five rules before Make calls.
- Sparse Preset updates must preserve sibling dimensions; saving sort must not send filter/group, saving filter must not send sort/group, and saving group must not send filter/sort.
- User and department candidates come from Service routes such as `GET /api/users` and `GET /api/departments` or the host equivalent; do not use local demo arrays in generated Service.
- Lookup option APIs must resolve target object/field from schema metadata and return `{ options, total }`. Do not expose full target records to selector UIs by default.
- File routes proxy upload/delete/download through Service. UI should not expose raw backend file URLs when a Service download proxy is available.
- Browser resource tags such as `<img src>` cannot attach `Authorization`. When Make file downloads require a bearer token, keep the URL browser-facing through a Service download proxy, verify the current App session first, and let only the Service adapter attach the deployment-injected token. Do not put Make tokens or raw `/data/v1/download/**` URLs in UI state, public config, JSX, or logs.
- Add boundary logs at route/adapter entry, success, and failure. Redact tokens, cookies, Authorization, API keys, signed download query strings, and unnecessary personal data.
- For cancellable or supersedable work, a client disconnect must abort downstream work through a request-scoped `AbortSignal`. Do not stop at ignoring a stale response, and do not treat an expected `AbortError` as a user-visible 5xx failure.
- Tests are required for route contracts, invalid input, adapter payloads, Make error mapping, and any schema/value normalization added by this skill.
- When single-app permission enforcement is in scope, do not report the Service complete without the principal permission proxy from `make-app-permission` and its required tests. Otherwise do not add that proxy solely to satisfy this Skill.
- For `record-write-permission` and `records/bulk`, follow `make-app-actions`:
  precheck the complete target with one Make `/data/v1/permission` call, parse the
  explicit-selection HTTP 200 / business-code `20000032` denial and its
  `noPermissionRecordIds` losslessly from the raw response before JavaScript
  `Number` coercion and generic Make error mapping, keep select-all 403 denial
  ID-less, reuse the target for one Make `/data/v1/field` call, and never split
  diagnostics or loop single-record updates.

## Default route baseline

Prefer these UI-Service contracts for new Make App Service projects unless the host project already documents equivalent routes:

```text
GET    /api/health
GET    /health
GET    /api/config
GET    /api/make/app/principal/permission
GET    /api/schema
GET    /api/entities/:entityKey/fields
GET    /api/entities/:entityKey/preset
PATCH  /api/entities/:entityKey/preset
GET    /api/entities/:entityKey/records
GET    /api/entities/:entityKey/records/:recordID
POST   /api/entities/:entityKey/records
POST   /api/make/app/entities/:objectKey/record-write-permission
POST   /api/make/app/entities/:objectKey/records/bulk
PATCH  /api/entities/:entityKey/records/:recordID
DELETE /api/entities/:entityKey/records/:recordID
PATCH  /api/entities/:entityKey/records/:recordID/cells/:fieldKey
GET    /api/users
GET    /api/departments
GET    /api/lookup-options
POST   /api/entities/:entityKey/records/:recordID/files/:fieldKey
DELETE /api/entities/:entityKey/records/:recordID/files/:fieldKey
GET    /api/files/download/*
```

Lookup relation update routes are optional and should be generated only when the UI needs editable lookup relationships and the Service can preserve a full `qfei_relation` snapshot safely.

## Collaboration rules

- With `makeui`: this skill provides Service contracts and normalized API shapes; `makeui` decides how UI renders them.
- With `make-app-permission`: this skill provides Service layering and tests; `make-app-permission` owns the principal permission route, IAM upstream path, App scope payload, and frontend permission contract.
- With `canvas-table-integration`: this skill provides schema/records/candidate APIs and owns Service-side disconnect-to-downstream cancellation; table rendering, editing UI, and browser-side virtual-page scheduling stay in the canvas skill.
- With `make-app-sort`: this skill implements and tests Preset/records routes and Make adapters; `make-app-sort` owns sortable rules, draft/save timing, and header linkage.
- With `make-app-filter`: this skill implements and tests Preset/records routes and Make adapters; `make-app-filter` owns package filter behavior, hydration, and save timing.
- With `make-app-group`: this skill implements and tests Preset group, record-groups, records groupFilter, and Make adapters; `make-app-group` owns groupable rules, groupFilter composition, grouped data timing, and CanvasTable grouped-flow coordination.
- With `make-app-actions`: this skill implements and tests `record-write-permission`, `records/bulk`, strict target parsing, Make adapters, and error mapping; `make-app-actions` owns selection intent, action timing, permission-key choice, frozen snapshots, and UI feedback.
- With `make-ai-assistant`: this skill implements selected-adapter route handlers, proxy adapters, runtime config validation, safe logs, AbortSignal propagation, and Service tests; `make-ai-assistant` owns adapter selection, package integration, Artifact V1, SSE event mapping, capabilities, history restore, action intents, and interface domain rules. For `make-console`, implement only the five-operation BFF allowlist, stable error mapping, and SSE close-on-post-frame-failure behavior; never a generic proxy.
- With `make-app-auth`: this skill may preserve Service-fronted app route shape, but auth proxy and session behavior stay in auth.
- With `make-app-runtime`: this skill writes Service source and tests; runtime build/start/port checks stay in runtime.
