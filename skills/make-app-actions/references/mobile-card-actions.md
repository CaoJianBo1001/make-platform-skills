# 手机卡片单条记录操作

## 边界

手机端标准业务记录列表使用卡片，不使用 CanvasTable。手机端当前不支持记录多选、全选、Shift 选择、选择操作栏、批量编辑或其他批量操作；这些能力只属于 desktop/tablet 的 CanvasTable 列表。这里的限制只针对业务记录列表，不影响人员、部门等表单字段自身的多选控件。

卡片点击不是“选中记录”：

- 点击卡片主体进入只读详情全屏任务路由。
- 卡片只展示当前记录可用的单条编辑和单条删除入口。
- 不维护 `selectedRecordIDs`，不生成 `exclude` 模式，不渲染 `RecordSelectionActionBar` 或批量编辑弹窗。
- desktop/tablet 切到手机并卸载 CanvasTable 时，按 [实例生命周期](selection-and-operation-snapshot.md) 清空选择并使旧预检失效；返回桌面从空选择开始。共享 Controller 保留业务草稿和查询缓存，不保留可恢复的旧表格写目标。

用户明确要求定制手机批量能力时，将其作为独立产品设计处理；在平台发布新的手机批量合同前，不从桌面选择栏自动推导实现，也不得把 CanvasTable 塞进手机页面作为替代。

## 复用包的 headless 单条操作模型

`@qfei-design/make-app-actions@^0.3.1` 的 root entry 是无 DOM 的 headless core，可以用于卡片单条操作。不要使用 CanvasTable adapter，也不要复制权限匹配逻辑。

为当前卡片构造只含 `scope: "single"` 的编辑、删除 action，并以单条记录解析：

```ts
const state = resolveRecordSelectionActionState({
  actions: singleRecordActions,
  selectedRecords: [record],
  selectedCount: 1,
  totalCount,
});
```

- `visible` 分别使用当前缓存的 `data.record.update` 和 `data.record.delete` 结果。
- `canOperateRecord` 使用 `resolveRecordOperationPermission`；两个权限点保持独立。
- 操作触发时调用 `validateRecordSelectionAction(action, [record])` 做本地即时反馈。
- 不渲染包的选择操作栏。宿主把 `state.actions` 映射为卡片操作按钮或紧凑更多菜单，视觉和触控布局由 `makeui` 负责。
- 没有可用单条操作时不显示空的操作区，也不在手机卡片上显示“暂无可用的操作”。

## 新建

新建不属于选择 action。由 `makeui` 与 `make-app-permission` 使用当前缓存的实体 create 权限和授权 `createFields` 决定 `MobileFloatingAction` 是否可见。点击后进入 `/objects/:objectKey/new` 全屏任务路由；最终创建接口继续执行权威鉴权和提交字段白名单过滤。

## 单条编辑

1. 从点击的卡片记录冻结不可变目标：对象 key、记录 ID、权限 `data.record.update`、`selectAllMode=false`、`recordIDList=[recordID]` 以及当前权限 generation。不要从任何桌面选择快照读取目标。
2. 使用包 core 校验当前缓存的 App 权限和本地记录权限。
3. 对冻结目标调用一次 `record-write-permission` Service 预检；拒绝或响应过期时不打开编辑页。
4. 预检允许且 generation 仍匹配时，进入该记录的编辑全屏任务路由。
5. 保存时由正常单条更新 Service 接口执行最终鉴权。预检不替代最终写接口。

## 单条删除

1. 从点击的卡片记录冻结与编辑相同形状的单条目标，权限改为 `data.record.delete`。
2. 用包 core 校验当前缓存权限和本地记录权限，然后打开手机确认框；确认框由 `makeui` 使用 `MobileConfirmDialog` 承载。
3. 用户确认后，对冻结目标调用一次 `record-write-permission` 预检，再调用宿主删除 Service 接口。删除接口保留最终权威鉴权；不得只依赖预检。
4. 异步期间锁定重复确认。失败时保留可恢复反馈，不做逐记录诊断；成功后关闭确认框并刷新当前列表。

手机卡片没有 CanvasTable 行颜色可用。权限拒绝使用安全的 toast/消息并保持当前卡片列表；不要为了“爆红”而引入 CanvasTable 或自造持久选择状态。

## 详情任务页操作

手机详情使用 `MobileBottomActionBar` 承载编辑和删除，两项操作继续读取独立权限，不因卡片上已经提供同名入口而省略。

- 卡片操作不能替代或取消详情操作；卡片与详情只是同一单记录 action lifecycle 的两个触发面。
- 详情页根据当前记录分别解析 `data.record.update` 和 `data.record.delete`，不得用一个权限同时控制两个按钮。
- 点击详情编辑后，保持当前详情路由并先对冻结的当前记录执行 `record-write-permission` 预检；允许后直接导航到同一对象、同一记录的编辑任务路由，不得先返回或跳转到对象列表再进入编辑。预检拒绝或失败时留在详情页，不改用列表选择状态重建目标。
- 直接进入编辑路由后，最终更新仍由正常单条更新 Service 接口鉴权；预检不替代最终写接口。
- 删除沿用冻结当前记录、`MobileConfirmDialog`、删除预检和最终删除接口鉴权。
- 编辑与删除都不可用时，整条底部操作栏不渲染；只有一项可用时只展示该项，不保留空按钮或占位。
- 加载、权限 generation 变化或当前记录变化时，使未完成预检失效；迟到结果不得打开或删除旧记录。

## 手机单记录操作场景矩阵

| 场景键 | update 权限 | delete 权限 | 预期 UI／结果 |
| --- | --- | --- | --- |
| `both-allowed` | 允许 | 允许 | 卡片与详情均显示编辑、删除 |
| `edit-only` | 允许 | 拒绝 | 卡片与详情只显示编辑 |
| `delete-only` | 拒绝 | 允许 | 卡片与详情只显示删除 |
| `neither-allowed` | 拒绝 | 拒绝 | 卡片无操作区；详情无底部操作栏 |
| `stale-precheck` | 任意 | 任意 | 丢弃结果，不打开任务页且不删除记录 |

这个矩阵同时适用于缓存 App 权限、记录权限和异步预检的最终合并结果。任何拒绝都不能通过隐藏按钮之外的入口绕过，任何迟到允许也不能重新激活已经失效的目标。

## 并发与模式切换

- 操作快照在任何异步预检前冻结；对象、身份、租户、权限 generation 或目标记录变化时使结果失效。
- 从手机切到 desktop/tablet 不得让迟到的预检打开错误 Drawer；从 desktop/tablet 切到手机也不得把已选多条记录转成手机操作目标。
- 成功更新或删除后按宿主既有缓存失效策略刷新；失败不应清空无关筛选、搜索或表单草稿。
- Service 入口、失败和关键分支日志遵循 `make-app-service`，只记录安全上下文和数量，不记录完整业务数据或凭证。

## 验证

- 手机 DOM 中没有 CanvasTable、复选框、全选、选择操作栏或批量编辑入口。
- 单条编辑与删除分别受独立 App 权限、记录权限和 Service 预检约束。
- 从手机详情点击编辑时，允许结果直接进入当前记录的编辑路由；列表不得在中间渲染或成为必经路由，预检拒绝时仍停留在详情。
- 点击卡片主体只打开详情，不产生记录选择；桌面→手机→桌面后没有残留的表格选择、批量目标或迟到预检结果。
- 快速切换对象、身份、权限 generation 或宽度时，迟到预检不会打开或删除错误记录。
- desktop/tablet 原 CanvasTable 多选、批量编辑、行级反馈和选择生命周期保持不变。
