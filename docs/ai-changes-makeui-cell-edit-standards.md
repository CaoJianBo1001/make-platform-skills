# MakeUI 单元格编辑标准规范

## 背景

新生成的应用在 CanvasTable 单元格编辑里容易出现非弹窗编辑器二次边框、输入框内缩、数字字段退化为普通文本输入框、日期/下拉类字段进入编辑后还需要再次点击等问题。这些问题与平台标准单元格编辑效果不一致。

## 调整

- `skills/canvas-table-integration/SKILL.md` 在 Track B 主入口中明确非弹窗 inline editor 的视觉规则：保留 CanvasTable 自带 active 编辑边框，内部输入框、数字输入框、选择器和日期触发器必须铺满单元格并使用无边框样式。
- `skills/canvas-table-integration/references/make-cell-edit-defaults.md` 强化单元格编辑基线，明确 Text/Input、TextArea、InputNumber/NumberInput、DatePicker/RangePicker、Select、人员/部门选择器和附件面板的默认行为。
- `skills/canvas-table-integration/references/field-editor-patterns.md` 按 Make 字段类型补齐编辑器映射，禁止把数字、日期、下拉、人员、部门、附件等复杂字段静默降级成普通文本输入。
- `skills/canvas-table-integration/references/editor-component-selection.md` 增加项目组件库优先的控件选择矩阵，要求优先复用宿主已有业务组件或已安装 UI 组件库。
- `skills/canvas-table-integration/references/edit-common-pitfalls.md` 将嵌套边框、二次蓝框、内缩编辑器列为明确缺陷。
- `skills/makeui/SKILL.md` 将 MakeUI revision 更新到 `0.3.44`，并明确 Make record table 单元格编辑必须路由到 `canvas-table-integration` Track B，不能在页面组件里临时自建编辑器。
- 新增 `scripts/test-cell-edit-standards-contract.mjs`，静态校验 Track B 文档必须覆盖非弹窗无二次边框、项目组件库控件映射、数字控件隐藏步进器、日期/选择器立即打开等标准。

## 边界

- 本次只修复 skill 规范和合同测试，不修改具体 POC 项目代码。
- 单元格编辑生命周期、弹窗定位、`customEdit`、`relatedElements`、`autoClose`、编辑器视觉规则仍归 `canvas-table-integration`；`makeui` 只负责在 UI 生成时正确路由到该 skill。
- 控件名称以宿主项目为准；Ant Design 的 `InputNumber`、`DatePicker`、`Select` 只是可选参考实现，不要求所有项目强制引入 Ant Design。

## 强制化调整

- 将 CanvasTable 单元格编辑规范从“默认建议”升级为强制准入规范：只要实现 CanvasTable cell edit，就必须按 `canvas-table-integration` Track B 和 `make-cell-edit-defaults.md` 执行。
- 未满足非弹窗无二次边框、项目组件库控件映射、弹窗立即打开、滚动后定位、规范化值提交、未变化不保存等要求时，视为 readiness blocker / 交付阻断，不能报告 ready、complete、delivered。
- `makeui` 也同步强化路由规则：页面层不能临时自建一套单元格编辑器，所有 Make record table cell editing 必须走 `canvas-table-integration` Track B。
- `scripts/test-cell-edit-standards-contract.mjs` 增加强制性断言，防止后续文档把该标准弱化成可选交互模型。
- Review 后将 `make-cell-edit-defaults.md` 中的 `prefer` 弱化措辞改为强制准入表达，并增加合同测试防止回退。
