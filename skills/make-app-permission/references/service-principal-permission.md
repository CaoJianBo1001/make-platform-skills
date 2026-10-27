# Service principal permission

Use this reference for the current principal permission Service route and IAM response interpretation.

## Contents

- UI-Service endpoint
- IAM request
- Identity and forwarding
- Response and field access
- Failure behavior

## UI-Service endpoint

Expose for Service-fronted Apps:

```text
GET /api/make/app/principal/permission
```

Call it through the host auth/API adapter, usually `auth.api.get("/app/principal/permission")`. Do not call IAM directly from UI. Keep a legacy `/api/principal/permission` route only when the deployed host contract requires it.

Keep the Service route thin: log safe entry context, derive request context, and call the IAM adapter. This is a direct Make proxy: when the IAM request completes, preserve the upstream HTTP status, response body, and Content-Type unchanged for every status, including 2xx, 4xx, and 5xx. Do not map an IAM failure to a Service error envelope, replacement status, or generic message such as `Make request failed (403)`.

## IAM request

Call Make IAM through the gateway:

```text
POST <gateway-origin>/api/make/iam/v1/principal/permission
X-Make-Target: MakeService.GetResource
Content-Type: application/json
Accept: application/json
```

Default body:

```json
{
  "scope": "make://<tenantId>/meta/app/<appKey>"
}
```

Do not add a tenant-root scope or platform permission filter. Only add a safe `permissionKey in [...]` expression for an explicitly requested diagnostic/constrained query.

Published IAM uses `/api/make/iam/**`; do not rewrite it to `/make/iam/**`. Other published Service-to-gateway Meta/Data/Auth paths may use `/make/**`, while local preview uses the host public `/api/make/**` contract.

## Identity and forwarding

Resolve `appKey` from trusted runtime config such as `MAKE_APP_KEY`, never from browser input.

Resolve `tenantId` from trusted config, trusted request context, or an authenticated current-context request using the same login context. Parse known tenant/org fields or a trusted Make scope.

If tenant resolution already consumes current-context, follow `make-app-auth/references/service-fronted-mode.md#current-context-consumption`. Its legacy Mock claims cannot replace IAM rows or authorize objects; this principal route returns the actual IAM result.

Forward the established login context:

- Cookie for cookie sessions;
- Authorization only when the host already uses bearer auth;
- `X-Make-Target: MakeService.GetResource`;
- trusted tenant/operator headers when available;
- derived `X-Forwarded-Host` and host-correct `X-Forwarded-Proto`.

Never log Cookie, Authorization, token, API key, or full signed URL values.

## Response and field access

