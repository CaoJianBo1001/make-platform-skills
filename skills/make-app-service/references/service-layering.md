# Service Layering

Use this reference when structuring `apps/service/src` code.

## Default folder responsibilities

Preserve existing project structure when it already separates these concerns. For new Make POC projects, use the platform layered tree by default:

```text
apps/service/src/
  app.ts
  server.ts
  config.ts
  logger.ts
  make-gateway-proxy.ts      # only when Service-fronted auth/proxy routes are needed
  routes/                    # optional; app.ts may own route registration for small Services
  make-client/
    request.ts
    schema.ts
    records.ts
    users.ts
    departments.ts
    files.ts
    types.ts
  services/
    lookup-options.ts
    lookup-relation-updates.ts
    <custom-orchestration>.ts
  utils/
    make-schema-identity.ts
    make-schema-display.ts
    <pure-helper>.ts
  *.test.ts                  # colocated with the behavior under test when practical
```

Responsibilities:

- `server.ts`: load config, create app, listen. Runtime entry/build details belong to `make-app-runtime`.
- `app.ts` or `routes/`: Express/Fastify route registration, request parsing, response sending, error middleware.
- `config.ts`: read runtime config; do not decide environment-to-domain mapping in code.
- `logger.ts`: safe logging/redaction.
- `make-client/`: Make/backend adapter functions.
- `services/`: multi-step orchestration such as lookup relation updates or OCR result creation.
- `utils/`: pure helpers for schema identity, display name resolution, value normalization, and validation.

Generated POC Services must not be delivered as a flat `src` directory with routes, adapters, schema parsing, lookup logic, file proxy logic, config parsing, and helpers all beside each other. A flat tree is a readiness defect unless the project is truly tiny and contains only a health/config endpoint. Once a Service calls Make Meta/Data APIs, exposes records/candidates/lookup/files, or has custom orchestration, split it into the layered tree before reporting completion.

## Route handler rules

Route handlers should:

- parse and validate path/query/body input
- call a service or Make adapter
- send the documented response shape
- log boundary start/success/failure with safe context
- delegate errors to common error middleware

Route handlers should not:

- build raw Make request bodies inline for every route
- parse schema variants repeatedly in JSX-like or route-local code
- implement record lookup, lookup-option construction, file proxy mapping, or custom workflow orchestration inline
- call local DSL/YAML files for published runtime schema
- shell out to `makecli`, `npx makecli`, or read local makecli config/credentials to serve published runtime data
- contain large multi-step business workflows
- swallow adapter errors and return empty success

## Error mapping

Use consistent errors:

- invalid client input -> `400 BAD_REQUEST`
- missing/expired auth/session -> owned by `make-app-auth`
- forbidden app/business access -> `403` when Service owns the check
- not found -> `404` when the record/entity is known missing
- Make/backend failure -> `502` or a documented Service error status
- unexpected Service error -> `500`

