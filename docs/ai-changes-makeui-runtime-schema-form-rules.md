# makeui 运行时 schema 与表单规则

## 2026-05-25

- 将 `skills/makeui` 修订标识更新为 `0.3.19`。
- 明确 `apps/dsl` 只是源码建模产物，生成出来的 UI 或 Service 运行时代码不得读取 `apps/dsl`、`/dsl` 或 YAML schema 文件。
- 收紧降级策略：如果缺少 schema API 或接口响应样例，先暴露 API 合同缺口，不把本地 DSL 当字段来源兜底。
- 规定对象、字段、表格表头、新建/编辑/详情字段必须通过后端 schema API 获取，默认参考 `/api/schema` 和 `/api/entities/:entityKey/fields`，或宿主项目等价接口。
- 规定人员和部门候选数据必须通过后端候选 API 获取，默认参考 `/api/users` 和 `/api/departments`，不得在生产代码中使用假的全局候选数据。
- 强化新建/编辑字段控件必须按 Make 字段类型选择：日期用日期组件，单/多选用 Select，人员/部门用可搜索候选选择器，文件字段遵守 `recordID` 持久化前置条件，Lookup 默认只读或使用明确支持的关联选择。
- 将新建/编辑 Drawer 的平台默认样式设为：右侧 `60%` Drawer、可全屏、垂直表单、白色轻量面板、两列网格、长字段通栏、错误 Alert 置顶、关联数据独立分组。
- 为本次修改到且超过 100 行的 makeui reference 文件补充 Contents，保持按需读取时的可导航性。

## 验证

- 已执行：`rg` 检查 `makeui` 中不再把读取 DSL 文件描述为生成应用运行时方案，只保留禁止运行时读取 DSL 的规则。
- 已执行：`quick_validate.py skills/makeui` 通过。
- 已执行：`git diff --check` 通过。
