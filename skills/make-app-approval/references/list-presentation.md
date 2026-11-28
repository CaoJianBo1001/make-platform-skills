# 我的审批列表展示合同

用于新接入、列表外观改造或排查 PC／手机展示差异。只规定审批列表的公共结构与宿主接线，不接管普通对象列表、全应用 Shell、业务字段或移动选择面板内部。

## 版本和实现门禁

当前已核验正式审批基线为 `@qfei-design/make-app-approval@0.2.17`，手机标准组合使用 `@qfei-design/make-app-mobile@0.1.16`。已从 registry.npmjs.org 取得版本元数据和 tarball，校验 SHA512 integrity 后核对实际公开 exports、类型、CSS 与运行产物；下述标准间距、空表及移动筛选能力从 0.2.16 已正式提供，0.2.17 新增的语义主题按 [包主题说明](package-and-list.md#主题能力与边界) 接入。旧审批 0.2.14 不具备本次全部新能力，不能向旧包直接传入新参数。

既有 App 没有本轮升级／改造要求时保留锁定依赖。缺少公开能力时报告具体包缺口；不靠深导入、覆盖私有 class、复制列表控制器或虚构 props 实现表面一致。

新接入或本次列表改造显式使用 `spacing="standard"`；包的默认 `spacing="host"` 保留原宿主间距行为，不会仅因升级版本就自动切换。依赖门禁按实际交付端区分：仅交付 PC（用户已明确不支持手机）时，核验审批包与兼容的 Canvas peer，不要求安装或核验移动包。默认新 App 的双端交付仍遵循 makeui，本段不改变该默认。正式合同如下：

- `MyApprovalsPage spacing="standard"`：标准模式的左右 12px 由包的列表 section 持有，活动面板持有上下 12px；组合后形成下表的有效四边留白。宿主标准 Tabs 不再叠加左右 padding。`host` 默认仍由宿主处理，避免给既有应用重复留白。
- 审批包公开 `/mobile` 入口的 `createMobileApprovalComponents({ Tabs, Button, mobile, loadApplicants?, logger? })` 返回 `ApprovalUIComponents`：`mobile` 接收移动包公开 `MobileFilterTrigger`、`MobileDateRangeField`、`MobileSearchPickerSheet` 对应的 `FilterTrigger`、`DateRangeField`、`SearchPickerSheet`。工厂提供原生小号搜索输入、日期／人员入口和候选生命周期；标准列表模式自己渲染透明无边框的搜索提交按钮，与输入共用搜索表面，不让宿主 Button 的默认边框进入搜索入口。宿主保留原 users I/O、Tabs 和 Button。
- 移动包 `/primitives` 的 `MobileFilterTrigger`，以及 `/pickers` 中 `MobileDateRangeField variant="filter"`；普通表单默认仍为 `variant="field"`。审批工厂消费该筛选变体，不改普通字段默认外观。

使用 `/mobile` 工厂的手机标准组合时，审批包和移动包两份实际安装产物都须核验；仅其中一个包支持新能力不能通过手机组合门禁，不要求未改造 App 统一升级。这两份正式版本的 `capabilities.json`、`package.ai.json` 或说明中仍可能残留 local-candidate、published:false、未发布等旧文案；上述发布状态已通过 registry、integrity 和真实产物交叉核实，不能仅凭遗留文案否定已发布能力，也不能因此省略公开类型与实际行为校验。

已核对 0.2.16 正式公开类型：`Tabs`、`Button` 分别复用 `ApprovalUIComponents` 的相应成员，`mobile` 为 `ApprovalMobileToolkit`；`ApprovalApplicantLoader` 签名为 `(keyword: string, context: Readonly<{ signal: AbortSignal }>) => Promise<readonly { value: string; label: string }[]>`。宿主转发取消信号，返回字符串人员 ID 和可读姓名；清空值由工厂提供“全部申请人”，远程结果不重复添加空 ID。未传 loader 时使用页面 `applicantOptions`，不能据此用当前页审批人员伪造完整组织候选。`logger` 接收 `ApprovalMobileDiagnostic`：`operation: "applicants"`、`phase: "start" | "success" | "error" | "cancel"` 及可选 `count`，不记录关键词、姓名或 token。工厂实例与适配组件身份保持稳定，不在每次输入重渲染时重新创建。

### 申请人跨端回显

0.2.16 正式公开 `ApprovalSelectProps` 提供 `selectedOption?: { value: string; label: string }`，回调为 `onChange(value: string, selectedOption?: ApprovalSelectOption)`。远程候选的宿主 Select 选中后回传字符串 ID 与同一真实候选的可读元数据；清除时回传 `onChange("", undefined)`。特别是桌面选中的人员可能不在页面的静态 `applicantOptions` 中，不能只回传 ID 后期待手机推算出姓名。

标准模式由 `MyApprovalsPage` 原有控制器保存当前选中的 `{ value, label }`，并通过 `selectedOption` 提供给当前桌面／手机适配器。宿主优先使用 `selectedOption.value === value` 的标签回显，再沿自身真实候选处理；`purpose` 和 `selectedOption` 都是适配元数据，不透传 DOM，也不放进列表查询 DTO 或 Service 请求。显示元数据随已有 `scopeKey` 生命周期隔离，切换应用／身份／环境、重置、清除及切入已发起后按原规则丢弃；不新增跨范围全局姓名缓存或在工厂闭包中缓存用户身份。

旧单参数适配仍兼容，未核验新类型的旧正式包只使用原单参接线；不能把兼容调用当作远程人员跨端姓名已经验收。正式宿主接入必须穿过真实适配器覆盖手机 → 桌面 → 手机与桌面远程选人 → 手机：选择名称保持、未打开候选面板时零额外 users 请求，查询只含人员 ID；另覆盖 scope 变化不保留旧名称。发布记录与类型核验不能替代这些宿主行为验收。

## PC 内边距与空表

PC／平板以审批列表根容器为测量边界，采用既有包的 12px 内容尺度：

| 区域 | 规格与所有权 |
| --- | --- |
| 页签栏 | 相对列表根容器的有效左右内边距各 12px；标准模式由包 section 提供，宿主 Tabs 不重复叠加 |
| 活动面板 | 有效四边内边距各 12px；标准模式左右随 section、上下在面板，等效布局只保留一份 |
| 筛选栏与表格 | 筛选 form 自带 `padding-bottom: 12px`，表格紧接其 border-box，不能再加外部 12px；搜索区和表格左右边缘对齐，页签文字内容起点与其左侧内容线对齐 |
| Shell | 外层留白按当前应用 Shell 单独处理；不把 Shell 的 12／24px 重复算进审批面板，也不因为 Shell 已有留白而删除列表内部尺度 |
| 高度链 | 继续使用 `make-app-approval--fill`，Shell、Tabs、中间包装与活动面板保留确定高度、`flex: 1; min-height: 0; min-width: 0`；表格占满筛选栏下方剩余空间，页面自身不滚动 |
| 查询成功为空 | 两个任务页签保留申请单ID、业务表单、申请人、申请时间四列表头与表体；已发起另保留流程状态，合计五列；在表体内显示“暂无审批记录”等明确空数据提示，不以一条整页空态替换表格，不要求改写包的既有文案 |

有效内容边缘从元素实际 border-box 向内合计对应边框与 padding；PC 页签和面板左右相对列表根容器各 12px，面板上下相对自身 border-box 各 12px。已有 2px 边框配 10px padding 可形成有效 12px，不能仍叠加 12px padding 后把实际 14px 判为合规；此计算不要求新增边框，Shell 留白仍独立处理。

非活动面板不占高度。空态、加载、权限拒绝和请求失败仍是不同结果；只有真实查询成功的空结果显示上述空态。空数据与有数据使用同一表格容器及尺寸生命周期，不为保留表头构造假数据或另建第二张任务表格。

## 手机一体搜索与胶囊筛选

- 页签内容、搜索和卡片共用 16px 左右留白；活动面板不叠加 PC 四边 padding。
- 搜索图标、输入和清除操作共用一个连续的小号搜索表面。输入不另画一个独立的边框／背景框，搜索按钮不作为相邻的独立方块；图标可通过同一表面内的公开按钮保持点击搜索语义。输入字号实际计算值至少 16px，保留键盘搜索、清空和可访问名称。
- 日期与申请人使用同款胶囊视觉入口：单行视觉高度 28px，左右内边距、圆角、边框／背景与文字样式一致，日期在左、申请人在右，箭头及文字垂直居中。人员入口显示“全部申请人”或可读姓名；日期显示“请选择申请时间”或完整范围。
- 28px 只约束紧凑视觉，实际按钮点击范围至少 44px 且互不重叠。不能把移动日期组件或人员字段整体硬缩至 28px；通过已核验的公开触发器／插槽组合保留移动包 Sheet。长日期或姓名可在自身入口内换行增高，不挤压另一入口；两侧视觉和各自点击区域保持同排居中，不要求换行日期与短姓名同高或顶部齐平。
- 日期确认／清空和申请人选择沿用既有立即筛选语义，不顺带提交 ID 草稿；Sheet、候选搜索、取消、草稿确认、焦点及安全区继续遵循 [移动端适配](mobile.md) 与 makeui 手机合同。已发起页签仍只显示日期，不能为了对称补申请人入口。

公共包提供的列表骨架、空态和专用筛选外观应由包及公开适配层复用；宿主保留真实人员候选、Service provider、响应式模式和导航。普通表单字段外观与筛选入口用途不同，不直接把表单的整行 label/value 触发器作为紧凑筛选入口。新公共适配 API 的名称、导入路径及参数须在实际产物核验后登记，不从此页推断存在某个尚未发布的导出。

## 真实页面验收

在宿主已有浏览器测试中导入随 Skill 分发的 `scripts/verify-list-presentation.mjs`，调用 `assertApprovalListPresentation`。它是验收工具接口，**不是审批 npm API**；必传当前真实页签 `tab: "pending" | "approved" | "initiated"`，不能从缺少控件猜测页签或为验收补造控件。使用测试 ref、宿主公开插槽或当前包明确公开的 DOM 标识取得实际元素，不查询包私有 class。传入引用：

| 模式 | 必需引用 |
| --- | --- |
| 共用 | `presentation`（tablet 映射为 desktop）、`tab`、`listRoot`、`tabs`、`panel`、`filters` |
| PC | `table`（实际表格容器）、`canvas`（实际画布）；有公开空态元素时可传 `emptyState` |
| 手机待处理／已完成 | `cards`、`searchSurface`、`searchIcon`、`searchButton`（包住搜索图标的实际按钮）、`searchInput`、`dateTrigger`、`applicantTrigger`（视觉元素）、`dateHitTarget`、`applicantHitTarget`（实际按钮） |
| 手机已发起 | `cards`、`dateTrigger`、`dateHitTarget`；只验日期及公共留白，不传搜索和申请人引用 |

手机“已发起”不渲染 ID 搜索和申请人入口，因此验收器拒绝该页签传入 `searchSurface`、`searchIcon`、`searchButton`、`searchInput`、`applicantTrigger`、`applicantHitTarget`；不能通过传入隐藏控件或沿用上一页签的 DOM 引用规避合同。待处理／已完成仍要求这些引用齐全，缺少任何入口应失败。

工具读取元素真实 `getBoundingClientRect` 和 `getComputedStyle`，拒绝零矩形；几何比较允许 1px 浮点误差，不能以此容忍缺失的边框／字号规范，也不能逐层累积误差；PC 筛选与表格的内容线直接对同一列表根容器和面板基准核查。PC 只自动验证真实表格及画布的非零几何；任务四列表头、已发起含流程状态的五列表头，以及体内“暂无审批记录”等空数据提示必须通过真实 Canvas 测试和浏览器截图单列验证，不要求不存在的表头／表体 DOM，不以手填 boolean 宣称通过，也不伪造占位 DOM。工具结果中的 `remaining` 按当前页签保留表头与空态这两项待验。候选请求、点击命中、键盘或真机行为另记。

`filters` 必须传真实筛选 form，PC 检查其计算后底部 padding 为 12px、`table.top === filters.bottom`，不是再要求两个 border-box 相隔 12px。手机页签、筛选和卡片的 16px 按实际内容边缘相对列表根容器测量；合法包装层可以分担留白，不要求每个被测元素自身都具有 `padding: 16px`。仅检查元素自身 padding 不足以判定对齐，额外包装层造成的重复缩进或容器位置偏移必须失败。

手机任务页同时检查原生输入和图标按钮的上、右、下、左四条边宽度均为 0，且没有独立底色；不能对 `borderWidth` 简写只取第一个数，也不能只因它们位于同一外框就判一体搜索通过。背景色按计算后 alpha 为 0 判断透明，不能只允许黑色透明的固定字符串；对已识别的计算后现代颜色函数，显式 `/ none` 在直接绘制时按 alpha 0，省略 alpha 仍按不透明处理，legacy 逗号语法中的 `none` 不接受。工具只识别有限的计算后数值／`none` 颜色函数；`backgroundImage` 各层均须为 `none`，图片或渐变不能仅因背景色透明而通过。无法解释的计算值应按核查失败处理，不扩展为任意 CSS 源码解析或完整绘制证明。

所有页签的日期胶囊，以及任务页的申请人胶囊，按四个角各自的水平／垂直圆角和实际视觉尺寸判断；兼容 CSS 对超大圆角的物理收敛，不能用 `borderRadius` 简写的首值代表四角。仅一个角圆润、其他角为直角不符合统一胶囊要求。当前工具支持计算后的 px／百分比圆角值；若浏览器仍返回无法解释的函数值，核查应失败并单列验证，不能按通过处理。

`wrappedTriggers: true` 仅用于已验证的长内容换行样例；默认短文案仍须通过 28px 视觉检查。成功空态、非空数据、三个页签往返、窄／宽桌面以及 320／390／767px 手机分别覆盖；每次传入当前 `tab` 及当前页签实际存在的引用，不复用已卸载面板。入口点击应在中心和边缘打开正确底部 Sheet；取消不查询，完整日期／申请人确认只发一次查询，清空恢复完整候选与筛选，搜索图标／回车语义一致。已发起只验证日期选择及其原有实例查询，不添加任务专属条件。记录实际包版本、浏览器尺寸、几何检查与交互结果；真实后端、iOS／飞书和 Android 验收分别报告。

仓库 `scripts/test-approval-list-presentation.mjs` 用几何故障注入验证工具：合法已发起只传日期引用可通过、任务页缺少搜索／申请人会失败、已发起传入任务专属引用会失败；覆盖 PC 边框与 padding 的有效留白、透明背景色与独立背景图、非对称边框、单角圆润、额外包装层缩进及原有贴边、重复筛选间距、画布缺失、表格外空态和不足点击区域，保留合法包装层分担留白及长日期／短姓名不同高度居中正例。CI 自动运行这些脚本，但它不渲染宿主，不能写成任意新 App 已符合本合同。
