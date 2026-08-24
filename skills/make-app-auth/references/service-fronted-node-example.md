# Service-fronted Node example

Use this compact example after reading `service-fronted-mode.md`. It illustrates
the route ownership and test seams; it is not a project template and must not
replace the host's established Service layering.

## Reference shape

```text
apps/ui/src/auth.ts                 # unified-login SDK bootstrap
apps/ui/src/makeApi.ts              # auth.api calls to /app/**
apps/service/src/routes.ts          # narrow browser-route dispatcher
apps/service/src/makeGatewayProxy.ts # auth/business proxy adapter
apps/service/src/makecliPreview.ts  # local-preview adapter only
```

Keep all browser business calls behind `auth.api` and the Service-owned
`/api/make/app/**` namespace:

```ts
export const auth = createMakeAppAuth({
  gatewayBaseUrl: '/api/make',
  unifiedLogin: true,
  apiAuthRedirect: true,
});

export const loadSchema = () => auth.api.get('/app/schema', {
  credentials: 'include',
});

export const listRecords = (entityKey: string, payload: unknown) =>
  auth.api.post(`/app/records/${entityKey}`, payload, {
    credentials: 'include',
    headers: { 'X-Make-Target': 'MakeService.ListResources' },
  });
```

## Route ownership

- `/api/make/auth/**` and `/api/make/oauth/**` forward to the published
  make-gateway auth namespace. Preserve the upstream status, `Set-Cookie`, and
  `Location`; use manual redirect handling.
- `/api/make/app/**` contains explicitly registered Service business routes.
  Do not create a broad `/api/make/**` passthrough; unmatched paths fail closed.
- `MAKE_APP_LOCAL_PREVIEW=true` may provide only the documented local preview
  handlers. Its makecli token and resolved gateway origin stay inside Service.
  When the flag is absent, `current-context` and `runtime-view` continue through
  the published auth proxy.

For every upstream request, forward the browser Cookie and derive
`X-Forwarded-Host` from inbound `Host`; add `X-Forwarded-Proto`. Do not trust a
client-provided forwarded-host header.

## Required tests

- Published `session/complete` returns the upstream `302`, `Set-Cookie`, and
  `Location` unchanged.
- Local-preview paths use `makecli configure resolve` and server-side credentials
  only; published paths use the internal `/make/**` scope.
- Query strings do not bypass the local-preview path guard.
- Unknown `/api/make/**` routes return a closed failure response.

Read `service-fronted-mode.md` for the full local-preview matrix, proxy rules,
attachment handling, and validation checklist.
