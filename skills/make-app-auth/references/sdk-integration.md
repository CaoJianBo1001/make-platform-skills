# SDK Integration

Use `@qfeius/make-app-auth` for Make App authentication and Make backend requests.

## Responsibility Boundary

The SDK owns auth bootstrap, unified-login browser state, cookies, redirects, logout, and scoped request helpers under `/api/make/**`.

App code owns page state, user-facing messages, and business feature logic.

The SDK and this skill diagnose auth only. They should answer whether a request is authenticated, unauthenticated, forbidden, expired, missing a cookie, blocked by callback routing, or failing because the Service auth proxy contract is absent.

The SDK should not diagnose runtime schema shape, object-field normalization, canvas-table rendering, white screens, published asset routing, or business data correctness. When authenticated `/api/make/**` requests succeed but UI rendering fails, hand off to `makeui` and the host app smoke tests.

SDK improvement backlog, not current generated-App contract:

- `unauthenticated`
- `forbidden`
- `session_expired`
- `state_expired`
- `challenge_expired`
- `cookie_missing`
- `cookie_not_sent`
- `callback_exchange_failed`
- `auth_proxy_missing`
- `logout_failed`

These labels describe the desired future diagnostic vocabulary only. Do not generate App code that branches on these labels unless the installed SDK type definitions expose them. Current generated App code should branch on the published SDK contract, such as `MakeAppUnauthorizedError`, `MakeAppForbiddenError`, `status`, and `reason`.

Do not add schema, table, route-rendering, or publish-platform labels to SDK diagnostics.

## Dependency

Use the public npm package by default when the SDK behavior is stable:

```json
{
  "dependencies": {
    "@qfeius/make-app-auth": "^0.1.3"
  }
}
```

Install command:

```bash
pnpm add @qfeius/make-app-auth@^0.1.3 --registry=https://registry.npmjs.org/
```

Published unified-login Apps require `@qfeius/make-app-auth >= 0.1.3`. Do not generate or publish Apps with older npm dependencies.

## Startup Shape

Generated Apps use unified login. Direct App entry should call `auth.init({ redirect: true })` and go to the Org login page instead of showing an App-owned login page.

```js
import {
  createMakeAppAuth
} from '@qfeius/make-app-auth';

const auth = createMakeAppAuth({
  gatewayBaseUrl: '/api/make',
  unifiedLogin: true,
  apiAuthRedirect: true
});

const boot = await auth.init({ redirect: true });

if (boot.status === 'authenticated') {
  renderApp({
    auth,
    context: boot.context,
    onLogout: () => auth.logout()
  });
} else if (boot.reason === 'state_expired' || boot.reason === 'challenge_expired') {
  renderLoginExpired({
    message: boot.message || '登录已过期，请重新登录',
    onRelogin: () => auth.login({ redirect: true })
  });
} else if (boot.status === 'forbidden') {
  renderForbidden();
} else {
  renderLoading();
}
```

## Business Requests

Use `auth.api` for Make backend calls. In direct gateway mode, the SDK handles `/api/make`, cookies, JSON request bodies, and unified auth errors.

`gatewayBaseUrl` is the SDK option for the Make backend API base. In Make tooling the effective local-preview backend origin is resolved by `makecli configure resolve --target local-preview --output=json`; consume the returned `make_api_origin` and add `/api/make` in Service-only local preview. Legacy `configure get environment` / `configure get meta-server-url` probing is only a fallback for older makecli installations. Reuse that host Make backend config when generating App configuration; do not invent a separate backend URL setting.

For a deployed same-origin direct-gateway unified-login App, prefer the SDK default `/api/make`. For a Service-fronted published App, also configure `gatewayBaseUrl: "/api/make"` and keep business calls as `auth.api("/app/**")`, which normally reaches `/api/make/app/**`. Browser code must not read `~/.make/config` directly.

`gatewayBaseUrl` is not the unified login, Org, or account-center URL.

Business code should pass relative paths to `auth.api`, for example `/data/v1/record`. Do not generate absolute business URLs. If an absolute URL is unavoidable, it must be under the same origin and path scope as `gatewayBaseUrl`; otherwise the SDK rejects it.

Available helpers:

```js
auth.api.get(path, init);
auth.api.post(path, body, init);
auth.api.put(path, body, init);
auth.api.patch(path, body, init);
auth.api.delete(path, init);
auth.api.request(path, init);
```

For shared adapter, 401/403, request headers, and no-scattered-`auth.api` rules, read `request-adapter.md`.

For Service-fronted Apps where UI calls App Service and Service calls make-gateway, read `service-fronted-mode.md`; keep browser auth/oauth paths under `/api/make/**` and keep Service upstream paths under internal `/make/**`.

For published/vibe Apps, auth integration is not complete until the agent or platform has verified the domain entry path, current-context challenge/context path, callback/session completion, and at least one authenticated business request through the generated adapter. Run `scripts/audit-auth-contract.mjs <project-root> --published` when a generated project tree is available. Do not make the user discover these failures by opening DevTools after publish.

## Tests To Add When Touching Auth

- 403 forbidden response.
- Unified-login API 401/403 with `apiAuthRedirect: true` redirects through SDK login once.
- Unified-login unauthenticated state does not loop redirects.
- Business-request 401 from schema/list/create/update/delete enters the shared expired-session handler.
- Make backend calls are routed through the shared adapter; no raw `window.fetch('/api/make/...')` and no scattered unhandled `auth.api` calls in UI components.
- Unified-login state/challenge expiration renders a relogin prompt instead of automatically redirecting again.
- Authenticated unified-login state exposes a visible logout action wired to `auth.logout()`, preferably in the top-header current-user menu defined by `makeui`.
- Logout does not consume or rewrite `orgSsoLogoutUrl` in App code; the SDK calls make-gateway logout and follows gateway `redirectUri`, which should be an App return URL rather than an account-center or Org logout URL.
- Service-fronted unified-login Apps proxy `/api/make/auth/current-context`, `/api/make/auth/session/complete`, and logout through Service without swallowing redirect or cookie headers.

## Never Generate

- Reading, storing, or forwarding Org access tokens.
- Reading, writing, or deleting `zs_session` or `make_app_session`.
- Browser code that tries to read `~/.make/credentials`.
- Raw `Authorization` header logic outside the SDK.
- Token-mode SDK options such as `unifiedLogin: false`, `accessToken`, `token`, or `tokenProvider`.
- Token-mode environment switches such as `VITE_MAKE_AUTH_MODE=token`.
- Using makecli credentials in UI. If local preview needs makecli token, keep it in Service-only code guarded by `MAKE_APP_LOCAL_PREVIEW=true`.
- Hard-coded Org, unified-login, or account-center domains in App code.
- Passing arbitrary absolute URLs to `auth.api`.
- Constructing Org OAuth URLs, `redirect_uri`, `state`, or `code_challenge`.
- Constructing Org logout URLs or adding App-side fallback logic for `token不能为空`.
- Handling Org OAuth `code` in the App.
- Raw `window.fetch('/api/make/...')` for Make backend calls.
- Monkey-patching `window.fetch`.
- Treating browser context data as server-trusted authorization.
