# Testing and pitfalls

## TDD checklist

Use TDD / Test first for non-trivial assistant changes:

1. Add failing tests for the expected package import, selected adapter/route
   family, context, transport, Artifact shape, or UI behavior.
2. Implement the smallest change.
3. Add regression checks around cancellation, stale responses, history restore,
   permissions, and error rendering.
4. Run host typecheck/build and relevant Service tests.

## Required tests

Package integration:

- imports use only public entrypoints
- package `styles.css` is imported once
- package version and documented public props match the host integration
- demo/mock transport is gated and visibly labeled

Transport:

- adapter selection test: a configured/queryable Console Agent or explicit Agent
  Gateway request selects `make-console`; a confirmed Make App AI Chat contract
  selects `make-app`; neither contract stops for confirmation
- wrong adapter / wrong route regression: Console code cannot construct the Make
  App adapter or call `/api/make/app/ai/**`
- locate, history, send, and events use the host authenticated request boundary
- send request includes stable `messageId`
- capabilities are included or explicitly documented as unsupported
- EventSource uses credentials when required by the host auth mode
- AbortSignal reaches Service and downstream gateway
- stale streams cannot mutate the active conversation

Artifact:

- Artifact validation / Artifact 校验 must cover both live SSE stream events and
  history restore payloads.
- valid `metric`, `comparison`, `trend`, `ranking`, `record-list`, and `notice`
  payloads render
- invalid kind, unknown fields, duplicate ids, oversized data, and unsafe values
  are rejected safely
- live SSE Artifacts and history Artifacts render the same after refresh
- text-only backend responses do not pretend to have components

UI:

- launcher is reachable, keyboard focusable, and placed by the host layout rules
- assistant panel open/close does not lose active conversation state unexpectedly
- `theme` is scoped to each supported React surface, does not mutate host global
  variables, and reaches custom Artifact roots through `themeStyle`
- `privacyNotice` renders the package focusable Tooltip rather than a duplicate
  host banner; header height, long-title/context overflow, and keyboard focus
  remain usable
- `MakeAiAssistant` width respects `maxDrawerWidth`, the configured minimum, and
  viewport changes; pointer and keyboard resize remain accessible, while
  560px-or-less viewports use full width without a resize handle and the 561px
  boundary restores desktop resize behavior
- embedded panels and wide drawers retain package container-query behavior for
  content, Artifacts, code blocks, and Markdown table overflow
- current user name/avatar render when provided
- suggestions can be customized or hidden
- action intents call host handlers and permission failures are visible
- closing the drawer preserves an active run and scroll intent; only explicit
  cancellation/new conversation/reinitialization/unmount stops it
- progress appears only while the assistant turn is generating; completed,
  failed, and restored turns omit internal process steps, and load failures show
  safe retryable UI without upstream diagnostics
- when an existing host page or route changes, run lint/typecheck or a build that
  catches missing imports and undefined Hook references; also run a page-level
  render/smoke test when the host test setup supports it. Cover the assistant
  mount, newly added Hook/callback imports, prop chain, and first paint state.

Service:

- route validators reject malformed path/body/query params
- unsafe browser writes enforce same-origin checks
- upstream error codes map to stable UI messages
- logs redact Cookie, Authorization, token, and sensitive payload data
- for `make-console`, use the five-operation BFF allowlist from
  `make-console-service-contract.md`; reject cross-App input, unknown paths,
  repeated/unknown query parameters, and illegal request bodies before proxying
- Console upstream failures expose stable errors only; they never expose upstream
  diagnostics or raw response bodies
- only Console Run SSE returns `text/event-stream`; an upstream failure after the
  first frame closes the stream without JSON error middleware, and client
  disconnect aborts the upstream run

## Common pitfalls

- Parsing Markdown tables or prose to guess a component. This is unreliable; use
  structured Artifact data.
- Returning React component names from backend. Backend returns Artifact
  semantics; frontend chooses registered templates.
- Streaming Artifacts live but omitting them from history. Refresh then loses the
  rich UI.
- Forgetting capabilities negotiation. Backend may return unsupported kinds or
  skip structured output entirely.
- Passing visual props such as `userName` as authorization context. Server-side
  auth must recheck identity.
- Calling Agent Gateway or Make APIs directly from UI instead of using the host
  authenticated Service/request boundary.
- Logging cookies, Authorization, tokens, prompts with sensitive data, or full
  record payloads.
- Treating mock/demo transport as backend readiness.
- Hard-coding gateway domains, tenant ids, App ids, Agent ids, or local paths in
  reusable package or Skill guidance.
- Replacing the package registry with host-specific one-off render switches that
  cannot be reused across Make Apps.
- Selecting `make-app` only because the page is a Make App page. Adapter choice
  follows the confirmed backend capability, not the UI container.
- Treating Console as a generic proxy. Its Agent query, Session, durable event,
  send message, and Run SSE operations require an explicit allowlist and separate
  JSON/SSE error handling.
- Letting a Run SSE upstream failure after its first frame flow into JSON error
  middleware. Close the stream instead.
