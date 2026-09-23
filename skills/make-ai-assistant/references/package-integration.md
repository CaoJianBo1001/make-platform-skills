# Package integration

## Resolve the consumer contract

For a new integration or a requested latest upgrade, query the configured npm
registry, install its latest published `@qfei-design/make-ai-assistant` in the
consumer UI workspace, and verify the lockfile's exact resolved version. Do not
put the dependency only at a monorepo root. Package `0.3.2` is the first
validated baseline for the current public failure fields and negotiated UI-limit
projection described below. Package `0.3.1` predates those public contracts and
must fail this Skill's current audit; do not weaken the audit or add a host-side
compatibility shim to accept it. Use `0.3.2` or a later published version only
if its public declarations satisfy the current contract and the v1
route/response tests pass. If registry access, peer
compatibility or the required public contract cannot be confirmed, stop and
report the exact gap instead of guessing an old adapter.

Read the installed `package.json` export map, each exported type target, and only
the transitively referenced declarations needed to understand those public
types. Do not inspect unexported declaration files or package implementation
merely because they are present under `dist`; an unexported file cannot add a
host-facing contract.
For `make-app`, require these public entry points and symbols:

| Entry point | Required public surface |
| --- | --- |
| `/client` | `createMakeAgentClient`, `AuthenticatedTransport`, `Client`, `Scope`, `Agent`, `Capabilities`, and `ResponseSnapshot.code/message` plus `response.failed` `code/message/requestId` |
| `/make-app` | async `createMakeAppAssistantTransport`, `MakeAppAssistantTransportOptions` |
| `/react` and root public types | `MakeAiAssistant`, `AssistantPanel`, public props, `MakeAiTheme`, and `AssistantTransportFeatures.limits` for negotiated upload/input budgets |
| `/styles.css` | declared style export |

The installed type target is read-only verification; host code must never
import `dist`, `src`, examples or an undeclared subpath.

Do not infer `ResponseSnapshot.code/message` or `AssistantTransportFeatures.limits`
from an unexported internal file. If the registry still resolves a build without
these public fields, report the package release dependency and pause full v1
integration; a host-side duplicate parser or fixed upload limits is not a
compatible substitute.

The Skill's versioned references define the selected backend protocol. Package
README/recipe/example text and another App are not substitutes for that protocol.
If the installed public types or exports are incompatible, report “当前包版本缺少所需公开契约”
with the version and missing symbol. Do not reconstruct internals or silently
enable a legacy route. A dedicated legacy adapter is not bundled here.

## Make App v1 composition

Import the public entry point, not an internal build file:

```ts
import { createMakeAgentClient } from "@qfei-design/make-ai-assistant/client";
```

The host creates `createMakeAgentClient({ scope: { appKey, identityKey },
transport: authenticatedTransport })`; its default base path is
`/api/make/app/ai`, and the SDK appends `/v1`. A host whose auth URL resolver
prepends `/api/make` may instead use `basePath: "/app/ai"`, provided the final
browser URL is the same-origin `/api/make/app/ai/v1/**`. Never pass a base path
already ending in `/v1`.

`AuthenticatedTransport.request` executes one authenticated HTTP operation and
returns `{ status, headers, body?: AsyncIterable<Uint8Array> }`. Set
`retryOwner: "sdk"` if this bridge itself does not retry, or `"transport"` if
the existing transport owns retries. Never stack both retry loops. Preserve the
request's method, headers, bytes and AbortSignal. The response body must remain
unconsumed for the SDK to decode JSON, empty 204, SSE or file bytes. The SDK
requires the upstream `Make-AI-Api-Version: v1` response header. The bridge
uses the established unified-login session and handles 401/403 through host
auth policy; it does not read or store tokens, cookies or Provider keys.

Read all Agent pages via `client.agents.list()` before creating the UI adapter:

```ts
const assistantTransport = await createMakeAppAssistantTransport({
  client,
  agentId,
  signal,
});
```

The async factory reads capabilities for the selected Agent, then returns a
public `AssistantTransport` for `MakeAiAssistant` or `AssistantPanel`. It owns
v1 DTO validation, request/response decoding, bounded retries, SSE parsing and
recovery, file upload/read helpers, feature gating and history mapping. A host
must not copy those algorithms into callbacks. Dispose the old client after
identity/App change or host unmount; disposal does not log out or remotely
cancel a running response.

Import `@qfei-design/make-ai-assistant/styles.css` once. Use the package's
public React props for brand/title, user display, safe context, suggestions,
controlled open state, launcher position and theme. New hosts do not pass the
ignored compatibility props `subtitle` or `privacyNotice`. The package owns
internal header, task list, composer, upload menu, message layout and responsive
styles. Host CSS should affect only external placement and documented theme
variables, not internal selectors or a competing drawer.

Mock/testing entry points are for tests and controlled demos only. They cannot
prove Service routes, authentication or model behavior are ready.
