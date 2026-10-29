# UI permission runtime

权限及 Schema 初次加载、刷新校验的占位遵循 [区域加载态](../../makeui/references/app-shell-layout.md#区域加载态)：Shell 已挂载时填满主内容区并水平、垂直居中，尚未挂载时使用有完整高度的启动 fallback；禁止左上角裸文本。布局不得提前开放受保护内容，不改变 Provider 顺序、失败关闭及错误出口。

以下普通编辑/更新字段规则不用于我的审批节点办理。任务表单按 [审批任务详情](../../make-app-approval/references/task-detail.md) 消费当前节点 fieldPermission/actions，字段定义读取 bpm-node-form-metadata 的 TASK 场景，不从普通 entity 或权限过滤的 Schema 补齐；节点定义不并入普通权限缓存。任务附件重查节点权限并用同一节点元数据来源校验类型，任务写入交 Workflow，不经普通记录更新门禁，也不以此放宽普通 CRUD。

Use this reference for frontend permission providers, matching, route/action gates, field sets, payloads, and refresh.

## Contents

- Provider and data sources
- Permission model
- Route and operation gates
- Create flow
- Read/edit flow
- Special fields and Lookup
- Refresh generation
- Readiness blockers

## Provider and data sources

Mount identity, permission, permission-aware Schema, then router/pages:

```jsx
<AuthGate>
  <PermissionProvider>
    <SchemaProvider>
      <AppRouter />
    </SchemaProvider>
  </PermissionProvider>
</AuthGate>
```

The global error outlet must remain mounted outside conditional `PermissionProvider` and `SchemaProvider` success branches, under its shared error-state owner. It must still receive the first permission request failure when `AppRouter` and the page Shell have not mounted. Keep the provider order above for authorization and Schema loading; placing the outlet in a persistent app-root layer does not change that order.

Use the host API adapter for `/app/principal/permission`; never raw-fetch IAM from UI.

The IAM wire response is `{code: 200, data: {principal, scope, permissions}}`. Follow `service-principal-permission.md`: the request adapter checks the business code and unwraps data exactly once before `normalizeAccess`. Do not pass the whole envelope into the pure model, unwrap a shared adapter's already-decoded DTO again, or reuse the bare `current-context` identity parser. Test this real UI loader boundary as well as the pure permission helpers.

When permission or permission-aware Schema loading fails, keep a safe structured request error in Provider state through the error outlet: `kind/status/title/description/traceId`. The status is optional when no HTTP response exists, and description may be absent. Preserve the request Trace ID even on the first load, when the page route has not mounted yet. The error title and description must already be safe user text; do not pass a raw Error, upstream response body, or stack to the UI. Continue to fail closed for authorization, but render the failure through the shared `make-app-observability` card. Ordinary permission denial stays a forbidden state and does not acquire a synthetic Trace ID. If nearby copy tells users to provide a Trace ID, confirm the card actually receives and displays a valid one.

Normalize each entity's permission-trimmed Schema collections independently:

- `fields`: list, detail, filter, edit upper bound;
- `createFields`: create upper bound; missing means `[]`, with no fallback to `fields`;
- `editableFields`: ordinary update field upper bound; preserve and intersect with visible fields. Bulk uses its own field decision.

## Permission model

Normalize to `{ principal, scope, appResource, permissions }`, deriving `appResource` only from the validated response `scope` rather than trusting an independently supplied value. Before normalizing `permissionKey`, `resource`, `effect`, and `fieldAccess`, apply the deterministic selection table in `permission-boundaries.md`. Ignore only clearly unrelated rows; selected and unclassifiable rows are strict-validation inputs and therefore fail closed when malformed. Ignored rows must never grant or deny App access or block the permission-to-Schema loading flow.

Provide pure helpers:

- `canUseEntityOperation(access, entityKey, permissionKey)`
- `canCreateEntityField(access, entityKey, fieldKey)`
- `canReadEntityField(access, entityKey, fieldKey)`
- `canUpdateEntityField(access, entityKey, fieldKey, operation = "data.record.update")`
- `creatableFieldKeysForEntity(access, entityKey, createFields)`
- `visibleFieldsForEntity(access, entityKey, fields)`
- `editableFieldKeysForEntity(access, entityKey, visibleFields, operation, editableFields)`

Use only the documented data/meta keys consumed by this App. The permission backend supplies the configured result; UI helpers apply it to routes, controls and submit allowlists. Keep policy aggregation, configuration validation and unrelated project authorization out of the App.

Do not require exactly one matching allow result. Preserve the returned access arrays and use the named-field/wildcard lookup and operation-specific membership rules in the response reference. Do not restore state priority or require every member to allow the operation. UI submit and App Service validation use the same rule, independent of response order.

Field eligibility by dimension (each still requires its operation and Schema bound):

```text
create:  *, creatable
meta.field.read structure: *, editable, readonly, partialMask, fullMask
update:  *, editable
```

Principal responses carry arrays of supported members, including multi-value arrays, as specified in [the bundled response contract](service-principal-permission.md#response-and-field-access). Normalize legacy strings to arrays; preserve every member and test the capability required by the operation. `creatable` alone grants neither ordinary metadata visibility nor editing; `editable` alone does not grant creation. Data API value-read permission and masking remain server responsibilities.

Collect applicable named-field members before wildcard members. Nonempty maps without either entry do not grant the field. When all applicable maps are empty, the principal + Schema consumption may add no further restriction, as defined in [the response contract](permission-boundaries.md#platform-authority-and-response-formats); it still cannot expand Schema or host capabilities. Never enumerate arbitrary payload keys as authorized fields.

For selected rows, missing `fieldAccess` is incomplete, not an empty map. Fail the snapshot closed rather than inserting `{}`. Explicit `null`, a non-object, an array used as the map itself, a blank field key, an empty state array, or an unknown/non-string member is malformed. Supported multi-value arrays are valid. Report invalid input visibly instead of successful empty grants. Reject invalid effects, non-three-part permission keys, missing/non-App scopes, arbitrary namespaces, and wildcard tenant/App resources; never discard a malformed selected row while keeping sibling allows. Classify clearly unrelated rows before validation; pure normalization of null/primitive envelopes or rows and non-array `permissions` must deny without throwing.

## Route and operation gates

- Validate App entry and dynamic entity membership against permission-aware Schema, and require `meta.entity.read` before exposing an entity in left navigation or entering its dynamic object route. The route itself must return the host forbidden result before it mounts the object page; hiding the sidebar is not a route guard. When a host `ProtectedRoute`/`RouteGuard` is used instead of an explicit forbidden branch, return that guard from the dynamic route and bind it to the resolved current `entityKey`; merely declaring an unrelated guard does not protect the object page.
- Bind fixed routes to an entity and permissionKey.
- Require `data.record.read` before list/detail loading. A denial replaces that record-reading business content, not the authorized shell/navigation. Do not reinterpret it as a metadata or field-permission revoke.
- Require `data.record.create` for create routes, create entry, open handler, and submit.
- Resolve ordinary create fields from `createFields` and `data.record.create` field states; `meta.field.create` changes Schema structure. Do not require metadata read for create-only fields.
- Require `data.record.update` for edit routes/entry/submit/cell commit.
- Keep delete and bulkUpdate independent.
- Do not use field-count conditions to hide create or normal edit entries.
- Recheck each handler before its protected read or mutation.

If create is allowed but no creatable fields remain, keep the create entry and render a “暂无可新建字段” empty state. Disable save unless the documented business API explicitly supports empty-record creation.

## Entity navigation and table surface

Derive the object surface in three independent steps:

```text
canViewEntity = canUseEntityOperation(access, entityKey, 'meta.entity.read')
visibleFields = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
canReadRecords = canUseEntityOperation(access, entityKey, 'data.record.read')
sourceRows = recordState.items
tableRows = canReadRecords ? sourceRows : []
```

Render the navigation item and resolve the object route only when `canViewEntity` is true and the entity exists in permission-aware Schema. In the dynamic route, return the host resource-forbidden result when it is false. For a record-reading destination, also gate the entire business content with `canReadRecords` and any current target's classified read denial before mounting the business page. Authorized tables derive their columns from `visibleFields`, not by rewriting field grants through `canReadRecords`.

When metadata is authorized but record read is denied, keep the authorized navigation and global identity header, not the object's business UI. Replace the full content subtree (business title, toolbar/search, statistics, table headers, rows, forms and dialogs) with `inline/resource` feedback. Do not execute `onDataLoad` or preserve an empty table around it. Keep denial state outside the replaced subtree so unmounting the page cannot reset the error and restart its requests. On refresh/revocation clear the actual `sourceRows` store and counts/selections, invalidate old requests, and reject late results. `tableRows` above is a stale-row safety bound, not a requirement to mount the table. A record read grant never expands field visibility; a field read grant never authorizes a record request.

## Create flow

先判断普通新建或审批新建。以下计算、提交步骤及普通 create 的就绪检查适用于无有效 `bpmDefinitionKey` 的场景；有效审批的新建字段、附件和 Lookup 源字段白名单按 [审批发起合同](../../make-app-approval/references/initiation-contract.md) 切换，UI/Service 同步执行，不能把本文件的普通源字段交集再次套到审批字段。目标对象授权、类型能力与已有记录编辑规则保持不变。

Compute create fields only from the create collection and create permission:

```text
createSchemaFields = entity.properties.createFields ?? []
creatableKeys = creatableFieldKeysForEntity(access, entityKey, createSchemaFields)
createFormFields = createSchemaFields
  .filter(field => creatableKeys.has(field.key))
  .filter(supportsCreateInput)
```

Do not require the field to be in visible `fields`, readable, or editable. A create-only invisible field must render and accept a value in create mode, then disappear from list/detail/edit.

Before submit:

1. Use the latest access generation and recheck `data.record.create` for the operation.
2. Re-read latest `createFields` and recompute creatable keys from `data.record.create` field states.
3. Validate only authorized, rendered fields, including `validations.isRequired` and type-specific validation.
4. Build an allowlist payload from those fields; never spread all form values.
5. Build relation/Lookup payloads from the same allowlist.
6. Reject DevTools-injected, stale, hidden, or unauthorized values before the request.

Created-record response mapping may use visible `fields`; it must not use visible `fields` to filter the create request data.

## Read/edit flow

Use:

```text
visible = visibleFieldsForEntity(access, entityKey, entity.properties.fields ?? [])
singleUpdateSchema = entity.properties.editableFields ?? []
singleKeys = editableFieldKeysForEntity(access, entityKey, visible, "data.record.update", singleUpdateSchema)
editable = visible.filter(field => singleKeys.has(field.key) && isEditCapableField(field))
bulkKeys = editableFieldKeysForEntity(access, entityKey, visible, "data.record.bulkUpdate")
batchEditable = visible.filter(field => bulkKeys.has(field.key) && isEditCapableField(field))
```

- Render list, detail, filter, and edit fields only from `visible`.
- Mark visible non-editable form fields readonly/disabled.
- Do not attach cell editors or required validation to non-editable fields.
- Build update payloads from latest visible/editable allowlists.
- Preserve and use backend `editableFields` for ordinary update, intersected with visible fields, `data.record.update` and its field state. Batch edit uses its own `data.record.bulkUpdate` decision; do not couple it to single update.
- A create revoke closes create only. An update revoke closes edit only. A `data.record.read` revoke unmounts the current record-reading business content and its dialogs but keeps entity-authorized navigation; it does not revoke independently authorized create-only routes. A `meta.entity.read` revoke also removes the object navigation entry. Operation-only denial keeps allowed drafts; it must not masquerade as whole-resource denial.

## Special fields and Lookup

- Exclude ID and system-managed create/update audit fields from create capability even if malformed input Schema/permission includes them.
- Preserve audit field edit capability when the field is visible, update-authorized, and host-editable.
- Treat the exact type `Make.Field.File` as a host-contract capability, not an implicit permission result. The host adapter must declare which upload contract it implements: (a) persisted-record FileField routes such as `POST .../records/:recordID/files/:fieldKey`, which require an existing record identity and therefore make File create-incapable; or (b) an explicit pre-upload/direct-create contract that returns the backend-approved attachment array without requiring `recordID`, in which case the field may remain create-capable and only that attachment array enters `data[fieldKey]`. Never infer mode (b) merely from `required`, `createFields`, or a File permission. Apply this capability guard after the mode-specific source authorization: ordinary create uses `createFields ∩ data.record.create 字段状态`, approval create uses authorized start-config fields. In mode (a), do not render, required-validate, or submit the File field during create. Its read/edit path remains independent and uses visible fields, update permission, an existing record identity, and the host edit-capability guard.
- Treat the exact type `Make.Field.Lookup` as a relation-backed control only when mode-specific relation metadata and the host relation-write contract both support it; otherwise it is read-only/unsupported for write even if field permission allows it. Load ordinary candidates through the host Lookup option route (normally `GET .../lookup-options?sourceEntityKey=&lookupFieldKey=&keyword=&page=&size=`), and BPM candidates through the scene-specific provider; never use an unrestricted target list. 普通场景使用 Schema 关系；BPM START/TASK 按 [节点 Lookup 依赖合同](../../make-app-approval/references/lookup-metadata.md) 使用节点内 relations 和目标 key/type，不回退普通 relation/entity/Schema。
- Resolve a Lookup source definition by mode: 普通新建 may use visible `fields` first and then `createFields` for a create-only source field; 审批新建 must use the authorized 启动配置 field definition as its source, even when an ordinary visible field has the same key. Ordinary mode resolves the target entity and display field from visible target `fields`; BPM uses the node dependency contract above and still checks target object, field and record read permissions. Never use target `createFields` or BPM metadata alone to bypass read visibility. Candidate values are target `recordID` strings; labels and option objects are presentation only.
- Split ordinary and Lookup values before persistence, then filter both by the latest mode-specific field allowlist. For create, exclude Lookup field keys from ordinary `data`; UI sends `{ data: ordinaryAllowlistedData, relations: { [lookupFieldKey]: recordID | recordID[] | null | [] } }` to `POST .../records`. Service must reject any client-provided raw `data.qfei_relation` or Lookup key hidden in `data`, re-authorize each `relations` key against 普通新建的 permission-trimmed `createFields` 或 审批新建的权威 启动配置 字段白名单, validate relation metadata, cardinality, target visibility/existence and exact target `recordID`, then synthesize the Make payload `data.qfei_relation: [{ entityKey, id }]`. For edit, never let UI submit a partial raw `qfei_relation`; send authorized changes as `{ values: { [lookupFieldKey]: recordID | recordID[] | null | [] }, data?: ordinaryAllowlistedData }` to `PATCH .../records/:recordID/lookup-relations`. Service must re-authorize each source field, validate ordinary `data` against the current permission-trimmed visible/update contract, read the exact current source record, fail closed on malformed unrelated relation entries, preserve unrelated relations, and synthesize the complete `qfei_relation`. Reject client-provided raw `qfei_relation`, non-allowlisted fields, invalid cardinality, invisible targets, and missing/mismatched source or target identities. Because the backend `qfei_relation` item contains only `{ entityKey, id }`, relationKey is not encoded; if more than one independently writable relation from the source can point to the same target entity, this generic field-key route is ambiguous and must fail closed unless the host documents and tests a backend contract that disambiguates it.

## Refresh generation

Permission changes are refresh-based, but permission and permission-trimmed Schema must refresh together:

```text
nextAccess = await refreshPermissions()
invalidateSchemaCache()
nextSchema = await refreshSchema()
advanceAccessGeneration(nextAccess, nextSchema)
closeOrRecomputeOpenSurfaces()
refreshDataOnlyIfReadAllowed()
```

An equivalent query-cache/provider design is valid when it guarantees:

- Schema cache identity includes principal/tenant/App or an access generation;
- old permission, Schema, record, candidate, and form async results cannot overwrite the new generation;
- newly granted create/read fields appear on page refresh;
- revoked fields/actions disappear before mutation;
- submission is disabled during access refresh.

Treat `nextAccess` as a candidate until `nextSchema` succeeds. At refresh start, the previous authorization must no longer be usable for protected reads or writes. Publish the new permission and Schema atomically; never expose “new permission + old Schema”. If either refresh fails, remain fail-closed rather than restoring a possibly revoked old generation.

Fail closed when either permission or Schema refresh fails.

## Readiness blockers

- Ordinary create form reads `fields` or `editableFields` instead of `createFields`; approval create form ignores the authorized start-config fields.
- Missing ordinary `createFields` falls back to visible fields, or missing approval start-config falls back to ordinary fields.
- Ordinary create fields use metadata operations, omit `createFields`, allow writes without `creatable|*`, or treat `creatable` alone as readable; approval create reapplies the ordinary field intersection.
- Edit skips visibility, ignores supplied `editableFields`, or batch edit borrows the single-update field gate.
- Entries are hidden by writable-field count.
- Submit expands raw form values or relation values without a latest allowlist.
- ID/audit fields can be created; ID fields can be edited or enter update payloads; audit edit is accidentally removed.
- Create-only Lookup reads an invisible target field.
- Permission refresh does not invalidate/reload Schema or accepts stale results.
- Direct URL/handler access bypasses operation checks.

## Scoped route feedback

Read `scoped-route-feedback.md` for App guard -> shell -> object/fixed-route guard composition. React uses a shared host adapter for `MakeAppPermissionNotice` from `@qfei-design/make-app-observability/react`; read `makeui/references/permission-feedback.md` for verified exports/CSS, visual variants and the package release gate. Scope, retry state, allowed return targets and protected-request invalidation remain host-owned; the component cannot authorize or refresh data by itself. Administrator contacts must work without a business request: follow `make-app-auth/references/access-help.md`. If embedded contacts are absent and the installed SDK supports it, use `auth.getAppAdministrators()` independently; a supplied empty list remains authoritative. For a local denial, do not fetch data merely to obtain a 403; retain authorized navigation and replace the business content. Record-read-only denial remains distinct from metadata/App entry denial. Existing non-React host helpers remain compatible without a forced framework migration.

业务字段编辑遵循 [统一规则](permission-boundaries.md#业务数据编辑统一规则)：单条更新使用 `data.record.update`，批量使用独立的 `data.record.bulkUpdate`，并校验该操作返回的字段访问态。`meta.field.update` 只用于字段结构变更，不能作为业务数据编辑授权或兜底。前端控件、提交白名单与 Service 写入校验必须一致，覆盖 readonly、hidden、脱敏、显式拒绝及撤权，禁止通过管理员或扩大为 `*.*.*` 绕过。
