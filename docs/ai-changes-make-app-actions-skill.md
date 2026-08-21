# Make App 操作按钮 Skill

## 2026-08-08

### 变更内容

- 新增 `make-app-actions` Skill，并将其设为 Make CanvasTable 可写记录列表的默认能力。
- 规定统一使用 `@qfei-design/make-app-actions@^0.2.1`，按 `package.ai.json.readOrder` 读取发布包公开文档，禁止宿主重复实现操作模型和批量弹窗。
- 固化单条编辑、单条删除和批量编辑的独立权限点，principal 权限使用有边界的缓存生命周期。
- 固化 Canvas 明确选择与表头全选语义、显式/排除 ID 上限、查询条件变化清空选择和不可变操作快照。
- 固化编辑前行级写权限预检和批量更新的 UI-Service/Make 请求合同，禁止逐 ID 诊断和循环单条更新。
- 固化批量编辑字段权限、字段类型控件、清空值、提交锁、旧请求失效和新选择保护规则。
- 更新根 README、`canvas-table-integration`、`make-app-permission` 和 `make-app-service` 的路由与职责交接。

### 测试策略

- 先新增 `scripts/test-make-app-actions-contract.mjs`，确认 Skill 缺失时测试失败。
- 实现过程中逐项让包、权限、选择、Service、批量弹窗和跨 Skill 路由断言通过。
- 完成后运行专用契约测试、元数据校验、Skill Creator 快速校验、相关 Skill 回归和 diff 格式检查。
- 独立前向测试使用新 Skill 审查现有 PoC，并据此补充“无可批量编辑字段时隐藏入口”和“分组选择只订阅一次标准事件”两条回归契约。

### 权限审计误报修复

- `make-app-permission` 明确区分创建/单条编辑入口与批量编辑入口：创建和单条编辑不得依赖可编辑字段数量，批量编辑则由 `make-app-actions` 在无可批量编辑字段时隐藏。
- 权限审计不再使用跨越相邻代码的关键词距离判断，改为只识别同一布尔门禁中创建/单条编辑权限与可编辑字段数量的直接耦合。
- 新增合法批量编辑门禁回归用例，同时保留非法单条编辑门禁必须失败的既有用例。

### 权限审计误报修复验证

- `node skills/make-app-permission/scripts/test-audit-make-app-permission.mjs`：通过。
- `node scripts/test-make-app-actions-contract.mjs`：通过。
- 新版 `audit-make-app-permission.mjs` 审计参考应用：`PASS`。
- `node scripts/lint-skill-metadata.mjs`：14 个 Skill 入口、89 个 Markdown 文件通过。
- Skill Creator `quick_validate.py skills/make-app-permission`：通过。
- `node scripts/test-platform-skill-genericity-contract.mjs`：通过。
- `git diff --check`：通过。

### 提交前复审修复

- 最低包版本调整为 `0.2.1`，排除仍包含旧 principal 刷新和逐条批量执行说明的 `0.2.0` 文档。
- `make-app-service` 描述精简到标准 1024 字符限制以内，并由仓库 metadata lint 固化该上限。
- 权限审计补齐括号、`Boolean(...)`、字段条件前置以及创建入口的可编辑字段数量耦合识别，同时继续允许批量编辑字段可用性判断。

### 提交前复审修复验证

- `node scripts/test-make-app-actions-contract.mjs`：通过。
- `node skills/make-app-permission/scripts/test-audit-make-app-permission.mjs`：通过。
- `node scripts/test-skill-metadata-lint.mjs`：1024/1025 字符边界通过。
- `node scripts/lint-skill-metadata.mjs`：14 个 Skill 入口、89 个 Markdown 文件通过。
- 仓库级 `scripts/test-*.mjs` 全部通过。
- Skill Creator `quick_validate.py`：`make-app-actions`、`canvas-table-integration`、`make-app-permission`、`make-app-service` 全部通过。
- 新版权限审计检查参考应用：`PASS`。
- `review_skill.mjs`：无 Critical/Major；通用强约束词提示经人工确认不存在同一行为矛盾。
- `git diff --check`：通过。

