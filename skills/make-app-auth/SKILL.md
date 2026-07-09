---
name: make-app-auth
description: Use when generating, modifying, reviewing, or debugging Make App unified login and authenticated /api/make requests with @qfeius/make-app-auth. Covers unified login, OAuth/ngrok mode, 401/403 handling, logout, current-user menu logout wiring, cookies, sessions, redirect callbacks, and Make App auth troubleshooting. For generated Make Apps, preserve authenticated context for the required make-app-permission /api/make/app/principal/permission flow. Does not cover UI layout, account menu placement, page structure, build output, Service API contracts, permission logic, DSL modeling, or canvas-table internals; use makeui for the current-user header menu surface and make-app-permission for single-app permission enforcement.
metadata:
  version: 0.1.2
---

# make-app-auth

Use this skill for **Make App authentication and authenticated Make API access**.

## Scope

This skill covers:

- `@qfeius/make-app-auth` SDK integration
- unified login as the default generated/published Make App auth mode
- unified login, OAuth, SSO, ngrok, cookie, logout, and callback testing
- direct Make gateway `/api/make/**` authenticated requests
- Service-fronted published App auth under the deployed App Service prefix, normally `/api/make/auth/**`
- 401, 403, and logout behavior
- cookie, session, redirect, and callback troubleshooting

This skill does not cover:

- UI layout, component design, or Make App page structure; use `makeui`.
- Service build output, packaging, image entrypoints, or publish runtime readiness; use `make-app-runtime`.
- runtime schema normalization, object-field mapping, table rendering, blank-page diagnosis, or business data correctness; use `makeui` and the host app tests.
- DSL modeling or Make resource definitions; use `makedsl`.
- makecli command execution; use `makecli`.
- make-gateway or Org server implementation changes.
- single-app permission enforcement; use `make-app-permission`.

## Default Behavior

Default generated and published Make Apps use **unified login** with `unifiedLogin: true`, `apiAuthRedirect: true`, and `auth.init({ redirect: true })`.

This skill only supports unified login for generated and reviewed Make Apps. Missing unified-login prerequisites are blockers, not reasons to switch modes. Do not generate browser token mode, mock mode, or any no-login bypass from this skill.

Local preview exception: a Service-fronted App may provide a Service-only local preview adapter guarded by `MAKE_APP_LOCAL_PREVIEW=true`. Enable that flag only as a temporary process environment variable from the local dev command, for example `MAKE_APP_LOCAL_PREVIEW=true pnpm run dev` or a project-owned `dev:preview` script. Do not persist the flag in `.env`, `.env.local`, `.env.example`, generated README setup steps, or deployment environment. The adapter should resolve the effective public Make origin with `makecli configure resolve --target local-preview --output=json`, consume `make_api_origin`, add the browser-facing `/api/make` scope, and attach the token only on Service-to-Make requests. It must not expose the token to UI, must not change the published unified-login contract, and must fail closed in production.

## Hard Rules

