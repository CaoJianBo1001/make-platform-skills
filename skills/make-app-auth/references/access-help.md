# Administrator Contact Help

Use one host-owned feedback component for startup denial, frontend permission guards and known business permission denials. It displays directly assigned user administrators only, not departments or Agents, and does not decide or grant permissions.

## Capability and release gate

The contact-query addition may be unreleased. Do not infer availability from the existing minimum auth SDK version or a changed template. Verify the installed SDK types expose `getAppAdministrators`, the gateway endpoint is deployed, and the generated App includes the shared renderer. Until then, preserve embedded contacts and generic fallback; report independent contact lookup as not ready. Do not invent a published version or hand-write a raw-fetch/Console/IAM fallback.

```js
const canLoadContacts = typeof auth.getAppAdministrators === 'function';
```

The SDK method returns `Promise<Array<{ userId, name, avatarUrl? }>>`. It is a dedicated auth-runtime helper, not a business `auth.api` request: it does not invoke login/403 hooks. It uses a three-second deadline, coalesces concurrent calls on one auth client, keeps no completed-result cache, and invalidates pending work on login/logout. Recreate the auth/help state when identity, tenant or App changes; unmount old feedback and ignore stale responses.

## Runtime contract

- Browser: `GET /api/make/auth/app-administrators`; internal Service upstream: `/make/auth/app-administrators`.
- Use the existing auth namespace proxy in Service-fronted Apps, preserving Cookie and trusted forwarded host/proto. Do not add a broad `/api/make/**` proxy or gate contact reads on business access/current-context returning 200.
- Server validates identity and a published, host-resolved App in the same tenant. Browser-supplied tenant/App selectors do not choose the directory. A business-denied user can read current-App contacts; this cannot authorize data access.
- Success: `{code:200,data:{appAdministrators:[{userId,name,avatarUrl}]}}`, `Cache-Control: no-store`.
- Missing/invalid identity: 401; tenant mismatch: 403; unknown/unpublished App: 404; identity verification unavailable: 503. Contact directory failures may safely return an empty list. No login redirect or session issuance from this endpoint.

## UI integration

Adapt the auth SDK Vibe template's `templates/vibe-app/src/forbidden.js` into the host shared feedback module. `showForbidden` is a template/helper function, NOT an npm SDK export. Reuse it for all denied surfaces; keep auth logic in the SDK.

```js
// Local route guard: do not send a denied business request just to obtain a 403.
await showForbidden(objectFeedbackElement, { auth, scope: 'resource' });
// A known permission-denied operation: preserve the payload and the user's input.
await showForbidden(formFeedbackElement, { auth, payload: error.payload, scope: 'operation' });
```

- Startup/no authorized App entry uses App-scope feedback; object access uses resource scope; create/update/delete use operation scope. Only App-scope denial replaces the App entry. Keep navigation and unaffected forms for local denial.
- Render existing `payload.data.appAdministrators` immediately. An explicit empty array is authoritative: keep the generic message without a redundant query. If the field is absent, use `auth.getAppAdministrators()` when available, even if no business request occurred.
- Show `无权限，请联系应用管理员授权` immediately while loading or when no contacts are available. Query timeout/failure keeps this fallback; never call the global denial handler again for the help query.
- Preserve backend order; deduplicate by userId; escape names/use text nodes; filter avatar URL protocols; use the first name character for missing, unsafe or failed images. Separate contacts with `、`.
- Discard query results after the target unmounts or a newer render replaces it. Never persist contacts across users/tenants/Apps.
- HTTP 403 alone does not prove permission denial. Branch on the backend's documented permission code/reason; keep unknown or infrastructure failures as request errors. Do not infer a full-App denial from a record request. Tenant mismatch should offer the correct organization path, not cross-tenant contacts.

## Verification

Test embedded contacts, empty/missing lists, frontend-only guards with zero protected requests, resource/operation feedback preserving shell/input, request failures without recursive login, concurrent lookups, session/navigation changes, name escaping and failed images. Verify both direct-gateway and Service-fronted paths against the deployed App before claiming release readiness.
