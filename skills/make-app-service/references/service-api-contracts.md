# Service API Contracts

任务节点的 recordPatch 与下面的普通记录更新/关系合同分开：按 [审批 Workflow 合同](../../make-app-approval/references/workflow-api.md) 通过任务动作一次提交；Lookup 直接保留字段下的单选 ID/null、多选 ID 数组，File 通过任务授权预上传后一起提交。任务字段定义及附件类型核验读取 bpm-node-form-metadata 的 TASK 场景，不从普通 entity/Schema 取得或回退；字段权限仍由当前任务决定，不覆盖普通 Schema 缓存。不得转普通 PATCH、qfei_relation 或二次套用普通 IAM 字段集。

Use this reference when designing or reviewing `apps/service` routes and `apps/docs/api.md`.

审批任务 UI 使用 `/api/make/app/bpm/tasks/form` 聚合原任务信封与 节点 metadata 及必要 Lookup 依赖；保留原 detail 直接代理。Lookup 使用 `/api/make/app/bpm/tasks/lookup-options`，每次候选读取重查节点授权、只解析当前字段，并保留目标对象/字段/记录读取检查。审批合同中的 `/api/bpm/**` 是逻辑路径，新应用由共享请求/路由层统一映射到这里的发布前缀，页面不另拼路径。元数据去重仅限单次编排；具体定位、响应包装和调用次数见上述审批合同。启动配置仅返回 field key 时由 bpm-node-form-metadata 的 START 场景补定义，不从普通 Schema 裁剪集合补齐。

## Contract source

`apps/docs/api.md` is the UI-Service contract source.

Before changing code:

1. read the existing API doc
2. identify which UI calls depend on the route
3. update the API doc with route, query/body, response, and error semantics
4. then update Service code and tests

Do not leave undocumented routes as the only integration path for generated UI.

## Make response classification and passthrough

Classify every browser-facing Service route in `apps/docs/api.md` before writing
code:

- A **direct Make proxy** forwards one completed Make response. It must preserve
  the upstream status, Content-Type, and body unchanged for every status,
  including 2xx, 4xx, and 5xx. Do not parse and reserialize a JSON body before
  forwarding it, and do not replace it with a generic Service envelope,
  synthesized `FORBIDDEN` code, or different status. This ordinary-proxy rule
  does **not** govern the selected Make AI assistant adapter's error response.
- A response whose body stream ends abnormally is not complete. If Service has
  not written response headers or body bytes, it may return the documented
  transport failure. After any upstream response data is written, preserve the
  started status/body and terminate the connection; never append or substitute a
  Service error envelope. Client cancellation aborts the upstream request and is
  not reported as a user-visible 5xx.
- A **non-proxy aggregation/normalization route** combines or intentionally
  transforms successful data. It must declare that distinct contract and its
  successful response shape in `apps/docs/api.md`; it is not permitted to claim
  direct passthrough. If any completed Make call fails, do not wrap, replace, or
  remap that Make error. Service-owned validation that rejects a request before a
  Make call, and a transport failure with no upstream response, may use a
  documented Service-generated error.

