# Permission boundaries

Use this reference before choosing scope, resource, permissionKey, Schema collection, or field access state.

## Contents

- Front-end App scope
- Single-App operations and resources
- Independent field dimensions
- Schema and permission intersection
- Matching semantics
- Route and backend boundaries
- Common mistakes

## Front-end App scope

This skill only consumes the front-end App permission response. Request the exact App scope `make://<tenantId>/meta/app/<appKey>` and use only the rows needed for this App's `data.record.*`, `meta.entity.*`, `meta.field.*`, and supported wildcard decisions. Do not use tenant-root or unrelated permission results to authorize App routes, fields, buttons, or records.

权限配置属于 Console；配置合法性、策略评估与聚合属于权限后端。本 Skill 仅指导 Make App 消费已配置好的 data/meta 权限、权限过滤后的 Schema 和业务 API 结果。App Service 保持现有代理与提交边界校验，不实现配置管理、策略引擎或其他项目的授权判断。

## Permission-row selection

Validate the response envelope and derive the current App from `scope` first. Then classify each permission row before strict row validation; do not use a broad namespace-prefix heuristic.

| Resource classification | Key classification | Result |
| --- | --- | --- |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Exact supported key, or a valid three-part wildcard matching at least one supported key | Select and validate strictly. |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Structurally valid three-part key that matches no supported decision, such as `data.record.export` or `meta.app.read` when the App has no consumer for them | Clearly unrelated: ignore without validating `effect` or `fieldAccess`; it must never grant or deny an App capability. |
| `*`, or a documented canonical/namespace-alias resource for the current tenant and App | Non-string key, or malformed/truncated key in a supported namespace such as `data.record` or `meta.field` | Select and fail closed during strict validation. |
| Tenant-root `make://<tenantId>`, or a structurally valid documented App resource for another tenant/App | Any key | Clearly unrelated: ignore without validating row fields. |
| Missing, malformed, arbitrary-namespace, or wildcard-tenant/App resource | Any key | Unclassifiable: select and fail closed. |
| Null, primitive, or array row | N/A | Unclassifiable: select and fail closed. |

Supported decisions are `data.record.read`, `data.record.create`, `data.record.update`, `data.record.bulkUpdate`, `data.record.delete`, `meta.entity.read`, and `meta.field.read`. A valid wildcard is supported only when it matches at least one item in that list; `*.*.*` is therefore supported. Unknown decisions are not future-proof grants: when a new business decision is introduced, update this list, its matching helper, and the conformance cases together.

This local response tolerance does not alter the upstream query: Service still requests only the exact App scope and no platform permission filter. IAM should correct surplus response rows separately.

## Single-App operations and resources

Common record keys:

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Entity metadata key:

```text
meta.entity.read
```

Normal edit/cell edit uses `data.record.update`; batch edit uses `data.record.bulkUpdate`. Keep all operation keys independent.

Common resources:

```text
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/meta/app/<appKey>/entity/*
make://<tenantId>/*/app/<appKey>
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>/entity/*
*
```

The namespace `*` in `make://<tenantId>/*/app/<appKey>` represents the same App family as response scope `make://<tenantId>/meta/app/<appKey>`; it is not tenant-wide platform permission.

## Entity metadata, table structure, and record data

The object, its visible columns, and its record values are three independent read surfaces:

| Surface | Required permission | Behavior when denied |
| --- | --- | --- |
| Sidebar/navigation and object route | `meta.entity.read` | Hide the entity and reject its dynamic object route. |
| Field structure when business content is rendered | `meta.entity.read` plus `fields ∩ meta.field.read` | Show only authorized fields; an empty visible-field set uses the host's zero-column state, not an invented object denial. |
| Record-reading business content, including list/detail/pagination | `data.record.read` | Do not issue record requests; replace the entire business content with resource feedback. |

Schema membership remains an upper bound: an entity must exist in the permission-aware Schema before it can be displayed in navigation or entered by route. Within that bound, do not let `data.record.read` decide entity navigation or field authorization, and do not let `meta.entity.read` or `meta.field.read` authorize a record request. Authorization dimensions are independent; this does not require keeping an authorized field's header mounted inside denied business content.

