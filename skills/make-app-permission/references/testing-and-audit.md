# Testing and audit

任务节点办理另按 [审批验证矩阵](../../make-app-approval/references/verification.md) 验证：普通 Schema/entity 已省略、但 bpm-node-form-metadata 返回且当前节点授权的字段可展示并通过任务动作保存；节点定义返回的未授权字段不可进入任务 UI/补丁，普通 CRUD 仍拒绝越权，普通 Schema 缓存不被替换；RETURN 空补丁且不上传，Lookup 保持任务字段格式。任务预上传用 TASK 节点字段定义校验类型。当前 starter 撤回与节点办理、普通 IAM 审计分开，不能要求通用权限函数返回节点授权。

本文件的 `createFields`/IAM 字段集合用例和通用权限一致性适配器验证普通新建。有效审批新建按 [make-app-approval](../../make-app-approval/SKILL.md) 单独增加 UI/Service 启动字段一致性测试：普通集合没有但启动配置授权的字段仍应显示并保存，启动配置只给 field key 时由 bpm-node-form-metadata 的 START 场景补定义。不得将普通场景的“字段不在 createFields 就不能创建”当成审批分支断言，也不得删除原普通权限回归来通过审批测试。应用、对象、操作资格和关联目标权限仍需共同覆盖。

任务 form 聚合允许已完成且无动作的任务只读访问；Lookup 的辅助目标定义不进入可见/可编辑字段集合。每次任务 lookup-options 搜索/翻页都重查节点授权，撤权后不读元数据或候选；只解析当前字段，仍检查关联目标对象/显示字段/记录读取。不能用普通源字段 IAM 门禁替代节点权限，也不能因为节点可编辑就放宽目标数据权限。

审批测试还应覆盖普通 `createFields` 缺少但启动配置允许的 Lookup/File：Service 对源字段使用最新启动配置，Lookup 目标仍须可见且存在，File 只在已确认预上传合同下提交；审计普通字段交集时不得把这一审批分支判为缺失 `createFields` 的违规创建。

Use this reference before implementation and before reporting permission work complete.

## Service and Schema tests

- Principal permission route, App scope, IAM `/api/make/iam/**`, target header, login forwarding, tenant resolution, errors, and runtime-mode scopes.
- If tenant resolution already consumes current-context, run the auth Skill's `current-context-conformance-suite.mjs` against a thin adapter to the production Service handler; otherwise keep the established trusted-tenant path without adding an auth request.
- Test frontend startup auth → actual IAM → Schema by response type, not HTTP 200 alone. Invalid IAM stops Schema; legacy Mock `app_admin` claims with empty IAM rows cannot grant object access.
- Use a bare successful current-context fixture and a complete IAM `{code:200,data:{principal,scope,permissions}}` fixture. Keep Service passthrough assertions byte-for-byte; at the actual UI request adapter prove code validation and one-time unwrap, valid empty grants, malformed success failure, and retained 401/known403/503 errors with administrator contacts. A DTO-only helper test does not cover this boundary.
- Principal permission route preserves every completed IAM response's HTTP status, Content-Type, and body unchanged, including 2xx success plus 4xx/5xx errors; only a no-response transport failure may use a documented Service-generated error.
- Preserve and normalize `fields` and `createFields` independently across Service, shared types, and UI adapters.
- Missing/null/invalid `createFields` becomes empty and never falls back to `fields`.
- Ordinary update preserves and consumes `editableFields`; bulkUpdate does not borrow the single-update field set.
- Permission-trimmed Schema cache/in-flight work is isolated by principal, tenant, App, and access generation.
- Permission refresh invalidates or reloads Schema before protected page data.
- Lookup source resolution uses visible `fields`, then `createFields`; target display fields remain visible-only.

## Permission model tests