## 2026-08-09

### 二次提交前复审修复

- 同步修正 `canvas-table-integration` 与 `makeui` 的旧规则：可写 Make 记录列表默认启用选择，标准操作栏位于表格视口底部居中，详情 Drawer 不重复展示编辑/删除。
- 增加 UI 组件库兼容分支：Ant Design 宿主使用包适配器，Arco、shadcn/ui 等非 AntD 宿主不得混入 AntD 或复制批量弹窗；缺少公开适配器时按交付阻断处理。
- 规定全选目标必须使用最后一次成功列表查询的统一 `effectiveFilter`，其中包含搜索、状态和快捷筛选等全部成员范围条件，并由列表、预检和批量写入复用。
- 调整权限拒绝反馈：只有拿到准确无权限行 ID 时才标红；后端仅返回布尔拒绝时只显示 toast，不再将全部显式选择行误标为无权限。
- 记录 CanvasTable 1.3.0 的分组边界：`GroupTableComponent` 不支持 Shift 区间选择，宿主不得自行模拟。
- 增加固定的新 Agent 前向测试场景，覆盖 AntD、非 AntD、搜索后全选、分组 Shift 和无准确 ID 的权限拒绝。
- 同步更新 `make-app-group` 对默认选择操作和分组 Shift 限制的交接说明。
- 明确 Skill 的 `0.2.1+` 最低版本优先于已发布包中可能缓存的旧 `0.2.0` 安装示例，禁止降级。

### 测试策略

- 先扩展 `scripts/test-make-app-actions-contract.mjs`，确认组件库分支等新增约束在旧文档下失败。
- 最小修改 Skill 与关联 references 后，使操作按钮契约测试恢复通过。
- 完成后运行仓库全部契约测试、元数据校验、Skill Creator 校验、机械复审和差异格式检查。

### 验证结果

- 仓库级 `scripts/test-*.mjs` 全部通过。
- `node skills/make-app-permission/scripts/test-audit-make-app-permission.mjs`：通过。
- `node scripts/lint-skill-metadata.mjs`：14 个 Skill 入口、89 个 Markdown 文件通过。
- Skill Creator `quick_validate.py`：`make-app-actions`、`canvas-table-integration`、`make-app-permission`、`make-app-service`、`makeui`、`make-app-group` 全部通过。
- `review_skill.mjs`：无 Critical/Major；剩余通用强约束词提示经人工复核，不是同一行为冲突。
- `git diff --check`：通过。

## 2026-08-10

### 新 Agent 前向测试补齐

- 使用 5 个互相独立且不继承当前会话历史的新 Agent，分别执行 AntD 默认操作、搜索后表头全选、Arco 批量编辑、分组表 Shift 和 403 无准确 ID 场景。
- 执行时只提供仓库位置与原始需求，不提供验收标准；Agent 只输出实施方案、关键调用链和验证计划，不修改文件。
- 5 个场景全部通过，未发现需要调整 Skill 规则的新问题。
- 新增 `docs/make-app-actions-forward-test.md`，记录提示词、验收标准、关键输出证据和逐项结论。
- 扩展 `scripts/test-make-app-actions-contract.mjs`，要求前向测试记录包含执行日期、独立 Agent 方法和 5 个通过结论，防止发布前验证记录再次缺失。

### 验证策略

- 先增加前向测试记录契约并运行，确认记录缺失时测试失败。
- 写入真实评估结果后重新运行操作按钮契约测试、仓库全部契约测试、元数据校验、Skill Creator 快速校验、机械复审和差异格式检查。

### 前向测试与权限审计校验修复

- 前向测试记录改为按二级标题隔离场景，逐场景检查必要证据和明确的“结论：通过”，避免失败场景误用后续章节的通过结论。
- 前向测试记录增加 `make-app-actions` Skill 全目录内容哈希，契约测试会与当前内容比较，防止 Skill 变化后继续复用历史验证结果。
- 权限审计的单条编辑入口识别收窄到记录级权限变量，不再将 `canEditCell`、`canEditEntityField` 等字段或单元格权限误判为记录编辑入口。
- 增加跨场景失败、场景缺失、Skill 内容变化、字段编辑和单元格编辑等负向或合法反例测试，同时保留非法记录编辑入口门禁测试。

