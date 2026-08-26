---
name: make-ai-assistant
description: "Use when integrating, generating, refactoring, reviewing, or debugging 助手 / AI助手 / MakeAI AI 助手 / Make AI 助手 / AI 对话框 with @qfei-design/make-ai-assistant, Artifact, SSE, Agent Gateway, make-ai-assistant 包, including floating launcher, AssistantPanel/ArtifactRenderer, MakeAiTheme/theme variables, responsive assistant sizing and resize, maxDrawerWidth, headerHeight, privacyNotice Tooltip, user identity/avatar, Artifact V1 templates, capabilities negotiation, Make App adapter, Make Console adapter, history restore, mock/demo transport, action intents, interface domain configuration, and tests. Does not own generic dialogs, business Agent prompts, model reasoning, Make data APIs, auth policy, runtime packaging, DSL modeling, Make CLI execution, or project-specific analytics."
metadata:
  version: 0.1.3
---

# make-ai-assistant

Use this skill for platform-level Make AI assistant integration. Treat the AI
assistant as a reusable host feature built from `@qfei-design/make-ai-assistant`,
host-provided context, Service/Agent Gateway transport, and versioned Artifact
contracts.

This Skill owns the assistant package consumption contract, Artifact semantics,
transport shape, template selection, host context, and tests. Related Skills own
their implementation surfaces.

## Workflow

1. Inspect the host UI package, component library, route shell, existing auth
   request boundary, Service API docs, runtime config, and tests.
2. Install or upgrade `@qfei-design/make-ai-assistant`. Read its
   `package.ai.json` first, parse `package.ai.json.readOrder`, read every
   declared file in order, and use only public exports plus `styles.css`.
3. Select the adapter before writing transport or Service code. Read the selected
   adapter's public `recipes.json` and `capabilities.json` entry in addition to
   `package.ai.json.readOrder`:
   - Select `make-console` when a Console Agent is already configured, the user
     names Agent Gateway, or the environment can query the Console Agent list.
     Read `references/make-console-service-contract.md`.
   - Select `make-app` only when the host has a confirmed Make App AI Chat
     backend contract. Read `references/transport-and-service-contract.md`.
   - A page being a Make App page must not default the adapter to `make-app`.
     When both are available, use the explicitly requested backend; otherwise
     prefer the configured/queryable Console Agent.
   - When neither contract is confirmed, stop implementation and ask for the
     backend choice. Do not guess an adapter, route family, Agent id, or gateway
     path from the host page type.
4. Choose the host surface:
   - `MakeAiAssistant` for the package default floating launcher and assistant panel.
   - `AssistantPanel` for an embedded panel inside an existing surface.
   - `ArtifactRenderer` only when rendering one Artifact outside the full chat UI.
5. Configure the package-owned visual contract through public props and scoped
   `--make-ai-*` variables only. Read `references/ui-and-templates.md` before
   changing theme, header, privacy prompt, launcher, panel, or drawer behavior:
   - pass `theme?: MakeAiTheme` to the surface being rendered; it never changes
     the host's global theme;
   - use `headerHeight` and `privacyNotice` only with `MakeAiAssistant` or
     `AssistantPanel` for the package header, rather than rebuilding a host
     banner or header around the panel;
   - use `maxDrawerWidth` only with `MakeAiAssistant`; preserve its desktop
     resize, keyboard access, mobile full-width, and container-query behavior;
   - use namespace variables for supported overrides and do not copy, override,
     or depend on package-internal CSS selectors.
6. Pass a complete host context: App identity, location, optional resource,
   optional selection, locale, timezone, and safe extension metadata. Context is
   for understanding the workspace, not for authorization.
7. Use the host's authenticated request boundary to build a transport. UI must
   not call Make data/model APIs directly, store tokens, or construct raw gateway
   credentials.
8. Configure assistant API domains through the host Service/runtime contract:
   browser calls remain same-origin, while Service reads the unified Make Gateway
   origin and owns the upstream service path.
9. Negotiate Artifact support. The request or run context must tell the backend
   the frontend-supported `schemaVersion`, `artifactKinds`, and template ids.
10. Require the backend or adapter to return structured Artifact results. Do not
   infer components from Markdown, headings, tables, or natural-language text.
11. Render with the package registry. Backend returns semantic `kind` plus data;
   frontend chooses a whitelisted renderer by `kind`, optional
   `presentation.template`, `canRender`, and priority.
12. Wire Artifact actions as intents such as `open-record`, `open-list`,
   `navigate`, or `invoke`. The host validates permission and maps each intent to
   routes or service actions.
13. Preserve history. If a live answer contains Artifacts, refreshed history must
   restore the same Artifact snapshots, not only assistant text.
14. Add tests before implementation for adapter selection, package imports,
   context, transport, SSE event order, Artifact validation, history restore,
   action handling, demo isolation, permission/auth failure states, and the
   public visual contract. For an existing host page or route, also run
   lint/typecheck or a build and a page-level render/smoke check when the host
   test setup supports one.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Package install, public imports, React components, props, demo mode | `references/package-integration.md` |
