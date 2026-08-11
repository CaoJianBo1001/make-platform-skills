# Make App Actions 前向测试记录

## 执行信息

- 执行日期：2026-08-11
- Skill 内容 SHA-256：`3abaa4e595bc89bb430c2884f81efbb0e13a42d8e782214b02d6cccf935666e5`
- 哈希算法：`qfei-forward-test-scope-v1` 长度前缀编码
- 哈希范围：以下 8 个关联 Skill 目录的全部文件：
  - `skills/make-app-actions`
  - `skills/makeui`
  - `skills/canvas-table-integration`
  - `skills/make-app-permission`
  - `skills/make-app-service`
  - `skills/make-app-filter`
  - `skills/make-app-sort`
  - `skills/make-app-group`
- 执行批次：`2026-08-11-make-app-actions-0.3.1-r8`
- 执行方式：独立任务 `019ff009-e682-7f71-a59d-8e1abc960a06` 负责协调；7 个场景均使用 `fork_turns: none` 创建、不继承父会话历史且彼此不共享上下文的新 Agent 针对当前组合 Skill 内容执行。场景七的第二问在首轮完成后发送给同一 Agent。
- 输出限制：只输出实施方案、关键调用链和验证计划，不修改仓库文件。
- 提示控制：执行前不向 Agent 提供验收标准或期望答案，只指定本地待验证 Skill 和用户式问题。
- 总体结果：7 个场景全部通过。

## 场景一：Ant Design 默认操作

提示词：`为一个 Ant Design Make CanvasTable 可写记录列表接入默认编辑、删除和批量编辑。`

验收标准：使用包提供的 AntD 适配器；编辑、删除和批量编辑权限保持独立；批量操作只执行一次权限预检和一次批量写入；使用 0.3.1 字段回调和标准标题。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff00b-bdc4-7c61-b192-e75b7e27edd6

输出证据：Agent 以已安装 `package.json` 为版本依据，按 `package.ai.json.readOrder` 读取公开合同；使用 `AntdRecordSelectionActionBar` 和 `AntdRecordBatchEditModal`，独立判断 update/delete/bulkUpdate。`renderValueControl(field, control)` 明确转发 `control.disabled`，标题固定为“批量编辑”；批量链路只执行一次 `/data/v1/permission` 和一次 `/data/v1/field`。验证计划同时覆盖批量字段的数值精度限制。

结论：通过。

## 场景二：搜索条件下表头全选

提示词：`在有搜索条件的列表中点击表头全选后批量编辑。`

验收标准：形成包含搜索条件的统一 `effectiveFilter`，并由列表查询、权限预检和批量写入复用。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff00b-cc89-7651-81f8-ae53630af030

输出证据：Agent 使用 `compileListFilter` 生成包含搜索、状态和快捷筛选条件的唯一 `effectiveFilter`，仅在列表成功后提交 applied-query 快照。用户点击表头全选后保持 `exclude`，让列表、一次预检和一次批量写入复用同一冻结搜索表达式与独立 `groupFilter`；手动或 Shift 选满仍保持 `include`。

结论：通过。

## 场景三：Arco 批量编辑

提示词：`为使用 Arco 的 Make 列表接入同样的批量编辑。`

验收标准：使用包公开的通用弹窗并注入 Arco 设计系统组件；不得混入 AntD、复制弹窗状态或复制校验逻辑；验证浮层交互语义。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff00b-dd6c-76a0-bf17-ca940f1d9963

输出证据：Agent 使用通用 `RecordBatchEditModal` 和 `MakeAppBatchEditComponents` 注入 Arco Modal、字段选择器和模式控件，标题保持“批量编辑”，明确不引入 AntD 或复制包内弹窗。`renderValueControl(field, control)` 完整转发 `value`、`onChange`、`disabled`、`invalid`、`ariaDescribedBy`；通过 Arco 公开 portal API 避免裁剪，并验证焦点、Escape 和 outside-click 顺序。

结论：通过。

## 场景四：分组表选择和 Shift

提示词：`为分组 CanvasTable 增加选择操作和 Shift 连选。`