### 二次复审校验修复

- 前向测试记录解析器改为提取结构化的 `输出证据` 字段，证据关键词只允许在该字段内匹配；提示词和验收标准不能替代 Agent 输出证据。
- 权限审计改为在记录级 JSX 操作入口或 action 对象内识别字段数量耦合，支持多行表达式和任意记录 handler 命名，并排除明确的 `Cell`/`Field` 权限变量。
- 补充 `canUpdate`、`canEdit`、action 对象等非法记录入口测试，以及 `canCreateCell` 和字段组件 `onEdit` 合法反例测试。

### 三次复审校验修复

- 权限审计只分类实际参与“操作权限与可编辑字段数量”门禁的权限变量，其他无关 `Cell`/`Field` 条件不再屏蔽真实违规。
- action 对象提取改用忽略字符串和注释的平衡花括号扫描，嵌套 `meta`、`style` 等配置不再导致外层记录操作漏检。
- 前向测试范围读取统一使用原始 `Buffer`，确保不同二进制资产字节产生不同的 Skill 内容哈希。
- 增加混合记录/单元格权限条件、嵌套 action 对象和二进制资产哈希回归测试。

### 四次复审校验修复

- 权限审计的平衡花括号扫描改为输出各 block 的直接层级文本，子对象内容会被屏蔽；嵌套 action 仍可识别，函数体内的兄弟对象不再串联属性产生误报。
- Skill 范围哈希升级为 `qfei-forward-test-scope-v1` 长度前缀编码，文件数量、路径长度和内容长度均参与哈希，消除 NUL 分隔导致的目录结构碰撞。
- 增加独立 action/字段对象合法反例和一文件/两文件结构碰撞回归测试，并按新算法更新同一份已验证 Skill 内容的记录哈希。

### `make-app-actions@0.3.0` 契约同步

- 将 Skill 最低依赖版本从 `^0.2.1` 升级到 `^0.3.0`，并同步更新根 README 和包接入参考。
- 根据发布包公开契约移除“非 AntD 宿主缺少批量弹窗适配器时阻断交付”的旧规则。
- Ant Design 宿主继续使用 `AntdRecordSelectionActionBar` 和 `AntdRecordBatchEditModal`；其他 React 设计系统改用通用 `RecordSelectionActionBar` 和 `RecordBatchEditModal`。
- 固化 `MakeAppBatchEditComponents` 注入边界：宿主提供 `Modal`、`FieldSelect`、`ModeControl` 和 `renderValueControl` 字段控件，包继续拥有弹窗状态、校验、安全错误和防重复提交。
- 更新 Arco 前向测试验收标准与证据，并在 Skill 修正后使用不继承当前会话历史的新 Agent 重跑；Agent 能正确给出通用组件注入、双参数字段控件和受控属性转发方案。
- 前向测试记录增加场景级 `执行方式`，契约解析器要求每个场景的值精确等于 `fresh-agent`；静态契约复核或未来补跑说明不能再满足当前发布验证。
- 为当前 Skill 内容重新执行全部 5 个独立 Agent 场景，并给每个场景记录同一执行批次；当前发布验证不再接受此前场景结果。
- 前向测试解析器增加场景级 `执行批次` 精确匹配，防止 Skill 内容哈希更新后只重跑部分场景却继续复用历史结果。

### 验证结果