| Artifact V1 kinds, capability negotiation, template hints, actions | `references/artifact-contract.md` |
| Adapter selection, Make App AI Chat transport, history restore | `references/transport-and-service-contract.md` |
| Make Console Agent/Session/events/message/Run SSE BFF | `references/make-console-service-contract.md` |
| Launcher/panel UI, host context, theme, privacy Tooltip, header, package-owned drawer responsiveness, display templates, custom registry | `references/ui-and-templates.md` |
| TDD, smoke checks, common regressions and readiness blockers | `references/testing-and-pitfalls.md` |
| Page shell, launcher placement, external container constraints, surrounding layout | Use `makeui` |
| Service route implementation, gateway proxy, request validation and logs | Use `make-app-service` |
| Unified login, cookies, 401/403 handling and authenticated request wrapper | Use `make-app-auth` |
| App/object/record/field permission policy and route/action gates | Use `make-app-permission` |
| Build output, environment injection, preview/deploy readiness | Use `make-app-runtime` |
| Make Console/App resources, Agent creation, deployment operations | Use `makecli` |

## Non-negotiable invariants

- Make AI assistant is a platform feature, not a project-specific widget. Do not
  encode business object names, example records, tenant ids, user ids, URLs, or
  local file paths in the Skill or reusable package code.
- Use the published package contract. Do not import from package `src`, `dist`, or
  other internal paths; do not copy package state machines, templates, transport
  adapters, or styles into host apps.
- Assistant API domains must come from the same runtime Make Gateway origin used
  by the host Service. Do not hard-code dev/test/prod domains, preview URLs,
  tenant ids, App ids, or Agent ids in reusable code or Skill guidance.
- Gateway base configuration is a strict origin. Do not put `/api/make`, `/make`,
  `/app/ai`, `/console`, or another service path inside `MAKE_API_BASE_URL`,
  `MAKE_SERVER_URL`, or equivalent host config.
- The default app surface is a right-side assistant with a right vertically
  centered launcher. This Skill owns the package's public theme, header,
  privacy-prompt, drawer sizing/resize, and container-query behavior; `makeui`
  owns only the surrounding shell, placement, and external container constraints.
- Backend and Agent logic returns Artifact semantics, not React component names.
  `presentation.template` is only a whitelisted hint; it must never load code or
  execute server-provided HTML, CSS, JSX, or JavaScript.
- Artifact V1 kinds are the stable interoperability boundary:
  `metric`, `comparison`, `trend`, `ranking`, `record-list`, and `notice`.
- Do not guess Artifact type from Markdown tables or prose. If the backend cannot
  produce structured results, render text only and report the protocol gap.
- Every transport event entering UI must be parsed and validated before render.
  Invalid, duplicate, stale, oversized, or cross-run events must fail safely.
- `loadHistory` must restore both text and Artifact snapshots. A refresh that
  drops Artifacts is an incomplete integration.
- Send or otherwise make available frontend capabilities before backend
  generation. Backend should only return Artifact kinds and templates supported
  by the current frontend.
- Message ids are idempotency keys. Use stable UUIDs or a documented deterministic
  conversion; do not let retries create duplicate user messages.
- The host provides user display name/avatar, brand/title/subtitle, and privacy
  prompt copy through React props only. These presentation props and theme values
  do not become authorization data.
- The host handles `onAction` permission checks and navigation. Package templates
  only emit action intents.
- Demo/mock transports are for development, tests, and controlled previews only.
  They must be explicitly gated and must not be confused with real Agent results.
- Safe boundary logs are required for Service/transport entry, success, failure,
  stale result, and cancellation branches. Never log cookies, tokens,
  Authorization, raw prompts with sensitive data, or full private record payloads.
- Never select `make-app` merely because the host UI is a Make App. Adapter
  selection is a backend capability decision: a configured/queryable Console
  Agent or an explicit Agent Gateway request selects `make-console`; a confirmed
  Make App AI Chat contract selects `make-app`; otherwise stop for confirmation.
- Do not implement a generic Console proxy. Console BFF routes, query/body
  validation, error mapping, SSE lifecycle, and disconnect cancellation must
  follow `references/make-console-service-contract.md`.

## Handoffs

- With `makeui`: use `makeui` for shell layout, launcher placement, external
  container constraints, and surrounding visual polish. This Skill owns package
  props and behavior, including `theme`, header/privacy presentation,
  `maxDrawerWidth`, package resize/accessibility behavior, container queries,
  and Artifact rendering semantics. Do not reimplement those package behaviors
  in host CSS or a generic Drawer.
- With `make-app-service`: this Skill defines assistant route and payload
  contracts after adapter selection. Service owns route handlers, adapter-specific
  proxying, request validation, upstream error mapping, AbortSignal propagation,
  and safe logs. `make-app` uses its confirmed App AI Chat contract;
  `make-console` uses the fixed Console BFF contract and is never a generic proxy.
- With `make-app-auth`: auth owns unified login, cookies, redirects, and
  authenticated request wrappers. This Skill consumes those wrappers and must not
  introduce token handling in UI.
- With `make-app-permission`: permission owns access policy. This Skill treats
  permission state as host context and validates action execution through the host.
- With `make-app-runtime`: runtime owns build, environment variables, deployment,
  and preview readiness. This Skill only specifies what runtime configuration the
  assistant integration needs.
- With `makecli`: use Make CLI for platform resource inspection, Agent deployment,
  and environment operations. This Skill does not execute Make CLI workflows.
