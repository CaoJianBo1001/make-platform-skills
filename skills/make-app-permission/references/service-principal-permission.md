# Service Principal Permission

Use this reference when adding or reviewing the Service route that reads current principal permissions for a single App.

## Contents

- Published UI-Service contract
- Service route
- Make IAM upstream
- Payload
- Tenant and app key
- Gateway scopes
- Header forwarding
- Response
- Failure behavior

## Published UI-Service contract

For Service-fronted Make Apps, expose:

```text
GET /api/make/app/principal/permission
```

The UI normally calls the shared auth API adapter with:

```text
auth.api.get("/app/principal/permission")
```

Legacy projects may keep `GET /api/principal/permission`, but do not document it as the published default unless the deployed route really exposes that path.

## Service route

Keep the route thin:

1. Log route entry with safe context only.
2. Build request context from inbound headers.
3. Call the Make IAM client.
4. Return the normalized Service envelope.
5. Map IAM HTTP/API errors to Service errors.

Preferred shape:

```text
registerPrincipalPermissionRoutes(app, {
  prefix: "/api/make/app",
  contextFromRequest,
  makeIamClient,
  logger,
})
```

Do not let UI call Make IAM directly.

## Make IAM upstream

Service must call Make IAM through make-gateway:

```text
POST <gateway-origin>/api/make/iam/v1/principal/permission
X-Make-Target: MakeService.GetResource
Content-Type: application/json
Accept: application/json
```

The path includes `/api/make`. Do not call published IAM as `/make/iam/v1/principal/permission`.

## Payload

Default body:

```json
{
  "scope": "make://<tenantId>/meta/app/<appKey>"
}
```

Do not add a default `permissionKey in [...]` filter. The App frontend needs all current App permissions, including expanded `data.record.*`, `meta.field.*`, `*.*.*`, operation keys, field keys, app-level resources, entity resources, and field access.

Only add a filter when the caller explicitly requests a diagnostic or constrained permission-key query:

```json
{
  "scope": "make://<tenantId>/meta/app/<appKey>",
  "filter": {
    "expression": "permissionKey in ['data.record.read', 'data.record.update']"
  }
}
```

Escape single quotes in permission keys if building the expression.

## Tenant and app key

Resolve `appKey` from deployment/runtime config, normally `MAKE_APP_KEY`. Do not accept `appKey` from the browser request for runtime authorization.

Resolve `tenantId` in this order:

1. Explicit Service config/env such as `MAKE_TENANT_ID`.
2. Trusted inbound header such as `X-Tenant-ID`.
3. Auth current context fallback through make-gateway, using the same browser login context.

Current-context fallback uses the auth namespace, normally:

```text
GET <gateway-origin>/make/auth/current-context
```

Parse common tenant fields such as `tenantId`, `tenant_id`, `orgId`, `org_id`, nested tenant/organization fields, or `make://<tenantId>/...` scope.

## Gateway scopes

Keep gateway origin and gateway scope separate:

- Published Meta/Data/Auth Service-to-gateway calls usually use gateway origin + `/make/**`.
- Published IAM principal permission calls use gateway origin + `/api/make/iam/v1/principal/permission`.
- Local preview may use public gateway origin + `/api/make/**`.

Do not store `/make`, `/api/make`, `/meta`, `/data`, `/auth`, or `/iam` inside `MAKE_API_BASE_URL` when the project convention says that env is a strict gateway origin.

## Header forwarding

Forward the established login context:

- Preserve Cookie when the browser session is cookie-based.
- Preserve Authorization only when the host contract already uses bearer auth or local preview server-side token mode.
- Add `X-Make-Target: MakeService.GetResource`.
- Add `X-Tenant-ID` and `X-Operator-ID` when known and missing.
- Derive `X-Forwarded-Host` from inbound Host; do not trust client-supplied `X-Forwarded-Host`.
- Add `X-Forwarded-Proto` according to the host/runtime contract.

Never log cookies, tokens, Authorization, API keys, or full signed URLs.

## Response

Return IAM data to the UI in the host Service envelope. The UI model expects these fields when present:

```json
{
  "principal": "user:87",
  "scope": "make://<tenantId>/meta/app/<appKey>",
  "permissions": [
    {
      "permissionKey": "data.record.update",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow"
    },
    {
      "permissionKey": "meta.field.read",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {
        "*": "readonly"
      }
    },
    {
      "permissionKey": "meta.field.update",
      "resource": "make://<tenantId>/*/app/<appKey>/entity/<entityKey>",
      "effect": "allow",
      "fieldAccess": {
        "name": "editable"
      }
    }
  ]
}
```

Preserve unknown fields if useful, but normalize at the UI boundary before checks. If IAM returns `fieldAccess`, consume it only on `meta.field.read/update` permission rows as the field range for that field permission. Do not derive field visibility or editability from `data.record.*` rows, even if such rows contain `fieldAccess`.

IAM may return permission resources in wildcard namespace form such as `make://<tenantId>/*/app/<appKey>`. Service should preserve the value; UI permission matching must treat it as the same current App resource represented by response scope `make://<tenantId>/meta/app/<appKey>`.

## Failure behavior

If IAM fails, the UI must fail closed. Service should return a clear non-secret error so UI can show an error/forbidden state and avoid protected data calls.