- 先更新 `scripts/test-make-app-actions-contract.mjs`，确认旧最低版本和旧非 AntD 阻断说明会导致测试失败。
- 新增前向测试执行方式负例，确认 `static-contract` 不能冒充 `fresh-agent` 通过。
- 增加“静态复核并声明发布前补跑”的欺骗性负例，确认字段中仅出现 `fresh-agent` 文本也无法绕过精确校验。
- 新增过期执行批次负例，确认历史批次不能满足当前发布门禁；当前记录中的 5 个场景均要求匹配 `2026-08-10-make-app-actions-0.3.0-r2`。
- 操作按钮契约拒绝任何声明复用此前执行结果的当前范围记录。
- 仓库级 `scripts/test-*.mjs` 全部通过。
- `node scripts/lint-skill-metadata.mjs`：14 个 Skill 入口、89 个 Markdown 文件通过。
- Skill Creator `quick_validate.py skills/make-app-actions`：通过。
- `review_skill.mjs`：无 Critical/Major；一项通用强约束词提示经人工复核，不存在同一行为冲突。
- `git diff --check`：通过。

## 批量编辑弹层与术语契约补强

### 问题背景

宿主在通用批量编辑弹窗中注入了下拉和日期控件，但 Skill 只约束字段类型与受控值，没有约束 popup 的挂载容器。弹窗面板或 body 使用 `overflow` 时，下拉层因此可能被裁剪。与此同时，操作入口与弹窗默认标题存在“批量编辑 / 批量修改”混用。

### 变更内容

- `make-app-actions` revision 更新为 `0.1.3`，将默认标题固定为“批量编辑”。
- 要求 `FieldSelect` 及 Select、DatePicker、DateRangePicker、人员、部门、Lookup 等弹层控件统一挂载到裁剪祖先之外，并位于所属弹窗之上。
- 明确仅提高裁剪祖先内部 popup 的 z-index 无法解决 `overflow` 裁剪。
- UI 测试矩阵增加 popup DOM 挂载位置断言与浏览器可见性验证。
- `makeui` revision 更新为 `0.3.51`，补充 Modal、Drawer 和滚动区域内通用弹层的 portal、层叠上下文与边界验收规则。

### 测试策略

- 先扩展 `scripts/test-make-app-actions-contract.mjs`，确认旧 Skill 因缺少标题、popup 挂载和视觉验收规则而失败。
- 更新 Skill 后执行静态契约、元数据检查和 Skill Creator 校验。
- 此项实现完成时尚未授权启动独立子代理，因此未伪造 fresh-agent 结果；范围哈希门禁按预期阻止该版本使用旧验证记录。
- 当时新增标题、popup 挂载及浏览器验收断言均已通过，`test-make-app-actions-contract.mjs` 在 forward-test scope hash 门禁处按预期失败。
- `quick_validate.py` 对 `make-app-actions`、`makeui` 均通过；metadata lint、makeui 合同测试、其余仓库级 `scripts/test-*.mjs` 与 `git diff --check` 均通过。

### 后续前向验证补齐

- 获得授权后，使用执行批次 `2026-08-10-make-app-actions-0.3.0-r2` 对当前 Skill 内容重新执行全部 5 个独立 Agent 场景。
- 当前 Skill 内容哈希 `1157c756f19aebd9ecbf6a93590dfc1558f0ca1cd97a7fe6e1e3e282221584d0` 下，5 个场景全部通过，`test-make-app-actions-contract.mjs` 的范围哈希和执行批次门禁均已恢复通过。

## `make-app-actions@0.3.1` 版本同步

- npm `latest` 已确认是 `0.3.1`，Skill 最低依赖与根 README 从 `^0.3.0` 更新为 `^0.3.1`。
- `package-integration.md` 将低于 `0.3.1` 的安装示例视为过期，明确不得因缓存的 `0.3.0` manifest 降级。
- `make-app-actions` Skill revision 更新为 `0.1.4`，契约测试要求新的 `0.3.1` 最低版本和前向测试批次。
- `quick_validate.py`、metadata lint、除前向门禁外的仓库级合同测试与 `git diff --check` 均通过；版本断言已通过，主合同测试按设计在新的 Skill scope hash 处阻止复用 `0.3.0` 的旧前向测试记录。

## `make-app-actions@0.3.1` 全链路契约收口

### 问题背景

此前修复按单次 review finding 局部推进，没有在每次规范变化后同时重新核对已发布 npm 产物、Skill 主流程、关联 Skill、负向门禁和独立 Agent 场景，导致后续复审仍能发现跨文件不一致。本轮将这些边界作为同一验收链处理，不再用旧范围的前向结果证明新 Skill。