Cover documented permission-key/resource matching and deny behavior. Consume the backend results according to the response contract; do not implement resource priority or policy aggregation in the App, and do not derive platform semantics from historical adapter expectations. Prove that a named entity grant does not leak to another entity. Exercise every row-selection-table outcome: malformed tenant-root and other-App rows remain ignored; a malformed unsupported current-App key such as `data.record.export` remains ignored; a malformed supported current-App key fails closed; and an unclassifiable resource fails closed even when its key is unrelated. Add adversarial rows for invalid effects, non-three-part permission keys, missing/non-App scope, an independently supplied App resource that conflicts with scope, arbitrary namespace, wildcard tenant/App resources, missing `fieldAccess`, explicit `null` fieldAccess, invalid containers, blank field keys, empty state lists, unknown states, and mixed non-string state lists. A malformed selected current-App row poisons the whole access snapshot; do not discard it while preserving sibling allows. Null/primitive payloads or rows and non-array `permissions` must return a denied snapshot without throwing.

Also prove that `meta.entity.read` is independent from `data.record.read`: an entity can be navigation/route-authorized while its record operation is denied, and a record permission alone cannot add an entity to navigation.

Required field cases:

| Case | Expected |
| --- | --- |
| Metadata read only | visible structure; no business create/update grant |
| `data.record.create` + createFields + create-eligible state | ordinary create permitted, including invisible create-only fields |
| `data.record.create` deny | operation and ordinary create fields denied |
| `data.record.create` allow + metadata read deny | create-only field may remain creatable in createFields |
| `data.record.update` + visible field + editable state | single edit permitted without meta.field.update |
| `data.record.bulkUpdate` only + bulk editable state | batch edit permitted; single update denied |
| `data.record.*` / `data.*.*` | matches real record operations, respects field limits and deny |
| metadata update only | no business edit grant |
| only readonly / hidden / partialMask / fullMask, without the operation's write member | writes rejected |
| explicit operation deny / revoked grants | no UI request and no Service write |
| all applicable field maps empty, with operation allow | principal adds no extra field restriction; UI and Service still enforce Schema and host capabilities |
| nonempty maps without requested field or wildcard | no field grant; never synthesize editable |
| named field values plus `'*'` baseline | use applicable named values; use wildcard only if no named value exists |
| selected row missing the entire field map, including beside a valid allow | invalidate the snapshot; no UI submit or Service persistence |
| compatible exact and wildcard results coexist, in either order | field stays available; UI submit and Service write succeed |
| named readonly/hidden/mask without editable, beside a wildcard grant | named members control the field; stale UI and direct Service writes cannot persist |
| readonly and editable coexist, either in one array or separate applicable results | edit capability remains; no obsolete priority reduction or first-result-only check |
| principal `{"*": ["*"]}` | preserve through Service/UI loading; operation and field helpers accept it; UI submit and Service write still enforce Schema bounds |
| single-element readonly/hidden/mask arrays | preserve the member restriction; reject injected or stale writes |
| `["readonly","creatable"]` vs `["readonly","editable"]` | first permits create only; second permits edit only; both preserve structure visibility |
| known multi-value arrays with hidden/mask members | preserve all members and evaluate operation capability; backend projection/masking remains effective |
| Schema collections vs principal fieldAccess values | consume each response contract separately; do not reject valid IAM arrays |

协议核对依据（2026-10-29）：真实 IAM 调用确认数组形态；PermissionService 的 `PrincipalPermissionItemResponse`、`mergeFieldAccessValues` 及多值响应测试确认保留/去重；共享 `PermissionFieldAccess` 与 Meta/Data 的字段消费代码确认按能力成员判断。当前 UI/Service 回归须覆盖相同数据经真实加载器、权限模型和提交边界，不以文档关键词或假造最终单值代替。权限服务 `c1d92d5e`（同字段实现也见 dev `3b052dc6`）、make-base dev `868d834b`、Meta dev `15bb4826`、Data dev `ed30755a` 为本次核对版本；这是证据记录，不要求应用访问源码仓库。

## Page and payload tests

