# Make App v1 host integration

Use this reference only after selecting `make-app`.

## Identity and public-client lifecycle

Mount `MakeAiAssistant` once in the authenticated App shell. Derive `appKey`
from the authenticated current App and `identityKey` from stable tenant and
user identifiers, never a display name. Keep the launcher mounted while
discovery or capabilities are loading or failed. A retryable safe error should
remain available when the panel opens.

Create the public `createMakeAgentClient` with an `AuthenticatedTransport` and
the current scope. Forward AbortSignal through every bridge request. On App,
tenant or user change, abort prior discovery, prevent stale results from
mounting, dispose the old client and re-key conversation state. Do not cache
another identity's chats in a module singleton. App context is for bounded
local presentation; it is not backend authorization and v1 messages do not
accept invented page-context or Artifact fields.

## Agent discovery before adapter creation

`createMakeAppAssistantTransport()` requires `agentId`, so discover with
`client.agents.list({ cursor, limit: 100 }, { signal })` first. Read all pages
using each opaque `nextCursor` until `hasMore: false`; detect repeated or
missing continuation cursors. Never accept a partial list as unique when a
request fails or an operational timeout is reached. The Client rejects a returned `appKey` outside
its scope. Of the complete result, select only agents with
`agentType === "app_internal"` and an `appKey` exactly equal to the current
App. Ignore `channel`, unknown and missing types. Accept exactly one matching
App-internal Agent; zero means unconfigured, two or more means configuration
conflict. Never silently choose the first or substitute a channel Agent.

`agentId` comes from this discovery result only, not an environment variable,
public config, deployment config, URL, storage or hard-coded identifier. Once
selected, call `await createMakeAppAssistantTransport({ client, agentId, signal })`.
The factory fetches `/capabilities`; do not present an active input surface until
it resolves. On failure, preserve the launcher and a retry action rather than
silently hiding the assistant. A narrow public-contract bootstrap
`AssistantTransport` may use `loadConversation` to trigger discovery while the
package renders its loading/error state; its `run` must be non-sending until the
real transport is ready. If the package cannot represent a distinct
configuration error, a host-owned external state may explain zero/multiple
Agents, but must not copy package internal controls or selectors.

## Authenticated raw-byte bridge

Ordinary business JSON requests continue through `make-app-auth`'s `auth.api`.
For this fixed v1 API, `auth.api` consumes success bodies and cannot provide the
SDK's status + headers + `AsyncIterable<Uint8Array>` contract. Implement only
one narrow AI bridge in the shared authenticated adapter. Resolve each
`HttpRequest.path` to the same-origin `/api/make/app/ai/v1/**` URL using the
host's `auth.apiUrl` where available or the existing same-origin Service path.
Reject other origins/scopes. Use browser-managed session credentials, never
read/copy cookies or construct Authorization. Do one `fetch` per call (unless
`retryOwner: "transport"`), pass method/headers/raw bytes/signal unchanged,
return status/all response headers and a lazily consumed byte iterator. Keep
login recovery for authentication 401/403 without consuming the SDK's original
error body (inspect `response.clone()` if 403 classification needs JSON); a
normal permission 403 must not trigger a login loop. No generic
raw-fetch exception is created for unrelated `/api/make/**` APIs.

The SDK decodes bare JSON, 204, event-stream and bytes itself. Do not wrap an
`ApiError` into the host's JSON envelope, use native `EventSource`, add a second
reconnect loop or retry an already accepted send with a new message ID.

## UI, actions and state

Pass the resulting public transport, safe `context`, optional user presentation
and documented theme/placement props to `MakeAiAssistant`. Leave the task list,
new conversation, feedback, upload menu and SSE rendering to the package.
Closing the drawer preserves the active chat; explicit stop uses the package's
remote cancellation operation. Do not assume visible context grants access.
