# Scoped route feedback

Read this when generating or changing App/object/fixed-page guards. This owns layout and permission boundaries, not npm UI semantics. React uses verified `MakeAppPermissionNotice` through the shared host adapter in `makeui/references/permission-feedback.md`; that reference owns install/CSS/props and release readiness. Keep existing non-React feedback helpers compatible.

## Mounting boundary

- Auth/permission/Schema loading must complete before business routes can run. Fail closed on load errors, but do not describe an unavailable service as denied permission.
- The App guard sits **outside** the shell. After successful loading, use all authorized objects **and authorized fixed pages** to decide whether an App entry exists. No authorized entry uses App-scope full-page feedback and mounts no business routes.
- If any authorized entry exists, the shell sits **outside** object/fixed-route guards. A denied destination replaces the **entire business content slot**, keeping the global identity header and authorized navigation (desktop sidebar or the host's mobile navigation). Unmount the business title, toolbar, search, statistics, table headers, rows, forms and dialogs; do not leave a disabled or empty business shell around the feedback.
- Never infer an App-wide denial from the current object's absence, a record 403, or `data.record.read=false`. Never mount the shell only inside the allowed business page and return a standalone resource panel from the router.
- Reuse authorized Schema/navigation data to build the shell independently of the denied object. Do not request denied records to obtain shell metadata or administrator help; do not expose the unavailable object's name/fields from stale or untrimmed Schema.
- Keep target-bound business loaders and AI surfaces unmounted when route access or the resource's required read is denied. Independently authorized App-level features remain governed by their own gates.
- Metadata/field authorization does not require keeping business headers mounted. If record read is denied locally, revoked on refresh, or explicitly refused by a current target's request, replace the same whole business content. Keep denial state outside the replaced business subtree, keyed by identity/App/target/access generation, so unmounting does not reset it and cause a fetch loop. Ignore stale target responses and clear cached records/counts/selections. This is resource denial, not App denial.
- Only an object/page read refusal replaces the business content. A rejected save/export/create remains operation feedback, preserving allowed input. Independent create-only routes use their own operation/field requirements, not a blanket record-read gate.

## React composition example

`AppPermissionFeedback` below is the App-owned adapter example from `makeui/references/permission-feedback.md`, not an npm/SDK export. Its `feedbackProps` carry established auth/context, contact payload, controlled retry status and the host refresh callback. `route` comes from the host's tested resolver; only explicit permission denial yields `forbidden`. Metadata allowed but Schema missing yields `unavailable`, not permission denial. This example is a record-reading object destination: `recordAccess` combines its current permission with classified request denial, and is owned above the business page. Other route kinds use their own required permissions.

```jsx
function AppRouter({ accessReady, hasAuthorizedEntry, route, recordAccess, feedbackProps, navigate }) {
  if (!accessReady) return <AccessLoadingOrError />;
  if (!hasAuthorizedEntry) {
    return <AppPermissionFeedback {...feedbackProps} variant="page" scope="app" />;
  }
  return (
    <AppShell>
      <ObjectRouteGuard route={route} recordAccess={recordAccess} feedbackProps={feedbackProps} navigate={navigate} />
    </AppShell>
  );
}

function ObjectRouteGuard({ route, recordAccess, feedbackProps, navigate }) {
  if (route.kind === "forbidden" || recordAccess.kind === "forbidden") {
    return <ResourceFeedback>
      <AppPermissionFeedback {...feedbackProps} variant="inline" scope="resource" />
      <button type="button" onClick={navigate}>返回可访问页面</button>
    </ResourceFeedback>;
  }
  if (route.kind === "unavailable" || route.kind === "not-found") {
    return <PageUnavailable onRetry={feedbackProps.onRetry} />;
  }
  if (recordAccess.kind !== "allowed") return <AccessLoadingOrError />;
  return <ObjectPage entity={route.entity} onReadDenied={recordAccess.onDenied} />;
}
```

`AppShell` receives the host's authorized navigation and current identity, not the denied object's data hook. `ResourceFeedback` is an existing or thin host content wrapper, not a new permission engine; its host-owned return action navigates only to an authorized target. Return/account actions are not npm component props. The feedback wrapper fills its content region, never `100vw/100vh` or another full-viewport overlay that hides the shell. `ObjectPage` includes all object-specific business UI and separately checks reads/mutations. If an object title/breadcrumb/toolbar is supplied through a shell slot, clear that business slot on denial too; it is not part of the retained global identity header. Its `onReadDenied` reports only a classified read refusal to the parent owner; a save/export denial must not call it. Do not put this guard inside a table body or retain a business header above it. Never have the npm component guess DOM selectors or remove host siblings.

A current read refusal remains latched until an explicit access refresh; do not remount the business page merely because its query state was cleared. Refresh reloads permission and permission-trimmed Schema in one generation before resolving the same URL again. Invalidate stale target requests/data; do not reuse an old allow after refresh fails. Do not auto-redirect an explicitly denied URL without displaying its scoped feedback.

The host sets `retryStatus="checking"` while that generation is loading, `denied` only for an explicit refusal and `error` for a failed check. Set `restored` only after permission and Schema have completed successfully for the same identity/App generation. Operation recovery enables a user action; it never replays the rejected mutation. Known permission denial belongs in its scoped feedback, not a duplicate generic network-error card; unrelated structured request errors keep the independent error outlet.

## Required behavioral acceptance

Use the host's existing browser/component test stack with isolated permission/Schema fixtures. Assert the rendered tree and protected-request counter, not merely `scope="resource"` or a helper call:

1. At least one authorized entry, direct URL to a denied object/fixed page: authorized navigation/global identity header remain visible, feedback fills the business content region, business title/search/toolbar/statistics/table headers/forms/dialogs are absent, denied business requests are zero, denied metadata is absent. Test a non-table/card layout too.
2. Navigation and return actions reach an authorized page; they do not retry the denied destination. Missing administrator contacts keep generic feedback without losing navigation.
3. Grant then refresh: permission -> Schema -> authorized data request, resolving the original URL. A failed refresh never loads protected data.
4. Post-load read revocation or a classified read 403: unmount the entire affected business content, remove cached records/counts/selections, and reject late responses without remount/fetch loops; retain authorized navigation/global identity header and access to another allowed destination. The rejecting request itself is not a forbidden subsequent request. Full-page App denial is permitted only when no authorized entry remains.
5. No authorized object or fixed page: App-scope feedback, no shell/business route or protected request.
6. Record-read-only denial retains authorized navigation, not business headers; unknown 403, 401 and service failures are not permission denial. Operation-only refusal keeps the business page and allowed draft, and recovery never replays the mutation.

Missing these runtime assertions is a delivery blocker even if a static audit passes. Existing Apps do not inherit this behavior automatically; the generation guidance affects Apps using this Skill version, and older Apps require regeneration or a scoped migration.
