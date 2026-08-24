# Testing and pitfalls

## TDD checklist

Use TDD / Test first for non-trivial assistant changes:

1. Add failing tests for the expected package import, context, transport, Artifact
   shape, or UI behavior.
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
- current user name/avatar and `privacyNotice` render when provided
- suggestions can be customized or hidden
- action intents call host handlers and permission failures are visible

Service:

- route validators reject malformed path/body/query params
- unsafe browser writes enforce same-origin checks
- upstream error codes map to stable UI messages
- logs redact Cookie, Authorization, token, and sensitive payload data

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
