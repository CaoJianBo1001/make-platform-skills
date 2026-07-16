# 字段属性生成规范

## 变更背景

字段 DSL 中的 `properties` 不只是建模说明，生成 Make UI、表格展示和单元格编辑时必须消费这些属性，否则会出现日期范围未限制、金额符号丢失、数字精度不一致、附件和多选数量不受控等问题。

## 变更内容

- 新增 `scripts/test-make-field-properties-contract.mjs`，用静态契约测试锁定字段属性从 DSL 到 UI、CanvasTable 展示和编辑器的规则。
- 更新 `skills/makedsl/references/FieldDesign.md`，同步后端字段唯一性、逐字段 `capabilities` 和 Lookup 等字段规范，并补充字段 `properties` 速查。
- 更新 File/User/Department 专项 DSL 引用，明确元数据消费方必须保留 `maxCount`，但不在 `makedsl` 中描述具体 UI 交互。
- 补充 `makedsl` 与 `canvas-table-integration` 的显式 handoff：DSL 建模归 `makedsl`，CanvasTable 展示、列配置和编辑归 `canvas-table-integration`。
- 更新 `skills/makeui/SKILL.md` 和 `skills/makeui/references/component-usage.md`，要求共享字段 registry 保留 normalized `field.properties`，并明确 `format`、`precision`、`decimalPlaces`、`symbol`、`begin/end`、`maxCount` 的控件行为。
- 更新 `skills/canvas-table-integration` 相关文档，要求 CanvasTable 列、展示 adapter、单元格编辑器和附件编辑器使用这些字段属性。

## 影响范围

- `Make.Field.Date` / `DateTime` 使用 `format` 控制展示和输入解析。
- `Make.Field.DateRange` 使用 `begin` / `end` 限制日期区间控件可选范围。
- `Make.Field.Number` 使用 `precision` 控制数字精度。
- `Make.Field.Currency` 使用 `symbol`、`decimalPlaces`、`useGrouping` 控制展示和输入格式，但提交值仍保持数字或纯数字字符串。
- `Make.Field.Percent` 使用 `decimalPlaces` 控制百分比展示和输入精度。
- `Make.Field.File` 使用 `maxCount` 限制上传、拖拽、粘贴和追加数量。
- `Make.Field.MultiUser` 和 `Make.Field.MultiDepartment` 使用 `maxCount` 限制继续选择，但保留移除/清空能力。

## 验证

- `node scripts/test-make-field-properties-contract.mjs`
