# AI 变更记录：Make App 分组 Skill

## 需求背景

分组能力已经在业务项目中完成基本闭环，需要沉淀成平台级标准 Skill，保证后续
AI 可以按统一规范完成完整分组功能，而不是只接一个弹窗组件。分组同时涉及
`@qfei-design/make-app-group` 包、`@qfei-design/canvas-table`
`GroupTableComponent`、Entity Preset、Service `record-groups` 路由、
`groupFilter` 表达式、Make Data 分组模式和叶子明细分页。

本次设计已结合后端最新 Data API 分组能力：`group` 为非空数组时进入分组模式，
`group` 省略或 `null` 为普通记录模式，Data API `group: []` 非法，但 Preset
`group: []` 表示清空保存的分组。

## 新增 Skill

新增 `skills/make-app-group`：

- `SKILL.md`：定义分组 Skill 的触发词、完整工作流、硬规则、跨 Skill 交接和
  参考文档读取顺序。
- `agents/openai.yaml`：提供 Codex UI 展示名、短描述和默认调用提示。
- `references/group-model.md`：定义最多三级 `{ fieldKey, order }[]`、字段唯一、
  `capabilities.groupable === true`、Lookup 能力边界、Data API 与 Preset 空数组差异。
- `references/ui-and-drag.md`：定义 npm 包接入、宿主拥有的触发器和容器、
  `useRecordGroupController`、拖拽边界、`openWithField` 和禁用态。
- `references/preset-and-data-flow.md`：定义权限感知上下文、Preset 读取/保存/回显、
  先保存后应用、稀疏更新、并发保存和旧响应丢弃。
- `references/group-filter-expression.md`：定义 `filter` 与 `groupFilter` 分离、
  稳定分组值、CEL 字面量、Lookup null、DNF 追加和请求位置。
- `references/service-contract.md`：定义 UI-Service 路由、Make Preset adapter、
  `record-groups`、普通 records、严格校验和安全日志。
- `references/canvas-table-flow.md`：定义普通表格与分组表格切换、根分组加载、
  `group:load`、`group:data:load`、`setGroup`、`setData`、失败页标记和 V1 单元格编辑禁用。
- `references/testing-and-pitfalls.md`：定义模型、表达式、UI、集成、Service、
  CanvasTable 和常见回归测试要求。

## 跨 Skill 调整

- 更新 `README.md`：新增 `make-app-group` 路由、常见组合和使用场景；筛选、分组、
  排序组合共享权限感知 Preset 协调器，但按维度独立保存。
- 更新 `canvas-table-integration`：明确只负责 `GroupTableComponent` 底层公开 API，
  Make 记录分组语义、Preset、Service 和叶子分页交给 `make-app-group`。
- 更新 `make-app-sort`：移除“分组后续阶段”表述，明确分组已由 `make-app-group`
  主责；排序只保留稀疏 Preset 更新和叶子 records sort 协作边界。
- 更新 `make-app-filter`：明确 `groupFilter` 路径表达式由 `make-app-group` 主责，
  但复用筛选 Skill 的表达式/DNF 规则。
- 更新 `make-app-service`：补充 Preset group、records `groupFilter`、
  `record-groups`、Make Data grouping mode、严格校验和测试要求。
- 更新 `makeui`：补充分组按钮默认位于筛选之后、排序之前，行为交给
  `make-app-group`。

## 防回归契约

- 新增 `scripts/test-make-app-group-contract.mjs`，覆盖分组模型、npm 包接入、
  Preset 生命周期、DNF `groupFilter`、Service 合同、CanvasTable 事件流和跨 Skill 路由。
- 更新 `scripts/test-platform-skill-genericity-contract.mjs`，将 `make-app-group`
  纳入平台 Skill 通用性与隐私扫描。
- 更新 `scripts/test-make-app-sort-contract.mjs`，把排序中的分组边界从“未来阶段”
  调整为“当前由 `make-app-group` 主责”。

## 验证结果

- `node scripts/lint-skill-metadata.mjs .`：通过。
- `node scripts/test-platform-skill-genericity-contract.mjs .`：通过。
- `node scripts/test-make-app-group-contract.mjs .`：通过。
- `node scripts/test-make-app-sort-contract.mjs .`：通过。
- `for script in scripts/*.mjs; do node "$script" . || exit 1; done`：通过全部
  Node 契约测试。
