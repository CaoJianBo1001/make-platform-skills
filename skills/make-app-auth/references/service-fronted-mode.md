# Service-Fronted Mode

Use this reference when the generated App keeps a Service layer between UI and make-gateway.

## Boundary

Preserve this contract:

```text
UI -> auth.api('/app/**') -> App Service -> make-gateway -> Make Platform
```

UI business code calls Service-owned paths such as:

```js
await auth.api.get('/app/schema');
await auth.api.post('/app/records/customer', payload);
```

UI must not bypass Service by calling `/data/**`, `/meta/**`, meta/data service domains, or k8s-internal service names directly.

## Local Preview

Local preview keeps the same UI and Service source as published mode. UI still uses `createMakeAppAuth({ gatewayBaseUrl: "/api/make", unifiedLogin: true, apiAuthRedirect: true })` and business code still calls `auth.api("/app/**")`.

When `MAKE_APP_LOCAL_PREVIEW=true`, the local Service should run `makecli configure resolve --target local-preview --output=json` on the server side, read `make_api_origin`, and use the makecli token only for Service-to-Make requests. The browser must not receive the token, must not configure SDK token mode, and must not read `~/.make/credentials`.

Enable local preview only from the local dev command, for example:

```bash
MAKE_APP_LOCAL_PREVIEW=true pnpm run dev
```

A generated project may wrap that command as `pnpm run dev:preview`, but it must not persist `MAKE_APP_LOCAL_PREVIEW=true` in `.env`, `.env.local`, `.env.example`, generated README setup steps, or any deployment environment. Env files are easy to copy between local and publish paths; treating the flag as a one-shot process variable keeps preview behavior out of committed and deployed runtime.

Local preview must use the same backend environment that makecli is using. Resolve it with:

```bash
makecli configure resolve --target local-preview --output=json
```

`makecli --env <dev|test|production> configure resolve --target local-preview --output=json` may override the configured environment for a single command; a local preview script may expose an equivalent explicit environment option, but it must not silently hard-code dev. Treat the returned `make_api_origin` as a bare public gateway origin and add `/api/make` inside the adapter. If the installed makecli does not yet support `configure resolve`, legacy fallback may read `configure get environment` plus profile `meta-server-url`, but fallback code must keep the same precedence and normalize path-scoped values such as `https://dev-make.qtech.cn/api/make` back to origin. Public gateway traffic passes through nginx, so Service-to-Make calls in local preview use the browser-facing `/api/make` scope.

Runtime mode matrix:

| Mode | Trigger | Gateway origin | Gateway scope | Credential |
| --- | --- | --- | --- | --- |
| Local preview | temporary process env `MAKE_APP_LOCAL_PREVIEW=true` | `makecli configure resolve --target local-preview --output=json` field `make_api_origin` | `/api/make` | Service-side makecli token and configured tenant/operator headers |
| Published | flag absent or false in deployed runtime | deployment-injected k8s internal origin, for example `http://make-gateway.make-dev` | `/make` | Browser App session Cookie plus forwarded host/proto |

Generated code should model this explicitly, for example `runtimeMode -> gatewayOrigin + gatewayScope + credentialStrategy`. Do not let individual routes hard-code `/api/make` or `/make`, and do not use local-preview public gateway settings in published runtime.

In local preview, Service should handle:

- `GET /api/make/auth/current-context`: return a preview context with real values available from makecli config/token claims, such as `userId`, `tenantId`, `name`, and `avatar`, plus `authMode: "token"` and `localPreview: true`.
- `GET /api/make/auth/runtime-view`: return a preview runtime view with `authMode: "token"` and `localPreview: true`.
- `/api/make/app/**`: call `make_api_origin + /api/make` with server-side `Authorization: Bearer <makecli token>`, makecli tenant/operator headers when configured, and the `/api/make` path scope.

This is a development-only convenience. Published runtime must keep the deployed chain below and must fail closed if local preview mode is enabled in production.

The preview auth routes must be strictly gated. Do not register or mount preview `current-context` / `runtime-view` handlers unless `MAKE_APP_LOCAL_PREVIEW=true`, or guard them inline before returning any preview response. When the flag is absent or false, `/api/make/auth/current-context` and `/api/make/auth/runtime-view` must fall through to the make-gateway auth proxy.

Match preview auth routes by path only, never by a raw URL string that may include a query string. The SDK can call `/api/make/auth/current-context?return_url=...`; that must still return the local preview context when `MAKE_APP_LOCAL_PREVIEW=true`. In Fetch-style handlers, compare `new URL(request.url).pathname`. In Express handlers mounted at `/api/make/auth`, compare `req.path` to `/current-context` or `/runtime-view`. Do not use exact equality against `req.url` or `req.originalUrl` for these preview routes.

Safe shape:

