# 审批包与我的审批列表

适用于完整接入或升级任务中心。本文默认描述两个任务页签；新增第三页签先读 [已发起与实例详情](initiated-instances.md)，按实际包能力启用实例 provider。本文基于已核对的 `@qfei-design/make-app-approval@0.2.17` npm 发布产物；版本号是接入基线，不声称永远为最新版。升级时核对实际安装包的 exports、类型及行为；包内文档若仍写“尚未发布”，以 registry 发布记录和实际产物为准。

历史正式 tarball 对照：0.2.13 与 0.2.14 的 dist 运行代码、公开类型、CSS、PUBLIC_API 和能力元数据逐字节一致；0.2.14 的变化为 URL 宿主展示指导、详情适配示例及发布校验等待配置／文档，不能据版本升级推断新增主题或禁编能力。该历史对照不代表 0.2.16 没有新增能力；当前标准间距、手机筛选适配与申请人跨端回显见 [列表展示合同](list-presentation.md)，原有禁编和只读缺口按下文保留。

## 依赖与职责

- UI 安装审批包和兼容的 `@qfei-design/canvas-table`；明确接入语义主题时使用已核验的 CanvasTable `1.3.5`，宿主与审批列表复用同版依赖。审批包仍声明 `^1.3.2` peer；旧版非主题接入至少需要 1.3.2 的无动画滚动校正，不能沿用 1.3.1，也不能因宽 peer 推断旧版支持语义主题。审批包 React peer 为 `^18.2.0 || ^19.0.0`，运行环境兼容性由 `make-app-runtime` 核对，不能为接包擅自迁移整个项目。
- Service 如消费状态、禁编或撤回校验函数，也安装同一审批包版本，只加载根入口。依赖与锁文件可在干净环境重装；生产不依赖开发机路径、未发布 tgz、node_modules 修改或未随构建分发的补丁。
- 应用入口一次导入 `@qfei-design/make-app-approval/styles.css`，表格样式沿用宿主 CanvasTable 接入。Ant Design/dayjs 是包的示例依赖，不要求宿主更换 UI 库。
- 0.2.10 发布包携带 `examples/field-adapters`，包含人员缓存、数值原文校验和 `use-input-modality.ts`。这些是宿主源码适配示例，按 [字段适配回归](../../makeui/references/field-adapter-regressions.md) 复用已有控件与校验，不当作新的 npm 公开子路径导入。
- 0.2.17 与历史 0.2.13、0.2.14、0.2.16 一样原生覆盖 APPROVED，但未锁定的 REJECTED/CANCELLED 仍返回 null。产品确认三种终态全部只读，按 [普通编辑接线与旧包兼容](status-display.md#公共包与宿主适配) 统一接入随包适配器，保留锁定优先级、运行态限制及入口/保存检查。
- UI/Service 的实际安装包分别执行 [普通禁编验证器](../scripts/verify-record-write-policy.mjs)：默认验证原生能力，`--compat` 仅验证包与参考适配器组合。0.2.17 原生检查失败仍是已知缺口（0.2.13、0.2.14、0.2.16 同样存在）；仍须验证宿主实际接线和后端拒写。消费方支持 approved/ended 原因，不改变任务授权及已完成任务只读适配。

| 公开入口 | 使用内容 |
| --- | --- |
| 根入口 | `APPROVAL_STATUS_FIELD`、`APPROVAL_LOCK_FIELD`、`getApprovalStatusDisplay`、`hasApprovalDefinition`、`isApprovalSystemField`、`getRecordApprovalWriteRestriction`、撤回意见校验；0.2.17 的 `MAKE_APPROVAL_THEME_CONTRACT`、`toMakeApprovalThemeStyle` 和 `MakeApprovalTheme` 类型 |
| `/react` | `ApprovalStatus`，用于只读状态文字/Tag；0.2.17 的 `MakeApprovalThemeProvider`、`useMakeApprovalThemeStyle` |
| `/list` | `MyApprovalsPage`、`ApprovalListProvider`、列表 DTO、基础控件适配类型 |
| `/mobile` | `createMobileApprovalComponents`、`ApprovalMobileToolkit`、申请人 loader 与诊断类型，消费正式移动包公开控件 |
| `/detail` | `ApprovalTaskDetail`、`readApprovalTaskDetail`、`getApprovalTaskFields`、`buildApprovalTaskAction`、`ApprovalTaskValidationError`、`ApprovalInstanceDetail`、`readApprovalInstanceDetail` 及任务/实例类型 |

业务代码只导入公开入口，不深层导入 src/dist。包负责列表状态、查询草稿、虚拟表格和详情办理状态机；宿主负责导航、应用/身份上下文、Service 请求、字段与控件适配、详情容器、历史查询及错误出口。不要复制公共包源码、构造第二张任务表格或另做一套桌面列表分页状态。

## 主题能力与边界

0.2.17 正式提供根入口的 `MAKE_APPROVAL_THEME_CONTRACT === "make-app-approval/semantic-theme/v1"`、纯函数 `toMakeApprovalThemeStyle(theme, presentation?)` 及 `/react` 的 `MakeApprovalThemeProvider`、`useMakeApprovalThemeStyle(presentation?)`。按 [唯一主题适配](../../makeui/references/public-component-theme.md) 将项目固定方案转为 `MakeApprovalTheme`，不让审批包读取 MakeDesign。宿主继续提供 Input、Select、DateRangePicker、Button、Tabs 及详情字段控件适配，沿用所选组件库的公开主题，不把示例依赖变成包的运行时必需依赖。

- Provider 接收 `theme?`、`presentation?: "desktop" | "mobile"` 和 `children`，不新增 DOM 外框；无上级主题时，无主题或空主题保留旧默认。嵌套 Provider 继承并合并父主题，`theme={}` 不清空父主题；未传 presentation 时继承父级，无父级时默认 desktop。主题更新只更新公开视觉上下文，保持原 provider、Controller、字段草稿和审批意见，不以主题 hash 重挂载。
- PC／平板使用 `desktop` 视觉；独立手机区域显式 `presentation="mobile"`。手机只允许 primary、onPrimary、primarySoft、link、focusRing 五项品牌色，原移动控件、字段布局、字号、尺寸和表面保持原规范。该 Provider 不替代独立的移动控件颜色 Provider，也不改变列表／详情各自的 `presentation` 接线。
- 包拥有的状态、列表、详情和意见区域消费公开主题；宿主注入的组件仍由其组件库 Provider 负责。Portal 使用公开 hook 或主题插槽获取同份样式，不能假设脱离 CSS 祖先后会自动继承。
- 未提供新 Provider 的旧接入继续使用 `themeKey`／公开控件插槽。0.2.16 没有新 Provider，其 `themeKey` 只通知 Canvas 重新读取已接入的 CSS 主题，原包外框不能据此宣称完整主题化；旧包缺能力时保留兼容并记录差异，不向旧产物传新参数、不覆盖私有结构或复制控制器。

升级时分别验证 npm 实际版本、公开导出／类型、CSS 和宿主真实主题结果。包内 capability 文案可能仍写旧版本或“未发布”，以 registry 和实际 tarball 为准；本次正式产物确认不替代业务权限、真实流程或浏览器验收。

## 页面接线

独立路由挂载 `MyApprovalsPage`，必传 `scopeKey`、`provider`、`components`、`onOpenApproval`：

- `scopeKey` 从环境、应用、租户/权限范围、当前用户派生，不含 token；上下文改变时同时销毁旧详情和候选状态。它用于隔离缓存，不是鉴权凭据。
- `provider.loadPage(query, { signal })` 仅经统一 UI → Service 请求层取得当前用户任务，返回 `{ rows, total }`。稳定 provider 身份，透传 AbortSignal，忽略过期结果，不能吞掉错误返回空数组。
- `onOpenApproval(row)` 先按 referenceType 分流；任务使用 `processInstanceId + taskId` 打开详情，缺任一标识时报合同错误；实例只要求 processInstanceId，按 [实例接线](initiated-instances.md) 打开只读详情。不拿 recordId 代替 taskId，不根据当前对象是否绑定流程阻断历史访问。
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

桌面列表固定四列：申请单ID、业务表单、申请人、申请时间，另有序号和详情入口。本基线不展示流程状态列或状态筛选；`statusOptions` 和 `processStatus` 查询字段只是兼容接口，不主动恢复该 UI。业务对象列表的“流程状态”仍按 [状态展示](status-display.md) 保留。

## 宿主控件与布局

`components` 必须完整提供以下受控适配器，放在模块作用域，避免输入时重新挂载：

| 适配器 | 关键合同 |
| --- | --- |
| Input | `value/onChange(string)`、id、ariaLabel、placeholder、disabled；宿主 DOM 事件转字符串 |
| Select | 单选 `{value,label}[]`；`purpose: applicant` 仅为适配元数据，不透传 DOM；空字符串代表全部申请人 |
| DateRangePicker | 真正的范围组件；值及回调为 `[YYYY-MM-DD, YYYY-MM-DD]`；清空 `['','']`；不以两个单日期控件代替 |
| Button | `htmlType`、`variant`、onClick、disabled、loading、ariaLabel；查询为 submit，其他为 button |
| Tabs | `items/value/onChange`，按传入 `items` 转发有效页签值，只挂载一次活动 children，保留键盘及 tab/panel 关联 |

宿主 Tabs 事件适配不能写死只允许 `pending/approved`；新增 `initiated` 时，这会造成页签可见但点击被吞掉。底层控件回传 string key 时，从本次 `items` 查找匹配项，再用其已类型化的 value 调用 `onChange`，无需强制类型断言。例如适配器的事件处理可写为：

```tsx
onChange={key => {
  const item = items.find(item => item.value === key);
  if (item) onChange(item.value);
}}
```

活动值和列表查询仍由审批包管理，宿主不另建页签状态或在点击回调里直接查询。桌面／手机分别核对实际使用的适配器；仅增加 `tabs` 数组、通过类型检查或单独调用 provider，不能证明点击链路已接通。

申请人候选来自宿主 users 接口，可在 Select 适配器远程加载；提供加载、失败重试、取消和已选名称回显，不能用审批当前页的人员反推完整候选。筛选先改草稿，查询后生效，重置清空，切换页签保留已应用条件，由包处理。

正式 0.2.16 的标准模式通过 `selectedOption` 与可选第二参数保存远程人员可读名称，桌面／手机适配器及旧单参兼容边界见 [申请人跨端回显](list-presentation.md#申请人跨端回显)。仅传 ID、仅检查 provider 或在单端缓存名称不能证明跨端回显已通过；旧正式包仍按实际公开类型接线。

新接入或本轮列表外观改造在正式 0.2.17 显式设置 `spacing="standard"`；默认仍为 `spacing="host"`，以保留旧宿主的留白所有权。手机专用基础控件使用 `/mobile` 工厂与正式移动包 `0.1.16` 的公开筛选入口，精确接线见 [列表展示合同](list-presentation.md)，不复制控制器。

列表页用 `className="make-app-approval--fill"` 填满剩余内容区。Shell、Tabs 根节点、中间包装层及活动面板传递确定高度和 `flex: 1; min-height: 0; min-width: 0`，页签栏不收缩；表格自身滚动，页面不滚动，不写固定视口减数。包已提供无外层卡片边框、筛选区下方 12px、页签及内容区间距；其他 Tabs 组件通过公开适配器提供等效间距，避免叠加旧覆盖。

PC 页签栏左右内边距 12px、活动面板四边内边距 12px、筛选区下方 12px；页签、搜索与表格共用内容对齐线，外 Shell 留白独立计算，不叠加第二份面板留白。成功空列表仍保留四列表头和表体，在表体内展示“暂无审批记录”等明确空数据提示，不要求改写现有文案。尺寸所有权、旧产物能力缺口、手机控件外观及真实浏览器验收统一见 [列表展示合同](list-presentation.md)，正式 0.2.16 已提供标准模式与表格体内空提示；0.2.14 不具备全部新增能力，不能向旧产物套用新参数。

非活动 Tabs 面板不得参与布局或占用高度；宿主设置 `display: flex` 等布局样式时，须保留非活动面板的隐藏行为。

本基线的桌面尺寸、列宽和图标行为由包负责，宿主保持高度链及公开 themeKey，不增加第二套 ResizeObserver、列宽计算或私有 Canvas 操作：

- 四列已内置标识、文本、单用户、日期时间图标；不再由宿主叠加图标，也不把包内列函数当作公开导出。
- 基础列宽为 260/180/170/220px，序号区 64px，合计 894px。宽容器的剩余空间平均分配给四列，窄容器保留基础宽度和横向滚动；这是此包版本的行为，不是其他业务表格的通用列宽。
- 容器或窗口尺寸改变时批量更新，尺寸不变不重复更新，主题变化仍可刷新。宽度变化不重建表格、不清空虚拟页缓存；横向偏移越界时无动画收敛，保留有效纵向位置，不能回滚用户正在进行的滚动。
- 高度增加时仅补取新增可见区域的缺页，重复测量不反复取数；卸载清理监听。升级验收覆盖宽窄往返、全屏/侧栏变化、深处滚动、主题切换和页面关闭。

## 多端边界

已核验的 0.2.16 发布产物包含 `MyApprovalsPage presentation="mobile"`、详情布局插槽 `detail/sections/actionItems` 及 `ApprovalTaskDetail presentation="mobile"` 字段展示能力。0.2.11 缺少最后一项，0.2.7 不包含这些手机能力；旧版本先核对并升级到具备所需能力的正式产物，不能直接传入不存在的参数。审批包与 `make-app-mobile` 分别核验，不能因审批包升级就认定移动组件包也已支持所有控件。

支持该能力的产物中，宿主由已有响应式上下文选择 `presentation="mobile"`，桌面/平板不传或传 `desktop`。手机公共卡片、列表查询状态、滚动追加、失败重试与下拉刷新归审批包；宿主只提供手机基础控件适配、导航、provider 和详情容器，不复制一套列表/分页 Controller。不生成不存在的 `MobileMyApprovalsPage` 导出。

以下 ID／申请人筛选、任务完成时间和结果规则仅用于两个任务页签。启用 initiated 后，实例只按发起日期筛选；任务和实例共享列表控制器，按 referenceType 选择详情。实例详情使用 application/history/feedback 插槽，没有意见或办理动作；字段展示同样显式传入 mobile。完整接线见 [手机实例详情](mobile.md#手机实例详情)。

- 卡片显示业务表单、字符串申请单 ID、申请人、申请时间；已完成增加审批结果和完成时间。可选 `completionResult` 为已确认的任务动作展示值，`completionTime` 为宿主格式化的任务完成时间，缺失显示 `—`，不得由流程状态推断结果，也不得以申请时间冒充完成时间。当前 Workflow 列表可读 `taskCompletedAt`，但未明确提供完成动作；没有此字段时按缺失展示，不逐卡读取详情。
- ID 搜索按钮/回车后精确查询，清空立即生效；人员、完整日期范围选择和清空立即应用，但不顺带提交 ID 草稿。搜索框及时间/申请人入口使用宿主小号尺寸，编辑输入保持 iOS 安全字号。时间与申请人入口同一行左右排列，均打开移动包底部弹层；手机不展示筛选操作、重置、刷新按钮。桌面仍使用查询/重置/刷新，不改变现有行为。
- 日期 `startDate/endDate` 当前筛选流程开始时间，手机两个页签均标申请时间，不因已完成卡片显示完成时间就将条件标为任务完成时间。
- 手机列表内部滚动，临近底部追加，保留同一记录的不同任务；加载更多提供可点击后备入口，失败保留已加载卡片并重试。顶部下拉刷新沿用已应用条件，无独立刷新按钮；切换条件/身份取消旧请求，详情开关不刷新列表。
- 日期范围、人员搜索复用宿主移动控件，弹层不被列表裁切；使用现有主题，不能为复刻截图另加品牌色。根导航及账号入口由 makeui/宿主保持一份。

手机详情、字段、审批记录、意见输入框、固定操作栏与导航统一遵循 [移动端适配](mobile.md)。通过已发布的 `detail/sections/actionItems` 组合宿主 View，继续复用包的办理控制器；桌面/平板保留原控件、容器与操作位置。