- `quick_validate.py skills/make-app-group`：通过；系统 Python 缺少 PyYAML，
  使用临时虚拟环境安装依赖后完成校验，随后已清理临时环境。
- `git diff --check`：通过。

## 2026-07-30 提交前审查修复

- 修复 `record-groups` 响应形状说明：明确 Make Data upstream 返回
  `{ data, pagination: { page, size, total } }`，默认 UI-Service 返回
  `{ groups, pagination }`，并说明如存在扁平 `total` 只能作为 Service alias。
- 清理活跃 Skill 中“future group / group 未实现”的旧表述。当前分组已由
  `make-app-group` 主责，筛选、排序和 Service 只保留稀疏 Preset 更新及跨维度保留规则。
- 收窄 `make-app-group` frontmatter 触发词，将 `openWithField` 限定为表头分组场景，
  避免与筛选、排序的表头联动触发冲突。
- 恢复 README 中“同时做筛选和排序”的组合说明，并保留“筛选、分组和排序”的完整组合。
- 补强 `test-make-app-group-contract.mjs` 和 `test-make-app-sort-contract.mjs`，
  防止响应映射、宽泛触发词和未来分组旧语义再次回退。

## 2026-07-30 分组首列左固定规则

- 补充分组 CanvasTable 渲染规则：仅在分组模式下，创建 `GroupTableComponent`
  前保证至少有一个左固定可见数据列。
- 规则收敛为条件式默认：如果已有左固定数据列，不再新增、覆盖或复制固定列；
  如果没有左固定数据列，才默认将第一列可见数据列设置为 `fixed: "left"`。
- 明确该规则不作用于普通非分组 `CanvasTableComponent` 模式，非分组表格不新增首列
  左固定默认要求。
- 补充分组测试契约，防止后续移除分组左固定保障、重复添加固定列或误应用到非分组表格。

## 2026-08-03 分组详情抽屉刷新回归规则

- 补充分组 CanvasTable 生命周期规则：根分组 `setGroup(rootGroups, undefined, 0)`
  只允许在初始化或 `rootGroups` / `dataVersion` 等语义数据变化时执行，不允许由
  父组件普通渲染或对象引用变化重复触发。
- 明确宿主传入的 `grouping` / 分组配置需要保持稳定；数据同步 effect 不应依赖每次
  render 都重新创建的完整分组对象，而应依赖分组字段、根分组数据、总数、分页尺寸和
  数据版本等真实输入。
- 同步 CanvasTable 通用集成陷阱：详情抽屉、全屏、表头按钮、行操作弹层等无关 UI 状态
  不得重建表格实例、重复 `setData` / `setGroup` 或重新请求列表、`record-groups`、
  叶子明细页。
- 同步 MakeUI 详情抽屉规则：非数据变更的详情交互只更新 UI 状态；只有保存、删除、
  关系更新或显式刷新命令才能刷新列表、分组或表格数据。
- 补充 `test-make-app-group-contract.mjs` 和 `test-canvas-table-data-sync-contract.mjs`
  防回归断言，覆盖等价新引用分组配置、详情抽屉交互和父组件状态抖动。
- 压缩 `canvas-table-integration` 的 frontmatter description，保留分组/排序/Track A/B/C
  触发语义，同时满足 `quick_validate.py` 的 1024 字符限制。

## 2026-08-11 分组弹层交互边界修复

- 明确根因包含两层：宿主把外层 Popover 留在组件库默认 `hover` 触发；以及下拉、日期、
  菜单等子弹层通过 portal/teleport 脱离外层 DOM 后，被朴素 outside-click 误判为外部区域。
- 外层分组弹层改为框架无关的受控 click/press 契约，禁止通过 hover、鼠标移出、blur 或
  focusout 关闭；普通关闭只允许确认成功或经交互边界验证的真实外部点击。
- 将分组面板和所有宿主子弹层根节点定义为同一交互边界。选值、搜索、滚动、子弹层开关和
  拖拽只更新草稿或子层状态，不得关闭外层分组面板。
