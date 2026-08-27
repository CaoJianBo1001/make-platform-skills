# Package integration

## Required package workflow

1. Locate the host UI package.
2. Ensure `@qfei-design/make-ai-assistant` is installed at the platform-approved
   version for the host. Prefer the latest published compatible version when the
   user asks to upgrade.
3. Read package docs from `package.ai.json`:
   - `node_modules/@qfei-design/make-ai-assistant/package.ai.json`
   - every file listed in `package.ai.json.readOrder`
4. Before building a transport, select the adapter under `SKILL.md` and read the
   selected public recipe from `recipes.json` plus its matching capability entry
   from `capabilities.json`. These files define which adapter operations, route
   shapes, SSE events, and feature flags are actually published. If the selected
   adapter or its required recipe/capability metadata is unavailable, report the
   package version and stop for confirmation; do not infer it from package source
   or the host page type.
5. Import only public entrypoints:
   - `@qfei-design/make-ai-assistant`
   - `@qfei-design/make-ai-assistant/react`
   - `@qfei-design/make-ai-assistant/sse`
   - `@qfei-design/make-ai-assistant/make-app`
   - `@qfei-design/make-ai-assistant/make-console`
   - `@qfei-design/make-ai-assistant/testing` for tests and controlled demo only
   - `@qfei-design/make-ai-assistant/styles.css`

Do not import package `src`, `dist`, examples, gallery files, or other internal
paths. Do not copy package templates, reducers, SSE parsers, state machines, or
CSS into the host.

The selected adapter is a backend capability choice, not a UI framework choice:

- a configured/queryable Console Agent or an explicit Agent Gateway request uses
  `@qfei-design/make-ai-assistant/make-console`;
- a confirmed Make App AI Chat backend contract uses
  `@qfei-design/make-ai-assistant/make-app`;
- a Make App page alone does not select `make-app`.

Add a regression test that rejects the wrong adapter and route family. In
particular, a Console selection must not instantiate the Make App adapter or call
`/api/make/app/ai/**`.

## Public React surfaces

- `MakeAiAssistant`: default surface with floating launcher and assistant panel.
- `AssistantPanel`: embedded panel when the host owns the conversation surface or page region.
- `ArtifactRenderer`: render one Artifact inside a custom host surface.
- `MakeAiTheme`: local visual contract shared by all three React surfaces.

Public props vary by surface:

- All three surfaces support `theme?: MakeAiTheme`, `context`, `onAction`, and
  `onActionError`; `ArtifactRenderer` also requires `artifact` and `registry`,
  and may accept `fallback`.
- `MakeAiAssistant` and `AssistantPanel` require `transport` and support an
  optional `registry`, `brandName`, `title`, `subtitle`, `assistantName`,
  `userName`, `userAvatarUrl`, `privacyNotice`, `headerHeight`, and
  `suggestions`, and `onNewConversation`; `AssistantPanel` additionally
  supports `onClose`.
- Only `MakeAiAssistant` supports `open`, `defaultOpen`, `onOpenChange`,
  `launcher`, `hideLauncher`, and `maxDrawerWidth`.

User display name/avatar, brand copy, privacy prompt, and theme are presentation
props only. They do not change authorization and must not be forwarded as
credentials.

## Visual and responsive contract

Use public props and package namespace variables; do not copy package CSS or
replace the assistant with a host-owned generic Drawer.

- `theme` requires `primary`; optional `MakeAiTheme` values refine hover,
  foreground, surface, text, border, and overlay colors. The prop applies local
  `--make-ai-theme-*` variables to the rendered package root, so it must not
  mutate host global CSS. A light primary needs a readable `onPrimary` value.
- Theme precedence is `theme` prop, then `--make-ai-theme-*`, then other
  `--make-ai-*` overrides, host `--make-color-*`, and finally package defaults.
  Semantic success, warning, and error colors remain semantic rather than being
  recolored as brand status.
- Package templates receive the same theme automatically. A custom Artifact
  template that returns its own root element or a Fragment must apply
  `renderContext.themeStyle` to its own root when it needs the package theme;
  never add a wrapper solely to theme an Artifact.
- `privacyNotice` and `headerHeight` are `MakeAiAssistant` / `AssistantPanel`
  header props. `privacyNotice` creates the package header's focusable help
  Tooltip beside the current context. Pass text only; do not build a duplicate
  broadcast row. Empty or blank text hides the control. `headerHeight` accepts a
  number or CSS length; `--make-ai-header-height` is the namespace-variable
  alternative. Do not pass either prop to `ArtifactRenderer`.
- `MakeAiAssistant` defaults to a 432px desktop drawer. It is resizable from the
  left edge, exposes a keyboard-focusable separator, and keeps the initial width
  as its minimum. `maxDrawerWidth` is a pixel cap with a default of
  `min(1024px, 72vw)` and is clamped to the minimum/current viewport. Do not pass
  this prop to `AssistantPanel` or emulate it with page-level media queries.
- At viewport widths of 560px or less, the package uses a full-width drawer and
  hides the resize handle. Use `--make-ai-drawer-width`, `--make-ai-drawer-resize-line`,
  `--make-ai-panel-gutter-wide`, and launcher position variables only when a
  documented override is necessary. The panel and Artifacts use container
  queries, so embedded and widened surfaces adapt to available container width.
- Closing an opened `MakeAiAssistant` hides the drawer without unmounting the
  panel or cancelling an active run. Let the package preserve scroll and focus;
  cancel only through stop, new conversation, context reinitialization, or host
  unmount according to the transport contract.

## Host context

Pass a complete `MakeAssistantHostContext`:

```json
{
  "app": { "id": "<appKey>", "name": "<appName>" },
  "location": { "pathname": "<currentPath>", "routeId": "<routeId>" },
  "resource": { "entityKey": "<entityKey>", "recordId": "<recordId>", "viewKey": "<viewKey>" },
  "selection": { "recordIds": ["<recordId>"] },
  "locale": "zh-CN",
  "timezone": "Asia/Shanghai",
  "extensions": { "view": "<safeViewSnapshot>" }
}
```

Only include small, safe, non-secret context. Do not send tokens, cookies,
Authorization headers, raw permission grants, full table data, or unbounded row
snapshots through `extensions`.

## Demo and mock transport

`@qfei-design/make-ai-assistant/testing` and any demo/mock transport are only
for development, tests, local demos, and explicitly gated preview demonstrations.
A demo/mock transport must be opt-in and visibly labeled, for example with a
query flag plus allowed host check.
换句话说，demo/mock/testing 能力仅用于开发、测试和演示，不进入生产真实语义。

Demo mode must not:

- replace the real transport silently
- run on production domains by default
- persist mock results as real assistant history
- be used as evidence that backend Artifact support is complete

## Package upgrade checks

When upgrading the package:

- read the new public docs before changing host code
- update direct imports and CSS imports only through public entrypoints
- check whether new required props, capabilities, events, or template ids were
  added
- add or update tests before changing the integration
- run host build/typecheck and package-specific contract tests
