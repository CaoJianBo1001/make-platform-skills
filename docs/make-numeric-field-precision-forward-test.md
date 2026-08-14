# Make 数字类字段小数位前向测试记录

## 执行信息

- 执行日期：2026-08-13
- Skill 内容 SHA-256：`a33dd95a7ff72e34d2af2b0d0c6175d42d5216371217e96ad555e9a3e0f9ae6d`
- 哈希算法：`qfei-forward-test-scope-v1` 长度前缀编码
- 哈希范围：`skills/makedsl`、`skills/makeui`、`skills/canvas-table-integration` 三个目录的全部文件
- 执行批次：`2026-08-13-make-numeric-field-precision-r6`
- 执行方式：当前任务根代理负责协调；两个场景分别由 `fork_turns: none` 创建、不继承父会话历史且彼此不共享上下文的新 Agent 读取当前 Skill 后执行
- 输出限制：只输出实施方案、关键代码结构和测试计划，不修改仓库文件
- 提示控制：只提供用户式需求，不提供预期算法、验收关键词或复审结论
- 总体结果：两个场景全部通过

## 场景一：数字类表单字段

提示词：`为 Make App 的新增/编辑表单实现数字、金额、百分比字段，字段元数据给出允许的小数位，后端只接收纯数据，金额符号和百分号由前端展示。`

验收标准：正确解析三个字段的小数位元数据；原始纯十进制文本先校验后解析；尾随零计入小数位并拒绝科学计数法；只阻止持久化请求；符号不进入 payload。

执行方式：fresh-agent

执行批次：2026-08-13-make-numeric-field-precision-r6

执行标识：/root/forward_numeric_r6_form

输出证据：Agent 要求表单 store 同时保留原始文本 `rawText` 与 `rawText.trim()` 得到的 `normalizedText`，仅让后者进入解析或纯数字字符串提交；新增和编辑表单复用独立 shared pure helper。`Number` 使用 `precision`，`Currency` 使用 `decimalPlaces`，`Percent` 使用 `decimalPlaces`；尾随零计入小数位，科学计数法、货币符号、百分号和千分位均在提交边界拒绝。无效输入只阻止 create/update 持久化请求，metadata 与候选只读请求继续执行；金额符号和 `%` 仅由前端展示，`85.00` 仍按直接百分数尺度提交。

结论：通过。

## 场景二：数字类单元格编辑

提示词：`为可编辑 Make CanvasTable 的数字、金额、百分比单元格接入编辑与提交，后端只接收纯数据，金额符号和百分号由前端展示。`

验收标准：Track C 与 Track B 组合正确；原始文本精度校验先于解析和提交；无效值保持编辑器活动并给出明确提示；保存零调用；与表单共享纯 helper。

执行方式：fresh-agent

执行批次：2026-08-13-make-numeric-field-precision-r6

执行标识：/root/forward_numeric_r6_cell

输出证据：Agent 使用 Track C 展示加 Track B 受控编辑，明确分离原始文本 `rawText`、`normalizedText`、`submitValue` 与 `renderValue/displayValue`，并要求表单与单元格共用独立 pure helper；字段 Registry 只提供元数据。尾随零计入小数位，科学计数法和格式化符号被拒绝。小数位超限时保持编辑器活动并显示“最多保留 N 位小数”，产生零次保存调用、零 dirty state 和零 Canvas 回填；校验成功后才转换为有限数字或后端约定的纯数字字符串，金额符号、百分号和千分位仅留在前端展示。

结论：通过。

## 总结

当前三项关联 Skill 的组合哈希下，表单与单元格两个独立 fresh-agent 场景均能恢复原始文本优先、独立纯校验 helper、持久化请求定向阻断和前端符号职责。该记录验证 Skill 指令可被独立 Agent 正确执行，不替代真实下游应用的组件库、浏览器和网络请求验证。
