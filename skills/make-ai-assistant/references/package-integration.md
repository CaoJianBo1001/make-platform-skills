# Package integration

## Required package workflow

1. Locate the host UI package.
2. Ensure `@qfei-design/make-ai-assistant` is installed at the platform-approved
   version for the host. Prefer the latest published compatible version when the
   user asks to upgrade.
3. Read package docs from `package.ai.json`:
   - `node_modules/@qfei-design/make-ai-assistant/package.ai.json`
   - every file listed in `package.ai.json.readOrder`
4. Import only public entrypoints:
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

## Public React surfaces

- `MakeAiAssistant`: default surface with floating launcher and assistant panel.
- `AssistantPanel`: embedded panel when the host owns the conversation surface or page region.
- `ArtifactRenderer`: render one Artifact inside a custom host surface.

Host props normally include:

- `transport`
- `context`
- `registry` for custom template registration
- `brandName`, `title`, `subtitle`
- `assistantName`
- `userName`, `userAvatarUrl`
- `privacyNotice`
- `suggestions`
- `launcher`, `hideLauncher`
- `onAction`, `onActionError`

User display name/avatar and broadcast copy are presentation props only. They do
not change authorization and must not be forwarded as credentials.

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
