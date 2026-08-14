# 可新建字段权限 Skill 变更记录

## 需求背景

Make App 字段权限新增“可新建”维度。该维度只在新建页面生效，并且与字段可见、可编辑相互独立。后端 Schema 新增 `createFields`，前端新建页面必须使用该集合；列表、详情和编辑仍使用 `fields`，当前不消费 `editableFields`。

## 本次变更

### make-app-permission

- 版本升级为 `0.2.0`，增加“字段可新建、`creatable`、`createFields`、`editableFields`”触发词。
- 明确三个独立集合：
  - 新建：`createFields ∩ data.record.create.fieldAccess(creatable|*)`；
  - 可见：`fields ∩ meta.field.read.fieldAccess`；
  - 可编辑：已可见字段再与 `meta.field.update.fieldAccess(editable|*)` 求交集。
- 明确 `createFields` 缺失时按空集合处理，禁止回退到 `fields`；当前编辑逻辑禁止消费 `editableFields`。
- 明确新建入口和提交由 `data.record.create` 控制，提交前必须重新计算可新建字段白名单并按白名单构造 payload。
- 明确 ID 和审计字段不可新建；审计字段保留原有可编辑能力。
- 补充仅可新建字段、全字段通配、通配基线加具名例外、Lookup 源/目标字段、权限与 Schema 同代刷新等规则。
- 扩展静态审计，检查 `createFields` 合同、可新建字段 helper、创建提交白名单、`editableFields` 误用和权限刷新后的 Schema 刷新。
- 静态审计新增“权限 helper 无条件返回 `true`”阻断；仅保真传输 `editableFields` 不再误报，只有把它用于新建/编辑字段推导才失败。
- 新增可执行行为一致性套件与宿主适配器合同，直接验证生产权限 helper 的缺失权限拒绝、通配、deny、三维独立和系统字段规则。
- 新增精确系统字段合同，统一 `Make.Field.ID`、`IDField` 及八个当前审计字段 key，禁止模糊字符串判断。
- 明确 `editable` 必须结合所在 `permissionKey` 解释：可编辑选择不自动授予可见；IAM 若在 `meta.field.read` 行返回 `editable`，该行仍表示可读。
- 明确“通配字段 + 具名 hidden”必须处于同一 allow 字段范围；禁止把 field-only hidden 例外拆成 `effect: deny`，以免 operation deny-wins 关闭整个操作。
- 明确权限与 Schema 刷新采用 fail-closed 两阶段提交：新权限在新 Schema 成功前不得发布，刷新失败不得恢复可能已撤销的旧代次。

### make-app-service

- 版本升级为 `0.1.5`。
- 明确 Service 只负责独立、无损地规范化和传输 `fields` / `createFields`，不复制权限计算逻辑。
- 明确 `createFields` 缺失时返回空集合，禁止回退到 `fields`；`editableFields` 可保留但不作为当前编辑字段来源。
- 明确权限裁剪后的 Schema 缓存必须按租户、主体/会话、App 和访问代次隔离，并提供刷新失效路径。
- 补充 create-only Lookup 源字段与可见目标字段的边界和测试要求。

### makeui

- 版本升级为 `0.3.54`。
- 明确 MakeUI 只消费 Permission 层提供的模式化字段集合：新建使用授权后的 `createFields`，编辑使用可见字段和可编辑子集。
- 必填校验只对当前模式实际渲染且已授权的字段生效。
- 新建操作允许但无可新建字段时，展示“暂无可新建字段”空状态并禁用提交，禁止从可见/可编辑字段补齐。

### 仓库入口与验证

- README 增加“字段可新建 / `createFields`”路由和三 Skill 协作说明。
- 新增跨 Skill 静态合同测试 `scripts/test-make-app-creatable-permission-contract.mjs`。
- 扩展 `make-app-permission` 审计负向夹具，覆盖缺失 `createFields`、错误 fallback、缺少 create helper、误用 `editableFields`、未过滤创建 payload、仅刷新权限未刷新 Schema。

## 关键安全边界

- Schema 集合是结构上限，IAM 权限是授权上限，两者必须求交集。
- 仅勾选“可新建”的字段可以出现在新建页，但不会因此出现在列表、详情或编辑页。
- 新建入口不能依赖可新建字段数量；即使没有可新建字段，入口仍按操作权限决定，页面负责展示授权空状态。
- 前端隐藏字段不是提交权限。提交 handler 必须使用最新可新建字段白名单重建 payload，以抵御陈旧表单状态和 DevTools 注入。
- 权限刷新后必须同步刷新或失效权限裁剪后的 Schema，避免旧的 `createFields` 继续生效。

## 验证结果