### 变更内容

- 直接核对 `make-app-actions@0.3.1` 发布产物和本地公开类型，确认通用 `RecordBatchEditModal`、`MakeAppBatchEditComponents`、AntD 双参数回调、默认“批量编辑”标题和提交锁契约。
- 顶层工作流改为先读取安装包 `package.json` 并验证实际解析版本满足 `^0.3.1`，再读取 `package.ai.json.readOrder`；发布包 manifest 中仍为 `0.3.0` 的版本与安装示例只作为过期字段忽略，不能触发降级。
- AntD 字段回调只要求转发 `control.disabled`；通用弹窗字段回调要求完整转发 `value`、`onChange`、`disabled`、`invalid`、`ariaDescribedBy`，不再混淆两个公开契约。
- 非 AntD 宿主统一使用包公开的通用弹窗和宿主组件注入。浮层规则改为设计系统中立：读取已安装组件库的公开 portal/overlay API，不把 AntD 的 `getPopupContainer` 写成统一接口。
- UI 验收同时覆盖 DOM 挂载、裁剪、层叠上下文、焦点、键盘导航、Escape 关闭顺序、外部点击和焦点回归；新增 shadcn/ui 与 Radix 独立场景，避免只用 Arco 代表所有非 AntD 组件库。
- 前向测试记录增加场景级真实执行标识并要求互不重复；重复字段、非法标识、历史批次和静态检查冒充 fresh-agent 均由负向测试拒绝。
- 首轮六场景验证中，shadcn/Radix Agent 仍被过期 manifest 引导到 `^0.3.0`，且没有明确 outside-click；该轮结果判定失败并全部作废，没有写入通过记录。
- 将版本权威规则提升到顶层不可违反约束：安装包 `package.json` 是唯一版本依据，当前发布的 `0.3.1` manifest 已知仍含 `0.3.0` 过期字段；shadcn/Radix 场景同步要求明确验证版本、读取顺序和关闭语义。
- `make-app-actions` revision 更新为 `0.1.6`，`makeui` revision 更新为 `0.3.52`，根 README 同步 `0.3.1` 与组件库中立规则。

### TDD 与验证策略

- 先增加“顶层工作流必须先核验 `package.json` 再读取 AI manifest”的断言，确认旧文档失败后再修改 Skill。
- 扩展前向记录解析器测试，覆盖执行方式、执行批次、执行标识、跨场景唯一性和重复字段拒绝。
- 固定最终 Skill 内容后，使用六个互不继承上下文的新 Agent 分别验证 AntD、搜索后表头全选、Arco、分组 Shift、无准确 ID 的 403、shadcn/Radix 场景；执行标识和最终范围哈希写入前向记录。
- 最后统一执行仓库全部合同测试、metadata lint、Skill Creator 校验、关联 Skill 机械审计、共享模块复审和 `git diff --check`。

### 最终验证结果

- 最终 Skill 内容哈希为 `f8eade5ab86bd30571002a3b58a68828295834468cbabdb5c8ee7182245e625f`，执行批次为 `2026-08-10-make-app-actions-0.3.1-r2`；六个场景使用六个不同的真实 Agent 执行标识并全部通过。
- 仓库全部 `scripts/test-*.mjs`、metadata lint、`make-app-actions` 与 `makeui` 的 Skill Creator 校验均通过。
- 关联 Skill 机械审计无 Critical/Major；通用扫描提示的 `must/do not` 经人工逐条复核，分别约束必须执行和禁止行为，不存在同一行为冲突。
- `make-app-actions@0.3.1` 包自身 9 个测试文件、61 个测试全部通过，`typecheck` 与 `build` 通过。
- 相对 Markdown 链接、Node 语法检查和 `git diff --check` 通过。

## 2026-08-11 提交前生命周期与跨 Skill 交接修复

### 问题背景

