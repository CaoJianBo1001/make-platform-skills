# Request Adapter

Use this reference when generating or reviewing Make backend request code.

## Rule

All ordinary frontend requests to Make backend must go through one shared adapter that wraps `auth.api`. In direct-gateway mode this includes schema/meta loading, record list/get/create/update/delete, cell updates, ordinary attachment/file APIs, lookup resolution, user candidates and department candidates. In Service-fronted mode the same UI adapter calls Service-owned `/app/**` paths through `gatewayBaseUrl=/api/make`.

Do not call raw `window.fetch('/api/make/...')` for ordinary business APIs. Do not scatter unhandled `auth.api` calls across UI components, drawers, tables, field editors, or route loaders.

The Make App Agent Public API v1 `/agent` contract is one narrow raw-response exception.
`auth.api` consumes successful responses and cannot return the required
`{ status, headers, body?: AsyncIterable<Uint8Array> }` for the Agent JSON envelope, SSE and
file bytes. Implement `AgentAuthenticatedTransport.request` inside this shared
adapter, limited to same-origin `/api/make/app/agent/v1/**`, using the established
session cookie through `credentials: "include"`, not a browser-read token.
Forward method, X-Make-Target, request headers/bytes and AbortSignal; convert an SDK async multipart body to a bounded Blob only when browser Fetch requires it; return the unconsumed
response status, headers and lazy byte stream. The SDK's response headers are a
`Readonly<Record<string, string>>`: convert browser `Headers` without dropping values.
Its optional `AbortSignalLike` may need a native `AbortController` bridge for Fetch;
propagate an already-aborted signal and later cancellation, then remove listeners
when the attempt/body finishes. Convert asynchronous multipart bytes within the
documented bounds rather than casting them to `BodyInit`. Keep 401/403 login and permission
handling without swallowing the SDK error body or redirect-looping on ordinary
403. Select one retry owner. The SDK handles SSE parsing/recovery, request-result recovery and task stopping;
do not add native `EventSource`, a parallel reconnect loop or a general raw-fetch
exception. Read `make-ai-assistant` for versioned routes and Service scope.

