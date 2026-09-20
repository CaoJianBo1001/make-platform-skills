# Request Adapter

Use this reference when generating or reviewing Make backend request code.

## Rule

All ordinary frontend requests to Make backend must go through one shared adapter that wraps `auth.api`. In direct-gateway mode this includes schema/meta loading, record list/get/create/update/delete, cell updates, ordinary attachment/file APIs, lookup resolution, user candidates and department candidates. In Service-fronted mode the same UI adapter calls Service-owned `/app/**` paths through `gatewayBaseUrl=/api/make`.

Do not call raw `window.fetch('/api/make/...')` for ordinary business APIs. Do not scatter unhandled `auth.api` calls across UI components, drawers, tables, field editors, or route loaders.

The Make App AI v1 `/client` contract is one narrow raw-response exception.
`auth.api` consumes successful responses and cannot return the required
`{ status, headers, body?: AsyncIterable<Uint8Array> }` for JSON, 204, SSE and
file bytes. Implement `AuthenticatedTransport.request` inside this shared
adapter, limited to same-origin `/api/make/app/ai/v1/**`, using the established
session cookie through `credentials: "include"`, not a browser-read token.
Forward method, request headers/bytes and AbortSignal; return the unconsumed
response status, headers and lazy byte stream. Keep 401/403 login and permission
handling without swallowing the SDK error body or redirect-looping on ordinary
403. Select one retry owner. The SDK handles SSE parsing/recovery and cancellation;
do not add native `EventSource`, a parallel reconnect loop or a general raw-fetch
exception. Read `make-ai-assistant` for versioned routes and Service scope.

## Request Shape

Business code should pass relative paths to `auth.api`. If an absolute URL is unavoidable, it must be under the same origin and path scope as `gatewayBaseUrl`; otherwise the SDK rejects it.

The SDK defaults Make backend requests to `credentials: 'include'`. Generated adapters may still keep a shared request init so cookie behavior is auditable in one place; do not repeat credential handling in UI components.

```ts
const makeRequestInit = {
  credentials: 'include' as const
};
```

Direct gateway mode example:

```ts
export async function listRecords(payload: unknown) {
  return auth.api.post('/data/v1/record', payload, makeRequestInit);
}
```

Service-fronted mode example. Use this only after `service-fronted-mode.md` confirms the `UI -> Service -> make-gateway` contract:

```ts
// With createMakeAppAuth({ gatewayBaseUrl: '/api/make', ... }),
// this reaches browser path /api/make/app/schema.
export async function loadSchema() {
  return auth.api.get('/app/schema', makeRequestInit);
}

export async function listRecords(entityKey: string, payload: unknown) {
  return auth.api.post(`/app/records/${entityKey}`, payload, makeRequestInit);
}
```

Apply the same adapter path to schema/meta, list, get, create, update, delete, file, lookup, user, and department APIs. Do not fix one endpoint while leaving another endpoint on raw fetch or a different helper.

Do not use `/app/**` in direct gateway mode. Do not use `/data/**` or `/meta/**` from UI in Service-fronted mode.

For passive browser resource loading, `auth.api` cannot wrap `<img src>`, `<object data>`, or a plain file link. In Service-fronted apps, normalize Make file values to the Service-owned download proxy URL `/api/make/app/files/download/**` before rendering them. Do not render raw `/data/v1/download/**`, `/make/data/v1/download/**`, or `/api/make/data/v1/download/**` values.

Custom headers are allowed through the SDK request options:

```js
const result = await auth.api.post('/data/v1/record', body, {
  credentials: 'include',
  headers: {
    'X-Make-Target': 'MakeService.ListResources',
    'X-Trace-Id': traceId
  }
});
```

If a list request has no real filters, omit `filter`. Do not send `filter: []`.

## Error Handling

When `apiAuthRedirect: true` is available, the SDK owns the normal unified-login 401/403 redirect. The shared adapter still owns three things:

- preventing scattered `auth.api` calls
- fallback UI for errors that cannot redirect

```js
async function handleMakeRequestError(error) {
  if (error instanceof MakeAppUnauthorizedError) {
    showNeutralLoading();
    if (!makeAuthConfig.apiAuthRedirect) {
      await auth.login({ redirect: true });
    }
    return;
  }

  if (error instanceof MakeAppForbiddenError) {
    renderForbidden();
    return;
  }

  throw error;
}

export async function listRecords(payload) {
  try {
    return await auth.api.post('/data/v1/record', payload, {
      credentials: 'include',
      headers: { 'X-Make-Target': 'MakeService.ListResources' }
    });
  } catch (error) {
    return handleMakeRequestError(error);
  }
}
```

Do not call `auth.logout({ redirect: false })` as the default 401 path when `apiAuthRedirect` is enabled. Use logout-before-login only for a diagnosed stale or corrupted App session, not as the normal request adapter behavior.

## Tests

When touching request code, add or update tests for:

- 403 forbidden response
- unified-login API 401/403 with `apiAuthRedirect: true`
- schema/list/create/update/delete 401 entering the shared expired-session handler
- schema/meta/list/get/create/update/delete/file/lookup/user/department calls use the shared adapter and the same cookie-capable request init
- Service-fronted auth and business proxy calls use the same host-context helper, deriving `X-Forwarded-Host` from inbound `Host` and not passing through client-supplied `X-Forwarded-Host`
- Service-fronted proxy calls add `X-Forwarded-Proto` before calling make-gateway
- Service-fronted proxy calls use k8s-internal make-gateway paths without the external `/api` prefix, for example `http://make-gateway/make/auth/**`, `/make/meta/**`, and `/make/data/**`
- no raw `window.fetch('/api/make/...')` outside the fixed AI v1 `AuthenticatedTransport` bridge
- no scattered unhandled `auth.api` calls in UI components
