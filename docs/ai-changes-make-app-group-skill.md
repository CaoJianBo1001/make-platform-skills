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