**AI safe-error exception:** The response contract is owned by the bundled
[Agent Public API v1 protocol](../../make-ai-assistant/references/make-app-protocol.md#响应).
Follow that contract for JSON success/error envelopes, numeric business codes,
extensible error reasons, public-field sanitization, SSE and download bytes.
Preserve HTTP status separately from the business code. After SSE headers or
bytes are written, close the stream on failure rather than sending JSON.
Document this exception in `apps/docs/api.md`; do not generalize it to ordinary
Make data/auth proxies.

## Default route response modes

New Make App Services must copy the applicable rows below into `apps/docs/api.md`.
An existing documented host route may use a different success contract only when
its response mode and migration plan are explicit. For every **non-proxy** row,
the listed success contract is the only value Service may normalize; a completed
Make error still preserves its original status, Content-Type, and body.

| Browser-facing route | Response mode | Successful response | Completed Make error |
| --- | --- | --- | --- |
| `GET /api/make/app/principal/permission` | direct Make proxy | original Make response | original Make response |
| Make file download proxy | direct Make proxy | original bytes, Content-Type, and Content-Disposition | original status, bytes, Content-Type, and Content-Disposition |
| `GET /api/make/app/schema`, `GET /api/make/app/entities/:entityKey/fields` | non-proxy normalization | normalized Schema contract | original Make response |
| `GET /api/make/app/entities/:entityKey/records`, `GET /api/make/app/entities/:entityKey/record-groups`, `GET /api/make/app/entities/:entityKey/records/:recordID` | non-proxy normalization | documented record/group contract | original Make response |
| `POST/PATCH/DELETE /api/make/app/entities/:entityKey/records/**` | non-proxy normalization | documented `recordID`, `ok`, or host success contract | original Make response |
| `GET/PATCH /api/make/app/entities/:entityKey/preset` | non-proxy normalization | documented Preset contract | original Make response |
| `GET /api/make/app/users`, `GET /api/make/app/departments`, `GET /api/make/app/lookup-options` | non-proxy normalization | documented candidates/options contract | original Make response |
| `/api/health`, `/health`, `/api/config` | Service-owned | documented Service result | not applicable |

For a Node Service reference that exercises this rule against real HTTP response
streams, including download Content-Disposition, see
`references/direct-make-proxy-contract.mjs`. Host projects must add an equivalent
route-level test; this reference does not replace their own adapter and
integration coverage.

`record-write-permission` and `records/bulk` use the existing stable action
contracts defined by `make-app-actions`; do not replace their
successful or failed response contracts with generic normalization. Keep HTTP200/code
`20000032` exact-ID mapping and the established select-all 403 projection;
outside that projection, completed HTTP failures preserve their original
status, Content-Type and body, including `reason`, `permissionKey` and optional
administrator contacts. Do not discard these fields in a code/message wrapper
or classify an unknown 403 as permission denial.

The selected Make AI assistant adapter is another explicit response-mode
exception: use `make-ai-assistant` for its Agent Public API v1 numeric code/msg/data success/error contract
instead of the ordinary completed-error column above.

For new Make Deploy Service-fronted Apps, the table and all default routes below are browser-facing paths. Ordinary authenticated business routes use `/api/make/app/**`; with `gatewayBaseUrl: "/api/make"`, UI calls `/app/**` through the shared `auth.api` adapter. For example, `auth.api.get('/app/schema')` reaches `GET /api/make/app/schema`, and `auth.api.get('/app/entities/<entityKey>/records')` reaches the records list. Public `/api/health` and `/api/config` remain outside that business namespace. The HTTPRoute sends `/api` to App Service and `/` to UI.

Existing Apps may retain their documented route/mount mapping and matching UI adapter; do not rename their API solely to adopt a new-App example. Prefix-free local routes and older `/api/**` business paths are compatibility contracts, not the new default. Document and test the actual published path in `apps/docs/api.md`.

## Public routes

Default public routes:

- `GET /api/health` -> `{ status: "ok" }` for published App Service access
- `GET /health` -> `{ status: "ok" }` when the host uses prefix-free local health or k8s probes
- `GET /api/config` -> public config only, for example `{ listPageSize }`

Public config must not expose `appKey`, tokens, Make API base URLs, session cookies, service keys, or private deployment details.

## Auth proxy routes

For Service-fronted unified-login Apps, auth implementation details belong to `make-app-auth`, but the Service route contract must expose the browser-facing proxy paths used by the host project. For `gatewayBaseUrl: "/api/make"` projects, use `/api/make/auth/**` and `/api/make/oauth/**`; for older `/api` projects, use `/api/auth/**` and `/api/oauth/**`.

- `GET/POST /api/make/auth/**` -> transparent proxy to make-gateway auth scope
- `GET/POST /api/make/oauth/**` -> transparent proxy to make-gateway oauth scope

Rules:

- Preserve upstream status, `Set-Cookie`, `Location`, and body for auth proxy responses.
- Select the upstream gateway scope by runtime mode: local preview uses makecli resolve `make_api_origin` plus `/api/make/auth|oauth/**`; published runtime uses the k8s-internal gateway plus `/make/auth|oauth/**`.
- Do not forward `/api/make/auth/**`, `/api/make/oauth/**`, `/api/auth/**`, or `/api/oauth/**` unchanged to the internal gateway.
- If local development keeps `/auth/**`, also test the published browser-facing path.

## Schema routes

审批场景配合 [审批发起合同](../../make-app-approval/references/initiation-contract.md)：无损保留对象顶层 `bpmDefinitionKey`，启动配置规范化接口与普通 Schema 字段集合分开。以下 `createFields` 源字段授权及普通记录关系创建规则用于普通新建；审批新建改用 Service 最新取得的启动字段授权，复用相同创建/关系/附件编排及目标授权，不能二次套用普通字段交集。记录列表和详情必须保留 `qfei_process_instance_status`、`qfei_is_locked`，不接受其作为客户端可写字段。

Default:

- `GET /api/make/app/schema` -> normalized `MakeAppSchema`
- `GET /api/make/app/entities/:entityKey/fields` -> normalized `MakeFieldSchema[]`

Rules:

- Normalize schema variants at the Service/API boundary before UI sees them.
- Keep permission-trimmed `fields` and `createFields` independent in the normalized entity contract. Missing or invalid `createFields` is `[]`; it never falls back to `fields`.
- Preserve unknown backend properties when lossless transport is required, including `editableFields`, but do not make Service derive the current edit-field set from `editableFields`; `make-app-permission` owns that runtime decision.
- Keep entity key, entity display name, field key, field name, field type, options, relation metadata, required/read-only flags, and lookup target metadata when available.
- Preserve normalized field `capabilities`, including `sortable` and `groupable`,
  so UI candidates and Service validation use the same runtime Schema contract.
- Do not require local DSL/YAML files to serve schema in published runtime.
- If remote schema is unavailable, return a visible error status; do not silently serve stale generated fields unless the project explicitly has an offline-dev fallback.
- If Schema responses are cached, isolate permission-trimmed values by tenant, principal/session, App, and access generation and document an explicit invalidation/reload path for permission refresh.
- 显式刷新成功后，同一身份与访问代际下随后开始的普通读取必须取得新 Schema，不得从旧缓存或旧进行中请求返回旧值。刷新结果应按代际原子发布；旧请求晚返回不能覆盖新缓存，旧请求失败也不能删除新缓存。权限刷新失败仍遵守 `make-app-permission` 的 fail-closed 规则，不恢复可能已撤销的旧授权。

## 分析元数据的复用与失效

分析来源及分页可多次检查上下文；检查次数不必等于身份、IAM、Schema 的网络读取次数。请求范围、跨请求缓存和业务结果是三种不同生命周期；结合 [聚合查询规划](aggregate-query-planning.md) 选择既有调用链支持的方式，不为统计另建认证或 IAM。

- **请求内复用**：同一逻辑分析请求使用已验证的身份／权限／Schema 快照。若既有协调层规定开始取快照、全部执行结束后权威复核，中间守卫检查存活租约与取消；结束复核失败或上下文改变时不交付业务结果。不得去掉最终复核、恒定返回允许或在结束后继续使用快照；不让每个来源重新打开整套会话。
- **跨请求元数据复用**：仅在宿主既有身份／权限生命周期明确允许时采用。例如初始化和显式刷新取得权威成功响应，同身份 SPA 路由及业务筛选复用该代次。必须明确权限／Schema 更新何时对 UI 生效，以及每次真实 Data API 仍由后端授权；缓存命中不能宣称即时感知所有远端变更。未约定时先保留请求级方案，不为优化擅自改变授权检查频率。
- **业务结果**：上述复用不包含记录、聚合或比较结果。通用接入保持业务查询实时读取；若用户明确要求结果缓存或预计算，另行定义新鲜度、授权、写入失效和完整性，不能隐藏引入。

统计需跟随记录列表时，按 [筛选交接](../../make-app-analytics/references/list-filter-integration.md) 验证完整已应用条件。原列表的 expression 透传合同不因此改变；分析只接受当前公开合同允许的参数，不能静默删除条件、接受任意定义或用宽范围结果冒充当前列表。范围不能完整表达时停止该统计，沿宿主约定反馈并保留原列表。

选择跨请求复用时，宿主实现与验收须覆盖：

1. 隔离依据来自可信运行配置、App／租户、原会话凭据摘要或已验证主体，以及访问代次；按网关部署需要包含受控 Host／origin／mode。客户端代次只参与隔离，不是凭据，不能用它覆盖主体或证明已授权；缺失会话或协议时保留原严格路径，不共享匿名身份。缺少应用身份或无效响应不能用配置常量补成已登录。
2. 只复用通过真实合同校验的成功身份、App IAM 和完整 Schema，保留原始响应与错误合同，不缓存失败、NULL、部分结构或任意 auth/oauth 响应。携带 Set-Cookie 的响应不加入可重放共享缓存，仍按原链路处理当次响应。
3. 显式刷新、退出、身份／会话变化或整代次失效建立新的上下文。旧工作晚成功不能覆盖新值，旧失败不能删除新代次；失效工作不得交付旧业务数据。身份／元数据拒绝按既有合同结束该代次，普通资源 403 仍走原局部拒绝路径；一次业务网络错误不自动清空其他合法元数据。
4. 同一隔离键可共享进行中的元数据读取，使用独立底层控制器和各等待者生命周期。单个调用方取消只结束自己；全部离开时取消无消费者工作；底层失败、取消或代次失效须及时结清全部等待者，即使上游尚未响应。正常完成不触发 abort，也不留下永远 pending 的 Promise。
5. 缓存有明确容量和回收／失效策略；只作为当前实例的性能优化，重启、切换实例或回收后能合法重新读取，不依赖单实例或粘性路由。不因容量回收无关条目而取消其他页面合法在途工作，不默认引入分布式缓存、轮询或业务结果持久化。

访问代次 Header、错误码、容量、缓存期限和刷新协议沿宿主公开合同，不复制某个示范 App 的私有名称。认证、权限与可观测性分别复用相关 Skill；日志不输出凭据、Cookie、缓存键原文或个人数据。共享请求的取消细节继续遵循 [Request cancellation](#request-cancellation)。

## Record routes

Default:

- `GET /api/make/app/entities/:entityKey/records`
  - query: `fields`, `filter`, `groupFilter`, `sort`, `pagination`
  - complex values should be JSON strings unless the host contract says otherwise
  - response: `{ records, total }`
- `GET /api/make/app/entities/:entityKey/record-groups`
  - query: `filter`, `groupFilter`, `group`, `pagination`
  - complex values should be JSON strings unless the host contract says otherwise
  - response: `{ groups, pagination: { page, size, total } }`
- `GET /api/make/app/entities/:entityKey/records/:recordID` -> record
- `POST /api/make/app/entities/:entityKey/records`
  - body: `{ data, relations?: { [lookupFieldKey]: recordID | recordID[] | null | [] } }`
  - response: `{ recordID }`
- `PATCH /api/make/app/entities/:entityKey/records/:recordID`
  - body: `{ data }`
  - response: `{ ok: true }`
- `DELETE /api/make/app/entities/:entityKey/records/:recordID`
  - response: `{ ok: true }` or the host documented empty success
- `PATCH /api/make/app/entities/:entityKey/records/:recordID/cells/:fieldKey`
  - body: `{ value }`
  - response: `{ ok: true }`

Rules:

- Make-backed list and detail routes read records through the Service Make adapter using the runtime-mode gateway scope: local preview calls `/api/make/data/v1/record` with the Service-side makecli token, while published runtime calls `/make/data/v1/record` with the incoming request's login/session context forwarded to gateway.
- Do not serve record routes from `makecli`, local makecli config, makecli stdout, generated fixtures, or local DSL/YAML in published runtime.
- List and detail are separate contracts. Use Make single-record reads for detail when available.
- Validate `sort` shape. Prefer `{ fieldKey, order }`; reject ambiguous legacy `{ field, order }` in new contracts.
- Validate `filter` shape before passing to Make. New Record list contracts should use `{ expression }` for CEL-style filters and omit `filter` when no expression exists.
- Validate `groupFilter` shape before passing to Make. It is separate from `filter`; do not merge the two expressions in Service.
- Do not generate new Service contracts that send `filter: []`, `filter: {}`, blank raw strings, or old object-array DSL to Make Data. Raw non-blank CEL strings are legacy compatibility only when the host API already documents them.
- For grouped leaf records, ordinary records mode must omit `group` or pass `group: null`; never send `group: []` to Make Data.
- Record-groups uses Make Data grouping mode: `group` is required and non-empty, each item is `{ fieldKey, order }`, and `properties` is invalid.
- Record-groups should not forward `fields` or ordinary `sort`; grouping mode ignores them.
- Make Data upstream returns `{ data, pagination: { page, size, total } }`; Service
  maps `data` to `groups` and preserves `pagination.total` as the current-layer
  group total. If an existing host exposes a flat `total` alias, document it as a
  Service alias derived from `pagination.total`, not as the upstream response shape.
- Do not infer returned fields from arbitrary UI row keys. The UI should request fields by schema keys when it needs a smaller payload.
- Create/update payloads carry raw submit values, not formatted display labels.
- For relation-backed `Make.Field.Lookup` during create, keep Lookup keys out of ordinary `data`. Reject client-supplied `data.qfei_relation`; validate `relations` keys against 普通新建的 permission-trimmed `createFields` 或 审批新建的权威 启动配置 字段白名单, plus relation metadata, cardinality, target visibility/existence, and exact target identity, then let Service synthesize the backend `qfei_relation`.

Use `make-app-sort` for the canonical five-level ordered sort model, sortable-field
capability, save-before-apply behavior, and CanvasTable header linkage. Service
owns parsing and authoritative validation.

Use `make-app-group` for the canonical three-level ordered group model,
groupable-field capability, `groupFilter` path semantics, record-groups timing, and
CanvasTable grouped leaf pagination. Service owns parsing and authoritative
validation.

## Request cancellation

Use request cancellation for long-running, paginated, or supersedable Service calls when the UI may abandon an earlier request, including large-data virtual scrolling. Cancellation is an execution concern and must not become a query parameter, request body field, or response-shape change in `apps/docs/api.md`.

At the Service boundary:

1. Reuse the framework's request signal when it provides one; otherwise create one request-scoped `AbortController`.
2. Detect only a premature client disconnect or closed response through the host framework's documented lifecycle hook and abort the controller. Normal completion must not abort the downstream request signal: in Node/Express-style handlers, guard `close` with `if (!res.writableEnded) controller.abort()`; in other frameworks, use the equivalent completed flag, response finished state, or request-aborted signal. Cleanup should be idempotent because finish, close, and error hooks may arrive in different orders.
3. Pass the same `AbortSignal` through the service layer and every downstream Make adapter or `fetch` call for that work.
4. Treat `AbortError` as expected control flow. Do not map it to a user-visible 5xx, retry it automatically, or write a response after the connection has closed.
5. In `finally`, remove disconnect listeners and release request-local resources so completed requests do not retain handlers. Listener cleanup must not itself abort a normally completed response.

Keep cancellation scoped to the request that created it. Do not reuse an `AbortController` across users, routes, query contexts, or independent page requests. If one request starts several downstream calls, either pass the same signal to all calls or derive child controllers that are all aborted when the request ends.

共享进行中的下游请求时，取消一个调用方不能影响其他仍有效请求：不要把任一调用方的 `AbortSignal` 直接作为共享网络请求的唯一信号。共享工作须有独立的存活/取消管理；仅当已无有效调用方时才可取消底层工作。一个调用方断开后只结束它自己的响应，其他调用方仍须收到正常结果或明确错误；共享工作发生 `AbortError` 时也必须结清仍在等待的调用方，不能仅跳过响应处理让它们一直挂起。跨主体共享仍受上面的 Schema 缓存身份隔离约束。

The adapter must pass `signal` to the actual network client. Merely ignoring a late response protects state but does not save Service or Make gateway work. If an intermediate library cannot propagate `AbortSignal`, document that boundary as a performance limitation and retain stale-response guards; do not claim end-to-end cancellation.

Log safe route, entity, page, and cancellation reason at the route/adapter boundary. Do not log row payloads, filter contents, credentials, cookies, or tokens. Expected cancellation may use debug/info logging; non-abort failures retain the normal error contract.

## Entity Preset routes

Generate these routes when advanced filtering, record sorting, or record grouping
is enabled:

- `GET /api/make/app/entities/:entityKey/preset`
  - response: `{ filter: { expression } | null, sort: { fieldKey, order }[], group: { fieldKey, order }[] }`
- `PATCH /api/make/app/entities/:entityKey/preset`
  - sparse body containing at least one supported dimension
  - filter clear: `{ filter: null }`
  - sort clear: `{ sort: [] }`
  - group clear: `{ group: [] }`
  - response: `{ ok: true }` or the host's documented update result

These new-App defaults already include the published `/api/make/app/**` prefix.
For an existing host with a different documented mapping, keep its UI adapter
and route registration consistent; do not leave local compatibility routes as
the only tested path.

Rules:

- Call Make Preset `/preset/v1/entity` with
  `X-Make-Target: MakeService.GetResource` or
  `X-Make-Target: MakeService.UpdateResource`.
- Inject `appKey` from normalized deployment config and `entityKey` from the
  validated route. Never accept `appKey` from UI input.
- Forward the current login/session context because Preset is scoped to the
  current user, App, and Entity.
- Normalize missing filter to `null`, missing sort to `[]`, and missing group to
  `[]`; do not leak the raw Make response envelope.
- PATCH is sparse. Send only dimensions present in the request and preserve
  sibling dimensions, including `group`. Do not implement client-side read-modify-write
  of the whole Preset.
- Verify upstream sparse merge semantics with an integration test that updates one
  dimension and proves existing sibling dimensions remain unchanged. If the
  upstream contract is not atomic, report the blocker instead of adding a racy
  read-modify-write fallback.
- Validate filter through `make-app-filter` semantics.
- Validate Preset sort and records sort with the same pure shape parser: at most
  five unique `{ fieldKey, order }` entries and only `asc | desc`.
- Before Make calls, resolve current runtime fields and require
  `field.capabilities?.sortable === true` for every sort field. Do not use a
  field-type allowlist.
- Validate Preset group and record-groups with the same strict shape parser: at
  most three unique `{ fieldKey, order }` entries and only `asc | desc`.
- Before Make calls, resolve current runtime fields and require
  `field.capabilities?.groupable === true` for every group field. Do not use a
  field-type allowlist and do not blanket-disable Lookup grouping in platform
  Service guidance.
- Treat Preset GET as a tolerant upstream boundary: sanitize invalid/stale stored
  sort/group entries to a safe response and log discard counts. Keep PATCH,
  records, and record-groups strict with 400 responses for invalid client input.
- Preset `group: []` means clear saved grouping. Data API `group: []` is invalid
  and must not be generated for ordinary records or grouped leaf records.
- Add route and adapter logs at entry, success, failure, and clear branches with
  safe entity/dimension/count context. Redact credentials and filter values.

Use `make-app-sort` for sort UI/model/records timing and `make-app-filter` for
advanced-filter package/hydration/save behavior. Use `make-app-group` for group
UI/model/group-data timing.

## Candidate routes

Default:

- `GET /api/make/app/users?keyword=&page=&size=` -> `{ users, total }`
- `GET /api/make/app/departments?keyword=&page=&size=` -> `{ departments, total }`

Rules:

- User items expose `userId`, `userName`, and optional `avatar`.
- Department items expose `departmentId`, `departmentName`, and optional hierarchy fields. Flatten nested trees when the selector expects flat options.
- UI should not provide sort controls for these candidate APIs by default. If the Make/backend adapter supports a stable sort internally, keep it in Service.
- Do not return fake demo candidates from Service unless the project is explicitly in demo/mock mode.

## Lookup option routes

Default:

- `GET /api/make/app/lookup-options?sourceEntityKey=&lookupFieldKey=&keyword=&page=&size=`
  - response: `{ options: [{ label, value }], total }`
  - `value` is the target record identity, usually `recordID`

Rules:

- Resolve target entity and display field from runtime schema relation metadata.
- Read only the target record identity and target display field by default.
- Read target records through the runtime-mode gateway scope: local preview `/api/make/data/v1/record`, published runtime `/make/data/v1/record` with forwarded login/session context. Do not use makecli command output as runtime data.
- `keyword` applies to the target display field when supported.
- Do not let UI call generic target-record list APIs for every lookup dropdown unless the host contract explicitly chooses that path.
- Reject non-lookup fields and unsupported relation directions with 400.

## Lookup relation updates

Generate lookup update routes only when the UI needs editable lookup relations and the Service can update safely.

Default optional routes:

- `PATCH /api/make/app/entities/:entityKey/records/:recordID/lookup-relations`
- `PATCH /api/make/app/entities/:entityKey/records/:recordID/lookup-relations/:lookupFieldKey`

Rules:

- Use an allowlist for editable lookup fields.
- Read the current record relation snapshot before update when Make replaces `qfei_relation` as a whole.
- Preserve unrelated relations in the submitted `qfei_relation`.
- Reject client-provided `qfei_relation`; Service alone synthesizes the complete relation snapshot.
- Validate the exact source identity, fail closed on malformed unrelated snapshot entries, and apply the current ordinary-field write allowlist to optional `data` in the same request.
- Reject unsupported cardinality, invisible or missing target fields/records, mismatched target identities, and non-allowlisted fields with 400.
- Backend `qfei_relation` items contain only `{ entityKey, id }`, not relationKey. If multiple independently writable relations from one source can target the same entity, do not guess which relation an item belongs to; reject the generic route unless the host API documents and tests an unambiguous backend mapping.

## File routes

Default:

- `POST /api/make/app/entities/:entityKey/records/:recordID/files/:fieldKey`
  - multipart field: `file`
- `DELETE /api/make/app/entities/:entityKey/records/:recordID/files/:fieldKey`
  - body: `{ fileName, filePath? }`
- `GET /api/make/app/files/download/*`
  - proxies backend file download stream

Rules:

- Upload requires a persisted `recordID`.
- Map Service route `:fieldKey` to the backend file field parameter expected by Make; do not blindly forward route param names when backend names differ.
- Normalize multipart filenames when the backend cannot handle non-ASCII filenames.
- Do not expose raw signed backend download URLs when a Service download proxy exists.
- Strip or redact signed query strings in logs.
- Attachment previews use the browser-facing `/api/make/app/files/download/*` proxy by default. Existing Apps may retain their documented equivalent download proxy; do not render raw Make Data paths such as `/data/v1/download/*`, `/make/data/v1/download/*`, or `/api/make/data/v1/download/*`.
- When the upstream Make download endpoint needs a bearer token, document that the Service validates the current App session before proxying the binary download with a Service-side token. If Make gateway returns a session-verification response, preserve its status, Content-Type, and body unchanged; only a verification transport failure with no response may use a documented Service-generated 5xx.
- `/api/config` and any UI-facing file metadata response must not expose Make download tokens.

## Custom orchestration routes

Custom routes such as OCR or generated artifact creation are allowed when the user asks for them.

Rules:

- Keep them thin and testable.
- Put multi-step orchestration in `services/`, not directly in route handlers.
- Return stable UI-facing records or result objects.
- Do not make custom routes a place for unrelated business rules unless the user explicitly requested those rules.


## 筛选表达式无损透传

记录 filter.expression 与 Entity Preset filter.expression 必须保留表达式原文及括号，不解析、扁平化、去括号或重写 CEL。对非空表达式不要 trim 后覆盖原值；只可用 trim 判断是否空白。测试 Preset PATCH → Make → GET 与记录查询 payload 的原文相等，包含双层条件组括号。编译错误不是空筛选，不应由 Service 兜底为全量查询；宿主先停止失败请求。筛选生成、回显、结构错误和版本门槛交接 make-app-filter 的 [无损回显合同](../../make-app-filter/references/roundtrip-and-errors.md)。filter 与 groupFilter 仍独立透传。