- An entity with `meta.entity.read` and readable `meta.field.read` fields but without `data.record.read` remains in authorized navigation, but its whole record-reading business content is replaced with resource feedback. Assert that the business title, search/toolbar, statistics, table headers, forms and dialogs are absent, with no records/detail/pagination request. Cover a card/non-table layout as well.
- A missing `meta.entity.read` hides the navigation item and blocks the dynamic object route even if `data.record.read` or `meta.field.read` is present.
- A runtime classified read 403 or a `data.record.read` revoke removes the entire current business subtree and cached records/counts/selections. Keep authorized navigation and the global identity header, ignore late responses and verify that page unmount does not reset denial or restart requests. Disabling only the records query or emptying only table rows is insufficient. Unknown 403/401/service errors do not become permission denial.
- A create-only invisible field renders and submits in create mode only.
- A field outside `createFields`, or a non-create-eligible field in the data creation decision, is absent from create.
- Create operation with zero fields keeps the entry, shows “暂无可新建字段”, and prevents unsupported empty submission.
- Create entry/handler depends only on current `data.record.create`; create field sets depend on current `createFields ∩ data.record.create 字段状态`.
- Edit remains visible-first, checks the record operation and its field state, and uses `editableFields` for single update only.
- ID/audit fields are absent from create; ID fields are also absent from edit forms, cell editors, and update payloads; audit fields remain editable when visible/update-authorized.
- Persisted-record-only `Make.Field.File` is absent from create render/required/payload; an explicitly implemented pre-upload/direct-create contract may include only its backend-approved attachment array without a `recordID`. Read/edit behavior stays independent and follows visible fields, update permission, and the host edit capability.
- `Make.Field.Lookup` candidate requests use the dedicated option route without exposing invisible target fields. Create sends `{ data, relations }` and Service validates `relations` before synthesizing `qfei_relation`; edit sends authorized `values` to the snapshot-preserving `lookup-relations` route. Neither path accepts a client-supplied partial raw `qfei_relation` or a Lookup key hidden in ordinary `data`.
- `field.validations.isRequired` and type validation apply only to rendered authorized fields; `required` is a derived UI-control prop, not an alternate Schema metadata key.
- Submit recomputes the current allowlist and removes DevTools-injected/stale/unauthorized values.
- Permission or Schema failure fails closed.
- Permission and permission-aware Schema request failures, including permission 首次加载失败, keep safe `kind/status/title/description/traceId` in Provider state and render the shared error card with a visible valid Trace ID when one exists; the failed load never exposes protected data. Follow `make-app-observability` for the real AppShell visibility test.

## Refresh tests

- Refresh order is permission, Schema invalidation/reload, surface recomputation, then data if read remains allowed.
- New permission is not published before its Schema succeeds; refresh failure does not restore the old authorization generation.
- New create/read fields appear after page refresh without browser reload.
- Revoked create/update closes the affected operation surfaces. Revoked record read replaces the current record-reading business content and its descendants, not authorized navigation or independently authorized create-only routes; an entity-metadata revoke also removes its navigation entry. Operation-only refusal preserves allowed draft inputs and recovery never replays a mutation.
- Old permission/Schema/record/candidate/form responses cannot overwrite the current generation.
- Submits are blocked while the access generation changes.

## Audit

Run:

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

For a nonstandard layout, pass `--config <json-file>` (relative paths resolve from the audited project root):

```json
{
  "uiRoots": ["clients/browser/src"],
  "serviceRoots": ["services/api/src"],
  "sharedRoots": ["packages/access-core/src"],
  "symbols": {
    "PermissionProvider": "AppAccessProvider",
    "canCreateEntityField": "canCreateField"
  },
  "createCalls": [{"name": "saveBusinessRecord", "argument": 1}]
}
```

