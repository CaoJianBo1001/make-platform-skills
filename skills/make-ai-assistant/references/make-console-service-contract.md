# Make Console Service contract

Use this reference only after the adapter-selection gate selects `make-console`.
It describes a Console Agent Gateway integration behind a host Service BFF; it is
not a requirement for every Make App page and it is not a generic Console proxy.

## Source of truth and route design

Read the installed package's public `package.ai.json.readOrder`, selected
`recipes.json` recipe, and matching `capabilities.json` entry before choosing
route names, request shapes, or SSE event mappings. Do not invent Console paths
from the Make App AI Chat route family and do not substitute
`/api/make/app/ai/**` for a Console adapter.

Expose a small, host-owned BFF mapping with an explicit method/path allowlist.
Do not mount a catch-all Console path or forward an arbitrary suffix. The exact
host-to-Console mapping comes from the selected public recipe, but it may expose
only these five operation groups:

1. Agent query: list or resolve an Agent that the authenticated principal may use.
2. Session: locate, create, or resume the session scoped to that Agent and the
   authenticated principal.
3. Durable event read: restore persisted events for that permitted Session.
4. Send message: validate and submit one bounded user message with safe context
   and frontend capabilities.
5. Run SSE: start or resume the selected Agent run and stream its events.

The BFF resolves the App, principal, and permitted Agent server-side. Client
input must never choose an arbitrary App, tenant, upstream host, or privileged
Agent. It must not create/update/delete Agents, write arbitrary events, proxy
files, or expose any Console operation outside this list.

## Validation and failure boundary

Validate method, path parameters, query parameters, and body before any upstream
request. The allowlist must reject cross-App identities, unknown paths, repeated
or unknown query parameters, invalid query values, and illegal request bodies
with a stable client error. Reject unknown body properties unless the selected
public recipe explicitly permits extension fields, then validate those fields
against the recipe's limits.

Map upstream failures to stable UI-facing errors. Logs may retain safe status,
operation, retryability, and request/run correlation context, but a response must
not expose upstream diagnostics, raw upstream bodies, stack traces, hostnames,
tokens, or credential details. Return normal JSON only before an SSE response has
started.

## Run SSE lifecycle

Only the Run SSE operation may return `text/event-stream`; Agent query, Session,
durable event read, and send message always return normal JSON. Validate the Run
request before setting stream headers, attach the request-scoped `AbortSignal` to
the upstream run, and forward only recipe-supported events after validating their
run/session identity and payload bounds.

When an upstream failure occurs before the first SSE frame, return the documented
stable JSON error. After headers are sent or a first frame has been written, log
safe context and close the stream; do not invoke JSON error middleware or write a
second error response. This prevents `ERR_HTTP_HEADERS_SENT` and mixed JSON/SSE
responses.

On client disconnect, abort the upstream Run SSE request through `AbortSignal`,
stop forwarding events, and remove lifecycle listeners. Treat an expected abort
as cancellation, not as a user-visible 5xx. Do not abort a normally completed
response merely because its response lifecycle closes after completion.

## Required Console BFF tests

Write these tests before the BFF implementation:

- each of the five allowed operation groups succeeds only with its declared
  method, path, query, and body shape;
- cross-App ids, unknown paths, repeated/unknown query parameters, illegal body
  fields, and unauthorized Agents are rejected before the upstream adapter runs;
- upstream 4xx/5xx/malformed payloads map to stable errors without diagnostics;
- non-Run operations cannot negotiate `text/event-stream`, while Run SSE can;
- an upstream failure before the first frame returns stable JSON, while an
  upstream stream failure after the first frame closes the response without JSON
  middleware;
- client disconnect aborts the upstream Run request and normal completion does
  not trigger a false abort;
- the selected Console adapter never calls Make App AI Chat routes and a wrong
  adapter or wrong route regression test fails.
