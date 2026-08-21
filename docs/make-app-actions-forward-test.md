# Make App Actions 前向测试记录

## 执行信息

- 执行日期：2026-08-14
- Skill 内容 SHA-256：`12b1c155d9756d3d715f1fc20c1a47705993b0e3cbfa49672dcfc147a2fbfdfe`
- 范围哈希同步日期：2026-08-21
- 上一 Action 语义前向测试基线 SHA-256：`69fb63b6b0419af55ea2bbe6021979b758e1a69150574b0b93718a8b64db6042`
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
- 执行批次：`2026-08-14-make-app-actions-0.3.1-r16`
- 执行方式：当前任务根代理负责协调；7 个场景均使用 `fork_turns: none` 创建、不继承父会话历史且彼此不共享上下文的 fresh Agent，针对当前组合 Skill 内容执行。
- 输出限制：只输出实施方案、关键调用链和验证计划，不修改仓库文件。
- 提示控制：提示词按真实用户任务描述，不提供验收标准、已知缺陷或期望答案。
- 总体结果：7 个场景全部通过，覆盖 Ant Design、搜索全选、Arco、Shift 200 与分组边界、显式权限拒绝与全选回退、shadcn/Radix，以及查询交接与 CanvasTable 生命周期。

## 本次验证边界

- 本批次重新验证了当前 8 个 Skill 组合中的 Action 行为，尤其是普通表单次 Shift 最多 200 条、显式权限拒绝精确整行爆红、超大 Record ID 无损映射及全选 403 无 ID 回退。
- `make-app-permission 0.2.3` 与前台 UI/CanvasTable 的平台化表述不改变选择、操作或批量写入的 Action 语义；本次仅同步组合范围哈希，未重新执行 r16 Action 场景，本记录不作为这些变更的 Action 场景重新执行证据。
- 所有 Agent 均只读执行；个别 Agent 自行运行合同测试并识别出旧范围哈希门禁，不以该旧门禁替代本批次输出验收。

## 场景一：Ant Design 默认操作

提示词：`为一个 Ant Design Make CanvasTable 可写记录列表接入默认编辑、删除和批量编辑。`

验收标准：使用包提供的 AntD 适配器；编辑、删除和批量编辑权限保持独立；批量操作只执行一次权限预检和一次批量写入；使用 0.3.1 字段回调和标准标题。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-antd

输出证据：Agent 先以已安装 `package.json` 为版本依据，再按 `package.ai.json.readOrder` 读取公开合同；使用 `AntdRecordSelectionActionBar` 和 `AntdRecordBatchEditModal`，独立判断 update/delete/bulkUpdate。`renderValueControl(field, control)` 转发 `disabled`，标题固定为“批量编辑”；批量链路只执行一次 `/data/v1/permission` 和一次 `/data/v1/field`。它还独立要求从原始响应无损映射 `9007199254740993`，显式拒绝精确整行标红，全选 403 只提示。

结论：通过。

## 场景二：搜索条件下表头全选

提示词：`在有搜索条件的列表中点击表头全选后批量编辑。`

验收标准：形成包含搜索条件的统一 `effectiveFilter`，并由列表查询、权限预检和批量写入复用。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-search

输出证据：Agent 将搜索、高级筛选、状态和快捷筛选统一编译为最后一次成功查询的 `effectiveFilter`；表头全选保持 `exclude`，冻结排除项、`filter` 和独立 `groupFilter`。列表、一次权限预检和一次批量写入复用完全相同的过滤目标；搜索草稿和失败查询不重定义操作目标，成功应用新搜索才清空旧选择并使 pending work 失效。

结论：通过。

## 场景三：Arco 批量编辑

提示词：`为使用 Arco 的 Make 列表接入同样的批量编辑。`

验收标准：使用包公开的通用弹窗并注入 Arco 设计系统组件；不得混入 AntD、复制弹窗状态或复制校验逻辑；验证浮层交互语义。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-arco

输出证据：Agent 使用通用 `RecordBatchEditModal` 和 `MakeAppBatchEditComponents` 注入 Arco Modal、字段选择器和模式控件，不引入 AntD 或复制包内弹窗。`renderValueControl(field, control)` 依次转发 `value`、`onChange`、`disabled`、`invalid`、`ariaDescribedBy`；通过 Arco 公开 portal 能力将 popup 挂载到裁剪祖先之外，并验证 focus、Escape、outside-click 顺序，标题保持“批量编辑”。