Only override roots that differ from defaults; `sharedRoots` adds production shared modules to the UI scan. For an `apps/ui` host whose permission model lives in `apps/packages/types/src`, configure that shared root instead. Directory and symbol names are host choices, not permission requirements. Symbol keys may be PermissionProvider, refreshPermissions, canUseEntityOperation, canCreateEntityField, canReadEntityField and canUpdateEntityField; values are actual identifiers. Mapping only enables code recognition, never grants access or skips a check. Unknown keys/options and nonexistent directories fail with usage errors. Tests, stories, fixtures and build output are excluded even under configured roots.

`createCalls` identifies actual UI write boundaries, not trusted payload builders. Each entry has a call `name` (identifier or dotted member), zero-based payload `argument`, and optional DTO `property` such as `data`. Defaults are `createRecord` argument 0 and `createMakeEntityRecord` argument 0/property `data`; a configured name replaces that default signature, other names add boundaries. For `createRecordForApproval(entityKey, payload, relations, key)`, configure `{ "name": "createRecordForApproval", "argument": 1 }`. Unknown options, duplicate names, invalid indices and configured names with no actual call fail; no check can be skipped by configuration. A project with no recognized create call cannot pass by merely defining a builder elsewhere.

`create calls` 列出识别数 `checked`、局部过滤证据数 `filtered`、来源未证明数 `unproven` 和待复核数 `review`。`checked=0` 报 `create_call_not_recognized`，先核对目录和创建接口配置；`create_payload_unverified_call` 列出已识别调用的文件、行号和载荷参数。跨回调 `prepare → create` 仍不追踪，无法证明时保留 FAIL（退出码 1）；不能直接断言业务授权缺失，也不能据此通过验收，需结合下述生产调用链测试复核。

The audit additionally recognizes generation-based context refresh (permission → fresh Schema → atomic context publication), navigation filtered from that context's Schema, whole-content permission guards and row-clearing enabled hooks consumed by the table. The refreshing effect's dependency array may contain other members alongside its generation key, in any order; an unrelated effect cannot supply that dependency. It checks necessary boolean conditions, including parentheses and guarded alternatives: `true || readable`, inverted permissions and OR between independent required permissions cannot establish a gate. The hook's actual enabled argument must consume the gate; mentioning it in another argument does not count. A nullable context wrapper is recognized only with the corresponding context's guarded generation provider; production tests still verify actual mounting and identity changes.

导航检查识别直接 visible/enabled 条件或当前项的 `meta.entity.read` 过滤集合，以及同文件/相对命名导入的一层函数组件集合参数透传。函数组件中的导航必须进入返回 JSX 或其中使用的局部 JSX/条件 JSX 变量；未使用的安全菜单不能为返回的原始菜单作证，同一识别到的函数视图内也不能用一个安全菜单掩盖另一个未过滤菜单。`permissionCheck || true`、取反和未消费的过滤结果不能作为证据。识别仅支持上述局部结构，不追踪集合别名链，也不证明整个应用的导航都正确。未获得有效证据时保留失败；这不是项目结构要求，不应为了通过扫描重构合法组件或放宽业务权限。

Create checking follows the configured argument through local immutable aliases, DTO properties and simple expression helpers to a consumed allowlist filter. It also recognizes a local field-driven reducer when its actual field argument is filtered and its accumulator only receives that field's key. Unused builders, same-name values in another function/file, mutated aliases, raw spreads and an always-true filter predicate do not establish a safe write. Checks include writes through local child aliases or shallow copies' shared children, and Set mutations before filtering, including optional/computed `add` calls; changing a copy's independent own property or a Set after the payload was materialized does not by itself invalidate the original payload. A prepared `{data: values}` DTO is not itself a mutation; the consuming boundary determines the result. This is a bounded static check, not a full JavaScript interpreter: unsupported builders require inspecting the actual production call chain and extending recognition with positive **and negative** fixtures, not renaming application code or planting keywords.