- Always use `@qfeius/make-app-auth`; do not fork a separate auth implementation.
- Direct-gateway business requests to Make backend must go through `auth.api` under `/api/make/**`.
- All frontend requests to Make backend must go through `auth.api`, including schema/meta, list, get, create, update, delete, attachment/file, lookup, user, and department candidate requests.
- Generated Apps must centralize Make backend access in a shared API adapter or data-source layer that wraps `auth.api`.
- Service-fronted Apps must preserve the `UI -> Service -> make-gateway` contract; do not let UI bypass Service for meta/data calls.
- Service-fronted Apps must also preserve this contract for permission calls. UI uses `auth.api("/app/principal/permission")`, and the single-app permission behavior belongs to `make-app-permission`.
- Service-fronted published Apps use `gatewayBaseUrl: "/api/make"` in UI. UI calls `auth.api("/app/**")`, which becomes browser requests to `/api/make/app/**`. Auth bootstrap and OAuth callbacks must stay under `/api/make/auth/**` and `/api/make/oauth/**`; do not generate `/api/auth/**`, `/api/oauth/**`, or `gatewayBaseUrl: "/api"` for this mode.
- Do not generate raw `window.fetch('/api/make/...')` for Make backend calls.
- Do not hand-write `Authorization`.
- Browser resource requests such as `<img src>`, `<object data>`, and plain `<a href>` cannot attach custom `Authorization` headers. If a Make file download requires a bearer token, UI must use a same-origin Service download proxy URL, and the Service must validate the current App session before using any deployment-injected download token.
- `gatewayBaseUrl` is the SDK option for the Make backend API base. Reuse the host Make backend config first; for local preview, prefer `makecli configure resolve --target local-preview --output=json` and its `make_api_origin` field instead of creating a second environment concept for the same URL.
- `gatewayBaseUrl` is not the unified login or account-center URL. Prefer `/api/make` for both same-origin direct-gateway Apps and Service-fronted published Apps; the difference is whether UI business calls use direct Make backend paths such as `/data/**` or Service-owned paths such as `/app/**`.
- Do not configure or hard-code unified login, Org, or account-center URLs in generated App code; make-gateway returns those URLs.
- Do not read, write, persist, or delete `zs_session` or `make_app_session` in App code.
- Do not construct Org OAuth URLs, `redirect_uri`, `state`, `code_challenge`, token exchange, or Org logout URLs in generated App code.
- Browser code cannot read `~/.make/credentials`.
- Do not generate browser-side `unifiedLogin: false`, `accessToken`, `token`, `tokenProvider`, local credential loading, `VITE_MAKE_AUTH_MODE=token`, or equivalent token-mode switches.
- Service-only local preview may use makecli credentials only behind a temporary process-level `MAKE_APP_LOCAL_PREVIEW=true`; do not persist this flag in env files or generated docs. Local preview must use `makecli configure resolve --target local-preview --output=json`, call `make_api_origin + /api/make`, and published runtime must call the k8s-internal gateway with `/make`. current-context/runtime-view must be explicit preview responses, route matching must ignore query strings such as `return_url`, and business requests must attach the token only inside Service.
- Local preview auth routes must not shadow published auth proxy routes. In published runtime, `/api/make/auth/current-context` and `/api/make/auth/runtime-view` must reach make-gateway through the auth namespace proxy and must not return `localPreview`, `local-preview-user`, `authMode: "token"`, or other preview context.
- Do not silently downgrade generated Apps from unified login because local OAuth prerequisites are missing; report the blocker.
- Before reporting publish/login readiness, verify the auth path with the agent or platform checks. Do not leave domain access, DevTools, k8s logs, or cookie inspection as user-only validation steps.
- For Service-fronted Apps, `/api/make/auth/**` and `/api/make/oauth/**` are required namespace-level Service proxy contracts under the published App Service prefix, not optional convenience routes or endpoint-by-endpoint allowlists.
- For generated Service-fronted Make Apps, the permission route `/api/make/app/principal/permission` is required by `make-app-permission`; auth must ensure it receives the established browser session context.
- Do not implement auth readiness by adding a broad `/api/make/**` passthrough. Only auth/oauth are default transparent namespaces; Service-owned business requests stay under explicit `/api/make/app/**` routes, and unknown `/api/make/**` paths fail closed.
- For Service-fronted Apps, Service must preserve the App host context for every make-gateway call: derive `X-Forwarded-Host` from inbound `Host`, do not trust client-supplied `X-Forwarded-Host`, add `X-Forwarded-Proto`, and share the same helper for auth and business proxy requests.
- Generated authenticated App shells must expose a visible logout action in the current-user menu or the host's established account area, and that action must call `auth.logout()`. The visual menu surface belongs to `makeui`; this skill owns the auth handler and logout behavior. Do not implement logout by clearing cookies, rewriting Org URLs, or hiding logout in page-specific controls.
- Generated Apps must handle recoverable unified-login expiry: when SDK init returns `reason: "state_expired"` or `reason: "challenge_expired"`, show a relogin prompt and call `auth.login({ redirect: true })` from user action.