验收标准：保留分组表当前支持的选择操作；在 CanvasTable 1.3.0 合同下拒绝由宿主模拟 Shift 连选。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff00f-85f5-7f61-8b02-b9f70acdf788

输出证据：Agent 为 `GroupTableComponent` 开启多选，只订阅一次父级 canonical `selection:change`；明确 CanvasTable 1.3.0 分组模式不支持 Shift 范围选择，禁止宿主监听键盘、保存范围锚点或推算跨组、跨页区间。成功应用分组或分组路径后清空选择并失效旧请求，草稿、取消和失败均保留选择；表格重建只发布一次空选择快照。

结论：通过。

## 场景五：403 且没有无权限 ID

提示词：`批量权限预检返回 403，但没有无权限 ID。`

验收标准：显示标准 toast，不把全部选择行标红，不发逐 ID 诊断请求。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff00f-e9ca-7133-93d8-9587adba684b

输出证据：Agent 将上游 403 映射为 `allowed: false` 和空 `unauthorizedRecordIDList`，阻止打开弹窗并保留选择，显示标准 toast。它明确不调用行标红 API、不把全部选择记录伪造成无权限记录，也不做逐 ID、拆分、分片或重试诊断；非 403 上游错误仍保持 operational error，整个拒绝链路为一次预检、零次写入。

结论：通过。

## 场景六：shadcn/Radix 批量编辑

提示词：`为使用 shadcn/ui 和 Radix primitives 的 Make 列表接入同样的批量编辑。`

验收标准：以真实安装版本为准，使用包公开通用弹窗和 package-neutral 宿主组件，保持 Radix 浮层的焦点与关闭顺序，不引入 AntD 约定。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff010-316a-74c0-9ce0-60459c186114

输出证据：Agent 要求 `@qfei-design/make-app-actions@^0.3.1`，先读已安装 `package.json` 再按 `package.ai.json.readOrder` 读取公开合同。它使用 `RecordBatchEditModal` 和 `MakeAppBatchEditComponents` 注入 shadcn/Radix 薄包装，通过 Radix `Portal/container` 处理浮层，验证 focus、Escape、outside-click 顺序，并明确不引入 AntD 或 AntD 形状的通用属性。

结论：通过。

## 场景七：查询交接与表格生命周期

提示词：先问 `可写列表已有选择操作栏；成功应用筛选或排序后如何处理当前选择？`，随后补充 `CanvasTable 实例重建，且同一查询的 totalCount 先增加后减少时，怎样保证操作选择安全？`

验收标准：成功应用 filter/sort 后清空选择并使 pending action 失效，草稿和失败保留选择；重建、总数增长、总数收缩分别遵守空快照、重新归一化和公共清空的单通知规则。

执行方式：fresh-agent

执行批次：2026-08-11-make-app-actions-0.3.1-r8

执行标识：019ff012-8813-7b71-868f-d8297d31dfe1

输出证据：Agent 将筛选或排序的成功应用定义为完成校验并成功保存对应 Preset 后同步提交 applied state，随后递增 `queryGeneration`、清空选择并使 pending precheck/submit 失效；草稿、取消、Preset 保存失败均保留选择，applied 成功后的列表查询失败不恢复旧选择。CanvasTable 重建通过新的 `tableInstanceToken` 拒绝旧实例事件，发布且仅发布一次空选择快照并禁止回放旧选择；同查询总数增加时读取当前公开快照并调用 `resolveCanvasSelectedRecordSnapshot` 重新归一化，总数减少时只调用一次 `clearSelection()`，以 canonical `selection:change` 作为唯一空选择通知。

结论：通过。

## 总结

当前 8 个关联 Skill 目录的组合哈希下，7 个 UUID 执行标识互不重复的新 Agent 场景均在同一批次通过。覆盖范围包括 AntD 默认操作、搜索后表头全选、Arco 通用组件注入、分组 Shift 能力边界、无准确 ID 的 403 权限拒绝、shadcn/Radix 的版本与浮层契约，以及 applied-query 交接、CanvasTable 重建和同查询 `totalCount` 增减生命周期。本批次在最终数字类字段规则冻结后重新执行，未复用旧范围结果。