For a conditional payload such as `approvalConfig ? sessionData : ordinaryFilteredData`, local analysis may prove only the ordinary branch. The tool reports `REVIEW_REQUIRED` with exit 2 rather than PASS. Keep that result separate from the manual review: trace the session's real input filtering and configured create call; exercise both branches through production UI/Service code with extra, hidden and read-only inputs; assert the exact outgoing payload and zero forbidden writes. Confirm that bypassing each filter makes those tests fail. Do not intersect approval fields with ordinary IAM just to satisfy the scanner. A manual review may resolve the identified branch with evidence, but cannot turn the CLI result into an automated pass; an unattended CI gate must keep the nonzero result until its recognizer and production contract are supported. Exit 1 denotes audit failure; exit 2 also denotes usage/configuration errors, which must be corrected and cannot be manually waived.

An imported transform that receives a filtered field list (for example attachment preupload) is also unproven locally. Merging its result with filtered data requires review of the actual transform and its outgoing keys; an unused allowlist or merging raw form values still fails. Exercise unauthorized attachment values as well as allowed values, assert zero uploads for excluded fields, and ensure a transform that enumerates all input keys makes the production-backed test fail.

Keep the config in the host's existing tooling and CI command. If copying the audit to a host, copy its sibling `scoped-route-feedback-audit.mjs`, `permission-runtime-signals.mjs`, `permission-navigation-signals.mjs`, `permission-source-expressions.mjs` and `create-payload-signals.mjs` too. Re-run static audit plus production permission/response conformance and page tests after updating; old copied scripts do not automatically update from this skill.

The audit should fail on outbound IAM request filters containing `make.platform.*`, including a platform-key array assigned to a local variable and then passed directly as `body`/`payload`/`request.permissionKeys`; missing `meta.entity.read` dynamic-route or navigation gates; field-column lists computed from `data.record.read` instead of `meta.field.read` through direct props or derived variables; missing empty/cleared rows after a record-read revoke; missing create permission helpers; business create/edit helpers using metadata write keys or unregistered permission keys; missing/overwritten `createFields`; `createFields ?? fields`; `editableFields` used for creation; create fields built from visible/editable sets; unfiltered create payloads; operation entries tied to field count; permission-only refresh without Schema refresh/invalidation; and obvious field-access state-array coercion through `String(...)`, text helpers, template interpolation, `.toString()`, or `.join()`. Whole-content early returns/conditional mounts are valid resource guards, not column-authorization failures. Response-side filtering of surplus platform rows is allowed. A positive navigation, route, or row-clear signal must be consumed by that same surface: a `ProtectedRoute` must be returned by the dynamic object route and use its resolved entity key, and an explicit empty row branch must occur on a Table/Grid/Canvas row prop or flow into it. Unrelated guards, entity filters, row props, store clears, or page components do not satisfy the gate.

The edit-key audit inspects actual call arguments and ignores comments, inert strings, logging arguments and built-in error messages; it is not complete alias or cross-function data-flow analysis. Run the behavior and write contracts as well.

The audit is heuristic. Its stringification rule is a targeted defense against known bad shapes, not complete data-flow proof. It must reject coercion that affects a normalization result or permission branch, including direct `if`/`switch`/loop conditions. It must lexically ignore comments and string literals and must not fail on diagnostic-only logging inside a named normalization helper, including structured log arguments, `fieldAccess`-specific parameter names, and semicolonless code where an earlier return ends through automatic semicolon insertion. Parenthesized, bracketed, or operator-continued returns remain result-affecting and must still fail. Host tests must prove permission matching, actual form field sets, payloads, Lookup target visibility, generation safety, and server-side enforcement.

## Executable behavior conformance

Static source signals cannot prove that permission helpers deny missing access. A helper set that always returns `true` is invalid even if every required function name exists. Create a thin adapter that imports the production helpers and exports:

```text
normalizeAccess
canUseEntityOperation
canCreateEntityField
canReadEntityField
canUpdateEntityField
isCreateCapableField
isEditCapableField
```

