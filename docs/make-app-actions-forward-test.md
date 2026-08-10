# Make App Actions 前向测试记录

## 执行信息

- 执行日期：2026-08-10
- Skill 内容 SHA-256：`461f6b30e8d9b2799fc91d3a74ae90e44ba2382605f556a0a4cba177fb4d2369`
- 哈希算法：`qfei-forward-test-scope-v1` 长度前缀编码
- 执行方式：使用 5 个互相独立的新 Agent；各 Agent 不共享当前会话历史，只接收仓库位置、原始需求和“按正常 Skill 发现处理”的说明。
- 输出限制：只输出实施方案、关键调用链和验证计划，不修改仓库文件。
- 提示控制：执行前不向 Agent 提供验收标准或期望答案。
- 总体结果：5 个场景全部通过。

## 场景一：Ant Design 默认操作

提示词：`为一个 Ant Design Make CanvasTable 可写记录列表接入默认编辑、删除和批量编辑。`

验收标准：使用包提供的 AntD 适配器；编辑、删除和批量编辑权限保持独立；批量操作只执行一次权限预检和一次批量写入。

输出证据：Agent 选择 `AntdRecordSelectionActionBar` 和 `AntdRecordBatchEditModal`，分别使用 `data.record.update`、`data.record.delete`、`data.record.bulkUpdate`，并规划一次 `/data/v1/permission` 和一次 `/data/v1/field` 调用，禁止逐条更新和诊断请求。

结论：通过。

## 场景二：搜索条件下表头全选

提示词：`在有搜索条件的列表中点击表头全选后批量编辑。`

验收标准：形成包含搜索条件的统一 `effectiveFilter`，并由列表查询、权限预检和批量写入复用。

输出证据：Agent 将搜索词和高级筛选统一编译为 `effectiveFilter`，只在列表请求成功后保存不可变查询快照；表头全选保留 `exclude` 选择意图，预检和最终写入复用同一冻结筛选条件。

结论：通过。

## 场景三：Arco 批量编辑

提示词：`为使用 Arco 的 Make 列表接入同样的批量编辑。`

验收标准：不得混入 AntD 或复制 AntD 弹窗；缺少公开 Arco 适配器时必须报告交付阻断。

输出证据：Agent 首先识别 `make-app-actions@0.2.1` 尚未公开 Arco 批量编辑适配器，明确拒绝在 Arco 宿主中引入 AntD 或复制 Modal，并要求先在通用包发布公开 Arco 适配器后再完成宿主接入。

结论：通过。

## 场景四：分组表选择和 Shift

提示词：`为分组 CanvasTable 增加选择操作和 Shift 连选。`

验收标准：保留分组表当前支持的选择操作；在 CanvasTable 1.3.0 合同下拒绝由宿主模拟 Shift 连选。

输出证据：Agent 通过父级唯一 `selection:change` 接入分组记录选择和标准操作栏，同时识别 `GroupTableComponent` 当前不支持 Shift，明确禁止宿主监听键盘模拟；只有包公开分组 Shift 合同后才允许接入。

结论：通过。

## 场景五：403 且没有无权限 ID

提示词：`批量权限预检返回 403，但没有无权限 ID。`

验收标准：显示标准 toast，不把全部选择行标红，不发逐 ID 诊断请求。

输出证据：Agent 将结果处理为 `allowed: false` 和空 `unauthorizedRecordIDList`，要求阻止弹窗、保留选择、显示固定提示、不调用行标红 API、不发 `/records/bulk`，并保证完整目标只调用一次 `/data/v1/permission`。

结论：通过。

## 总结

5 个独立 Agent 均通过对应验收标准。结果证明当前 Skill 能在正常发现条件下稳定引导 AntD 标准接入、搜索全选范围安全、非 AntD 适配器边界、分组 Shift 能力边界和不透明权限拒绝反馈。本轮未发现需要修改 Skill 规则的新问题。