- 操作选择只描述 applied query 变化，未覆盖 CanvasTable 实例重建和同查询 `totalCount` 增减，旧选择可能在重建或数据收缩后继续驱动操作栏、弹窗和写入目标。
- `make-app-filter` 与 `make-app-sort` 只维护各自 Preset/查询生命周期，没有反向声明与 `make-app-actions` 的成功应用交接，容易在局部调用 Skill 时漏掉选择失效。
- 前向测试范围只计算 `make-app-actions` 单目录哈希，但实际场景依赖 makeui、CanvasTable、权限、Service、filter、sort 和 group，关联规则变化后旧记录仍可能被误用。

### TDD 与修复内容

- 先扩展组合哈希和跨 Skill 合同测试；首次运行按预期因缺少 `readForwardTestScopeEntriesFromRoots` 导出而失败。补最小实现后，组合根路径会带 Skill 命名空间参与长度前缀哈希，并拒绝重复路径碰撞。
- 再增加 CanvasTable 重建、`totalCount` 增长/收缩、单一空通知、filter/sort 成功应用交接及草稿/失败保留的合同断言；旧正文按预期在重建生命周期断言处失败。
- `make-app-actions` revision 更新为 `0.1.7`：表格实例替换先推进选择代次、使 pending work 失效并发布一次空快照，禁止回放旧实例选择；同查询总数增长重新归一化当前公开快照，总数收缩只通过公共 `clearSelection()` 清空，并拒绝 disposed-instance 事件。
- `canvas-table-integration` revision 更新为 `0.1.10`：通用编辑状态仅能在同一语义代次下恢复；由 `make-app-actions` 拥有的选择在表格重建时不得 restore/reapply/replay。
- `make-app-filter`、`make-app-sort`、`make-app-group` revision 分别更新为 `0.1.6`、`0.1.4`、`0.1.2`：仅在可写列表启用 actions workflow 时交接；成功应用并提交新查询前清空选择和失效 pending action，草稿、取消、校验失败、Preset 保存失败与查询失败均保留当前选择。各 Skill 不直接操作 CanvasTable 选择 API。
- 测试矩阵增加重建、总数增长/收缩、重复通知、disposed instance、成功应用/失败路径和组合范围哈希回归；readiness blocker 同步拒绝旧实例选择恢复、收缩后保留旧目标和重复空事件。

### 前向测试

- 前向测试范围改为 8 个关联 Skill 目录的全部文件，组合哈希为 `71d289318632d3cf6cd80a0bc8c6a42fe004fb04290c046de10a1e25822f75cf`，执行批次为 `2026-08-11-make-app-actions-0.3.1-r3`。
- 使用 7 个不继承当前会话历史、彼此不共享上下文的新 Agent 验证 AntD、搜索后全选、Arco、分组 Shift、403 无准确 ID、shadcn/Radix，以及查询交接与表格生命周期综合场景；7 个场景全部通过，执行标识互不重复。
- 新增综合场景确认：成功应用 filter/sort 后清空选择，草稿与失败保留；CanvasTable 重建只发布一次空快照，总数增长调用 `resolveCanvasSelectedRecordSnapshot`，总数收缩只调用一次 `clearSelection()`。

### 验证结果

- 仓库全部 15 个 `scripts/test-*.mjs` 通过；metadata lint 覆盖 14 个 Skill 入口和 89 个 Markdown 文件；`git diff --check` 通过。
- `review_skill.mjs` 无 Critical/Major；唯一通用 `must/do not` Minor 经人工复核，约束的是不同允许/禁止行为，不存在同一行为冲突。
- `quick_validate.py` 初次因系统缺少 PyYAML 未能启动；使用 `/tmp` 临时依赖补齐运行时后，`make-app-actions`、`make-app-filter`、`make-app-sort`、`make-app-group`、`canvas-table-integration` 五个修改 Skill 全部通过，临时目录随后已删除。
- 两组参考应用的全量测试、权限审计和生产构建均通过。
- 两个 POC 构建仅保留既有的 Node 模块浏览器 externalize 与大 chunk 警告，无构建失败。

## 2026-08-13 前向歧义加固

