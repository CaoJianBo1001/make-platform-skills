# 审批包与我的审批列表

适用于完整接入或升级任务中心。本文基于已核对的 `@qfei-design/make-app-approval@0.2.7` 公开产物；版本号是接入基线，不声称永远为最新版。升级时核对实际安装包的 exports、类型及行为，不能只依据文档中的旧“尚未发布”或“状态筛选”说明。

## 依赖与职责

- UI 安装审批包和兼容的 `@qfei-design/canvas-table`；本基线使用 CanvasTable `1.3.2`，审批包声明 `^1.3.2` peer，无动画滚动校正依赖此能力，不能沿用 1.3.1。审批包 React peer 为 `^18.2.0 || ^19.0.0`，运行环境兼容性由 `make-app-runtime` 核对，不能为接包擅自迁移整个项目。
- Service 如消费状态、禁编或撤回校验函数，也安装同一审批包版本，只加载根入口。依赖与锁文件可在干净环境重装；生产不依赖开发机路径、未发布 tgz、node_modules 修改或未随构建分发的补丁。
- 应用入口一次导入 `@qfei-design/make-app-approval/styles.css`，表格样式沿用宿主 CanvasTable 接入。Ant Design/dayjs 是包的示例依赖，不要求宿主更换 UI 库。

| 公开入口 | 使用内容 |
| --- | --- |
| 根入口 | `APPROVAL_STATUS_FIELD`、`APPROVAL_LOCK_FIELD`、`getApprovalStatusDisplay`、`hasApprovalDefinition`、`isApprovalSystemField`、`getRecordApprovalWriteRestriction`、撤回意见校验及类型 |
| `/react` | `ApprovalStatus`，用于只读状态文字/Tag |
| `/list` | `MyApprovalsPage`、`ApprovalListProvider`、列表 DTO、基础控件适配类型 |
| `/detail` | `ApprovalTaskDetail`、`readApprovalTaskDetail`、`getApprovalTaskFields`、`buildApprovalTaskAction`、`ApprovalTaskValidationError` 及详情类型 |

业务代码只导入公开入口，不深层导入 src/dist。包负责列表状态、查询草稿、虚拟表格和详情办理状态机；宿主负责导航、应用/身份上下文、Service 请求、字段与控件适配、详情容器、历史查询及错误出口。不要复制公共包源码、构造第二张任务表格或另做一套桌面列表分页状态。

## 页面接线

独立路由挂载 `MyApprovalsPage`，必传 `scopeKey`、`provider`、`components`、`onOpenApproval`：

- `scopeKey` 从环境、应用、租户/权限范围、当前用户派生，不含 token；上下文改变时同时销毁旧详情和候选状态。它用于隔离缓存，不是鉴权凭据。
- `provider.loadPage(query, { signal })` 仅经统一 UI → Service 请求层取得当前用户任务，返回 `{ rows, total }`。稳定 provider 身份，透传 AbortSignal，忽略过期结果，不能吞掉错误返回空数组。
- `onOpenApproval(row)` 使用 `processInstanceId + taskId` 打开详情。缺任一标识时报合同错误；不拿 recordId 代替 taskId，不根据当前对象是否绑定流程阻断历史任务。
- 动作成功后改变 `refreshKey`，重新查当前页签和已查询条件，按包的刷新机制保留有效滚动位置；仅关闭详情不刷新。动态主题改变用 `themeKey` 通知 Canvas 重读主题。
- `pageSize` 默认 20，合法范围 1–200；包的 provider 页码从 1 开始。Canvas 内部页码转换、缓存、并发、取消和后续页失败重试由包负责，宿主不能再加 1。

## 查询与行映射

| 包查询 | Workflow 请求 |
| --- | --- |
| `tab: pending`，页面“待处理” | `taskStatus: PENDING` |
| `tab: approved`，页面“已完成” | `taskStatus: COMPLETED` |
| `keyword` | trim 后的完整 `recordId`，精确查询，空串省略 |
| `applicantId` | `starterId`；人员候选 ID，不能以姓名筛选 |
| `startDate/endDate` | `YYYY-MM-DD 00:00:00` / `YYYY-MM-DD 23:59:59`，空串省略 |
| `page/pageSize` | `pagination: { page, size: pageSize }` |

Service 固定当前部署 `appKey` 和 `viewType: MY`。已完成是当前用户的任务完成，不是流程已结束。不要补查 CLOSED、合并多种 taskStatus、按 processStatus 重分类、按 recordId 去重或本地过滤已加载页；保留后端顺序、总数以及同一业务记录的不同任务。

