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
- 新版 `audit-make-app-permission.mjs` 审计 InspectionPoc：`PASS`。
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
- 新版权限审计检查 InspectionPoc：`PASS`。
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
