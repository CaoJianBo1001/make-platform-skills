# Administrator Contact Help

Use one host-owned adapter for startup denial, frontend permission guards and known business permission denials. React Apps render `PermissionFeedback` from `@qfeius/make-app-feedback`; read `makeui/references/permission-feedback.md` for the public props, CSS, installed-package verification and release gate. Display directly assigned user administrators only, not departments or Agents. Neither the component nor contact lookup decides or grants permissions.

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

For React Apps, use the package-backed host adapter from `makeui/references/permission-feedback.md` instead of copying the DOM renderer or its styles. The package has no automatic 403 listener, contact-query hook or `showForbidden` export. The host supplies scope, contact and retry state plus existing navigation/auth callbacks; keep auth logic in the SDK.

Existing non-React Apps may retain the Vibe template's `templates/vibe-app/src/forbidden.js` as a compatibility helper. Its `showForbidden` is a local DOM function, not an SDK/npm export; do not force a framework migration merely for this package. Scope and safe contact rules still apply.

- Startup/no authorized App entry uses App-scope feedback; object access uses resource scope; create/update/delete use operation scope. Only App-scope denial replaces the App entry. Keep navigation and unaffected forms for local denial.
- Do not wire every SDK/business 403 to an App-wide renderer. Pass the request owner's resource/operation context to the host feedback sink; App-entry denial remains separate. Preserve the existing login and Trace lifecycle.
- Render existing `payload.data.appAdministrators` immediately. An explicit empty array is authoritative: keep the generic message without a redundant query. If the field is absent, use `auth.getAppAdministrators()` when available, even if no business request occurred.
- Keep generic authorization guidance visible while contacts load or are unavailable. React uses the package's default `请联系应用管理员为你开通权限。` plus a separate administrator row; legacy DOM copy may remain unchanged. Query timeout/failure keeps generic help; never call the global denial handler again for the help query.
- Preserve backend order and pass validated user contacts. React delegates deduplication, safe text/avatar rendering, failed-image initials and contact wrapping to the package; do not add another handwritten avatar/name renderer or force inline `、` separators into its layout. Non-React compatibility helpers retain their own safe rendering.
- Discard query results after the target unmounts or a newer render replaces it. Never persist contacts across users/tenants/Apps.
- HTTP 403 alone does not prove permission denial. Branch on the backend's documented permission code/reason; keep unknown or infrastructure failures as request errors. Do not infer a full-App denial from a record request. Tenant mismatch should offer the correct organization path, not cross-tenant contacts.

## Verification

Test embedded contacts, empty/missing lists, frontend-only guards with zero protected requests, resource/operation feedback preserving shell/input, request failures without recursive login, concurrent lookups, session/navigation changes, name escaping and failed images. Also verify the installed React component/CSS and package gate from `makeui/references/permission-feedback.md`. A locally approved tarball test does not prove npm publication, SDK release or gateway deployment. Verify both direct-gateway and Service-fronted paths against the deployed App before claiming release readiness.
