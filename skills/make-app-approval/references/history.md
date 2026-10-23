# 审批历史与业务详情流程区

当前审批包只提供 `ApprovalTaskDetail.history` 插槽，**没有历史表格组件或 timeline provider 导出**。历史由宿主实现、查询只读 Workflow 时间线，不伪造任务记录或复制流程设计器。

## 定位与数据

- 我的审批详情：使用已核验 task detail 的 processInstanceId，标题“审批记录”。
- 业务对象详情：使用 entityKey + recordId，标题“审批流程”；应用已接入且记录有非空、非 UNSUBMITTED 状态时查询。当前对象解绑不删除历史入口。
- 请求经宿主 Service → `bpm-timeline / MakeService.ListResources`，实例定位与记录定位二选一，后者由 Service 注入 appKey；分页从 1 开始，默认每页 20。
- 校验 data 数组、非负安全整数 pagination.total、非空 eventId 及实例匹配。按记录定位时校验返回事件属于同一实例；不能将多个实例混在同一表格而不说明。
- 保留后端顺序、重复节点与轮次。不要按 nodeKey 合并，不拼当前待办，不用 actionType 推导流程结果。

## 两个展示落点

| 落点 | 按顺序展示 |
| --- | --- |
| 我的审批“审批记录” | 节点名称/轮次（nodeName）、审批时间（eventTime）、审批结果（processStatusAfter）、审批人（operator.userName）、审批意见（comment） |
| 业务详情“审批流程” | 节点名称（nodeName）、审批人（operator.userName）、审批时间（eventTime）、审批结果（processStatusAfter）、审批意见（comment） |

只展示这五项，不添加序号、节点状态、关闭原因或推测轮次；名称采用后端 nodeName。时间按宿主格式，缺省值 `-`。事件的 processStatusAfter 是历史值，不能拿当前实例状态覆盖它，也不能因结果异常就在前端硬编码 PROCESS_STARTED 的状态。时间线固定列直接消费事件，不为读取历史额外请求 Entity 字段定义。

两个历史落点共用独立的逐行结果适配：RETURNING →“退回修改”、IN_APPROVAL →“审批中”、APPROVED →“已同意”、REJECTED →“已拒绝”、CANCELLED →“已撤回”，空值显示 `-`，未知值显示“状态未知”；其余已识别值复用公共状态工具。公共包将 RETURNING 合并为“审批中”，历史须覆盖这一项，不能改动业务记录的状态字段或标题 Tag。退回后的 SUBMIT 行只按它自己的 processStatusAfter 展示，不能按 actionType 推断或重写前面的退回行。

历史表头复用宿主字段类型图标和 CanvasTable 的公开 prefixRender：nodeName 为 Text、eventTime 为 DateTime、processStatusAfter 为 SingleSelect、operator 为 SingleUser、comment 为 TextArea。两种列序使用同一图标映射；保留原列标题，不复制审批包内部 SVG 或引入第二套图标库。历史图标由宿主负责，任务列表四列图标已由审批包提供。

桌面复用宿主 CanvasTable，只读、底边闭合；total 仅决定下一页，不增加总数文案，单页隐藏分页栏，多页上一页/下一页。这是历史表格的独立分页，不是任务列表的虚拟滚动分页。手机用相同五项的可读布局与分页，不强制 Canvas。

## 生命周期与容器

加载、失败重试和真实空态独立；关闭、切换实例/身份/环境取消请求，旧响应不能污染新页。Canvas 在容器可测量后创建，提前返回的数据仍保留，全屏只调整尺寸，卸载清理表格与观察器。撤回成功后刷新业务历史；办理成功后按宿主关闭/刷新机制更新任务历史。

任务正文顺序为申请信息 → 审批记录 → 审批意见，history 只读、不参与字段校验。0.2.7 插槽默认有“审批流程”标题；宿主已有“审批记录”标题时仅保留一个。优先采用包后续公开标题配置；基线需要时仅在审批详情宿主作用域处理重复标题和间距，禁止全局隐藏 h3、改 node_modules 或另造流程图。