本节完整定义 Make App 消费的 IAM 响应格式；字段默认态及多条结果的消费规则见 [本地权限合同](permission-boundaries.md#platform-authority-and-response-formats)。The wire success is a `{code: 200, data: ...}` envelope, not the bare identity returned by auth `current-context`. A representative complete IAM response is:

```json
{
  "code": 200,
  "msg": "ok",
  "data": {
    "principal": "user:<principalId>",
    "scope": "make://<tenantId>/meta/app/<appKey>",
    "permissions": [
      {
        "permissionKey": "data.record.update",
        "resource": "make://<tenantId>/meta/app/<appKey>/entity/<entityKey>",
        "effect": "allow",
        "fieldAccess": {
          "displayname": "editable",
          "username": "readonly",
          "id_card": "hidden"
        }
      }
    ]
  }
}
```

Service forwards that envelope unchanged. At the UI request boundary, validate `code === 200`, unwrap `data` once, then validate/normalize the `{principal, scope, permissions}` DTO. SDK `auth.api` returns parsed JSON, not an automatically unwrapped business DTO. If the host's shared business API adapter already checks code and returns data, consume its DTO without a second `.data`. Do not apply either IAM parser to auth `current-context`.

Malformed or non-success IAM responses must stop permission-to-Schema loading; never default them to a successful empty snapshot. A successful `permissions: []` is authoritative absence of grants, not a transport error. HTTP denial/error payloads, including administrator contacts, stay on the established request-error/permission path. The pure `normalizeAccess` behavior suite takes the decoded DTO; it cannot prove that the UI wire boundary unwraps correctly. Also run the production-loader contract from `testing-and-audit.md`.

Consume `fieldAccess` according to [the App response contract](permission-boundaries.md#platform-authority-and-response-formats). The example above is the backend's principal-permission result; the App forwards and consumes it.

- `meta.entity.read` controls Schema-present entity navigation and its dynamic route.
- `meta.field.read` controls field structure visibility; it cannot grant business creation or update.
- `data.record.read` controls record requests and server field projection/masking; denial replaces the record-reading business content, preserving authorized navigation.
- `data.record.create` controls ordinary creation; Schema `createFields` contains create-eligible fields (`creatable|editable|*` in aggregation). Workflow approval creation keeps its own field authorization.
- `data.record.update` plus its field state controls ordinary edit; preserve Schema `editableFields`. `data.record.bulkUpdate` and its field state control batch edit independently.
- `meta.field.create/update` exist for Schema structure operations. Neither grants business value writes.

principal fieldAccess 使用五态单值 map；不要将 Schema 聚合的 creatable、多 access 数组或通配 access 搬入该响应合同。该接口不处理 dataCondition，因此不能替代具体请求的最终行级授权。

同一 App/对象/操作可能命中多条已返回结果。Make App 不因命中多条 allow 而拒绝字段，也不能借另一条 allow 放宽已返回的字段限制；响应条目的先后顺序不改变访问资格。操作允许与字段只读分别处理，字段限制不改写为整个操作被拒绝。

Do not make the UI readiness transition depend on every row returned by IAM. Apply the deterministic selection table in `permission-boundaries.md` before strict row validation: only clearly unrelated rows may be ignored, while selected and unclassifiable rows fail closed. Ignored rows must never grant or deny App access or block the subsequent Schema request. Keep the Service request App-scoped; local response selection is not a reason to add a tenant-root scope or upstream platform permission filter.

For a valid `fieldAccess` map, `{}` or an unlisted field adds no field restriction after the matching operation is allowed; a named state takes precedence over `'*'` in that map. Apply the Schema bounds and host capabilities in [the field contract](permission-boundaries.md#independent-field-dimensions). An unlisted field is not automatically outside the grant, and default editable never authorizes an arbitrary submitted field.

For selected current-App business rows, a missing `fieldAccess` property is an incomplete response, not `{}`. The documented response supplies a map and defines no omission compatibility; fail closed instead of inserting an empty map. Explicit `null`, a non-object, an array container, a blank field key, an unknown scalar state, or any non-scalar field state is also invalid and must fail the whole access snapshot closed at the Service validation or UI normalization boundary. Do not silently discard a malformed selected row while keeping sibling allows. Also reject a selected row with an invalid effect, non-three-part permissionKey, arbitrary namespace, or wildcard tenant/App resource instead of guessing intent. Null/primitive payloads or rows and non-array `permissions` must produce a denied snapshot without throwing.

The Service preserves resources such as `make://<tenantId>/*/app/<appKey>`; UI segment matching treats that namespace wildcard as the same current App family represented by response scope.

## Make App consumption boundary

聚合由权限后端完成。Make App 的 Service 透传结果，UI 按当前 App 的权限和 Schema 更新页面、控件及提交字段。不在这里实现 Console 配置校验、策略合并或记录级字段配置判断，也不增加决策接口调用。业务 API 的真实拒绝按现有错误处理链路展示。

## Failure behavior

When IAM returns a response, return its status, Content-Type, and body unchanged so the UI receives the real backend result, including its error code and message. UI must still fail closed: clear protected access, avoid protected reads/mutations, invalidate permission-dependent Schema, and render a visible retry/error/forbidden state from that real response. Only a transport failure with no IAM response may use a documented Service-generated error.

业务字段编辑遵循 [统一规则](permission-boundaries.md#业务数据编辑统一规则)：单条更新使用 `data.record.update`，批量使用独立的 `data.record.bulkUpdate`，并校验该操作返回的字段访问态。`meta.field.update` 只用于字段结构变更，不能作为业务数据编辑授权或兜底。前端控件、提交白名单与 Service 写入校验必须一致，覆盖 readonly、hidden、脱敏、显式拒绝及撤权，禁止通过管理员或扩大为 `*.*.*` 绕过。