For an entity that has `meta.entity.read` and readable fields but lacks `data.record.read`, keep its authorized navigation entry and replace the current record-reading business content as a whole. Do not retain its business title, search/toolbar, statistics, table/card/form structure, headers, records or dialogs. Follow `scoped-route-feedback.md`; mount the guard above arbitrary business descendants rather than guessing their DOM structure. Clear the record store/counts/selections and invalidate in-flight work; disabling only the next request is insufficient. If a still-allowed table remains elsewhere, its columns still come from `visibleFieldsForEntity(...)` and its row source must exclude denied records. Independent create-only routes keep their own create/field gates; a read denial is not a create-permission revoke.

## Platform authority and response formats

本节与 [principal 接口合同](service-principal-permission.md#response-and-field-access) 随 Skill 一起提供，定义 Make App 所需的权限点、响应格式及字段默认态。完整的 23 个 data/meta 权限名称见 [`scripts/permission-registry.mjs`](../scripts/permission-registry.mjs)，供名称和回归核对；它不维护平台注册服务、不产生授权，也不校验 Console 配置。

- `data.record.create/read/update/delete/bulkUpdate/export` 是业务记录操作。附件的 `data.file.create/get/delete/download` 也是独立权限，不从记录 update 或元数据权限推导；Service 仍调用对应 Make File API 做最终授权。
- `meta.field.create/read/update/delete` 均为合法元数据权限；create/update/delete 管字段结构，不能授权业务记录写入。`meta.field.read` 仍用于结构可见性。
- 具体权限点只接受随包字典列明的名称，不能通过字段状态或命名规律推导新的权限点。实际接口出现未列明的权限名称时先确认合同，不自行扩展授权。
- 通配是匹配规则，不是新的注册权限点。先确认被查询的具体权限合法，再匹配 `data.record.*`、`data.*.*`、`*.record.update` 等三段通配。即使已收到 `*.*.*`，也不能把未知具体权限判为存在。

按 Make App 已接入的响应合同消费数据：

1. 权限过滤后的 Schema 已提供 `fields`、`createFields`、`editableFields`。Make App 保留并使用这些集合，分别用于可见字段、普通创建和普通编辑；Schema 的 `creatable`、通配 access 与多 access 资格格式不改变 principal 接口的响应类型。
2. `/principal/permission` 的 `fieldAccess` 是字段到访问值数组的 map，包含 `* / hidden / readonly / creatable / editable / partialMask / fullMask`；字符串仅作历史兼容输入。按对应操作检查数组成员，不能将多值压成一个最终态：创建要求 `creatable|*`，更新要求 `editable|*`，仅 `editable` 不授予创建。结构可见性、业务值读取及脱敏分开，详见本地 principal 接口合同。

对应操作已 allow 后，收集所有适用结果中的具名字段访问值；不存在具名字段时才用 `'*'` 基线，非空 map 未列且无通配的字段不授权。只有全部适用 map 为空时，principal 的 Meta 消费链才按不额外限制处理，仍不得增加 Schema 集合外的字段。不能把该默认搬到 Data API 决策计划。单条编辑受 `fields ∩ meta.field.read ∩ editableFields` 约束，批量使用其独立操作状态。

权限后端返回已聚合的权限结果，每行包含 `permissionKey`、`resource`、`effect` 和 `fieldAccess`；不同资源的结果独立保留。App 的权限接口保持原始返回结果，不合并不同资源、不重算配置规则、不增加资源覆盖优先级。多条适用结果的应用消费规则见下文 Matching and validation。具体记录的行级条件、数据投影、脱敏和最终拒写由 Make API 执行；本 Skill 不要求 App 新增决策接口或实现后台配置判断。

## Independent field dimensions

Creation, visibility, and editability are separate field-set decisions. 普通新建遵守下表；审批新建使用 [审批发起合同](../../make-app-approval/references/initiation-contract.md) 的启动字段授权，不再叠加普通字段交集；应用、对象及记录新建操作门禁仍保留。审批任务办理也不使用普通 CRUD 字段规则。

| Surface | Schema upper bound | Data authorization |
| --- | --- | --- |
| Ordinary create | `createFields` | `data.record.create` + create-eligible field state + host create capability |
| List/detail/filter | `fields ∩ meta.field.read` | `data.record.read` and server projection/masking |
| Single edit/cell edit | visible `fields ∩ meta.field.read ∩ editableFields` | `data.record.update` + editable final field state + host edit capability |
| Batch edit | visible `fields ∩ meta.field.read` | `data.record.bulkUpdate` + its own editable field state + package capability |

createFields missing means empty, with no fallback to fields. `editableFields` 表示普通 update 的可编辑集合，应保留并使用；缺失不等于全部可编辑，不从未过滤 Schema 推导授权。批量编辑不能因缺少单条 update 的 `editableFields` 或 update 权而被耦合拒绝，应使用 bulkUpdate 的字段决策。所有字段列表只能收紧其对应操作，不能代替 record gate。

`createFields` 和 `editableFields` 可以包含 `fields` 外的字段。普通新建可显示仅可创建的不可见字段；普通编辑仍必须可见，不通过编辑权补可见权。ID 和系统审计字段不进入 create 集合；已有审计字段在平台允许且宿主编辑器支持时保留 edit 能力，详见 `system-field-contract.md`。

## Matching and validation

- 先验证精确 App scope，再按上文选择权限行。选中或无法分类的行格式错误时整份快照 fail closed，不能丢弃坏行后保留 sibling allow。
- `effect` 只允许 allow/deny；selected key 为合法三段形式。明确无关的权限点不能授予、拒绝或阻断当前业务权限。资源仅接受已确认的当前 App 家族，保留 namespace alias；不猜测 tenant/App 通配或任意 namespace。
- 请求 entity/field 必须是具体非空字符串，不能用 `*`、null、数字、数组或对象做查询标识。
- 多条返回结果按上面的具名/通配规则取得访问值集合，再按操作所需成员判断，结果顺序不改变资格。`readonly` 与 `editable` 共存不撤销编辑能力；`hidden`/脱敏成员保留，不被转换丢失，也不当作旧式最高优先级覆盖其他成员。原始结果保持分开，不重建策略配置或资源优先级。
- 已解析的无行条件操作 deny 优先于 allow；字段 hidden/readonly/mask 使用字段态表示，不把字段限制改写为整操作 deny。
- principal 解析按 [响应合同](service-principal-permission.md#response-and-field-access) 验证七种合法成员并保留多值，不能统一拒绝数组或用 String(value) 强制转换。所选行缺失整个 `fieldAccess` 属性与 `{}` 不同，按响应不完整失败关闭，不补成空 map。null、数组作为整个 map、空值数组、未知或非字符串成员仍不允许；不丢弃坏行保留其他 allow。
- 当前权限、Schema 与提交应绑定同一用户、App、对象及刷新代际；不能借用另一操作或旧响应。

## Route and backend boundaries

- Protect App, object, create, and fixed routes; require `meta.entity.read` inside the dynamic object route as well as navigation, because menu hiding is insufficient and direct URLs bypass the sidebar.
- Do not load list/detail without `data.record.read`; stop requests, invalidate rows and replace the denied business content, without removing metadata-authorized navigation.
- Recheck create/update/delete/cell/batch handlers immediately before mutation.
- Let backend record APIs enforce row-level `dataCondition` and final write authorization.
- Do not cache permission-trimmed Schema across principals. Refresh permission and Schema together when access is refreshed.

## Common mistakes

- 用不存在的字段权限点、元数据更新权限或管理员授权修复业务编辑。
- 把记录操作 allow 或非空数组当作字段可写，未检查对应写能力；或使用旧优先级让 readonly 覆盖同时返回的 editable。
- 从 Schema 集合或策略配置推断 principal 中不存在的权限，或由 App 重做后端策略聚合。
- 新建回退到 fields；批量字段套用单条 update 权；只过滤控件却提交整个表单。
- 只隐藏菜单，缺少直达路由门禁；刷新权限却保留旧 Schema、草稿和请求。

## 业务数据编辑统一规则

单条编辑检查 `data.record.update`，批量检查独立的 `data.record.bulkUpdate`。字段访问值还须包含 `editable` 或 `*`。前端控件、提交白名单和 Service 使用一致规则：最新授权可见字段、对应操作允许字段、宿主编辑能力的交集。显式拒绝、撤权、或只有 readonly/hidden/mask 而无编辑能力时都不能写入；多个合法值共存不按旧优先级互相覆盖。

UI 提交前重算最新白名单；Service 不信任 UI 过滤，对全部提交字段独立检查。DataService 最终执行行条件和写入授权，不具备权限时整单拒绝，不能静默丢弃字段；沿用统一错误链路保留真实 status/code 和提示，不根据字段状态臆造错误码。普通单条 update 的 Schema editableFields 与 bulkUpdate 决策不能互相替代。禁止通过扩大为 `*.*.*` 或授予应用管理员绕过。