`isEditCapableField` is the production host-capability guard used before edit rendering, cell-editor attachment, and update payload construction. It must reject both ID types without excluding audit keys by name.

Run:

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <adapter-module>
```

For TypeScript adapters, invoke the command with the project's existing TypeScript runner. The adapter must delegate to production App code rather than duplicate permission logic. Test operation gates, current-App/entity isolation, response validation, field visibility, editability, submit filtering, refresh and host field capabilities. Fixture behavior is not authority for a backend aggregation rule or a client-side resource priority.

## UI 提交与 Service 写入边界契约

运行独立的写入契约，不能以纯 helper 返回值替代提交和拒写验证：

```bash
node skills/make-app-permission/scripts/write-permission-conformance-suite.mjs <host-write-adapter-module>
```

适配器导出 `createWriteHarness({snapshot, entityKey, operation, onRequest, onWrite})`。每次创建隔离的宿主实例：`snapshot.access` 是原始 IAM DTO，`snapshot.fields` 是当前对象的 Schema 可见字段上限，`snapshot.editableFields` 是普通 update 的 Schema 可编辑集合（批量不得依赖它）；`entityKey` 为对象键，`operation` 为 `data.record.update` 或 `data.record.bulkUpdate`。套件保留 `meta.entity.read`、`data.record.read` 作为进入编辑场景的前置权限，只单独改变待验证的字段或记录写权限。使用字段定义 `{key, type}`，适配器只映射数据形状，不实现权限判断。适配器可准备固定测试记录和选中目标，仍需经真实 UI 提交及 Service 更新处理器。

宿主实例必须连接生产权限上下文、表单提交函数、Service 更新处理函数；只替换真实外部 I/O。回调 `onRequest(values)` 观察前端实际发送的数据字段对象，`onWrite(values)` 替换 Service 最终持久化调用并观察其真实参数；不得由适配器先过滤、先鉴权或伪造回调。对于 HTTP/DTO 包装只提取实际的 data/values，保留所有字段，不可按期望值改写。

返回以下方法，异步方法可返回 Promise：

| 方法 | 必须连接的生产边界 |
| --- | --- |
| `editableFieldKeys()` | 表单、单元格或批量编辑实际消费的可编辑字段键，统一以数组返回。 |
| `refreshUi(snapshot)` | 发布权限和 Schema 新代际的真实 UI 刷新链路；更新后重新计算编辑字段和提交白名单。 |
| `refreshService(snapshot)` | 替换 Service 可信权限/Schema 数据源并按生产刷新机制失效缓存；不可读取 UI 缓存或客户端提交的授权。 |
| `submit(values)` | 打开编辑后提交当前草稿的真实前端处理器；禁止字段不离开 UI，已撤权的旧草稿也必须重新过滤。若没有可提交字段或缺记录操作资格，适配器将宿主真实失败信号转为 rejected Promise。 |
| `requestUpdate(values)` | 绕过 UI，直接调用生产 Service 的单条/批量写入边界；越权返回的真实拒绝信号转为 rejected Promise，不得伪造拒绝。 |
| `dispose()` | 卸载 UI、释放订阅和隔离缓存，避免用例之间共享授权。 |

Service 必须在持久化前独立验证当前记录操作和全部写入字段；混合合法/非法字段时整次拒绝，`onWrite` 调用次数为零。UI 更新白名单时可以只提交仍获授权的字段，但不能发送旧的 readonly/hidden 字段。

套件同时覆盖普通与批量编辑：精确权限与数据通配授权可写，App/对象和通配/精确的兼容结果并存、交换顺序仍可写；全部适用 map 为空时仍受 Schema 边界约束，非空 map 未列且无通配的字段不授权；额外字段、不可见字段和 ID 不提交；仅只读/hidden/脱敏而无编辑能力、精确拒绝、撤权、仅元数据授权、所选结果缺少字段 map、Schema 移除及缺少可读权限不能写；记录操作与字段权限独立。特别保持 UI 在旧授权状态，只刷新 Service，验证旧提交已经产生请求但持久化次数仍为零。前端拒绝路径则要求请求数和写入数同时为零。

仓库中的 `test-write-permission-conformance-suite.mjs` 以本地夹具验证这些边界，并注入原始表单提交、旧白名单、提交仍使用旧白名单、缺字段校验、Service 信任 UI、忽略 Schema 可编辑集合、忽略刷新等错误实现，也验证按 allow 数量拒绝、要求数组全部成员都允许编辑、将未列且无通配的字段视为可写、缺失 map 被自动补空会失败。夹具自身通过仅证明套件有效，不代表任何存量业务项目已经通过。业务项目必须用生产适配器接入默认测试/CI，不能复制夹具作为验收实现；没有宿主证据时只可提交技能候选修复，不能声称已完成实际任务验证或发布。

写入套件覆盖 Make App 的 update/bulkUpdate 控件、提交和 App Service 拒写边界。外部 Make API 被替换时，不能据此声称真实 Make API 的最终授权已经验证。普通创建还需独立 UI 提交与 Service 创建验证，尤其是 create-only、readonly/mask、越界字段及审批例外；不要求实现或测试 Console 配置能力。

## UI wire-response conformance

Copy `scripts/principal-response-conformance-suite.mjs` into project-local test tooling. Export `createPermissionLoader(request)` from a thin host adapter: `request` is an injected SDK-level request function returning parsed JSON (or throwing an HTTP error), and the export returns the actual production permission load function. Delegate to the existing API factory; do not duplicate its parser or model in the adapter. For a factory that accepts `auth.api.request`, this can be:

```javascript
import { createServiceApi } from '../../ui/src/lib/service-api/client';
export const createPermissionLoader = (request) =>
  createServiceApi({ api: { request } }).loadPermission;
