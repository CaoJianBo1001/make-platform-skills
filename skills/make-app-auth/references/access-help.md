# Administrator Contact Help

Use one host-owned adapter for startup denial, frontend permission guards and known business permission denials. React Apps render `MakeAppPermissionNotice` from `@qfei-design/make-app-observability/react`; read `makeui/references/permission-feedback.md` for the public props, CSS, variants, installed-package verification and release gate. Display directly assigned user administrators only, not departments or Agents. Neither the component nor contact lookup decides or grants permissions.

## Capability and release gate

Skill/npm releases may precede backend deployment. Administrator lookup is an optional enhancement, never a prerequisite for App generation, login, IAM loading, business access or denial rendering. A missing SDK method or undeployed endpoint does not by itself block App readiness; preserve embedded contacts and generic authorization guidance, and report named-contact lookup as degraded rather than fully available. Existing auth/IAM gates remain mandatory, and a missing npm component/JS/types/CSS is still a package blocker.

The contact-query addition may be unreleased. Do not infer availability from the existing minimum auth SDK version or a changed template. Verify the installed SDK types expose `getAppAdministrators` and test the deployed gateway before claiming independent contact lookup is available. Do not require an unreleased SDK version, invent a published version or hand-write a raw-fetch/Console/IAM fallback.

```js
const canLoadContacts = 'getAppAdministrators' in auth && typeof auth.getAppAdministrators === 'function';
```

The SDK method returns `Promise<Array<{ userId, name, avatarUrl? }>>`. It is a dedicated auth-runtime helper, not a business `auth.api` request: it does not invoke login/403 hooks. It uses a three-second deadline, coalesces concurrent calls on one auth client, keeps no completed-result cache, and invalidates pending work on login/logout. Recreate the auth/help state when identity, tenant or App changes; unmount old feedback and ignore stale responses.

The installed SDK may declare `avatarUrl?: string | null`. Preserve that nullable response type at the SDK boundary, then normalize `null` to `undefined` in the host contact adapter before passing the presentation DTO. Do not narrow the SDK method signature to the UI component's non-nullable avatar type.

Check both runtime and TypeScript compatibility with an SDK declaration that lacks the method. Use the `in` guard above when accessing the concrete SDK client. A typed host adapter should share an existing client member such as `api` plus the optional helper, as in the MakeUI example; an optional-helper-only type rejects older clients with TypeScript's weak-type error. Do not require or assert that the new method exists.

## Staggered-release fallback

| Available capability | Host behavior |
| --- | --- |
| Denial includes `data.appAdministrators`, including `[]` | Render immediately; explicit empty is authoritative and makes no independent lookup |
| Old SDK with a new backend and embedded contacts | Preserve the SDK's denial payload and render contacts without requiring the new query method |
| Old SDK with a deployed query endpoint but no embedded list | Retain generic guidance; endpoint availability alone does not add an SDK method or justify raw fetch |
| No embedded list and no SDK method | Render generic guidance without a request |
| SDK method exists but endpoint returns 404 | Quietly keep generic guidance; this is not an App/login error or proof of the App's existence |
| Lookup returns 401/403/5xx, times out, fails transport or has invalid data | Catch locally, retain generic guidance and the original denial; optional contact-unavailable text stays inside the feedback |
| Endpoint becomes available later | A later entry or explicit retry may query again; do not permanently cache unsupported capability |

Render denial before starting contact lookup; do not await help in auth bootstrap or combine it with required IAM/Schema loading in an all-or-nothing promise. Use the SDK's deadline and concurrent-request coalescing. Do not poll, automatically retry a failed lookup, invoke login/global denial/error hooks or replay a business operation for contact help. Reuse the same policy for App, resource and operation feedback, without changing their scope. `administratorStatus: 'ready'` with no contacts describes the generic UI state, not backend deployment readiness.

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
- Keep generic authorization guidance visible while contacts load or are unavailable. React uses the package's authorization guidance and loading/error state; legacy DOM copy may remain unchanged. Query timeout/failure keeps generic help; never call the global denial handler again for the help query.
- Preserve backend order and pass validated user contacts. React delegates deduplication, safe text/avatar rendering, failed-image initials and contact wrapping to the package. Toast uses compact names separated by `、`; inline/page use avatar/name chips. Do not add another handwritten avatar/name renderer. Non-React compatibility helpers retain their own safe rendering.
- Discard query results after the target unmounts or a newer render replaces it. Never persist contacts across users/tenants/Apps.
- For business requests, HTTP 403 alone does not prove permission denial. Branch on the backend's documented permission code/reason; keep unknown or infrastructure failures as request errors. SDK startup is a separate contract: `auth.init()` returning `forbidden` follows `sdk-integration.md#startup-shape`, without requiring the business payload reason. Do not infer a full-App denial from a record request. Tenant mismatch should offer the correct organization path, not cross-tenant contacts.

## Verification

Test embedded contacts, empty/missing lists, frontend-only guards with zero protected requests, resource/operation feedback preserving shell/input, request failures without recursive login, concurrent lookups, session/navigation changes, name escaping and failed images. Test new Skill/npm with an old SDK and with an endpoint returning 404, plus timeout/invalid-response/401/403/503 cases; assert generic guidance, no auth/business side effects, no polling and successful contact discovery after later rollout. Run these against the production host adapter in its default test/CI gate, not a test-only fallback. Repository CI executes the guide's contact effect through `scripts/test-administrator-help-compatibility.mjs`.

Also verify the installed React component/CSS and package gate from `makeui/references/permission-feedback.md`. A locally approved tarball test does not prove npm publication, SDK release or gateway deployment. Distinguish verified generic-fallback compatibility from verified named-contact availability; verify both direct-gateway and Service-fronted paths against the deployed App before claiming the latter.
