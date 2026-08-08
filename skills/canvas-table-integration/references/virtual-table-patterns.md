# virtual table patterns

Use this file when integrating paginated virtual tables, especially for large datasets, fast scrolling, or scrollbar dragging.

## Contents

- [Choose the virtual path](#1-choose-the-virtual-path)
- [Confirm the installed public contract](#2-confirm-the-installed-public-contract)
- [Bootstrap and page contract](#3-bootstrap-and-page-contract)
- [Required loader lifecycle](#4-required-loader-lifecycle)
- [Large-data scheduler](#5-large-data-scheduler)
- [Cache and state ownership](#6-cache-and-state-ownership)
- [Context changes and stale rows](#7-context-changes-and-stale-rows)
- [Cancellation across boundaries](#8-cancellation-across-boundaries)
- [Observability and failure behavior](#9-observability-and-failure-behavior)
- [Common mistakes](#10-common-mistakes)
- [Verification checklist](#11-verification-checklist)

## 1. Choose the virtual path

Use virtual mode when:

- the backend is paginated
- the dataset is too large to load at once
- incremental loading is required for a smooth scrolling experience

Do not choose virtual mode when local in-memory data is small enough. Pagination remains opt-in.

Use the basic loader for ordinary remote pagination. Add the large-data scheduler in section 5 when rapid wheel scrolling or scrollbar dragging can cross many pages before earlier requests finish. Do not wait for production request storms before adding the scheduler to a known high-volume table.

## 2. Confirm the installed public contract

Read the installed package documentation through `package.ai.json.readOrder` before implementation. Use the capabilities below only when the installed package declares them public:

- `virtualOptions.enabled`
- `virtualOptions.totalRowCount`
- `virtualOptions.pageSize`
- `virtualOptions.maxCachedRows`
- `data:load`
- `setData(rows, page, request?)`
- `setVirtualPageData(rows, page, totalRowCount, request?)`
- `runVirtualPageLoad`
- `markPageLoadFailed(page, request?)`
- `getPagesInView()`
- `getScrollState()`
- `IVirtualPageRequestContext`

Select the request protocol from the installed public docs, not from a guessed package version:

- Use the identity-aware path only when the docs expose the coherent request contract together: `data:load(page, request)`, `IVirtualPageRequestContext` with `signal` and `useRequestIdentity()`, and request-aware success/failure methods such as `setData(rows, page, request?)`, `setVirtualPageData(..., request?)`, and `markPageLoadFailed(page, request?)`. Synchronously claim the request identity and pass the same request through success, failure, and cancellation.
- Use the legacy page-only path only when the installed docs expose `data:load(page)` without a request context. Record that stale same-page work may need to finish or fail before the page can restart.

`runVirtualPageLoad` is an optional convenience wrapper. If it is unavailable but the request context is public, reproduce its documented behavior in the host: call `request.useRequestIdentity()` synchronously before the first `await`, call the loader, and pass the same request to the documented success or failure method.

For the high-volume path, `markPageLoadFailed`, `getPagesInView`, and a bounded table cache such as `maxCachedRows` are safety capabilities. If they are unavailable and the installed docs provide no public equivalent, upgrade the package or stop and report the blocker. Do not emulate them through package internals.

Do not import table internals or depend on internal loading-page, cache, render, or scrollbar classes.

## 3. Bootstrap and page contract

The table must know a valid `totalRowCount` before virtual mode is enabled or the table is created. Obtain it through either:

- a count endpoint; or
- the first page response when that response includes the total.

When the first page supplies the total, bootstrap that page before creating or enabling the virtual table, then initialize `totalRowCount`. For identity-aware packages, keep that first-page result in a small bootstrap cache and commit it only after the table emits page `0` and that request is synchronously claimed; do not perform an unclaimed `setData` before the request lifecycle exists. Do not require a second count request when the backend already returns an authoritative total with page data.

Treat the CanvasTable page contract as zero-based. Translate to a one-based backend only at a pure host data-source boundary. This helper returns data only; the required loader lifecycle below owns request claiming and table writes:

```ts
async function fetchTablePage(tablePage, signal) {
  const apiPage = tablePage + 1
  return fetchPage({
    page: apiPage,
    size: pageSize,
    signal,
  })
}
```

Never change the table-side page convention to match the backend.

When a later page response carries a latest authoritative total and the installed package documents `setVirtualPageData`, atomically commit the rows and total with that method. Do not update `virtualOptions.totalRowCount` separately and then write the page because an intermediate paging map can accept or reject the wrong rows.

## 4. Required loader lifecycle

Create the table with the documented virtual props and subscribe only when a real loader is available. Use the following identity-aware example only when the installed docs expose the request context, `runVirtualPageLoad` request forwarding, and `setVirtualPageData`:

```ts
const table = new CanvasTableComponent(container, {
  columns,
  canvasWidth,
  canvasHeight,
  rowKey,
  style,
  virtualOptions: {
    enabled: true,
    totalRowCount,
    pageSize,
    maxCachedRows,
  },
})

const off = globalEventBus.onWithNamespace('data:load', table.tableId, (page, request) => {
  void runVirtualPageLoad(
    page,
    async (loadPage, activeRequest) => {
      if (!activeRequest) throw new Error('Virtual page request context is required')
      const result = await loadPageFromHost(loadPage, {
        pagesInView: table.getPagesInView(),
        requestSignal: activeRequest.signal,
        scrollState: table.getScrollState(),
      })
      if (!result || !Array.isArray(result.rows)) {
        throw new Error('Virtual page result must include rows')
      }
      const rows = result.rows
      const hasLatestTotal = result.totalRowCount !== undefined
      if (hasLatestTotal) {
        if (!Number.isFinite(result.totalRowCount) || result.totalRowCount < 0) {
          throw new Error('Virtual page totalRowCount must be a non-negative number')
        }
        table.setVirtualPageData(
          rows,
          loadPage,
          result.totalRowCount,
          activeRequest,
        )
        return
      }
      table.setData(rows, loadPage, activeRequest)
    },
    (failedPage, failedRequest) =>
      table.markPageLoadFailed(failedPage, failedRequest),
    request,
  ).catch((error) => {
    if (
      request.signal.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      return
    }
    logPageLoadFailure(page, error)
  })
})
```

`setVirtualPageData` is required when the response carries the latest authoritative total and the installed package documents that atomic API. Otherwise use `setData(rows, page, request)` and keep the previously established total.

When the installed docs expose only the legacy page-only event, use the same lifecycle without request arguments: `setData(rows, page)` on success and `markPageLoadFailed(page)` on failure. Do not pretend this legacy path provides request generation, immediate same-page restart, or late-response rejection.

Required behavior:

- Keep the listener namespace tied to `table.tableId` and remove it during cleanup.
- On the identity-aware path, pass the emitted `request` into `runVirtualPageLoad`; pass its `activeRequest` unchanged to `setData` / `setVirtualPageData` or `markPageLoadFailed`.
- Call `setData(rows, page, request)` on success when the total is unchanged. Omitting `page` in virtual mode is invalid.
- Keep request identity tied to the emitted page. A scheduler may prioritize work, but it must resolve the matching page promise and must not commit another page with the active request.
- Treat same-page pending/loading requests as deduplicated work: the table and the host scheduler must not start duplicate network calls for the same page.
- On every failure or cancellation path, call `markPageLoadFailed(page, request)` on the identity-aware path, or the documented legacy form, so a later scroll can request that page again. `runVirtualPageLoad` is the preferred wrapper when the installed package documents it.
- If the total is known and a requested page is out-of-range or beyond the total page count, do not call the backend or network; call `markPageLoadFailed(page, request)` with the same request identity and return successfully from the loader.
- Do not subscribe to `data:load` during permission, schema, or bootstrap windows in which no page loader exists.

## 5. Large-data scheduler

For fast scroll or scrollbar drag behavior, coalesce transient viewport targets before starting network requests. Cancelling a large number of requests after dispatch is too late because browser and server queues may already be saturated.

### Desired pages

For every emitted anchor/trigger page:

1. Read the current viewport pages from `getPagesInView()`.
2. Build a desired-page set from the anchor page plus every viewport page.
3. Add a bounded neighbor prefetch radius around those pages.
4. Remove negative and known out-of-range pages.
5. Prioritize remaining pages by distance from the anchor/current page, then by page number for deterministic ties.

The prefetch radius must stay bounded. A radius of `1` is the recommended starting point; increase it only from measured latency and scroll behavior.

### Queue and concurrency

- Deduplicate the same page across cache, queued requests, and in-flight requests.
- Scope every queued or in-flight job to the active query context. Before attaching a new request identity, discard an aborted or stale same-page job; never deduplicate a new generation onto work owned by an older generation.
- Cancel or remove stale queued page requests that are no longer in the desired-page set.
- If the package request signal aborts while its job is still queued, remove and reject that job immediately so the identity-aware wrapper can release the matching table request.
- Abort stale in-flight page requests with `AbortController` when the platform and request client support it.
- Use a bounded, configurable concurrency limit. Start with `2` concurrent page requests; tune it from backend capacity and measured latency.
- Give forced refresh and first-page bootstrap work immediate priority. Debounce ordinary silent scroll loads so the latest viewport can replace earlier transient targets.
- Resolve cancelled queued promises and let their identity-aware wrapper release every affected CanvasTable pending page with the matching request; never leave callers or table pages permanently pending.

Speculative neighbor prefetch has no package request identity of its own. It may populate only the bounded host cache; do not call `setData` or `setVirtualPageData` for that page with the anchor page's request. When the matching page's own `data:load` arrives, synchronously claim that request and commit the cached rows with it. If that request arrives while a healthy speculative fetch is still running, attach its abort signal to the page job before awaiting it or restart the job with the composed signal; never ignore the new request's cancellation contract.

### Proven tunable baseline

Use this baseline before project-specific measurement:

- debounce/coalescing window: `120ms`
- maximum concurrency: `2` concurrent page requests
- neighbor prefetch radius: `1`
- host cache: about `30` pages
- table cache: `maxCachedRows = pageSize * 30`

These values are configurable recommendations, not universal magic constants or fixed values. Keep the mechanisms mandatory for the high-volume path while tuning the numbers from page size, response time, browser constraints, and service capacity.

## 6. Cache and state ownership

Maintain separate but aligned responsibilities:

- CanvasTable owns its rendered virtual-page cache through `maxCachedRows`.
- The host cache owns normalized page results and request reuse.
- Keep the host cache and `maxCachedRows` bounded at the same order of magnitude so one layer does not retain far more pages than the other.
- When the host cache exceeds its page limit, evict the page farthest from the current anchor/viewport first. If reverse scrolling returns to an evicted page, allow the table to request and reload it normally.

Initial/bootstrap page data may update React or page-level state because toolbar totals, empty state, and page-level errors may depend on it. For background/silent scroll pages, call `setData(rows, page, request)` directly on the identity-aware path, or use `setVirtualPageData` when an authoritative total is returned, and avoid routing every page through React state or unrelated parent-level state; that churn can recreate effects, overwrite the current page snapshot, or trigger duplicate loading.

Treat `getTableData()` as current in-memory cache data, never as the complete remote dataset.

## 7. Context changes and stale rows

Define a stable query context key from every input that changes row identity or order, such as object/entity, filter, sort, schema identity, permission scope, and page size.

When the context changes:

1. enter a synchronous context-reset gate and install the new context key before any new request can dispatch
2. abort all old in-flight requests
3. cancel and resolve the old queued requests
4. clear pending debounce timers and the desired-page set
5. clear the host page cache and reset total/current-page state
6. reset horizontal and vertical scroll to `0` while the context-reset gate prevents network dispatch; release any package request emitted during this transition with `markPageLoadFailed(page, request)` using that same request
7. leave the gate and call `clearData()` as the final reset boundary

Reject or ignore a response whose context no longer matches the active key, even if transport cancellation was unavailable or arrived too late.

On an identity-aware package whose installed docs state that clearing immediately reissues the required pages, treat the fresh page `0` `data:load` event caused by `clearData()` as the sole bootstrap. Do not start a second manual bootstrap that races it. If a legacy package does not document or emit a load event after clearing, cover that installed behavior with an integration test and start exactly one manual bootstrap only after the reset.

Use `clearData()` as the boundary that begins the next generation, before any fresh request is claimed or bootstrap work starts. Do not call `clearData()` after an identity-aware request has been claimed and then reuse that active request; clearing may invalidate the request generation and cause the following commit to be rejected.

For a short page `0` on the identity-aware path, commit it through `setVirtualPageData` when the response includes the latest total, or through `setData` when the established total is unchanged; do not call `clearData` inside that active response. If an older page-only package demonstrably requires a full clear to remove stale slots, perform that clear as a legacy reset before starting the next load and cover the exact installed behavior with an integration test.

## 8. Cancellation across boundaries

Cancellation should save work, not merely hide an obsolete response:

This skill owns the browser host scheduler, its `AbortController`, request-signal composition, and verification that the UI request client preserves the signal. Use `make-app-service` for implementation beyond that boundary: `make-app-service` owns Service/server disconnect handling and downstream DataAPI or `fetch` cancellation. Keep the end-to-end contract visible here, but do not design Service routes or Make adapters inside the canvas integration.

1. On the identity-aware path, preserve `activeRequest.signal` from the package request.
2. Create a scheduler `AbortController` for host-side stale-page cancellation.
3. Compose the package request signal and scheduler signal with `AbortSignal.any(...)` when supported, or a small helper that forwards either abort and removes its listeners during cleanup. Never silently choose only one signal.
4. Pass the composed `AbortSignal` through the browser API/auth client.
5. Let the Service/server detect the disconnected or aborted request and cancel its downstream DataAPI or `fetch` call.
6. Treat `AbortError` as expected control flow: do not show it as a user-facing page failure, but still release the CanvasTable pending page with the matching request identity.

On a legacy page-only package, only the scheduler signal is available. Preserve the context-key stale-response guard and document that package-generation cancellation is unavailable.

If an intermediate client drops the signal, document that boundary as a performance defect. Do not claim end-to-end cancellation when only the browser response is ignored.

## 9. Observability and failure behavior

Keep pure page planning, priority, range, and eviction functions free of logging. At host and Service boundaries, log safe context for:

- page request entry or dispatch
- cache, queued, and in-flight hits when debug logging is enabled
- out-of-range skips
- stale queue cancellation and in-flight aborts
- non-abort failures

Use page number, page size, desired-page count, context version/hash, and error name. Do not log row payloads, filters containing sensitive values, tokens, or personal data.

Only non-abort failures should update user-visible error state. A failed page remains retryable after `markPageLoadFailed(page, request)` on the identity-aware path or the documented legacy form.

## 10. Common mistakes

### Calling `setData(rows)` in virtual mode

Always call `setData(rows, page, request)` on the identity-aware path, or the documented legacy form.

### Dropping request identity

Do not claim a request and then omit it from success or failure. The same request must flow through the loader, network signal, and final table method.

### Clearing inside an active identity-aware response

`clearData()` may advance the package generation. Use it before a fresh bootstrap, not immediately before committing the response that it invalidated.

### Updating total and rows separately

When a response includes the latest total and `setVirtualPageData` is public, use the atomic method instead of separately updating virtual props and page rows.

### Enabling virtual mode before total is known

Bootstrap the count or first page first, then create or enable virtual mode.

### Starting a request for every transient drag position

Debounce and coalesce desired pages before dispatch, then apply the concurrency limit.

### Cancelling responses without cancelling work

Ignoring a stale response protects state but not browser or server capacity. Propagate `AbortSignal` through the full request chain where supported.

### Keeping unbounded host data

Bound both host and table caches. Confirm that reverse scrolling reloads an evicted page.

### Recreating the table when loader callbacks change

Keep the table instance stable and read changing callbacks through refs or the host framework's equivalent stable indirection.

## 11. Verification checklist

Verify at least these paths:

- package docs expose every public API used by the integration
- the loader selects identity-aware or legacy behavior from installed docs instead of guessing from a version number
- identity-aware listeners synchronously claim and return the same request through success, failure, cancellation, and out-of-range release
- page `0` loads and its total initializes `virtualOptions.totalRowCount`
- responses carrying a latest total use `setVirtualPageData` when documented, so total and rows change atomically
- table pages stay zero-based and backend translation happens only at the data-source boundary
- scrolling loads subsequent pages through `setData(rows, page, request)` on the identity-aware path
- the same pending page does not start duplicate backend calls
- failed and cancelled pages release pending state and can retry
- rapid scrollbar dragging coalesces targets before network dispatch and never exceeds the concurrency limit
- desired pages follow `getPagesInView()`, anchor priority, range bounds, and the configured prefetch radius
- stale queued requests are resolved and stale in-flight requests receive both package-generation and scheduler abort signals where available
- an out-of-range page performs no backend request and releases its pending marker
- host and table caches stay within their configured limits; reverse scrolling reloads evicted pages
- object, filter, sort, permission, or schema changes abort old work and reset queue, cache, data, and scroll
- a context reset clears before the fresh generation; a short identity-aware response does not clear and invalidate itself
- background page loads do not recreate the table or churn unrelated page-level state
- teardown removes listeners, timers, queued work, and in-flight requests

Prefer pure model tests for page normalization, desired-page calculation, priority, out-of-range detection, stale-page calculation, and cache eviction. Add host integration tests for listener lifetime, direct page writes, failure release, and cancellation propagation.