日期边界使用应用约定的自然日，不先转 UTC；当前已验证 Workflow 使用日期与时间之间的**空格**，不使用 `T`。可在 UI provider 或 Service 单一适配边界转换一次，API 文档写明落点。人员 ID 在 UI → Service 保持十进制字符串，Service → Workflow 按 Long 合同无损编码整数，见 [接口合同](workflow-api.md)。

| 包行字段 | 数据来源 |
| --- | --- |
| `id`、`taskId` | `taskId`，稳定且唯一；不是数组下标或业务记录 ID |
| `processInstanceId/entityKey/recordId/processStatus` | 同名原始字段；真实任务接入须校验非空标识与状态 |
| `applicationNo` | `recordId` 原字符串 |
| `applicationType` | `formName` |
| `applicantName` | `starter.userName` |
| `applicationTime` | `processStartedAt`，按应用时区格式化为 `YYYY-MM-DD HH:mm:ss` |
| 返回 `total` | 信封的 `pagination.total`，非负安全整数，不能用本页 rows.length 替代 |

列表固定四列：申请单ID、业务表单、申请人、申请时间，另有序号和详情入口。审批包 `0.2.7` 不展示流程状态列或状态筛选；`statusOptions` 和 `processStatus` 查询字段只是兼容接口，不主动恢复该 UI。业务对象列表的“流程状态”仍按 [状态展示](status-display.md) 保留。

## 宿主控件与布局

`components` 必须完整提供以下受控适配器，放在模块作用域，避免输入时重新挂载：

| 适配器 | 关键合同 |
| --- | --- |
| Input | `value/onChange(string)`、id、ariaLabel、placeholder、disabled；宿主 DOM 事件转字符串 |
| Select | 单选 `{value,label}[]`；`purpose: applicant` 仅为适配元数据，不透传 DOM；空字符串代表全部申请人 |
| DateRangePicker | 真正的范围组件；值及回调为 `[YYYY-MM-DD, YYYY-MM-DD]`；清空 `['','']`；不以两个单日期控件代替 |
| Button | `htmlType`、`variant`、onClick、disabled、loading、ariaLabel；查询为 submit，其他为 button |
| Tabs | `items/value/onChange`，只挂载一次活动 children，保留键盘及 tab/panel 关联 |

申请人候选来自宿主 users 接口，可在 Select 适配器远程加载；提供加载、失败重试、取消和已选名称回显，不能用审批当前页的人员反推完整候选。筛选先改草稿，查询后生效，重置清空，切换页签保留已应用条件，由包处理。

列表页用 `className="make-app-approval--fill"` 填满剩余内容区。Shell、Tabs 根节点、中间包装层及活动面板传递确定高度和 `flex: 1; min-height: 0; min-width: 0`，页签栏不收缩；表格自身滚动，页面不滚动，不写固定视口减数。包已提供无外层卡片边框、筛选区下方 12px、页签及内容区间距；其他 Tabs 组件通过公开适配器提供等效间距，避免叠加旧覆盖。

非活动 Tabs 面板不得参与布局或占用高度；宿主设置 `display: flex` 等布局样式时，须保留非活动面板的隐藏行为。

0.2.6–0.2.7 的尺寸、列宽和图标行为由包负责，宿主保持高度链及公开 themeKey，不增加第二套 ResizeObserver、列宽计算或私有 Canvas 操作：

- 四列已内置标识、文本、单用户、日期时间图标；不再由宿主叠加图标，也不把包内列函数当作公开导出。
- 基础列宽为 260/180/170/220px，序号区 64px，合计 894px。宽容器的剩余空间平均分配给四列，窄容器保留基础宽度和横向滚动；这是此包版本的行为，不是其他业务表格的通用列宽。
- 容器或窗口尺寸改变时批量更新，尺寸不变不重复更新，主题变化仍可刷新。宽度变化不重建表格、不清空虚拟页缓存；横向偏移越界时无动画收敛，保留有效纵向位置，不能回滚用户正在进行的滚动。
- 高度增加时仅补取新增可见区域的缺页，重复测量不反复取数；卸载清理监听。升级验收覆盖宽窄往返、全屏/侧栏变化、深处滚动、主题切换和页面关闭。

## 多端边界

当前包没有独立手机列表/历史导出，不能虚构 `MobileMyApprovalsPage` 等 API，也不能把 CanvasTable 缩放到手机冒充卡片列表。新 App 的手机导航和任务容器继续由 `makeui` 决定：手机列表需宿主卡片 View，复用同一任务查询映射、身份隔离、筛选和详情 reference；桌面列表继续由包管理。手机详情可使用 `ApprovalTaskDetail` 的 `renderLayout` 接入全屏任务容器并提供手机字段控件；测试窄屏动作、意见及历史布局后才能报告手机完成。某个宿主保留窄屏右抽屉的定制不作为平台默认。