```ts
if (isLocalPreviewEnabled() && url.pathname === '/api/make/auth/current-context') {
  return localPreviewCurrentContext();
}
// Express equivalent when mounted with app.use('/api/make/auth', ...)
if (isLocalPreviewEnabled() && req.path === '/current-context') {
  return localPreviewCurrentContext();
}
if (url.pathname.startsWith('/api/make/auth/')) {
  return proxyMakeAuth(request, stripBrowserMakePrefix(url));
}
```

Unsafe shape:

```ts
// Wrong: this shadows the published auth proxy.
app.get('/api/make/auth/current-context', localPreviewCurrentContext);
app.use('/api/make/auth', proxyMakeAuth);

// Wrong: SDK requests can append ?return_url=..., so this misses local preview.
if (isLocalPreviewEnabled() && req.originalUrl === '/api/make/auth/current-context') {
  return localPreviewCurrentContext();
}
```

## Deployed Chain

Browser calls stay same-origin under `gatewayBaseUrl=/api/make`.

Business APIs:

```text
browser -> /api/make/app/** -> App Service -> http://make-gateway/make/meta|data/**
```

Auth APIs:

```text
browser -> /api/make/auth/** -> App Service -> http://make-gateway/make/auth/**
browser -> /api/make/oauth/** -> App Service -> http://make-gateway/make/oauth/**
```

Service code running inside the cluster must call k8s-internal make-gateway routes without the external `/api` prefix. UI code must not call internal routes directly.

Published runtime must not reuse makecli public gateway settings. `MAKE_API_BASE_URL` / `MAKE_SERVER_URL` in deployed Service containers are k8s internal gateway origins, and Service adds `/make` before calling auth, meta, or data APIs.

Do not publish a Service-fronted unified-login App without namespace-level auth and OAuth proxies. A missing `/api/make/auth/current-context` route means the browser cannot start or verify unified login, even if business routes such as `/api/make/app/schema` work. An endpoint-only allowlist is also incomplete because future auth routes and recovery callbacks must use the same proxy path.

Do not drop the `/make` segment from browser-facing Service-fronted auth routes. The current platform entry uses `/api/make/auth/**` and `/api/make/oauth/**` for unified login, while Service-to-gateway upstream calls still use internal `/make/**` paths without the external `/api` prefix.

Do not fix auth proxy gaps by adding a broad `/api/make/** -> /make/**` passthrough. Auth and OAuth are the default transparent namespaces; Service-owned business APIs stay under explicit `/api/make/app/**` adapters, and unmatched `/api/make/**` paths should fail closed.

Published `/api/make/auth/current-context` must be the make-gateway response. It may return an authenticated context or `401 + authorizationUrl`, but it must not return a local preview context such as `localPreview: true`, `grantVersion: "local-preview"`, `authMode: "token"`, or `userId: "local-preview-user"`.

The Service auth proxy must forward browser auth context:

- request `Cookie`
- request host/proxy headers needed by make-gateway to resolve the published App domain, especially `X-Forwarded-Host` and `X-Forwarded-Proto`
- gateway `Set-Cookie`, `Location`, and status code back to the browser

Do not convert the gateway response into a JSON envelope for auth routes.

## Attachment Download Proxy

In Service-fronted apps, file previews and downloads must stay on Service-owned browser paths:

```text
browser img/link -> /api/make/app/files/download/** -> App Service -> make-gateway /make/data/v1/download/**
```

Do not use raw Make download paths such as `/data/v1/download/**`, `/make/data/v1/download/**`, or `/api/make/data/v1/download/**` as UI `src`, `href`, or file metadata URLs when a Service proxy exists.

When the Make download endpoint requires `Authorization`, the browser still must not receive the token. The Service download route must:

- derive forwarded host/proto with the same helper used by auth/business gateway calls
- require the browser App session Cookie
- verify the session first through make-gateway, for example `${makeAuthBaseUrl}/auth/current-context`
- use the deployment-injected download token only after the session check passes
- remove or overwrite any inbound browser `Authorization` before attaching the Service token
- return the upstream binary bytes or stream with safe `Content-Type` and `Content-Disposition`
- keep tokens, cookies, Authorization, and signed query strings out of logs and `/api/config`

## Host Context Helper

Generated Service-fronted Apps must centralize host/proto forwarding in one helper and use it for both auth routes and business routes. Do not trust or pass through client-supplied `X-Forwarded-Host`; derive it from inbound `Host`.

```ts
function applyForwardedHostContext(headers: Headers, source: Headers): void {
  const host = source.get('host');
  if (host) {
    headers.set('x-forwarded-host', firstHeaderValue(host));
  }
  if (!headers.get('x-forwarded-proto')) {
    headers.set('x-forwarded-proto', isLocalHost(headers.get('x-forwarded-host')) ? 'http' : 'https');
  }
}

function firstHeaderValue(value: string): string {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.substring(0, commaIndex).trim() : value.trim();
}

function isLocalHost(host: string | null): boolean {
  const hostname = stripPort(host);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function stripPort(host: string | null): string | null {
  if (!host) {
    return host;
  }
  const portIndex = host.indexOf(':');
  return portIndex >= 0 ? host.substring(0, portIndex) : host;
}
```

