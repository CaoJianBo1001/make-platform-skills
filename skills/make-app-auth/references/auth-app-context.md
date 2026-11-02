# Service Make App Context

This is the authoritative appKey-injection contract for Service-to-Gateway calls. Apply it inside the existing shared Make client, not as a new proxy or browser SDK option.

## Contract

- Read and trim `MAKE_APP_KEY` once in the Service config entry; missing/blank values stop startup. Use this trusted `config.appKey`, never browser input, a hostname or a default App.
- Every frontend-driven and internal Make request uses the shared decorator below, including auth/oauth and business calls. Set exactly one outer query `appKey`, replacing existing or duplicate values. The receiving backend decides whether to consume it; appKey is not identity or permission proof.
- Decorate only URLs already constructed by the Make client from its trusted gateway origin and explicit published/preview scope. Keep route/selector validation and configured business payloads unchanged. Do not add a broad proxy or decorate static, health/config, non-Make or locally answered preview requests.
- Change no other request or response behavior: preserve other query values (encoding may normalize), opaque/nested OAuth URLs, method, body, headers, Cookie, streams, AbortSignal, status, Location and every Set-Cookie. Keep manual redirect handling; do not add appKey inside Org's callback URI.

## Shared URL decorator

<!-- executable-app-key-context -->
```js
export function withMakeAppContext(input, config) {
  const url = new URL(input);
  if (/^\/(?:api\/)?make(?:\/|$)/u.test(url.pathname)) {
    url.searchParams.set('appKey', config.appKey);
  }
  return url;
}
```

Call it at the existing Make client's URL-to-fetch boundary: `fetch(withMakeAppContext(url, config), init)`. Reuse that client in auth proxies, business adapters and internal callers; retain its current call signature, config, forwarding and transport implementation.

For mode/proxy behavior and current-context compatibility, use [Service-fronted mode](service-fronted-mode.md); identity consumption remains in [Current-context consumption](service-fronted-mode.md#current-context-consumption). This contract does not replace authentication/IAM checks or change backend endpoint ownership. Updating a Skill does not update already deployed Services.

## Verification

Run `node --test scripts/test-auth-app-context.mjs` for the executable decorator and published/preview examples. Cover auth/oauth, business/internal/future paths, duplicate appKey, other query values, input immutability, non-Make exclusions, and a real HTTP POST retaining body and redirects. Retain the host's existing login/proxy tests; verify a deployed Service separately before claiming live readiness. The audit warning is only a source hint, not runtime proof.