```

Adapt the import/factory names to the host without adding a production test switch. Use its existing TypeScript runner when needed:

```bash
node scripts/principal-response-conformance-suite.mjs test/adapters/principal-response.mjs
```

The loader resolves a validated `{scope,permissions,...}` DTO for successful IAM responses and rejects completed failures/malformed success; adapt a different existing host error-state API through its actual failure signal, not a synthetic successful empty result. The suite injects SDK transport responses, not a fake normalized model: success and empty envelopes, business errors with valid-looking data, invalid data, identity claims, and HTTP 401/403/503 including structured denial contacts. It also rejects missing/invalid `fieldAccess`, empty member arrays, unknown or non-string members in selected rows, even alongside a valid row; neither dropping the bad row nor returning successful empty grants is valid. Clearly unrelated rows remain outside selected-row validation, and valid empty grants/maps remain valid. Keep a host integration test for the subsequent permission-to-Schema ordering and zero protected requests after invalid IAM.

## Host gate integration

- Keep the audit and conformance runner project-local, or consume them from a versioned build dependency. Do not make CI depend on a sibling checkout or an unversioned local Skill installation.
- Make the host's default test, CI workflow, or publish verification invoke the audit, pure-model conformance, UI/Service write conformance and UI wire-response conformance. A change record stating that two projects passed once is acceptance evidence, not a continuing gate.
- Add a host contract test that asserts the gate commands still exist and that the vendored/current runners contain the multi-state-array audit and behavior cases.
- Treat source-to-installed-Skill comparison as a local install/release verification. Generic CI must not require a developer home-directory copy.

For that local install/release verification, run the directory-level checker with explicit paths:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

It must fail on source-only, installed-only, or content-mismatch files. Do not replace this complete comparison with a hand-maintained file list.

## Completion rule

Do not report complete until:

- new/changed tests pass;
- the permission audit passes or every warning is explicitly resolved;
- the executable permission conformance suite passes against production helpers;
- the host's default test, CI, or publish gate invokes both permission checks;
- Skill metadata/quick validation and cross-Skill contract tests pass;
- a real reference project passes the audit without changing that project;
- source and installed Skill copies are synchronized;
- complex revisions have fresh-agent forward-test evidence when available.

## Scoped feedback acceptance

Read `scoped-route-feedback.md` and wire its direct URL, recovery, refresh and revocation assertions into host tests. Assert visible authorized navigation/global identity header, feedback replacing the whole business content, absence of original business titles/toolbars/headers/forms/dialogs, and zero subsequent denied requests. A scope/text-only assertion or static audit pass is insufficient: the heuristic cannot prove arbitrary business content was fully unmounted. `resource_route_shell_unverified` is a bounded JSX signal; dynamic nesting/aliases require rendered-tree evidence, not a comment or an unrelated business-page shell.

React also follows the installed-package verifier in `makeui/references/permission-feedback.md`. Test the actual package-backed host adapter: embedded and explicit-empty contacts make no independent lookup; missing contacts use only a supported SDK helper; old contact responses cannot replace a new identity/tenant/App; retry failure stays fail-closed; recovery never auto-submits. Assert that `MakeAppPermissionNotice` and host wrapper aliases still sit inside the retained shell for resource denial. Cover `page/app`, `inline/resource`, `inline/operation` and `toast/operation` separately. Keep 401/unknown403/503 and permission/Schema transport failures on the existing request-error path, without duplicating a classified permission denial. SSR/package verification is not proof of host request gating or a deployed administrator endpoint.

Include the staggered-release cases from `make-app-auth/references/access-help.md`: new Skill/npm with a missing SDK method or a 404 administrator endpoint must retain generic guidance and the original access/scope. Contact-only 401/403/503, timeout and invalid-response failures stay local; they must not trigger login, global request-error feedback, permission retries, protected reads or mutation replay. A later entry may discover a newly deployed endpoint. Keep these production-adapter checks in the host test/CI gate; degraded contact help is not an App-readiness blocker or a permission grant.

Do not reuse business permission-reason matching as an additional auth bootstrap gate. Follow `make-app-auth/references/sdk-integration.md#startup-shape` for SDK startup `forbidden`; test old refusal text and new JSON without reason, including zero IAM/Schema/business calls. The unknown-403 request-error requirement above applies to business requests, not this separate SDK startup result. An old SDK must still render contacts already embedded by a new backend; a new query endpoint alone cannot supply a missing SDK method.