- 跨 Skill 可新建权限合同测试通过。
- `make-app-permission` 正负审计夹具通过。
- 可执行权限行为一致性套件的正例、无条件放行负例和缺失适配器负例通过。
- `make-app-permission`、`make-app-service`、`makeui` 已通过仓库 metadata lint；另在一次性临时虚拟环境安装 `PyYAML` 后，三个 Skill 均通过官方 `quick_validate.py`，未污染项目或全局 Python 依赖。
- Skill metadata、仓库通用性、MakeUI 既有合同和 `git diff --check` 通过。
- `review-skills` 对主权限 Skill 及两个关联 Skill 的复核无 Critical、Major；唯一 Minor 为“文档同时存在必须/禁止措辞”的机械提示，人工核对后分别约束正确门禁与错误实现，不构成语义冲突。
- 源码与 `~/.agents/skills` 安装副本的本次相关文件已同步并比对一致。

真实 `expensePoc` 已补齐“权限 → Schema → 数据”刷新顺序以及权限/Schema generation 防旧响应覆盖，并通过 Skill 静态审计与可执行行为一致性套件。

已完成五个 `fork_turns: none` 的 fresh-agent 场景并记录到 `docs/make-app-permission-forward-test.md`。场景覆盖仅可新建、旧 Schema 迁移、通配/deny、系统与复杂字段、权限/Schema 刷新；其中两个场景发现并推动修复了 hidden 例外与两阶段原子刷新的歧义。

## 2026-08-13 提交前审查问题修复

- 修复静态审计误报：允许在 Schema 边界保留、复制或规范化 `editableFields`，只有该集合实际流入新建/编辑表单字段推导或权限 helper 时才报 `editable_fields_consumed_by_runtime`。
- 将可执行权限一致性套件从 12 项扩展到 23 项，新增 `*.*.*`、合法三段 permissionKey 通配、实体/父级/全局 resource、带 `fieldAccess` 的 operation deny、同具体度 allow 并集、canonical/namespace 别名同具体度、跨行具名 hidden 覆盖通配、相似业务字段 key、审计字段更新能力和畸形 `fieldAccess` 失败关闭。
- 为新增矩阵增加反例适配器，确保缺少全局通配、只读取第一条同级 allow、模糊匹配审计字段和误伤审计字段编辑能力都会失败。
- 统一实施规划文档：`editable` 只授予更新维度且不自动授予可见；匹配的 `effect: deny` 拒绝整个操作，字段级排除必须使用同一 allow `fieldAccess` 中的具名 `hidden`。
- 增强后的套件发现并推动修复 `expensePoc` 的真实 deny 字段判定、canonical/namespace 资源评分、跨行具名例外和畸形 `fieldAccess` 扩权问题；`bizFinancePoc` 同步修复，并补齐 create-only 实体导航、提交时按最新权限/Schema 重建白名单、权限与 Schema 两阶段刷新、旧 Schema 响应隔离，以及 Service 精确系统字段判断。两套参考项目最终均以 23 项一致性套件和权限静态审计验收。

## 2026-08-13 最终收敛

- 版本升级为 `0.2.1`：将 IAM 多状态数组保真规则提升到主 Skill 必读合同，避免安装副本和工作区源文件出现同版本不同语义。
- 一致性套件扩展到 40 项，新增显式 `null`、未知/空/混合字段访问态、合法字符串状态数组、空字段 key、非法 effect、非三段 permissionKey、任意 namespace、通配 tenant/App、缺失/非法 App scope、具名实体隔离、畸形 envelope/row、非法请求实体/字段标识、实体通配相对 App 的资源具体度、同层具名 hidden 与具名/空范围 allow 冲突，以及 `appResource` 试图覆盖或以显式非法值冒充缺省等对抗场景。
- 静态审计只消费生产源文件，排除 test/spec/stories/mock/fixture；支持扫描 workspace `permission-runtime` 包，同时保留“必须存在真实 UI 根”的检查，避免测试文本或共享包制造假阳性。
- 宿主前向哈希改为覆盖 `make-app-permission`、`make-app-service`、`makeui` 三个关联 Skill，实施计划退出测试真值链；588 行重复规划压缩为历史决策索引，消除双份规范。
- 畸形权限行会使整个访问快照失败关闭，禁止静默丢弃坏行后继续接受同 envelope 的 allow；两种 ID 类型通过独立 edit-capability guard 同时排除编辑表单、单元格编辑和 update payload，审计字段仍保留合法编辑能力。
- 两套 POC 均通过 40 项生产 helper 一致性套件和静态审计；最终独立前向测试完成后再写入当前组合哈希，禁止先更新哈希再复用旧结论。
- 独立前向测试发现资源具体度和调用入参合同仍有歧义，现已固定为 `* < App < entity/* < entity/exact`，并明确 `null`、数字、数组、对象、空白与 `*` 均不是合法请求实体/字段标识；一致性套件对这些恶意入参逐一失败关闭。
- 独立前向测试还发现 File 与 Lookup/Relation 的宿主能力边界不够可实施：现已固定 `Make.Field.File` 的“仅已有记录上传”和“显式预上传附件数组”两种模式判定，并明确 `Make.Field.Lookup` 的候选请求、创建态 `qfei_relation` 合成、编辑态 `lookup-relations` 全快照更新及普通/关系 payload 分拆合同。
- 同一资源具体度的具名字段规则发生冲突时，`hidden` 固定优先于任何授权态，但不把 allow 行升级为操作级 deny；两套生产权限运行时已统一该行为。
- 最终复审继续收紧 Lookup 写边界：Service 必须验证源/目标记录精确身份、目标展示字段可见性、可选普通字段白名单及未修改快照完整性。`qfei_relation` 不携带 relationKey；若同一源对象的多个独立可写关系指向同一目标实体，通用路由不得猜测归属，必须有宿主/后端明确可区分合同，否则失败关闭。