## Pre-flight Workflow

1. Use unified login. If unified-login prerequisites are missing, report the blocker instead of switching modes.
2. Read `references/sdk-integration.md` before generating or changing auth code.
3. Read the relevant mode reference unless troubleshooting requires more.
   - Default unified login: `references/unified-login-mode.md`
   - 401, 403, logout: `references/logout-and-401.md`
   - Incident/debugging: `references/troubleshooting.md`
4. Read `references/service-fronted-mode.md` when the App keeps a Service layer between UI and make-gateway.
5. Read `references/request-adapter.md` whenever generating or reviewing Make backend requests.
6. Keep auth bootstrap thin. Business features must consume the project Make API adapter and auth state, not auth internals.
7. Before claiming publish/login readiness, verify the auth path: current-context route, unified redirect, session callback, cookie-preserving business requests, and Service-fronted auth proxy when applicable.
8. Run `scripts/audit-auth-contract.mjs <project-root> --published` for generated Apps when a project tree is available; use `--mode service-fronted` when the App keeps a Service layer.
9. When changing generated code, add or update tests for the touched auth path: unauthenticated session, expired session, 403, logout, unified-login redirect, callback proxy, or business-request 401 handling.

## Reference Selection

- SDK contract and request wrapper: `references/sdk-integration.md`
- Shared request adapter and 401/403 handling: `references/request-adapter.md`
- Default unified login mode: `references/unified-login-mode.md`
- Service-fronted unified-login mode: `references/service-fronted-mode.md`
- 401, 403, and logout behavior: `references/logout-and-401.md`
- Auth incident diagnosis: `references/troubleshooting.md`
- Minimal Service-fronted sample project: `examples/service-fronted-node/`; use only as a reference shape after reading `references/service-fronted-mode.md`.

## Deterministic Checks

Use `scripts/audit-auth-contract.mjs` on generated App projects to catch contract drift before publish:

```bash
node skills/make-app-auth/scripts/audit-auth-contract.mjs <project-root> --published
node skills/make-app-auth/scripts/audit-auth-contract.mjs <project-root> --mode service-fronted --published
```

The audit is auth-scoped. It checks unified-login readiness, raw `/api/make` fetch usage, Service-fronted `/api/make/auth/**` and `/api/make/oauth/**` namespace proxy presence, local-preview auth shadowing, broad `/api/make/**` passthrough risk, and obvious direct-vs-Service route mismatches. It does not verify schema rendering or UI blank-page behavior.

Audit expectations:

- UI design-system theme fields named `token` are not auth token mode. Only flag token-mode options inside auth configuration, auth environment switches, browser credential access, or explicit `authMode: "token"` paths.
- Service namespace proxies may be expressed as direct string routes, constants, `.startsWith(...)`, or equivalent regex route mounts, as long as `/api/make/auth/**` and `/api/make/oauth/**` map to internal `/make/auth/**` and `/make/oauth/**`.
- Cookie forwarding may use `req.headers.cookie`, `req.header("cookie")`, Fetch `headers.get("cookie")`, or an equivalent inbound-header adapter.
- Keep tests in `scripts/test-audit-auth-contract.mjs` updated when changing audit heuristics, especially for false-positive and false-negative cases discovered in generated Apps.

## Collaboration With makeui

When `makeui` is generating or editing Make App frontend code, this skill owns all authentication decisions. `makeui` may design UI states around auth results, but it must not invent OAuth, cookie, token, logout, or `/api/make/**` request logic.

`make-app-auth` reports whether the user is authenticated, unauthenticated, forbidden, expired, or blocked by an auth proxy/callback problem. It should not diagnose schema shape mismatches, missing fields, render crashes, white screens, or record-table behavior after authenticated Make requests are already reaching the backend.
