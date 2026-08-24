# Transport and Service contract

## Host boundary

The UI consumes an `AssistantTransport`. The host decides how to implement that
transport with Make App, Make Console, or another Agent Gateway. The package must
not hard-code URLs, cookies, tokens, tenants, or gateway domains.

For Make App pages, prefer same-origin Service routes under:

```text
POST /api/make/app/ai/chats/locate
GET  /api/make/app/ai/chats/:chatId/messages?cursor=-1&limit=<limit>
POST /api/make/app/ai/chats/:chatId/messages
GET  /api/make/app/ai/chats/:chatId/events?responseId=<responseId>&cursor=<cursor>
```

Service may proxy these to Agent Gateway, but UI still calls the host's
authenticated request boundary. UI must not call Make data/model APIs directly.

## Domain configuration

Use the host's existing Make Gateway origin configuration instead of creating an
assistant-only domain variable:

- `MAKE_API_BASE_URL` is the preferred published Service config.
- `MAKE_SERVER_URL` may remain as a compatibility alias.
- The value must be a strict gateway origin, normally the platform-provided Make
  Gateway origin such as `<make-gateway-origin>` or a cluster service like
  `http://make-gateway.<namespace>`.
- The base URL must not contain a path. Do not configure `/api/make`, `/make`,
  `/app/ai`, `/console`, `/meta`, `/data`, or another service path in the base
  URL.

The adapter owns the service scope:

- Browser-facing and same-origin UI routes use `/api/make/app/ai/**`.
- Local preview that talks to a public gateway origin also uses
  `/api/make/app/ai/**`.
- Published Service-to-gateway calls use the internal Make service scope,
  normally `/make/app/ai/**`, derived from the same gateway origin.

Do not hard-code dev/test/prod environment domains, preview domains, tenant ids,
App ids, Agent ids, or local callback domains. If an environment needs a
different gateway origin, configure it through the runtime/config layer owned by
`make-app-service` and `make-app-runtime`.

Recommended config shape:

```ts
type MakeAiAssistantGatewayConfig = {
  gatewayOrigin: string; // strict origin only
  browserPrefix: "/api/make/app/ai";
  upstreamPrefix: "/make/app/ai";
};
```

Resolve and validate this config once at Service startup. Reject empty values,
path-scoped base URLs, malformed URLs, and unsafe session-token overrides before
the Service is reported ready.

## Locate

`locateChat(context)` returns the chat/session identity for the current logged-in
principal and App:

```json
{
  "chatId": "<chatId>"
}
```

The backend must verify identity and App access server-side. `context.app.id`
helps locate the right App; it is not an authorization proof.

## Send message

`sendMessage` should be idempotent:

```json
{
  "messageId": "<stableUuid>",
  "text": "<userText>",
  "context": "<optionalHostContext>",
  "capabilities": {
    "artifactSchemaVersions": ["1.0"],
    "artifactKinds": ["metric", "comparison", "trend", "ranking", "record-list", "notice"],
    "templates": ["<templateId>"]
  }
}
```

Response:

```json
{
  "chatId": "<chatId>",
  "responseId": "<responseId>",
  "acceptedCursor": 20
}
```

Use UUIDs when possible. If the package or older host generates a legacy
message id, the adapter must convert it to a stable deterministic id before
calling the backend. Retries must not create duplicate user messages.

## SSE

Use standard SSE. A versioned Make App adapter may bridge platform event names to
the package `AssistantEvent` model. To support structured UI, include an Artifact
stream event:

```text
event: artifact
data: {"messageId":"<assistantMessageId>","artifact":{"schemaVersion":"1.0","id":"<artifactId>","kind":"notice","data":{"tone":"info","body":"<body>"}}}
```

Text and lifecycle events must have stable ordering. A safe stream normally has:

```text
event: message.start
data: {"runId":"<runId>","messageId":"<assistantMessageId>"}

event: message.delta
data: {"messageId":"<assistantMessageId>","delta":"<textDelta>"}

event: artifact
data: {"messageId":"<assistantMessageId>","artifact":{"schemaVersion":"1.0","id":"<artifactId>","kind":"metric","data":{"value":1}}}

event: message.complete
data: {"messageId":"<assistantMessageId>"}

event: run.complete
data: {"runId":"<runId>","threadId":"<chatId>"}
```

If the backend sends complete text snapshots, map them to a package-supported
replace event. If the backend sends progress, map it to progress steps. Do not
mix events from different runs or reuse message ids in one conversation.

## History

`loadHistory` must return text and Artifact snapshots:

```json
{
  "messages": [
    {
      "role": "assistant",
      "cursor": 12,
      "text": "<assistantText>",
      "artifacts": []
    }
  ]
}
```

When live responses support Artifacts, `artifacts` must contain the validated
Artifact V1 payloads. A history response that always maps to empty artifacts is
text-only and cannot restore rich displays after refresh.

## Cancellation and stale results

- Pass `AbortSignal` from UI requests to Service and downstream gateway calls.
- Closing an assistant panel may only hide UI unless the package explicitly cancels the run.
- Stop/new conversation/context switches should cancel or ignore stale streams.
- Late events from an old run must not mutate the current conversation.

## Security and logging

Service and transport logs must record safe context only: route, app id, event
type, run id, response status, retryable code, and stale/cancel branch. Cookies,
Authorization, token, raw secret headers, private prompts, and full record
payloads must not be logged or stored in UI state.

For browser writes, preserve same-origin checks and authenticated request
wrappers from `make-app-auth`. Do not introduce a parallel token mode for the
assistant.
