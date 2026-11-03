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

本节定义经真实接口、权限服务及下游消费源码核实的 IAM 响应合同；字段默认态及多条结果的消费规则见 [本地权限合同](permission-boundaries.md#platform-authority-and-response-formats)。The wire success is a `{code: 200, data: ...}` envelope, not the bare identity returned by auth `current-context`. The following response uses the array shape observed through a real App Service IAM adapter (identifiers replaced):

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
        "resource": "make://<tenantId>/*/app/<appKey>",
        "effect": "allow",
        "fieldAccess": {
          "*": ["*"]
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
- `data.record.create` controls ordinary creation; Schema `createFields` contains create-eligible fields (`creatable|*`). `editable` alone does not grant creation. Workflow approval creation keeps its own field authorization.
- `data.record.update` plus its field state controls ordinary edit; preserve Schema `editableFields`. `data.record.bulkUpdate` and its field state control batch edit independently.
- `meta.field.create/update` exist for Schema structure operations. Neither grants business value writes.

`fieldAccess` 是 `Record<string, string[]>`。2026-10-29 经真实 App Service 在 dev/default 调用本接口观察到 `{"*": ["*"]}`；权限服务的 `PrincipalPermissionItemResponse` 也声明 `map[string][]string`，`mergeFieldAccessValues` 保留全部命中值并去重，不再按状态优先级覆盖。旧字符串仅作为历史兼容输入归一为单元素数组，不能反过来限制当前响应。

| 检查维度 | 数组成员要求 |
| --- | --- |
| 普通创建字段 | 包含 `creatable` 或 `*` |
| 普通更新/批量更新字段 | 包含 `editable` 或 `*` |
| `meta.field.read` 的字段结构可见性 | 包含 `readonly`、`editable`、`partialMask`、`fullMask` 或 `*`；仅 `creatable` 不补普通可见性 |
| Data API 的业务值读取 | 下游按 `readonly` 或 `*` 判断，并执行投影、脱敏和行条件；不由前端自行重建数据权限 |

合法成员为 `* / hidden / readonly / creatable / editable / partialMask / fullMask`。纯权限模型保留数组，可按首次出现顺序去重；接口透传层保持原响应。不能 `String(array)`、`join()`、取首项、选“最高优先级”或要求全部成员都允许。`["readonly","editable"]` 保留编辑能力，`["readonly","creatable"]` 可创建而不可编辑；只有 readonly/hidden/mask、没有对应写能力的字段仍不可写。`*` 只用于当前匹配操作，不代替其他操作、Schema 或宿主能力。

脱敏成员必须保留给展示链路，不能把能力判断结果改写成未脱敏原值，也不能把脱敏占位直接作为编辑原值提交。该接口不能替代具体请求的最终行级授权。未知成员仍按合同不支持处理，保留原响应并反馈，不能按字符串真值自动放行。

同一 App/对象/操作命中多条结果时，先处理该操作的显式 deny，再消费 allow 中返回的字段能力。具名字段值存在时收集所有适用结果中该字段的数组；不存在时收集 `'*'` 基线。按上表的成员资格判断，不能按响应顺序选择一条，也不对不同状态重建优先级。保留原始结果，不产生新权限或合并策略配置。

Do not make the UI readiness transition depend on every row returned by IAM. Apply the deterministic selection table in `permission-boundaries.md` before strict row validation: only clearly unrelated rows may be ignored, while selected and unclassifiable rows fail closed. Ignored rows must never grant or deny App access or block the subsequent Schema request. Keep the Service request App-scoped; local response selection is not a reason to add a tenant-root scope or upstream platform permission filter.

所有适用 allow 的字段 map 都为 `{}` 时，Meta 的 principal 消费链把它视为不额外限制，仍以对应 Schema 集合和宿主能力为上限。非空 map 中未列字段且没有 `'*'` 时，不自行补 editable；一个空 map 也不能覆盖其他结果的具名字段限制。此默认只用于 principal + Schema 的应用消费，不照搬到 Data API 的 `/decision/plan`：实际数据请求仍由后端逐字段校验。见 [字段边界](permission-boundaries.md#independent-field-dimensions)。

For selected current-App business rows, a missing `fieldAccess` property is an incomplete response, not `{}`; fail closed instead of inserting an empty map. Explicit `null`, a non-object, an array used as the entire map, a blank field key, an empty state array, a non-string member or an unknown state stops the snapshot at the consuming validation/normalization boundary, with visible feedback rather than successful empty grants. Known multi-value arrays are valid. The Service proxy still forwards the original response. Do not discard a malformed selected row while keeping sibling allows. Reject invalid effects, non-three-part permission keys, arbitrary namespaces or wildcard tenant/App resources instead of guessing intent. Pure normalization of null/primitive payloads or rows and non-array `permissions` denies without throwing; the loading boundary reports the invalid response.

The Service preserves resources such as `make://<tenantId>/*/app/<appKey>`; UI segment matching treats that namespace wildcard as the same current App family represented by response scope.

## Make App consumption boundary

聚合由权限后端完成。Make App 的 Service 透传结果，UI 按当前 App 的权限和 Schema 更新页面、控件及提交字段。不在这里实现 Console 配置校验、策略合并或记录级字段配置判断，也不增加决策接口调用。业务 API 的真实拒绝按现有错误处理链路展示。

## Failure behavior

When IAM returns a response, return its status, Content-Type, and body unchanged so the UI receives the real backend result, including its error code and message. UI must still fail closed: clear protected access, avoid protected reads/mutations, invalidate permission-dependent Schema, and render a visible retry/error/forbidden state from that real response. Only a transport failure with no IAM response may use a documented Service-generated error.

业务字段编辑遵循 [统一规则](permission-boundaries.md#业务数据编辑统一规则)：单条更新使用 `data.record.update`，批量使用独立的 `data.record.bulkUpdate`，并校验该操作返回的字段访问态。`meta.field.update` 只用于字段结构变更，不能作为业务数据编辑授权或兜底。前端控件、提交白名单与 Service 写入校验必须一致，覆盖 readonly、hidden、脱敏、显式拒绝及撤权，禁止通过管理员或扩大为 `*.*.*` 绕过。
