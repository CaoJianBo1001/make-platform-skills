# make-app-filter skill 新增

## 背景

高级筛选同时涉及 UI 控件、字段类型、筛选条件模型、Service filter 合同、Make Data API 表达式和 CanvasTable 表头菜单联动，不能继续分散写在 `makeui`、`make-app-service` 或 `canvas-table-integration` 中。

## 本次调整

- 新增 `skills/make-app-filter/SKILL.md`，定义高级筛选职责、边界、默认行为和协作方式。
- 新增 `references/filter-model.md`，沉淀 Filter IR、草稿确认、搜索合并和对象切换重置规则。
- 新增 `references/operator-matrix.md`，按 Make 字段类型定义默认操作符、值编辑器、候选接口和不支持字段。
- 新增 `references/ui-style.md`，按 ExpensePoc 当前高级筛选样式沉淀默认面板布局、尺寸、颜色和校验反馈。
- 新增 `references/header-table-linkage.md`，沉淀 CanvasTable 表头更多菜单与高级筛选 `openWithField(fieldKey)` 的联动规则。
- 新增 `references/service-translation.md`，约束 `{ expression }` filter 合同、CEL 子集和空筛选处理。
- 新增 `references/testing-and-pitfalls.md`，补充高级筛选、表头联动、Service payload 的测试要求和常见回归。
- 更新根 `README.md`，让高级筛选相关问题路由到 `make-app-filter`。
- 补充 ExpensePoc 高级筛选视觉细节：弹层是一个整体白色面板，根条件不放入第二层灰色背景；嵌套条件组只允许一层浅色块；值编辑器和删除按钮必须无缝连接，所有输入、下拉、日期、数字、人员、部门编辑器的连接处不得出现圆角或间隙。
- 补充高级筛选校验生命周期：点击 `确认` 后必须按条件 id 标记字段、操作符和值控件错误；下拉、日期、数字、人员、部门等值编辑器也必须显示错误态；用户输入或选择有效值后应立即重新校验并清除已修复控件的红框。

## 边界

- `make-app-filter` 不负责页面 Shell 和列表工具栏整体布局，布局仍交给 `makeui`。
- `make-app-filter` 不负责 CanvasTable 渲染和 suffixRender API 细节，表格接入仍交给 `canvas-table-integration`。
- `make-app-filter` 不负责 Service 路由实现、日志和 adapter，具体代码仍交给 `make-app-service`。
- `make-app-filter` 不负责认证、打包发布、DSL 建模或 Make CLI 操作。

## 2026-06-10 15:15 CST

- 变更摘要：同步 `make-app-filter` 与当前 `filter.expression` 能力，补齐 DateRange、File、Lookup 支持边界，并修正搜索 OR 与高级筛选 AND 必须展开为 DNF。
- 涉及文件：`skills/make-app-filter/SKILL.md` 及 `references/filter-model.md`、`operator-matrix.md`、`service-translation.md`、`header-table-linkage.md`、`testing-and-pitfalls.md`。
- 关键逻辑：Lookup 只能使用当前 Entity 的 Lookup 字段 key，操作符和值格式按 `targetFieldKey` 目标字段类型决定；缺少目标元数据或嵌套 Lookup 时仍隐藏。

## 2026-06-11 18:08 CST

- 变更摘要：回退提交 `6e7f6a25` 中 `make-app-filter` 关于 `@qfei-design/make-filter` 包能力门禁和扩展合同的同步内容。
- 涉及文件：`skills/make-app-filter/SKILL.md` 及 `references/package-integration.md`、`operator-matrix.md`、`service-translation.md`、`header-table-linkage.md`、`testing-and-pitfalls.md`。
- 关键逻辑：恢复到回退前一版高级筛选说明，撤销 host 不手写 File、DateRange、Lookup 或 DNF 编译逻辑等新增约束。

## 2026-07-10

- 变更摘要：同步 `make-app-filter` 与 `@qfei-design/make-filter@^0.2.5` 公共契约，去除过期 Filter IR、静态操作符矩阵和宿主 DNF 展开规则。
- 涉及文件：`skills/make-app-filter/SKILL.md`、`references/filter-model.md`、`operator-matrix.md`、`service-translation.md`、`header-table-linkage.md`、`testing-and-pitfalls.md`、根 `README.md` 和筛选契约测试。
- 关键逻辑：宿主从包入口导入 IR 类型，通过包 API 动态判断字段与操作符能力，并将 `compileListFilter` 结果原样提交给 Service；File、DateRange 和已解析 Lookup 统一走 `0.2.5` 包能力，不再由宿主复制或补偿共享逻辑。
- 防回归：契约测试禁止旧操作符名称、本地 IR 类型、静态字段操作符表和宿主 DNF 笛卡尔积实现重新进入 Skill。