结论：通过。

## 场景四：Shift 200 与分组边界

提示词：`为 CanvasTable 增加 Shift 连选，单次最多 200 条；同时兼容分组表。`

验收标准：普通表只通过已安装公共合同限制单次 Shift 200；缺少公共能力时阻断；CanvasTable 1.3.0 分组表不得由宿主模拟 Shift。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-shift

输出证据：Agent 区分单次 Shift 交互上限和最终显式目标上限，要求普通表通过已安装 CanvasTable 的公开 contract/API 将一次 Shift 限制为 200，并覆盖 199/200/201；公开能力缺失即报告 blocker/阻断，不监听宿主键盘或维护私有锚点。分组表继续使用父级唯一 `selection:change`，CanvasTable 1.3.0 下保留逐行/表头选择但不模拟 Shift。

结论：通过。

## 场景五：显式权限拒绝与全选回退

提示词：`非全选批量权限预检返回 HTTP 200、code 20000032 和部分无权限 ID；表头全选仍返回 403 且没有 ID。`

验收标准：显式模式无损规范化准确 ID、统一提示并只标记对应整行错误红；取消勾选/关闭时清理；全选模式只提示且不诊断。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-permission

输出证据：Agent 在通用错误映射前处理 HTTP 200、`20000032` 和 `noPermissionRecordIds`，从原始响应无损映射为有序 `unauthorizedRecordIDList`，并覆盖 `9007199254740993`。显式拒绝显示统一 toast，只将准确返回的整行错误红，取消勾选时清理该行、关闭操作栏时清空全部；全选 403 返回空 ID，只提示，不标红、不发诊断请求。

结论：通过。

## 场景六：shadcn/Radix 批量编辑

提示词：`为使用 shadcn/ui 和 Radix primitives 的 Make 列表接入同样的批量编辑。`

验收标准：以真实安装版本为准，使用包公开通用弹窗和 package-neutral 宿主组件，保持 Radix 浮层的焦点与关闭顺序，不引入 AntD 约定。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-radix

输出证据：Agent 要求 `@qfei-design/make-app-actions@^0.3.1`，先读已安装 `package.json` 再按 `package.ai.json.readOrder` 读取公开合同。它使用 `RecordBatchEditModal` 和 `MakeAppBatchEditComponents` 注入 shadcn/Radix 薄包装，通过 Radix `Portal/container` 逃离裁剪并验证 focus、Escape、outside-click 和焦点回归；明确不引入 AntD、不使用 AntD adapter 或 AntD 形状的 generic props。

结论：通过。

## 场景七：查询交接与表格生命周期

提示词：`可写列表已有选择操作栏，成功应用筛选或排序后如何处理当前选择？CanvasTable 实例重建，且同一查询的 totalCount 先增加后减少时，怎样保证操作选择安全？`

验收标准：成功应用 filter/sort 后清空选择并使 pending action 失效，草稿和失败保留选择；重建、总数增长、总数收缩分别遵守空快照、重新归一化和公共清空的单通知规则。

执行方式：fresh-agent

执行批次：2026-08-14-make-app-actions-0.3.1-r16

执行标识：actions-r16-lifecycle

输出证据：Agent 将筛选/排序的成功应用定义为校验和 Preset 保存成功后的同步查询交接，清空选择并失效旧请求；草稿、取消与保存失败都保留选择。CanvasTable 重建推进 instance/selection generation，发布一次空选择快照且不回放旧选择；同查询 `totalCount` 增加时读取公共快照并调用 `resolveCanvasSelectedRecordSnapshot` 重新归一化，减少时只调用一次 `clearSelection()`，最终只有一次通知。

结论：通过。

## 总结

当前 8 个关联 Skill 目录的组合哈希下，7 个执行标识互不重复的 fresh Agent 场景均在 r16 批次通过。输出覆盖新的 Shift 200、显式 `20000032` 精确反馈、无损大 ID、全选 403 回退，也保留了既有 UI 适配、查询目标一致性和生命周期安全规则。