## 2026-08-14 数组静态审计与持续门禁修复

- `make-app-permission` 升级到 `0.2.2`。静态审计新增 `field_access_state_stringified` 阻断，定向识别权限字段访问态经 `String(...)`、文本 helper、模板插值、`.toString()` 或 `.join()` 被压平成单字符串的实现。
- 审计正例改为实际读取并保留 `fieldAccess` 状态数组；负向夹具覆盖直接字符串化、文本 helper 和模板字符串，另保留 scope、permissionKey、fieldKey 等正常字符串规范化的防误报用例。
- 明确静态审计只能拦截已知坏形态，可执行 40 项一致性套件仍是权限语义真值；一次性跨项目验收记录不再视为持续门禁。
- 要求宿主默认测试、CI 或发布校验持续调用静态审计和生产 adapter 一致性套件。宿主应保存本地 runner 或使用版本化构建依赖，禁止在可移植 CI 中硬编码其他工作区或 `~/.agents/skills` 路径。
- `expensePoc` 新增项目本地审计/一致性 runner 和默认测试门禁；`bizFinancePoc` 将原 12 项项目 runner 替换为当前 40 项合同，并由宿主合同测试锁定数组专项规则。
- `make-app-actions` 的组合前向哈希因覆盖权限 Skill 全目录而同步变化；记录保留原 Action 语义基线哈希，并明确本次只由确定性权限门禁验证，禁止把旧 fresh-agent 结果表述为对新审计脚本的重新执行。
- 新增目录级安装副本同步检查器及自测试，自动识别源码独有、安装副本独有和同路径内容不一致；它只用于显式路径的本地安装/发布校验，不把开发者主目录引入宿主 CI。
- 修复命名权限规范化 helper 的诊断字符串化误报：只有字符串化结果进入规范化返回值或权限分支时才阻断，单纯 `console`/日志诊断不再导致宿主门禁失败。
- 补充 `.toString()`、`.join()`、间接规范化返回值、多行返回值、箭头函数对象返回值和诊断日志防误报夹具，确保收紧误报时不削弱已声明的数组压平拦截范围。
- 修复无分号代码的 ASI 边界误判：提前 `return []` 后的诊断 `String(value)` 不再被归入上一条返回表达式；审计通过屏蔽字符串/注释、跟踪分组层级和识别顶层跨行续写来确定返回值影响范围。
- 新增“无分号提前返回 + 诊断日志”正向夹具及 `return value ||\n String(value)` 运算符续行负向夹具，确保消除误报的同时继续阻断实际参与返回值的数组字符串化。
- 修复后通过仓库 21 个测试入口、官方 Skill 校验、安装副本 14 文件全量同步比对、两项跨 Skill 合同；`expensePoc` 通过 169 项 Service 测试、569 项 UI 测试、2 项门禁合同、40 项权限一致性、审计和构建，`bizFinancePoc` 通过 344 项测试、40 项权限一致性、审计、构建和发布产物校验。
- 修复显式 `fieldAccessValue` 诊断误报：直接字段访问态模式现在先屏蔽注释与字符串字面量，并通过未闭合调用分组识别普通及结构化日志参数，不再把纯诊断文本当成权限结果。
- 修复直接权限分支漏检：`String(value)`、文本 helper、模板插值、`.toString()` 或 `.join()` 位于 `if`、`switch`、`while`、`for` 条件时会被识别为影响权限控制流并阻断。
- 新增显式参数日志、结构化日志、注释、字符串字面量四类正向夹具，以及直接 `if (String(value))` 负向夹具；模板插值、返回值、赋值回流和运算符续行的既有负例继续通过。
- 本轮最终验证通过仓库 21 个测试入口、官方 Skill 校验、安装副本 14 文件全量同步比对、两项跨 Skill 合同；`expensePoc` 通过 163 项 Service 测试、572 项 UI 测试、2 项门禁合同、40 项权限一致性、审计和构建，`bizFinancePoc` 通过 345 项测试、40 项权限一致性、审计、构建和发布产物校验；当前工作区版审计与一致性脚本也分别直连两个生产 adapter 通过。
