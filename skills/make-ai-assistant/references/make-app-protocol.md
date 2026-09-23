# Make App v1 protocol

This is the current `make-app` adapter contract. Browser requests are same-origin
`/api/make/app/ai/v1/**`. The package Client's `basePath` excludes `/v1`; it
appends the version itself. The Service forwards to:

- local preview: `make_api_origin + /api/make/app/ai/v1/**`;
- published: strict `MAKE_API_BASE_URL` (or compatibility `MAKE_SERVER_URL`)
  origin plus `/make/app/ai/v1/**`.

The authoritative backend reference is [Agent Public API v1](https://git.qtech.cn/make/agent-service/agent-design/-/tree/dev/docs/proposals/agent-public-api-v1), verified at commit `60bbbcfe90c6defce46a0ed715e008fa4db20deb` (OpenAPI 1.0.1). This reference captures the integration-critical contract so a new App does not depend on another project's implementation.

No dedicated AI Gateway origin or token is needed. The Service derives App scope
from deployment-injected `MAKE_APP_KEY`, forwards the established login session
to Make Gateway, and never accepts a client-selected upstream origin.
An internal HTTP Gateway origin can be valid when supplied by trusted platform
deployment configuration (for example, cluster service DNS); "strict origin"
means no credentials, path, query or fragment, not a blanket HTTPS-only rule.
Do not allow the browser to choose that origin or downgrade a public HTTPS
endpoint.

## Exact 18-operation allowlist

| ID | Method and browser path | Purpose |
| --- | --- | --- |
| A01 | `GET /api/make/app/ai/v1/agents?appKey=...&cursor=...&limit=...` | paginated Agent discovery |
| A02 | `POST /api/make/app/ai/v1/chats` | create independent chat |
| A03 | `GET /api/make/app/ai/v1/chats?appKey=...&agentId=...&cursor=...&limit=...` | list chats |
| A04 | `GET /api/make/app/ai/v1/chats/:chatId` | get chat |
| A05 | `PATCH /api/make/app/ai/v1/chats/:chatId` | title/pin with expected revision |
| A06 | `DELETE /api/make/app/ai/v1/chats/:chatId?expectedRevision=...` | delete chat |
| A07 | `PUT /api/make/app/ai/v1/chats/:chatId/messages/:messageId/feedback` | feedback |
| A08 | `POST /api/make/app/ai/v1/chats/:chatId/messages` | accept message |
| A09 | `GET /api/make/app/ai/v1/chats/:chatId/messages?cursor=...&limit=...` | history |
| A10 | `GET /api/make/app/ai/v1/chats/:chatId/events?responseId=...&cursor=...` | response SSE |
| A11 | `GET /api/make/app/ai/v1/chats/:chatId/responses/:responseId` | snapshot |
| A12 | `POST /api/make/app/ai/v1/chats/:chatId/responses/:responseId/cancel` | remote cancel |
| A13 | `POST /api/make/app/ai/v1/chats/:chatId/uploads` | start upload |
| A14 | `GET /api/make/app/ai/v1/chats/:chatId/uploads/:uploadId` | upload state |
| A15 | `PUT /api/make/app/ai/v1/chats/:chatId/uploads/:uploadId/parts/:part` | raw part bytes |
| A16 | `POST /api/make/app/ai/v1/chats/:chatId/uploads/:uploadId/complete` | complete upload |
| A17 | `GET /api/make/app/ai/v1/chats/:chatId/content/:contentRef` | content bytes |
| A18 | `GET /api/make/app/ai/v1/capabilities?appKey=...&agentId=...` | negotiated features, model input kinds and limits |

The Service request validator must admit the SDK's actual query/body shape for
each operation. Optional fields below may be absent; reject repeated or unknown
query keys, but do not reject a valid v1 field just because an older host did
not use it:

| Operations | Query or body admitted by v1 |
| --- | --- |
| A01–A03 | A01 query `appKey`, optional opaque `cursor`/`limit`; A02 JSON `{ appKey, agentId, requestId, title? }`; A03 query `appKey`, `agentId`, optional `cursor`/`limit` |
| A04–A06 | A04 no query/body; A05 JSON `{ expectedRevision, title?, pinned? }` with at least one change; A06 query `expectedRevision` |
| A07–A09 | A07 JSON `{ requestId, rating, reason?, comment? }`; A08 JSON `{ messageId, text }` **or** `{ messageId, parts }`; A09 optional query `cursor`/`limit` |
| A10–A12 | A10 query `responseId`, optional persistent `cursor`; A11 no query/body; A12 empty JSON `{}` |
| A13–A16 | A13 JSON `{ fileId, name, contentType, sizeBytes, digestSha256? }`; A14 no query/body; A15 raw bytes with zero-based part index; A16 empty JSON `{}` |
| A17–A18 | A17 no query/body; A18 query `appKey`, `agentId` |

Identifiers in A02/A07/A08/A13 are stable client-generated intent IDs. The
`parts` shape and media-reference fields come from the installed public
`InputPart`/`Media` types; current composer UI exposes file/image input, while
Service forwarding must not silently narrow a valid v1 DTO. Validate lengths,
types and body limits against the current protocol/negotiated limits, not a
copied project's one-off validator. A 204 operation must have no body; A12 can
return a nonterminal snapshot with 202.
The current deployment baseline is 64 MiB per file, 32 input parts, 8 KiB
aggregate UTF-8 message text, 64 KiB message JSON, 8 MiB JSON response and
1 MiB SSE data frame. The initial partSize is 1 MiB, but A13's returned
partSize is authoritative. Treat these as current limits, not permanent package
constants; use authenticated capabilities and the current deployed contract
for UI budgets and keep Service preflight aligned with backend validation.

Use SDK `Client` methods for browser operations instead of manually constructing
these paths. The host Service must allowlist exactly the methods/paths it exposes;
no wildcard pass-through, removed convenience route or unversioned alias belongs
in a new integration. Validate path decoding, query multiplicity, body shape,
content type, byte limits and App scope before upstream I/O. A request's
`appKey` query/body, when present, must equal `MAKE_APP_KEY`; this check does not
replace backend authorization of chat/Agent ownership. For all non-GET/HEAD
requests, require exactly one HTTP(S) `Origin` whose normalized authority
matches the selected Host; reject missing, duplicate or cross-origin browser
`Origin` before forwarding. Do not trust client-supplied `X-Forwarded-Host` for
this comparison. In local preview, validate the browser `Origin` against the
incoming App Host before using the Service-owned session; the upstream
`Origin` may then be the trusted Gateway origin, with Gateway Host/protocol
context. In published mode, forward the validated App `Origin` rather than
inventing one. Derive trusted forwarded host/protocol values server-side.

## Response and cursor contract

- Successful JSON is a bare object, not `{ data: ... }`. Preserve the documented
  HTTP status: chat creation 201, accepted message 202, delete/part upload 204
  with no body. Do not equate success with status 200.
- Every v1 success response must carry `Make-AI-Api-Version: v1`; preserve it and
  `X-Request-ID`, `Retry-After` and relevant content headers. The SDK checks the
  version header. SSE is `text/event-stream`, content is raw bytes; neither goes
  through a JSON envelope, text buffering or JSON parser.
- Agent, chat and message-history page cursors are separate **opaque strings**.
  The initial history request omits the cursor; pass returned `nextCursor`
  unchanged while `hasMore`. The response-event cursor is a separate persistent
  string; the SDK manages initial subscription and resume. Do not convert page
  cursors to numbers or reuse an event ID as a history cursor. Chat `revision`
  and response `snapshotRevision` are concurrency/state values, not cursors.
- The SDK validates known response fields and App/Agent/Chat association; new
  optional metadata may be ignored, but corrupt known fields or mismatched
  scope are protocol errors. Do not make the host validator narrower than the
  public v1 DTO.

## Requests and capabilities

The SDK generates/validates v1 request DTOs. Client intent IDs (`requestId` for
chat and feedback, `messageId` for a message, `fileId` for an upload) must remain
stable across a retry. For message input, `{ messageId, text }` and
`{ messageId, parts }` are mutually exclusive. File/image parts reference only
a completed ready `contentRef` with the returned size and digest; no invented
download URL or unverified media tuple. Do not add page `context`, Artifact
payload or client-negotiation fields to current v1 messages.

`GET capabilities` returns optional feature flags, `modelInputKinds` and
limits. The public `/make-app` adapter reads it during async creation and gates
chat editing, feedback, upload and content reading. Capabilities are descriptive
and may change by Agent/deployment; they do not replace request-by-request
authorization. A host may narrow displayed model kinds for an explicit product
or security policy, provided the restriction is documented and does not claim
the backend lacks a capability. Broadened model support requires deployed-model
evidence. Do not globally hard-code one project's text-only result or equate
upload acceptance with model understanding.

The public error JSON is flat `{code,message,requestId?,details?}`. The `code`
is an extensible string, not a closed allowlist: a schema-valid unknown code
retains its HTTP status and safe public message, and callers classify unknown
code by HTTP category. Current statuses include 400, 401, 403, 404, 409, 410,
413, 415, 422, 429, 502, 503 and 504; see the backend v1 reference for known
codes. Never parse program flow from message text. The Service may forward a
bounded schema-valid public error unchanged or reconstruct only its public
fields; a malformed/non-JSON upstream error becomes a safe Service-generated
upstream error, without leaking hosts, stacks, credentials, raw prompts or
bytes. Do not turn a valid unknown public code into 502. This AI error rule
overrides ordinary direct Make proxy error passthrough only for this adapter.
After response headers start, an SSE failure closes the stream rather than
trying to send JSON.