- fresh-agent 在搜索全选场景中自行发明了未定义的 `snapshotToken`，说明“复用同一冻结 target”仍可能被错误解释为新增服务端令牌协议。
- 将禁止发明未文档化 token 提升到主 Skill 和选择快照合同；只有宿主 Service 已明确规定令牌签发、目标绑定、过期和写入校验时才允许使用。
- 新增机械合同断言，并在最终关联 Skill 哈希上重新执行独立前向场景。

## 2026-08-14 行级权限预检错误 ID 与整行爆红

### 问题背景

- 行级写权限预检旧合同只处理无准确 ID 的 403 拒绝，因此前端只能显示吐司，不能确定具体异常行。
- 新合同在非全选模式下通过 HTTP 200、业务码 `20000032` 和 `data.noPermissionRecordIds` 返回准确无权限记录；全选模式仍保持 403 且不返回记录 ID。
- 原测试继续断言“多记录拒绝没有 ID”，会锁死旧行为；同时只限制最终显式操作目标为 200 条，没有固化单次 Shift 连选最多 200 条的交互约束。

### TDD 与修复内容

- 先扩展 `scripts/test-make-app-actions-contract.mjs`，增加新业务响应、数字 ID 规范化、精确整行错误红、取消勾选/关闭操作栏清理、全选无 ID 回退、Shift 199/200/201 和 Service 专用解析顺序断言；旧 Skill 首次运行按预期在 Shift 上限断言处失败。
- `make-app-actions` revision 更新为 `0.1.8`：显式模式将 `noPermissionRecordIds` 规范化为稳定的 `unauthorizedRecordIDList`，只标记准确返回的整行并显示统一吐司；拒绝后保留当前选择，供用户逐行取消；全选 403 继续只显示吐司，禁止猜测、全量标红或逐 ID 诊断。
- Service 响应解析要求将数字 ID 无损映射到冻结请求中的字符串行键，校验唯一性、请求成员关系并保持返回顺序；格式错误或越界 ID 作为上游合同错误处理，不制造行反馈。
- `make-app-service` revision 更新为 `0.1.6`：权限预检在通用 `code !== 200` 错误映射之前识别 `20000032`，保留 `noPermissionRecordIds`，并补齐显式/全选两类 Service 测试要求。
- `canvas-table-integration` revision 更新为 `0.1.12`：补充公共 `setRowColors` 能力路由；普通 CanvasTable 单次 Shift 连选最多 200 条，只能通过已安装包公开合同实现，缺少能力时报告阻断，不在宿主模拟私有选区；CanvasTable 1.3.0 分组表仍不支持 Shift。
- 前向测试场景四改为同时验证普通表 Shift 200 上限和分组表能力边界；场景五改为验证显式 `20000032` 精确爆红与全选 403 无 ID 回退。

### 验证说明

- 新增语义合同断言全部通过；更新 fresh-agent 与关联范围记录后，仓库 18 个合同测试脚本全部通过。
- `make-app-actions`、`make-app-service`、`canvas-table-integration` 的 Skill Creator 快速校验全部通过；metadata lint、Node 语法检查、`git diff --check` 均通过。
- 关联 Skill 机械审查无 Critical/Major；唯一 `must/do not` 启发式 Minor 经人工复核，分别约束必须执行与禁止行为，不存在同一行为冲突。
- 使用 `fork_turns: none` 为七个用户式场景分别创建互不共享上下文的 fresh Agent；r16 批次全部通过，并以真实执行标识更新 `docs/make-app-actions-forward-test.md`。权限与数字精度记录只更新当前组合哈希和非语义影响边界，明确没有把确定性合同测试冒充为对应领域的 fresh-agent 重跑。

### 提交前复审修复

- 先新增“超出 JavaScript 安全整数仍须精确映射”的合同断言，旧规则按预期失败；随后删除未经后端合同确认的安全整数上限：权限适配器必须从原始响应使用无损 JSON 解码器保留整数 token，再用任意精度十进制身份与冻结请求 ID 匹配并映射回原始行键；禁止先经过 `Number` 舍入。
- 增加 `9007199254740993` 回归边界，以及小数、零、负数、数值身份重复、越界和已舍入值的失败测试要求。
