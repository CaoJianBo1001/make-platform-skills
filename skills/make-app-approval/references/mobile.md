# 我的审批移动端适配

适用于审批包支持手机 View 后的宿主接入与迭代。先读取 makeui 的手机布局、字段和底部导航规范，复用当前组件能力与主题；桌面/平板保留原有行为。公共组件可用时按 [移动详情公共组件](../../makeui/references/mobile-detail-components.md) 直接调用，不按文字尺寸重新复制样式；旧产物不支持时先报告版本缺口。

## 产物与职责

- 当前已核验正式基线 0.2.11 包含手机列表与详情布局插槽，见 [包与列表](package-and-list.md#多端边界)。以实际安装的 exports、类型和行为为门禁；旧版本缺少能力时升级正式依赖，不以本地链接替代交付。审批包和 make-app-mobile 的能力分别核验。
- 包拥有 MyApprovalsPage 的查询、列表、追加页、取消和重试，以及 ApprovalTaskDetail 的草稿、权限复核、校验、预上传与提交状态机。宿主只提供路由、Service provider、控件、字段展示、历史和布局适配。
- 使用公开入口；不深导入 src/dist，不另写任务列表或办理 Controller。本机预览可以使用模拟接口，但不能当真实后端或真机验收。

## 列表与筛选

- 由已有响应式上下文显式选择 `presentation="mobile"`；不传时保持桌面。手机卡片不挂 Canvas，桌面/平板仍用原表格和查询/重置/刷新。
- 仅待处理与已完成。卡片展示类型、完整申请单 ID、申请人及申请/完成时间；申请人与时间同排两端对齐，窄屏可换行。完成时间取 taskCompletedAt，结果仅在列表合同确有动作字段时接入，缺失显示 `—`；不按流程状态推断，不逐卡追加详情请求。
- 搜索文案“搜索申请单ID”，trim 后精确查询，不增加标题搜索。点击搜索/回车生效，清空立即生效；输入草稿与已应用条件分离。
- 时间和申请人使用小号入口（本轮 28px），同排左右布局；搜索同为小号，输入文字保持 iOS 安全字号。两个入口均打开 make-app-mobile 底部弹层，不使用桌面下拉或另造弹层。
- 完整日期范围/清空、申请人确认立即应用并回到第一页，不顺带提交 ID 草稿。当前日期条件筛选流程开始时间，两页签均叫“申请时间”，不能因卡片显示完成时间更名为任务完成时间。
- 手机不展示查询、重置或刷新按钮。内部滚动追加、失败保留已有卡片并提供重试和加载更多后备入口；下拉刷新保留已应用条件。关闭详情不刷新；切换条件/身份取消旧请求并隔离迟到响应。
- 搜索候选关闭/重开时清空搜索词并恢复初始候选；已选名称独立保留，不污染别的关键词结果。只复用真实人员候选请求，不用样例数据替代。
- 弹层相对真实手机视口定位；桌面居中窄容器预览应使用独立手机视口，不通过改公共弹层宽度补偿错误预览环境。

## 详情、字段与操作

- 卡片以真实 `processInstanceId + taskId` 进入可直达、刷新的全屏任务路由，保留租户/应用 query 和字符串 ID。手机根账户栏、底部 Tab 不与任务页重复叠加，返回保留列表条件、加载内容和滚动，办理成功才刷新。
- 以 ApprovalTaskDetail 的 renderLayout 组合可选 `detail/sections/actionItems`（核验实际产物）。加载或失败时 sections 不存在，必须渲染原 content 中的加载/重试，并保留手机页头返回；只有 sections 存在的成功态才分别渲染 application/history/opinion/feedback，不再同时挂 content。可选 summary 只用于标题、发起人与提交时间，不作为授权依据。
- 审批详情/审批记录页签点击后滚动定位同一正文中的区块，不隐藏或重建字段草稿；页头、操作底栏在正文滚动之外。桌面/平板继续原抽屉、宽度和全屏行为。
- 当前节点 fieldPermission/actions 与 PC 同源，混合编辑和只读，不把手机详情统一设为只读。复用原数值、日期、附件、Lookup 和候选链路；只读不获取编辑候选，禁用状态不接受回写。
- 优先复用 MobilePageHeader、移动日期/范围/日期时间、选项、身份及附件字段；Lookup 复用宿主已有的任务授权候选。普通字段同排左标签右值，附件可全宽，长内容自然撑高；标签槽 minmax(96px,34%)、普通行至少 56px，只读 14px/24px，编辑输入至少 16px、交互高度至少 44px。使用公开 form-value/trigger 类，不覆盖公共组件私有结构。
- 选择器取消不改值，时间秒值、长 ID、数值原文精度、已选名称及 File 对象保持；附件继续原预上传与授权，不另走普通记录保存。
- 审批包的 sections.application 已拥有标题、字段 label、必填及错误布局；renderField 只返回值控件，不在其内再套 MobileFieldRow，也不为整个 application 再添加同名 MobileDetailSection 标题。宿主自建普通业务字段行/区块才使用这两个公共组件。连续任务详情用 MobileDetailPage 保留原 application/history ReactNode，opinion 和 feedback 进入尾部正文。只替换公开插槽；缺少必要结构或样式能力时报告包缺口，不复制 Controller、不删除包节点或修改 PC 共用模板。
- 审批意见/撤回原因使用 MobileTextArea 默认两到五行、实际测量自动增高与内部滚动，字段 TextArea 使用 inline 外观；保留原受控值、字数、必填与错误，PC 不变。
- 编辑/办理底栏使用 MobileFormActionBar size="small"。从 actionItems 映射 key=actionType，保留原 label/onClick/loading，disabled 合并包状态与宿主字段错误；APPROVE/SUBMIT 为 primary，其余为 default，沿用原动作语义。无动作不留空底栏；记录详情的编辑/删除等图标操作仍使用原 MobileBottomActionBar。
- actionItems 回调直接复用包控制器，保留 loading/disabled、本地数字校验门禁、最新权限复核、重复提交保护与失败恢复。RETURN 不受业务数字错误阻断，仍只提交意见及唯一目标、空 recordPatch；不根据截图增加撤回/终止等动作。

## 手机布局接线参考

使用随包 [纯布局适配器](../assets/mobile-detail-layout.mjs) 组合公开插槽；它不读取字段值、不请求、不生成授权动作。宿主接入时沿用已有页头及桌面 renderLayout。hasFieldErrors 是现有字段校验结果，不能另写数值转换；provider 仍在序列化、附件预上传和发送动作前复核全部已修改字段，禁用按钮不能替代提交边界校验。

宿主页头接收公开 slots，按 [流程状态标题合同](status-display.md#展示合同) 使用 detail 中的真实状态；需要修正文案时替换标题组，不同时保留旧 Tag。无 detail 时保留 slots.title；沿用原标题排版，不改变控制器、字段及动作。

```tsx
import type { ApprovalTaskDetailProps } from '@qfei-design/make-app-approval/detail';
// composeApprovalTaskLayout 来自随包参考适配器；两个 renderExisting... 是宿主已有容器接线。
const renderLayout: NonNullable<ApprovalTaskDetailProps['renderLayout']> = (slots) => {
  if (presentation !== 'mobile') return renderExistingDesktopLayout(slots);
  const view = composeApprovalTaskLayout(slots, { presentation, hasFieldErrors });
  return <MobileDetailPage
    header={renderExistingMobileHeader(slots)}
    sections={view.sections}
    trailingContent={view.content ?? <>{view.opinion}{view.feedback}</>}
    footer={view.actions.length > 0 ? <MobileFormActionBar size="small" actions={view.actions} /> : null}
  />;
};
```

展示切换不改变 ApprovalTaskDetail 的 scopeKey、任务 reference 或控制器身份。没有 history 时不创建空历史页签；加载/失败不创建空操作栏；办理完成后空 actionItems 不恢复旧动作。参考适配器测试只证明插槽组合，宿主仍须用实际安装的审批包测试字段 DOM、加载失败后的重试、只读/可编辑混合字段、RETURN 与非必填数值错误，以及 PC 来回切换的草稿保持。

## 紧凑审批时间线

- 仅手机历史 View 使用 make-app-mobile 的 MobileTimeline，宿主仅映射 items，不再复制时间线 JSX/CSS；按 [共享数据源与滚动展示](history.md#共享数据源与滚动展示) 复用 PC 的 timeline 完整查询、授权、取消和重试。一次获取全部事件，滚动不追加请求，不合并重复节点/轮次，不另造接口或逐条读取详情。
- 节点标题与结果同排，标题突出、结果使用既有主题；审批人与完整时间合并为弱化文字行，窄屏允许换行。圆点用细线连接，最后节点不继续连线，缩小记录间距。
- 意见有内容时直接显示普通文字；空、纯空白或既有空值占位符 `-` 不展示，不显示“审批意见：—”，不增加底色卡片。保留换行与长文本折行。
- 结果与 PC 共用 [历史结果适配](history.md#共享历史结果)：直接显示事件 actionResult，未知文本原样保留，空值为 `-`，不以 actionType 或当前实例状态替代。两端使用同一完整事件列表与定位，手机只改变布局与空意见展示。

## 业务对象详情中的审批区域

- 业务对象手机详情的“审批流程”复用同一个历史组件的手机时间线；共享样式随历史组件加载，不依赖先进入我的审批任务页。PC 保持原表格、列序、结果映射和全屏行为。
- “发起审批”和“撤回”沿用业务详情原记录操作栏；详情独立发起不要求普通编辑权限，不调用普通更新、关系保存或附件上传。有有效 BPM 绑定、明确未提交且未锁定的记录进入普通编辑页后，用同一 MobileFormActionBar 展示“保存”和“保存并提交”，复用原保存控制器。撤回由最新真实 starter、运行状态和 endedAt 判断；手机使用 MobileFormSheet + MobileTextArea 填写必填原因，取消不提交，提交前重新核查资格、防重复并保留失败输入，成功后回读业务记录，不本地解除审批锁。PC 原弹窗不变。
- 发起仅在当前有有效流程绑定、记录明确 UNSUBMITTED 且未锁定时显示，点击重新核对最新状态，遵守无普通读权限会话的恢复合同，不以强制 Data 回读代替发起资格；不调用普通创建或 PATCH。终态不额外生成重新发起能力；RETURNING 由我的审批当前任务 SUBMIT 继续原实例。
- 普通编辑仍按原审批锁及 IAM 双重限制：IN_APPROVAL、RETURNING 或明确锁定时不展示编辑，不接受迟到保存；不能因手机详情适配放开编辑，也不能把当前任务节点授权混入普通详情权限。

## 根底部导航

以 makeui 的移动导航规范为唯一组合规则：我的审批作为业务入口序列最后一项，之后才是可用的 AI 助手、需要时最右侧的工作台。审批不加入业务对象网格或对象授权集合，只计入底部导航的入口数量；全部业务对象、审批和可用 AI 合计超过 5 项时显示工作台：有 AI 从 4 个业务对象起，无 AI 从 5 个起。工作台出现时为审批、AI 和工作台预留位置，总数不超过五项，剩余对象从工作台进入。没有审批的应用沿用原逻辑，桌面导航不变。

验收矩阵见 [验证场景](verification.md#手机适配回归)。
