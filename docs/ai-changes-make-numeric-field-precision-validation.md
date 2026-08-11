# Make 数值字段前端小数位校验约束

## 需求背景

数字、金额、百分比字段的小数位限制应由前端根据字段元数据直接控制。用户输入超过允许小数位时，表单组件和 CanvasTable 单元格编辑组件必须在调用后端接口之前完成校验与提示，不能依赖后端接口报错。

同时统一百分比数值尺度：后端只传纯数据，`85.00` 表示 `85%`；百分号由前端展示，筛选表达式也使用直接百分数尺度，不能切换成 `0.85` 或隐式乘除 `100`。

## 规则调整

- `Make.Field.Number` 使用 `field.properties.precision` 作为最大允许小数位数。
- `Make.Field.Currency` 使用 `field.properties.decimalPlaces` 作为最大允许小数位数。
- `Make.Field.Percent` 使用 `field.properties.decimalPlaces` 作为最大允许小数位数。
- 金额符号和百分号只属于前端格式化层，不进入表单值、单元格值或 API payload。
- 百分比 Data API、提交和筛选统一使用直接百分数尺度，例如 `85.00` 表示 `85%`。
- 表单组件和单元格编辑组件必须复用同一份纯小数位校验契约，避免相同输入在两个入口表现不一致。
- 输入超过限制时显示“最多保留 N 位小数”，阻止表单提交或单元格提交，并保证不调用保存接口、不创建脏状态、不回填无效值。
- 单元格编辑器保持活动状态，通过 tooltip 或宿主外部校验区域展示错误，不在活动单元格内部增加帮助文字或二次表单布局。
- 默认禁止静默四舍五入或截断。只有宿主项目明确声明产品与后端舍入约定时才允许自动舍入，并且必须先把归一化后的值回显给用户。
- 小数位校验使用独立纯 helper，以原始纯十进制文本为输入；尾随零计入小数位，科学计数法和带符号/千分位的展示文本在提交边界按无效格式处理。校验通过后才允许解析为有限数字。
- helper 保留原始 `rawText` 仅供诊断或回显，同时返回 `normalizedText = rawText.trim()`；只有 `normalizedText` 可以进入有限数字解析或纯数字字符串 payload，全空格输入规范化为空字符串后再交给 required/optional 校验。
- 通过校验后的提交形态在表单和单元格两侧统一为有限数字或后端认可的纯数字字符串，不能由某个入口擅自收窄成仅数字。
- 字段 Registry 只提供规范化元数据，不承载表单或单元格校验逻辑；高级筛选校验继续归 `make-app-filter`。
- 字段无效时只阻止本次提交对应的持久化请求，候选搜索、元数据读取等无关只读请求仍可执行。

## 修改范围

- 更新 `skills/makedsl/references/FieldDesign.md`、`DataAPIDesign.md`、`EntityDataFilterUsage.md` 和 `MetaAPIDesign.md`，明确三个字段属性的最大允许小数位语义，消除百分比 API 示例 `85.00` 与筛选示例 `0.8` 的尺度冲突，并将遗留的 `Make.Field.Amount + precision/currency` 示例修正为规范的 `Make.Field.Currency + symbol/decimalPlaces/useGrouping`。
- 更新 `skills/makeui/SKILL.md` 和 `skills/makeui/references/component-usage.md`，将表单前置校验、错误提示和请求阻断设为硬约束。
- 更新 `skills/canvas-table-integration/SKILL.md`、`make-cell-edit-defaults.md`、`field-editor-patterns.md` 和 `edit-common-pitfalls.md`，补齐单元格编辑的校验、提示和零保存调用要求。
- 更新 `validated-usage-notes.md`，明确三种字段完整的小数位溢出交互仍需真实下游项目验证，避免夸大现有验证范围。
- 新增 `scripts/test-make-numeric-field-precision-validation-contract.mjs`，逐文件保护表单和单元格编辑契约。
- 新增 `scripts/lib/numeric-field-precision-contract.mjs` 及行为测试，作为原始输入精度语义的可执行 oracle。
- 扩展数字展示契约测试，保证 `DataAPIDesign.md` 的所有 `json` 代码块均为可复制、可 `JSON.parse` 的真实 JSON。
- 新增数字类表单与单元格编辑专项 fresh-agent 前向记录；真实下游应用仍需在自身交付前执行组件库和浏览器验证，Skill 记录不得冒充生产验证。
- 因共享的 `makeui` 与 `canvas-table-integration` 内容发生变化，重新执行 `make-app-actions` 的 7 个独立 Agent 前向场景，并将回归门禁批次更新为 `2026-08-11-make-app-actions-0.3.1-r8`。

## TDD 记录

1. 先新增跨 Skill 契约测试。
2. 首次执行在 `Make.Field.Number.precision` 未声明“最大允许小数位”时按预期失败。
3. 补齐 DSL、表单和单元格编辑规范后，新测试通过。
4. 扩展数值展示契约测试后，测试在百分比筛选示例仍使用 `0.8` 时按预期失败；统一为直接百分数尺度后通过。
5. 重新计算关联 Skill 组合哈希并执行独立前向场景，确认批量操作、权限拒绝、选择交接和不同组件库适配合同未被破坏。
6. 上线复审先发现“解析后校验”“阻止所有 API”“Registry 职责冲突”和“缺少专项前向验证”四项问题；分别增加失败测试后再修正规则与可执行行为合同。
7. 二次复审发现成功结果仍返回未去空格输入；先增加 `" 1.20 "` 和全空格失败用例，再增加 `normalizedText` 并明确提交安全边界。
8. 数字类表单与单元格专项前向场景使用 `fork_turns: none`、纯用户式提示重新执行为 r2，确认无父会话上下文时仍能推导 `rawText`/`normalizedText` 分离。
9. 最终跨文件复核发现 Meta API 仍使用已废弃的金额类型、Data API 的 `json` 示例含行内注释，以及表单/单元格提交形态表述不一致；分别先增加失败断言，再修正规范类型、可解析 JSON 和“有限数字或纯数字字符串”合同。
10. 内容冻结后，在独立任务 `019ff009-e682-7f71-a59d-8e1abc960a06` 中对 7 个操作回归场景和 2 个数字专项场景全部使用 `fork_turns: none` 重跑；数字专项更新为 r3，操作回归更新为 r8，9 个 Agent 均正常完成且没有请求用户输入。

## 版本调整

- `makedsl`：`0.2.3` → `0.2.4`
- `makeui`：`0.3.52` → `0.3.53`
- `canvas-table-integration`：`0.1.10` → `0.1.11`