- 要求优先使用当前组件库公开的 portal 容器、overlay branch、dismissable layer 或 outside
  include 机制；必要时通过原始事件 `composedPath()` 对已登记根节点分类。禁止用额外的
  document 全局监听或 `stopPropagation()` 作为主要修复。
- Ant Design 的 `trigger="click"` 仅作为适配示例，同时补充 Radix/shadcn、MUI、Vue 和
  其他组件库的等价能力映射，避免把 AntD 属性误写成平台通用协议。
- Escape 默认不关闭外层；产品显式启用时必须先由最上层子弹层消费，不能一次同时关闭子层
  和分组面板。
- 扩充分组契约测试，覆盖 hover/移出/失焦不关闭、portal 子弹层选值不关闭、真实外部点击
  关闭、Escape 层级顺序及禁止竞争性全局监听。

### TDD、前向验证与回归结果

- 先只增加 `test-make-app-group-contract.mjs` 的弹层契约断言，旧文档按预期在“外层必须
  受控且禁止 hover/移出/失焦关闭”处失败；补充最小规范后测试通过。
- 使用独立 fresh Agent 场景 `group-overlay-r1` 直接验证分组面板内 Select、
  DatePicker 等 portal/teleport 子弹层。Agent 能从当前 Skill 自主恢复受控外层、owned
  overlay boundary、`composedPath()` 外部判定、确认成功后关闭、失败保持打开，以及
  AntD、Radix/shadcn、MUI、Vue 的等价适配，结论通过。
- 因 `make-app-actions` 的组合前向测试范围包含 `make-app-group`，旧范围哈希按设计失效。
  使用批次 `2026-08-11-make-app-actions-0.3.1-r4` 对当前 8 个关联 Skill 重新执行 7 个
  互不共享上下文的 fresh Agent 场景，组合哈希为
  `a861acd2e0bb2a8e51381378b16d0307957f72838cd2aa6f041020099d172ffd`，全部通过。
- `skill-creator` 的 `quick_validate.py skills/make-app-group` 通过；系统 Python 缺少
  PyYAML，使用 `/tmp` 临时虚拟环境补齐后校验，临时目录随后已清理。
- 仓库全部 `scripts/*.mjs` 契约测试通过，包含 metadata lint、分组合同、actions 组合
  前向门禁、平台通用性、CanvasTable、筛选和排序回归。

### 2026-08-11 Review 问题修复

- 修复分组弹层契约测试的假阳性：原断言使用跨全文贪婪匹配，即使把“子弹层选值不得关闭”
  改成相反语义，相关关键词仍可能从不相干段落拼接并通过。
- 新增 Markdown 小节提取，只在 `Outer overlay interaction boundary` 和
  `UI component tests` 范围内验证对应行为。
- 将普通关闭原因显式收敛为 `GroupOverlayCloseReason = "confirm-success" |
  "true-outside-pointer"`，禁止把子弹层 `onOpenChange(false)`、选值、焦点变化或鼠标移出
  直接映射为外层 `setOpen(false)`。
- 增加反向突变测试：把 `must not close the outer panel` 改为
  `must close the outer panel` 后，契约校验必须失败，防止核心 bug 被关键词测试掩盖。
- `make-app-group` Skill revision 更新为 `0.1.4`。
- TDD 首次运行按预期失败于缺少 `confirm-success | true-outside-pointer` 关闭原因白名单；
  补充最小正文模型后，聚焦分组契约通过，反向突变被拒绝。
- 使用 `group-overlay-r2` 重新执行直接分组弹层 fresh-agent 场景，Agent 能从
  当前 Skill 自主使用 `GroupOverlayCloseReason`，并拒绝子层 `onOpenChange(false)`、选值、
  失焦和鼠标移出关闭外层，结论通过。
- 使用批次 `2026-08-11-make-app-actions-0.3.1-r5` 对当前 8 个关联 Skill 重新执行 7 个
  fresh-agent 场景；组合哈希为
  `a436603f7065f9288f0ff5fd5769ca1d3cb8293fcacfa827ef9d41676d469f3b`，全部通过。
- `quick_validate.py skills/make-app-group` 通过，临时校验环境已清理。