业务字段编辑遵循 [统一规则](permission-boundaries.md#业务数据编辑统一规则)：单条更新使用 `data.record.update`，批量使用独立的 `data.record.bulkUpdate`，并校验该操作返回的字段访问态。`meta.field.update` 只用于字段结构变更，不能作为业务数据编辑授权或兜底。前端控件、提交白名单与 Service 写入校验必须一致，覆盖 readonly、hidden、脱敏、显式拒绝及撤权，禁止通过管理员或扩大为 `*.*.*` 绕过。

## Make App 权限合同回归

仓库 CI 同时运行 `test-permission-registry.mjs` 与 `test-platform-permission-contract.mjs`。名称字典只核对文档中的 data/meta 权限，防止使用不存在的权限点；它不提供平台管理或配置能力。App helper 不能授权其他项目，混入的无关结果不能改变业务权限。对宿主运行生产 UI/Service 适配器、真实提交与拒写边界，不能以夹具自测代替。

## 范围与协议依据

权限点清单、principal 响应和 Schema 集合按本 Skill 随包提供的 [权限合同](permission-boundaries.md#platform-authority-and-response-formats) 与 [接口合同](service-principal-permission.md#response-and-field-access) 验证。`test-permission-portability-contract.mjs` 防止权限 Skill 再次依赖内部设计文档的地址或章节。测试聚焦 Make App 使用已配置权限后的行为。Console 配置是否合法、权限服务如何聚合属于其他项目，不进入本 Skill 的实现或提测门槛。只有影响当前 App 接口消费的协议疑问需要澄清，不能依据夹具推导规则或扩展应用职责。