The auth audit checks the UI workspace's compiler API capabilities when it finds raw
requests, including official compatible entries for TypeScript 7; tooling setup and the complete local copy bundle are documented in [Project-local audit](../SKILL.md#project-local-audit). Its narrow exemption checks an exported shared factory/constant typed
as the public `AgentAuthenticatedTransport` (including import aliases), its
`request` method, cookie/signal/method/headers/body forwarding, manual redirects,
and the original response status/headers/body. It follows local const bindings,
shorthand properties and the data source of bounded body, header and signal
conversions; those helper implementations still require executable tests.
A page-level Agent URL gets no
automatic exemption. A literal URL must stay inside the normalized Agent prefix;
dynamic URLs must be normalized with `new URL(request.path, window.location.origin)`
and rejected before Fetch when the origin differs or the pathname leaves
`/api/make/app/agent/v1/`. Fetch the checked URL, not the original unchecked string.
Do not weaken checks or change production architecture merely to satisfy a
static pattern: unfamiliar equivalent control flow remains a review item and
needs executable transport tests. This preflight does not prove stream conversion,
multipart bounds, Trace, or 401/403 behavior.

The audit also resolves ordinary request targets written as `URL`, `Request`,
local const aliases, `.href`/`.url`, or string conversions. A resolved Make path
outside the typed Agent bridge remains rejected. Known non-Make paths are outside
this audit's scope; unresolved targets produce `raw_fetch_scope_unproven` and a
manual-review warning rather than silently passing as verified. Resolve that
review item with source inspection and request tests before declaring the scope
verified. UI and Service test files/directories are excluded relative to the App
root; the same invalid configuration in production source remains a failure.

## Request Shape

Business code should pass relative paths to `auth.api`. If an absolute URL is unavoidable, it must be under the same origin and path scope as `gatewayBaseUrl`; otherwise the SDK rejects it.

The SDK defaults Make backend requests to `credentials: 'include'`. Generated adapters may still keep a shared request init so cookie behavior is auditable in one place; do not repeat credential handling in UI components. The following `requestWithTrace` is an App-owned shared-adapter placeholder, not an SDK export: it creates a fresh Trace context per network attempt, supplies matching headers, and ends the span on success or failure as specified by `make-app-observability`. Business pages call the shared adapter, not this callback directly.

```ts
type TraceHeaders = { traceparent: string; 'X-Log-Id': string };

const makeRequestInit = (traceHeaders: TraceHeaders, extraHeaders = {}) => ({
  credentials: 'include' as const,
  headers: { ...extraHeaders, ...traceHeaders }
});
```

Direct gateway mode example:

```ts
export async function listRecords(payload: unknown) {
  return requestWithTrace((traceHeaders: TraceHeaders) =>
    auth.api.post('/data/v1/record', payload, makeRequestInit(traceHeaders)));
}
```

Service-fronted mode example. Use this only after `service-fronted-mode.md` confirms the `UI -> Service -> make-gateway` contract:

```ts
// With createMakeAppAuth({ gatewayBaseUrl: '/api/make', ... }),
// this reaches browser path /api/make/app/schema.
export async function loadSchema() {
  return requestWithTrace((traceHeaders: TraceHeaders) =>
    auth.api.get('/app/schema', makeRequestInit(traceHeaders)));
}

export async function listRecords(entityKey: string) {
  return requestWithTrace((traceHeaders: TraceHeaders) =>
    auth.api.get(`/app/entities/${encodeURIComponent(entityKey)}/records`, makeRequestInit(traceHeaders)));
}
```

Apply the same adapter path to schema/meta, list, get, create, update, delete, file, lookup, user, and department APIs. Do not fix one endpoint while leaving another endpoint on raw fetch or a different helper.

Do not use `/app/**` in direct gateway mode. Do not use `/data/**` or `/meta/**` from UI in Service-fronted mode.

For passive browser resource loading, `auth.api` cannot wrap `<img src>`, `<object data>`, or a plain file link. In Service-fronted apps, normalize Make file values to the Service-owned download proxy URL `/api/make/app/files/download/**` before rendering them. Do not render raw `/data/v1/download/**`, `/make/data/v1/download/**`, or `/api/make/data/v1/download/**` values.

Custom headers are allowed through the SDK request options. Keep the Trace pair when adding them:

```js
const result = await requestWithTrace((traceHeaders) =>
  auth.api.post('/data/v1/record', body,
    makeRequestInit(traceHeaders, { 'X-Make-Target': 'MakeService.ListResources' })));
```

If a list request has no real filters, omit `filter`. Do not send `filter: []`.

## Error Handling

This section handles business requests, not `auth.init()` results. Startup follows `sdk-integration.md#startup-shape`: the SDK's `forbidden` status does not require the business payload reason. Do not import this business classifier into the bootstrap gate. Conversely, a business `MakeAppForbiddenError` must not be promoted to App-entry denial merely because startup uses that SDK status.

When `apiAuthRedirect: true` is available, preserve the SDK's established session-recovery and redirect checks; do not add host redirects from HTTP status alone. A confirmed business permission denial must not trigger another login or redirect. The shared adapter still owns three things:

- preventing scattered `auth.api` calls
- fallback UI for errors that cannot redirect

```js
// onPermissionDenied is a host event sink wired to its shared feedback adapter.
async function handleMakeRequestError(error, { scope, onPermissionDenied }) {
  if (error instanceof MakeAppUnauthorizedError) {
    showNeutralLoading();
    if (!makeAuthConfig.apiAuthRedirect) {
      await auth.login({ redirect: true });
    }
    return;
  }

  if (error instanceof MakeAppForbiddenError && error.payload?.reason === 'permission_denied') {
    onPermissionDenied({ scope, payload: error.payload });
    return;
  }

  throw error;
}

export async function listRecords(payload, onPermissionDenied) {
  try {
    return await requestWithTrace((traceHeaders) =>
      auth.api.post('/data/v1/record', payload,
        makeRequestInit(traceHeaders, { 'X-Make-Target': 'MakeService.ListResources' })));
  } catch (error) {
    await handleMakeRequestError(error, { scope: 'resource', onPermissionDenied });
    throw error; // A denied request must not resolve as successful undefined data.
  }
}
```

Do not call `auth.logout({ redirect: false })` as the default 401 path when `apiAuthRedirect` is enabled. Use logout-before-login only for a diagnosed stale or corrupted App session, not as the normal request adapter behavior.

## Tests

`onPermissionDenied` is an App-owned state/event callback, not an SDK/npm export. React routes it to the shared package-backed adapter from `makeui/references/permission-feedback.md`; the adapter does not consume auth internals. The read example passes resource scope; create/update/delete handlers pass operation scope and retain permitted input. Bootstrap/App-entry denial is not the default for all requests. This example uses the structured permission-denial reason; for legacy responses without reason, reuse the host's tested, documented permission classifier rather than treating every code/HTTP 403 as denied permission. Follow `access-help.md` and preserve the existing requestWithTrace contract. Route a known permission denial once instead of also presenting a generic network-failure card; unrelated request errors keep the independent error outlet.

When touching request code, add or update tests for:

- 403 forbidden response
- unified-login API 401/403 with `apiAuthRedirect: true`
- schema/list/create/update/delete 401 entering the shared expired-session handler
- schema/meta/list/get/create/update/delete/file/lookup/user/department calls use the shared adapter and the same cookie-capable request init
- Service-fronted auth and business proxy calls use the same host-context helper, deriving `X-Forwarded-Host` from inbound `Host` and not passing through client-supplied `X-Forwarded-Host`
- Service-fronted proxy calls add `X-Forwarded-Proto` before calling make-gateway
- Service-fronted proxy calls use k8s-internal make-gateway paths without the external `/api` prefix, for example `http://make-gateway/make/auth/**`, `/make/meta/**`, and `/make/data/**`
- no raw `window.fetch('/api/make/...')` outside the fixed Agent v1 `AgentAuthenticatedTransport` bridge
- no scattered unhandled `auth.api` calls in UI components
- ordinary and AI business requests preserve matching `traceparent` and `X-Log-Id` through the shared adapter, including failed network attempts