Apply the helper before every upstream make-gateway request:

```ts
const authHeaders = pickProxyHeaders(inboundHeaders, ['cookie']);
applyForwardedHostContext(authHeaders, inboundHeaders);

const businessHeaders = new Headers(init.headers);
applyForwardedHostContext(businessHeaders, inboundHeaders);
```

Internal make-gateway URLs must not use the external `/api` prefix:

```ts
const makeAuthBaseUrl = 'http://make-gateway/make';
const makeBusinessBaseUrl = 'http://make-gateway/make';
businessHeaders.set('Content-Type', 'application/json');
businessHeaders.set('X-Make-Target', 'MakeService.ListResources');
const recordPayload = { appKey: config.appKey, entityKey, fields, pagination };

await fetch(`${makeAuthBaseUrl}/auth/current-context`, { headers: authHeaders });
await fetch(`${makeBusinessBaseUrl}/data/v1/record`, {
  method: 'POST',
  headers: businessHeaders,
  body: JSON.stringify(recordPayload)
});
```

Local-preview URLs are different because they leave the user's machine through the public gateway resolved by makecli:

```ts
const publicGatewayOrigin = readMakecliResolveJson().make_api_origin;
const localPreviewBaseUrl = `${publicGatewayOrigin}/api/make`;
const schemaHeaders = new Headers(makecliTokenHeaders);
schemaHeaders.set('Content-Type', 'application/json');
schemaHeaders.set('X-Make-Target', 'MakeService.GetResource');
const dataHeaders = new Headers(makecliTokenHeaders);
dataHeaders.set('Content-Type', 'application/json');
dataHeaders.set('X-Make-Target', 'MakeService.ListResources');

await fetch(`${localPreviewBaseUrl}/meta/v1/schema`, {
  method: 'POST',
  headers: schemaHeaders,
  body: JSON.stringify({ appKey: config.appKey })
});
await fetch(`${localPreviewBaseUrl}/data/v1/record`, {
  method: 'POST',
  headers: dataHeaders,
  body: JSON.stringify(recordPayload)
});
```

## Session Complete

When proxying `/api/make/auth/session/complete`, Service must return the gateway response to the browser:

- preserve `302`
- preserve `Set-Cookie`
- preserve `Location`

In Node Service code, use `redirect: "manual"` or the equivalent. Do not let server-side fetch follow the redirect internally.

## Validation

These checks belong to the agent, generated tests, CI, or publish pipeline. Do not require the end user to open DevTools or inspect k8s logs after publish to discover the issue.

- Run `scripts/audit-auth-contract.mjs <project-root> --mode service-fronted --published` when a generated project tree is available.
- Browser business requests go to Service-owned `/api/make/app/**` paths.
- Browser auth and OAuth requests go to namespace proxies under `/api/make/auth/**` and `/api/make/oauth/**`.
- `/api/make/auth/current-context` is reachable from the published domain and returns a challenge or authenticated context, not a Service 404.
- In published mode, `/api/make/auth/current-context` and `/api/make/auth/runtime-view` are not served by local preview handlers and do not return `localPreview`, `local-preview-user`, `grantVersion: "local-preview"`, or `authMode: "token"`.
- `/api/make/auth/session/complete` and at least one future/unknown auth-namespaced path use the same proxy mapping instead of a hand-written endpoint list.
- UI uses `createMakeAppAuth({ gatewayBaseUrl: "/api/make", unifiedLogin: true, apiAuthRedirect: true })`, then calls `auth.api("/app/**")` for Service-owned business routes.
- Service calls internal business routes such as `http://make-gateway/make/meta/**` and `http://make-gateway/make/data/**`.
- Service calls internal auth routes such as `http://make-gateway/make/auth/**`.
- Service does not call k8s-internal `/api/make/auth/**`, `/api/make/oauth/**`, `/api/make/meta/**`, or `/api/make/data/**`; `/api/make` is only for browser/ingress access.
- Local preview calls makecli resolve `make_api_origin` with `/api/make/**`, not k8s-internal `/make/**`.
- Published mode and local preview mode are both covered by contract tests; tests must fail if `MAKE_APP_LOCAL_PREVIEW=false` still routes upstream calls through `/api/make`.
- Service does not expose a production catch-all for all `/api/make/**`; unknown paths outside documented auth/oauth/app routes fail closed.
- Service forwards browser cookies on every auth and business request that depends on App session.
- Service derives `X-Forwarded-Host` from inbound `Host`, does not pass through client-supplied `X-Forwarded-Host`, and adds `X-Forwarded-Proto`; auth and business requests share this helper.
- `session/complete` reaches the browser as `302 + Set-Cookie + Location`.
- At least one authenticated schema/meta request and one record-list request pass through the same Service/auth adapter path before reporting publish success.