Default error body:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Request body must include a data object"
  }
}
```

If the host project already uses `{ code, message }` or another shape, preserve it and document it in `apps/docs/api.md`.

Do not expose backend stack traces, tokens, signed URLs, raw cookies, or internal config in error responses.

## Logging

Add logs at boundary functions:

- route start/success/failure
- Make adapter request start/success/failure
- key orchestration branches such as lookup relation snapshot merge

Safe log context:

- app/entity/field keys
- record id
- request path without signed query
- pagination sizes
- counts and status codes

Do not log:

- `Authorization`
- cookies/session values
- tokens/API keys
- full signed download URLs
- uploaded file contents
- unnecessary personal data

## Security and local exposure

The Service API may be a local dev proxy or deployed app backend. Preserve the host mode.

Default guidance:

- keep `/api/health` and `/api/config` public for published App Service access; `/health` may remain for local or k8s-probe compatibility
- for Make Deploy's default route split, mount published browser-facing Service APIs under `/api/**`. Prefix-free `/app/**` and `/auth/**` routes are local compatibility only unless the deploy HTTPRoute exposes them.
- protect Make-backed `/api/*` routes when the host project has a Service API key or auth middleware
- for Make-backed record/data routes, forward the established request login context to Make gateway through the adapter; do not replace this with makecli or local credentials
- keep CORS scoped to documented UI origins in local development
- do not introduce a permissive wildcard CORS policy for generated Apps
- do not make Service listen on a wider interface as part of this skill; port/host runtime policy belongs to `make-app-runtime`

## Runtime config boundary

`make-app-service` may use config values, but does not own build/start/port contracts.

Service code should:

- read Make adapter config from `apps/service/src/config.ts` or the host equivalent
- expose a pure `loadConfig(env = process.env)` or host-equivalent function so config behavior can be unit tested without mutating global process state
- trim env strings and normalize trailing slashes before adapters consume base URLs
- normalize or validate gateway base URLs as strict origins, then let Make Meta/Data adapters add the runtime-mode service scope: local preview `make_api_origin + /api/make/**`, published `/make/**`
- avoid hard-coded Make domains in route handlers
- keep secrets out of public config
- treat `makecli` as unavailable in online Service runtime; runtime adapters use gateway/API calls, not local CLI commands

Default new-project config semantics:

- `appKey`: read deployment-injected `env.MAKE_APP_KEY`. Make-backed Services that call Make Meta/Data APIs must fail config loading when it is missing. Do not invent, hard-code, or read `appKey` from UI requests in generated production code.
- `makeGatewayBaseUrl`: in published runtime, read `env.MAKE_API_BASE_URL || env.MAKE_SERVER_URL`, trim it, and remove trailing slashes. `MAKE_API_BASE_URL` is preferred; `MAKE_SERVER_URL` is a compatibility alias. This value is a k8s gateway origin, for example `http://make-gateway.make-dev`, not a path-scoped Make API base.
- Local preview gateway origin: when `MAKE_APP_LOCAL_PREVIEW=true`, derive the public gateway origin from `makecli configure resolve --target local-preview --output=json` field `make_api_origin`. Normalize any path-scoped legacy fallback value into origin plus `/api/make`.
- Make Meta/Data scope: selected by runtime mode inside adapter URL construction. Local preview uses `/api/make`; published uses `/make`. Do not put either path segment in published Service runtime config or `.env.example`.
- `makeSchemaPath`: read `env.MAKE_SCHEMA_PATH`, otherwise use `/meta/v1/schema`.
- When `MAKE_APP_KEY` is missing, or both `MAKE_API_BASE_URL` and `MAKE_SERVER_URL` are missing in a Make-backed Service, throw a clear non-secret config error during `loadConfig`.
- Reject `MAKE_API_BASE_URL` / `MAKE_SERVER_URL` values that include a service scope such as `/make`, `/api/make`, `/meta`, `/data`, or `/auth`. New generated Services keep the env var as the gateway origin because the same Service may call other gateway services with different scopes.
- Reject internal Service upstream calls that use the browser-facing `/api/make` scope. `/api/make/**` belongs to browser or ingress access; Service-to-gateway upstream calls use gateway-origin plus the owning adapter's service scope.

Recommended shape:

The `port` field may appear in the same `config.ts` because Service runtime settings are often loaded together. Its fixed value, build/start contract, and publish readiness checks still come from `make-app-runtime`; this section only defines Make adapter config semantics.

```ts
export type ServiceConfig = {
  appKey: string;
  port: number;
  makeGatewayBaseUrl: string;
  makeSchemaPath: string;
};

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ServiceConfig => {
  const appKey = env.MAKE_APP_KEY?.trim();
  const makeGatewayBaseUrl = stripTrailingSlash(
    env.MAKE_API_BASE_URL || env.MAKE_SERVER_URL || "",
  );

  if (!appKey) {
    throw new Error("MAKE_APP_KEY is required");
  }

  if (!makeGatewayBaseUrl) {
    throw new Error("MAKE_API_BASE_URL or MAKE_SERVER_URL is required");
  }

  const normalizedMakeGatewayBaseUrl = normalizeGatewayOrigin(makeGatewayBaseUrl);

  return {
    appKey,
    port: readPortFromRuntimeRule(env.PORT),
    makeGatewayBaseUrl: normalizedMakeGatewayBaseUrl,
    makeSchemaPath: readTextEnv(env.MAKE_SCHEMA_PATH, "/meta/v1/schema"),
  };
};
```

`normalizeGatewayOrigin` can be a host-equivalent helper, but its published-runtime contract is fixed for new generated code: trim, remove trailing slashes, require an origin-style URL, reject `/make`, `/api/make`, `/meta`, `/data`, `/auth`, and other service scopes in `MAKE_API_BASE_URL`, and leave service path construction to adapters. Existing projects may keep equivalent names such as `baseUrl`, `serverUrl`, or `makeBaseUrl`, but they must preserve the same precedence and failure behavior. `/make` is fixed in the published Make Meta/Data adapter boundary, not config loading. Local preview should consume `make_api_origin` from makecli resolve; only legacy fallback may normalize a makecli-provided public API base that includes `/api/make`, and that normalization must be gated by `MAKE_APP_LOCAL_PREVIEW=true`. A local-only fallback app key is acceptable only when the host project has explicitly documented it for tests or local development; deployed readiness still requires `MAKE_APP_KEY`.

`GET /api/config` must expose only public UI config. Do not return `appKey`, Make base URLs, tokens, cookies, service keys, signed URLs, or deployment-internal route details.

For Service-fronted unified-login Apps that use `gatewayBaseUrl: "/api/make"`, route registration should include the published auth proxy paths (`/api/make/auth/**` and `/api/make/oauth/**`) and business paths (`/api/make/app/**` or the documented `/api/make/<resource>/**`). If the code also keeps prefix-free local routes, tests must cover the `/api/make/**` published path so UI cannot accidentally call `/app/**` and fall through to the UI static route. Older `/api` projects may keep `/api/auth/**` and `/api/app/**` only as an explicit legacy contract.

If the task is to change `apps/service/src/config.ts` structure for port, build, start, or runtime artifact reasons, use `make-app-runtime`.
