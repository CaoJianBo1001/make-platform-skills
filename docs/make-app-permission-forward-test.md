# Make App Permission 前向测试记录

## 执行信息

- 执行日期：2026-08-14
- Skill 内容 SHA-256：`aaf4410797e5104b8348c65b0cd085168458d94415b86a4b53362968de9aef52`
- 语义前向测试基线 SHA-256：`7f59d274bee3f60a224f0c438ef12d72cffb1182d3f4a9111906bdda9f1c47d2`
- 哈希算法：`qfei-forward-test-scope-v1` 长度前缀编码
- 哈希范围：`skills/make-app-permission`、`skills/make-app-service`、`skills/makeui` 三个目录的全部文件
- 执行批次：`2026-08-13-make-app-permission-0.2.1-r10`
- 执行方式：5 个场景均使用 `fork_turns: none` 创建、不继承父会话历史且彼此不共享上下文的 fresh Agent；只允许读取主 Skill 及其明确引用的必要资料。
- 输出限制：只输出实现方案、审查清单和测试计划，不修改仓库文件。
- 提示控制：提示词按真实用户任务描述，不提供验收答案或已知缺陷。
- 总体结果：5 个场景在 `0.2.1` 语义基线上全部通过；代理独立推导，未复用历史场景输出。`0.2.2` 未改变权限语义，只增加确定性的静态审计和宿主持续门禁，因此不把旧 fresh-agent 结果伪装成对新脚本实现的重新执行。

## 0.2.2 审计与门禁验证

- 修订范围：新增复合 `fieldAccess` 数组字符串化静态阻断、负向/防误报夹具、宿主自动门禁和本地安装副本同步检查，不修改创建、读取、更新、资源匹配或系统字段语义。
- 验证方式：先运行失败夹具证明旧审计漏检，再实现最小规则；随后运行审计自测、40 项一致性套件、两个真实 POC 的生产 adapter、默认/发布门禁及完整测试构建。
- 证据边界：上方当前哈希用于锁定本次确定性验证内容；五个 fresh-agent 场景只证明其明确标注的 `0.2.1` 语义基线。

## 2026-08-14 Action Service 适配边界说明

- 当前组合哈希变化来自 `make-app-service` 对 `record-write-permission` 端点的响应适配：显式 Action 拒绝解析 `20000032` 和无损 Record ID，全选 Action 拒绝保留 403 无 ID。
- 本次没有修改 `make-app-permission` 的 principal 路由、App/实体/字段权限匹配、`fields/createFields`、刷新代次或 makeui 新建/编辑权限语义，因此不重新执行下方五个权限语义场景。
- 上方哈希锁定当前三个 Skill 目录；下方 fresh-agent 输出仍只证明 `0.2.1` 语义基线，本说明不把 Action 适配器的确定性合同测试冒充为权限 fresh-agent 重新执行。

## 场景一：仅可新建不可见字段

提示词：`在新的 Service-fronted Make App 中，实现某字段仅可新建、不可见、不可编辑，但仍能在新建页展示并安全提交。`

执行方式：fresh-agent

执行批次：2026-08-13-make-app-permission-0.2.1-r10

执行标识：/root/permission_r10_create_only

输出证据：Agent 正确给出 `createFields ∩ data.record.create.fieldAccess(creatable|*) ∩ supportsCreateInput`，明确 create-only 字段不依赖可见/可编辑集合；入口仅由实体 create 控制，提交前基于最新 access generation 和 `createFields` 重算 allowlist，过滤 DevTools 注入、旧状态和撤权字段，并保持 Service 当前身份最终授权。

结论：通过。

## 场景二：旧 fields 新建页迁移

提示词：`旧 Make App 的新建页一直使用 fields，改造为 createFields 并保持编辑页既有规则。`

执行方式：fresh-agent

执行批次：2026-08-13-make-app-permission-0.2.1-r10

执行标识：/root/permission_r10_legacy

输出证据：Agent 明确 `createFields` 缺失/null/非法均为 `[]` 且禁止回退；Service/共享类型/UI 独立传输字段集合；编辑继续 `fields → meta.field.read → meta.field.update → isEditCapableField`，不消费 `editableFields`。它还正确区分创建的 ID/八个审计键排除与编辑的 ID 排除，给出 Lookup 的 `{ data, relations }` 边界、提交前重算和失败关闭测试。

结论：通过。

## 场景三：通配、具体度与 deny

提示词：`审查 App allow、实体具名范围、字段通配、具名 hidden 例外和 IAM namespace 通配资源。`

执行方式：fresh-agent

执行批次：2026-08-13-make-app-permission-0.2.1-r10

执行标识：/root/permission_r10_wildcard

输出证据：Agent 正确推导固定资源具体度 `* < App < entity/* < entity/exact`、canonical/namespace alias 同层合并、任意匹配 deny 优先，以及同层具名 hidden 覆盖具名、通配和空范围基线但不否决整个操作。它还明确畸形 permission row 污染整个快照、请求实体/字段 `*` 必须拒绝，并给出三维字段状态的表驱动测试。

结论：通过。

## 场景四：系统与复杂字段

提示词：`审查 required、ID、审计、File、Lookup/Relation 和仅可新建字段的展示、校验、payload 与编辑兼容。`

执行方式：fresh-agent

执行批次：2026-08-13-make-app-permission-0.2.1-r10

执行标识：/root/permission_r10_special_fresh

输出证据：Agent 正确区分普通、File、Lookup 的 create/edit 能力；默认 persisted-only File 不进入新建，direct-create 必须有明确预上传合同；Lookup options 的目标展示字段只来自 visible fields，客户端必须分离普通 `data` 与 `relations/values`，严禁 raw `qfei_relation`。它还准确识别两个可写 Lookup 指向同一目标实体且关系项无 `relationKey` 时无法归属，要求 UI 禁写、Service 拒绝整个请求且不得部分写入。

结论：通过。

## 场景五：权限与 Schema 刷新代次

提示词：`页面内刷新权限后 createFields/fields 变化，需要新增授权立即出现、撤权立即失效并阻止旧响应回写。`

执行方式：fresh-agent

执行批次：2026-08-13-make-app-permission-0.2.1-r10

执行标识：/root/permission_r10_refresh

输出证据：Agent 给出 `idle/ready → refreshing(deny-all) → ready/denied` 状态机：permission 与 Schema 同代成功后用单次 transaction 原子发布，AbortController 仅节省资源，所有回写仍校验 generation、principal/tenant/App、surface instance 与请求序号；权限或 Schema 失败均不恢复旧代。撤销 read 但保留 create 时停止记录读取并按新 `createFields` 重建新建面，撤权字段同时清理控件、值、校验、关系 payload 和候选结果。

结论：通过。
