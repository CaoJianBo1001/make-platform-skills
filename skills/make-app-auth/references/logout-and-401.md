# Logout And 401

Use this reference when implementing or reviewing user-facing behavior for auth failures and logout.

401 means browser session is missing or expired.

Behavior:

- Show only a neutral loading state while the browser is being redirected.
- Use `auth.login({ redirect: true })` to enter the Org login page.
- If the current App session is diagnosed as stale or broken, clear the App session with `auth.logout({ redirect: false })`, then call `auth.login({ redirect: true })`. Do not make logout-before-login the default 401 path.
- Do not render an App-owned login page, login transition page, or signed-out completion page.
- Prefer `createMakeAppAuth({ apiAuthRedirect: true })` for generated unified-login Apps with `@qfeius/make-app-auth >= 0.1.3`, so SDK handles API 401/403 redirect checks with built-in loop protection.
- Do not leave business views in a schema/list/create/update/delete error state for 401. Route 401 through the shared expired-session handler.
- If `auth.init({ redirect: true })` returns `reason="state_expired"` or `reason="challenge_expired"`, show `登录已过期，请重新登录` and wait for the user to click.
- After the user clicks relogin, call `auth.login({ redirect: true })`. Do not implement multiple automatic retries.

Logout:

```js
await auth.logout();
```

Generated App shells must expose logout as a visible account action. The default Make UI placement is the top-header current-user dropdown: avatar plus display name opens a menu below the header, and the menu contains `退出`. If the host project already has an equivalent account menu, use that established surface, but the action must still call `auth.logout()`.

Do not construct Org logout URLs in generated App code. make-gateway and Org own global logout behavior.

The SDK calls make-gateway logout and follows the gateway-provided App `redirectUri`. Generated App code must not rebuild this flow, consume deprecated `orgSsoLogoutUrl` directly, or patch wrong logout URLs in UI code. After the App loads again, `auth.init({ redirect: true })` decides whether the user should enter the Org login page.

## Error Handling Pattern

Handle 401/403 in one Make API adapter or data-source layer. Every frontend request to the Make backend, including schema/meta, records, lookup, user, department, and file APIs, must go through that shared handler. Read `request-adapter.md` for the implementation pattern.

## Anti-patterns

- Generating token mode, local debug token prompts, or no-login bypasses.
- Handling 401 only in App bootstrap while business requests use unhandled `auth.api` calls.
- Calling `auth.api` directly from scattered UI components without the shared 401/403 handler.
- Using raw `window.fetch('/api/make/...')` for any Make backend request.
- Automatically retrying unified login multiple times after state/challenge expiration.
- Hand-writing per-request 401/403 login wrappers when the SDK option `apiAuthRedirect: true` is available.
- Rebuilding Org authorize/logout URLs in App code.
- Hiding logout in page-specific actions instead of exposing it through the account/current-user surface.
- Hard-coding Org, unified-login, or account-center environment domains in App code.
- Clearing `zs_session` or `make_app_session` from App code.
- Treating every 403 as a login-expired state after SDK login check confirms the user is already authenticated.
