# Scoped route feedback

Read this when generating or changing App/object/fixed-page guards. This is a layout and permission boundary, not a new npm component API. Reuse the host's feedback component; frontend owns its eventual package and styling.

## Mounting boundary

- Auth/permission/Schema loading must complete before business routes can run. Fail closed on load errors, but do not describe an unavailable service as denied permission.
- The App guard sits **outside** the shell. After successful loading, use all authorized objects **and authorized fixed pages** to decide whether an App entry exists. No authorized entry uses App-scope full-page feedback and mounts no business routes.
- If any authorized entry exists, the shell sits **outside** object/fixed-route guards. A denied destination replaces only the content slot, keeping the current user's header and authorized navigation (desktop sidebar or the host's mobile navigation).
- Never infer an App-wide denial from the current object's absence, a record 403, or `data.record.read=false`. Never mount the shell only inside the allowed business page and return a standalone resource panel from the router.
- Reuse authorized Schema/navigation data to build the shell independently of the denied object. Do not request denied records to obtain shell metadata or administrator help; do not expose the unavailable object's name/fields from stale or untrimmed Schema.
- Keep target-bound business loaders and AI surfaces unmounted when metadata/route access is denied. Independently authorized App-level features remain governed by their own gates.
- If metadata and fields are authorized but record read is not, retain their navigation/table headers, pass an empty row set, and disable list/detail requests. This is not an App denial.

## React composition example

The names below are host-owned slots, not SDK/npm exports. `route` comes from the host's tested resolver; only explicit permission denial yields `forbidden`. Metadata allowed but Schema missing yields `unavailable`, not permission denial.

```jsx
function AppRouter({ accessReady, hasAuthorizedEntry, route, refreshAccess, navigate }) {
  if (!accessReady) return <AccessLoadingOrError />;
  if (!hasAuthorizedEntry) {
    return <ForbiddenPanel scope="app" onRetry={refreshAccess} />;
  }
  return (
    <AppShell>
      <ObjectRouteGuard route={route} refreshAccess={refreshAccess} navigate={navigate} />
    </AppShell>
  );
}

function ObjectRouteGuard({ route, refreshAccess, navigate }) {
  if (route.kind === "forbidden") {
    return <ResourceFeedback onReturn={navigate}>
      <ForbiddenPanel scope="resource" onRetry={refreshAccess} />
    </ResourceFeedback>;
  }
  if (route.kind === "unavailable" || route.kind === "not-found") {
    return <PageUnavailable onRetry={refreshAccess} />;
  }
  return <ObjectPage entity={route.entity} />;
}
```

`AppShell` receives the host's authorized navigation and current identity, not the denied object's data hook. `ResourceFeedback` is an existing or thin host content wrapper, not a new permission engine; its return action navigates only to an authorized target. The feedback wrapper fills its content region, never `100vw/100vh` or another full-viewport overlay that hides the shell. `ObjectPage` separately gates record reads and mutations.

Refresh reloads permission and permission-trimmed Schema in one generation before resolving the same URL again. Invalidate stale target requests/data; do not reuse an old allow after refresh fails. Do not auto-redirect an explicitly denied URL without displaying its scoped feedback.

## Required behavioral acceptance

Use the host's existing browser/component test stack with isolated permission/Schema fixtures. Assert the rendered tree and protected-request counter, not merely `scope="resource"` or a helper call:

1. At least one authorized entry, direct URL to a denied object/fixed page: navigation/header remain visible, feedback is inside the content region, denied business requests are zero, denied metadata is absent.
2. Navigation and return actions reach an authorized page; they do not retry the denied destination. Missing administrator contacts keep generic feedback without losing navigation.
3. Grant then refresh: permission -> Schema -> authorized data request, resolving the original URL. A failed refresh never loads protected data.
4. Post-load revocation: remove affected cached records/counts/pages and close unauthorized surfaces; retain other authorized navigation. Full-page App denial is permitted only when no authorized entry remains.
5. No authorized object or fixed page: App-scope feedback, no shell/business route or protected request.
6. Record-read-only denial retains authorized navigation/headers; unknown 403, 401 and service failures are not permission denial.

Missing these runtime assertions is a delivery blocker even if a static audit passes. Existing Apps do not inherit this behavior automatically; the generation guidance affects Apps using this Skill version, and older Apps require regeneration or a scoped migration.
