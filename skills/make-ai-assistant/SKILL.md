---
name: make-ai-assistant
description: "Use when integrating, upgrading, debugging, or reviewing @qfei-design/make-ai-assistant in a Make App: Agent discovery, multi-session chat, streaming, file/image input, Service gateway routes, and package-owned UI. Does not own generic dialogs, model behavior, authentication or permission policy, DSL, or publishing."
metadata:
  version: 0.3.0
---

# Make AI Assistant

This Skill owns the host integration contract, not the package's internal UI or
state machine. The Make App host owns identity, bounded page context, one
authenticated raw-byte transport, explicit Service routes, and deployment
configuration.
This Skill's Make App v1 reference is aligned with the Agent Public API v1
OpenAPI revision `60bbbcfe90c6defce46a0ed715e008fa4db20deb` and the
package's public v1 entry points. The Skill version and npm package version
are independent; verify the actual installed version before implementation.

## Workflow

1. Inspect the target host's package manager, authenticated shell and identity,
   shared auth adapter, UI/Service routes, permission checks, runtime origin,
   tests, and existing assistant integration. Preserve stable call chains.
2. Read `references/package-integration.md`. For a new installation or a requested
   latest upgrade, query the configured registry, install the latest published
   package in the consumer UI workspace, and verify its exact lockfile version,
   public export map and declarations. If the installed version does not expose
   this Skill's required public contract, stop with the missing export/type and
   version; do not synthesize compatibility from another project or package prose.
3. Use the versioned Make App AI Chat contract in
   `references/make-app-protocol.md`, including schemas, limits, extensible
   public errors and the pinned backend revision. Check the current backend
   contract/deployed behavior before claiming production readiness. If that
   check is unavailable or differs, retain the documented v1 implementation
   but report runtime compatibility as unverified; never infer an older API
   from another project.
4. For a full integration, read the package, host, protocol, stream/attachment,
   UI, and test references below. For a targeted fix, read only the relevant
   references. Use TDD: failing contract/behavior test, minimal implementation,
   then refactor with tests green.
5. Use only public imports and import `styles.css` once. Create the
   public `/client` with a host-authenticated `AuthenticatedTransport`, discover
   the unique current-App `app_internal` Agent across complete pagination, then
   `await createMakeAppAssistantTransport({ client, agentId, signal })`. The SDK
   owns v1 DTOs, decoding, retries, uploads, SSE and UI transport mapping.
6. Expose only the 18 documented Make App v1 Service operations. Validate App
   scope, method/path/query/body, a single same-origin HTTP(S) Origin for every
   non-GET/HEAD request, sizes and upstream target before forwarding.
7. Keep package UI internals package-owned. Use public props/theme variables for
   host placement and presentation; never copy its reducer, stream parser, upload
   engine, task list, composer or CSS.
8. Run the static audit, focused UI/Service tests, typecheck, build and an
   authenticated existing-route smoke test. A static preflight pass cannot
   prove all 18 Service operations, runtime correctness or deployment readiness.

For a Skill contract release, complete the independent forward test in
`references/testing-and-pitfalls.md` before declaring this guidance ready.

```bash
node skills/make-ai-assistant/scripts/audit-make-ai-assistant-project.mjs <project-root> \
  --expected-package-version=<resolved-exact-version>
```

The expected version is the actual installed resolution, not a range. A claim
of broader model-input support needs separate deployed-model evidence. Verify
published same-origin requests and response streaming against the target Dev App
before reporting an integration complete.

## Reference map

| Topic | Read |
| --- | --- |
| Package resolution, public types and React props | `references/package-integration.md` |
| Make App host composition, Agent discovery and identity | `references/make-app-host-integration.md` |
| Make App v1 18-operation API and Service boundary | `references/make-app-protocol.md` |
| SDK stream recovery and file/image behavior | `references/make-app-stream-and-attachments.md` |
| Package UI, theme and accessibility | `references/ui-and-templates.md` |
| Tests and delivery gates | `references/testing-and-pitfalls.md` |

## Hard boundaries and handoffs

- Browser Make App requests use same-origin `/api/make/app/ai/v1/**`. The SDK
  appends `/v1` to its path-free version base; do not append it twice. Local
  preview upstream uses `make_api_origin + /api/make/app/ai/v1/**`; published
  Service uses the configured Make Gateway origin plus `/make/app/ai/v1/**`.
  Never add a separate Agent Gateway origin, token or hard-coded Agent ID.
- The selected App Agent must have `agentType === "app_internal"` and an exact
  current `appKey`. Ignore channel and unknown Agent types, but fail on zero or
  multiple matching App-internal Agents. Read every page before accepting one.
- `AuthenticatedTransport.request` performs one credentialed same-origin I/O and
  yields status, headers and raw `AsyncIterable<Uint8Array>`; it never reads a
  browser token or unwraps SSE/bytes as JSON. Set `retryOwner` to exactly one
  owner. Preserve 201/202/204, `Make-AI-Api-Version`, AbortSignal and 401/403
  login/permission handling.
- Capabilities are fetched by the package at adapter creation. They gate optional
  UI features and supply model input kinds/limits; they are not authorization.
  Upload availability does not prove the model can interpret a file or image.
  The current Make App adapter does not carry Artifact; do not add
  unsupported context, Artifact or negotiation fields or promise Artifact UI.
- App, tenant or user changes abort old discovery and dispose the old client.
  A panel close is local UI state, not a remote run cancellation. Keep a retryable
  launcher on Agent/capabilities discovery failure.
- `makeui` owns surrounding App shell and external placement; this Skill and the
  package own assistant-internal behavior/styles. `make-app-service` owns the
  explicit proxy, validation and safe errors. `make-app-auth` owns
  unified login and the narrow AI raw-byte bridge rule. `make-app-permission` owns access and
  action authorization. `make-app-runtime` owns preview/published origins and
  build contracts. `make-env-setup` owns Skill installation/sync; `makecli` owns
  platform inspection, not runtime Service requests.
- Keep page context bounded and non-secret. Never treat it as authorization or
  execute server-provided HTML, JSX, CSS, JavaScript or unvalidated action URLs.
  Testing mocks are opt-in and cannot establish backend readiness.
