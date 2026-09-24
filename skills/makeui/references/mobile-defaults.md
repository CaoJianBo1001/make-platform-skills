# Make App 移动端默认规范

## 适用范围与优先级

本文件落实 [`mobile-product-baseline.md`](mobile-product-baseline.md) 的最终产品合同，定义所有新 Make App 的默认移动端方案，也适用于明确要求改造移动端的现有 App。移动适配不是新项目的可选增强：除非用户明确要求不支持移动端或指定特殊定制方案，否则必须随桌面端一起交付。

适用范围、存量迁移与规则冲突统一按 [移动端基线的优先级](mobile-product-baseline.md#优先级) 处理；本文件不另设优先级，也不从历史讨论稿、旧截图或被推翻的方案回填行为。

除非用户明确要求不同实现，使用 `@qfei-design/make-app-mobile` 是默认要求。不要等用户再次提出“适配移动端”，也不要把任何试点项目的组件源码复制进新应用；组件包不可用时应报告缺失依赖，保留宿主业务 Controller，并等待包可用或用户确认替代方案。

## 包接入与边界

新项目和本次移动端改造的目标基线为 `0.1.7`，该版本包含符合冻结视觉基线的普通选项、日期控件、人员／部门字段、附件字段，以及专用表单提交栏 `MobileFormActionBar`。只有在 `0.1.7` 已发布且 registry 能解析时才执行安装；若尚未发布，不得改装 Git URL、本地目录或复制源码，应报告 package release blocker。新 Make App 或已明确进行运行时迁移的项目先满足 `make-app-runtime` 的固定基线；再在已解析的 UI package 工作目录中通过项目声明的包管理器安装。标准 pnpm 工作区例如：

```bash
corepack pnpm add @qfei-design/make-app-mobile@^0.1.7
```

仅当宿主源码直接从 `lucide-react` 导入图标，且 UI package 尚未声明可复用的兼容直接依赖时，才单独安装：

```bash
corepack pnpm add lucide-react@^1.28.0
```

仅使用移动组件包自身内置图标时，无需为宿主额外添加 `lucide-react`；已有兼容声明保持不变。存量 App 执行上述命令前，必须先通过下述兼容性门禁。

不要改用 `latest`、Git URL、本地目录或复制源码来绕过版本声明。

存量 App 在安装或升级前必须先完成兼容性门禁，不得为了通过门禁改写运行时声明、包管理器或锁文件类型：

1. 定位实际安装目标（通常是 `apps/ui/package.json` 或宿主 UI package），读取 workspace 根的 `packageManager`、Node `engines`、React/React DOM 版本及现有 lockfile。
2. 以当前解析到的 `@qfei-design/make-app-mobile` `package.json` 为准，验证 Node、React 和 React DOM 满足其 `engines` 与 peer dependencies；`0.1.7` 基线要求 Node `>=22.12.0`，React/React DOM 为 `^18.2.0 || ^19.0.0`。
3. 使用现有 workspace/package-manager 流程在该 UI package 安装；不要在 pnpm 项目生成 `package-lock.json`，也不要在 npm/yarn 项目引入 Corepack 或 pnpm。宿主直接导入图标时才声明直接依赖 `lucide-react`；保留已有兼容版本，不做无关图标迁移。
4. 若 Node/peer 版本、workspace 位置、包管理器或 lockfile 不满足，停止安装并报告兼容性 blocker；运行时或 package-manager 迁移必须交给 `make-app-runtime`，只有用户明确要求迁移时才能进行。

已有项目若版本低于 `0.1.7`，仅在以上门禁通过后升级，并复跑宿主测试、类型检查和构建。下述字段、选择、日期控件及表单提交栏合同以 `0.1.7` 为最低版本；包内通用安装示例若仍使用更低版本范围，不得据此降低本 Skill 的基线。

安装后先读取包内 `package.ai.json`、`PUBLIC_API.md` 和 `package.ai.json.readOrder` 指向的所需文档，并在 UI 入口只导入一次：

```tsx
import "@qfei-design/make-app-mobile/styles.css";
```

按职责使用公共入口：

- 根入口：纯展示模式解析。
- `/presentation`：容器宽度观察和统一展示模式上下文。
- `/shell`：移动端应用页头、账户抽屉、底部导航和工作台。
- `/primitives`：底部弹层、任务页头、确认框、表单提交栏 `MobileFormActionBar`、详情操作栏 `MobileBottomActionBar`、悬浮新建和列表结束状态。
- `/fields`：默认字段级适配器 `MobileIdentityField` 与 `MobileAttachmentField`；宿主传入受控值、候选或附件状态和业务回调，不复制其标签、头像／部门简称、附件卡片、确认框和上传入口。
- `/pickers`：`MobileSearchPickerSheet`、`MobileOptionPickerSheet`、`MobileDateField`、`MobileDateRangeField`。其中搜索 Sheet 是供特殊字段组合使用的底层原语；标准人员／部门字段优先使用 `/fields` 的 `MobileIdentityField`。

组件包只负责展示与交互。以下内容必须留在宿主：

- Schema、权限、记录、人员、部门、Lookup、文件和认证请求。
- 路由解释与跳转。
- 表单草稿、保存、删除、筛选及请求生命周期。
- AI 助手 transport 和内部行为。
- 飞书运行环境判断与退出登录动作。
- 对象字段到卡片内容的业务映射。

## 多端切换

- 使用实际应用容器宽度，不使用 UA、平台字符串或一次性的 `window.innerWidth` 猜设备。
- 默认断点：`mobile <= 767`、`tablet 768-1199`、`desktop >= 1200`；只有用户或现有产品规范明确要求时才覆盖。
- 使用 `useContainerPresentationMode` 观察容器；把业务 Controller、请求缓存、表单值和路由状态放在桌面／移动 View 分支之上。
- 一次只挂载当前展示 View。不要同时挂载桌面和移动两棵业务树再用 CSS 隐藏其中一棵。
- 宽度变化只切换展示组件，不重新创建 Controller，不重复同一查询请求，不清空表单草稿、筛选或滚动上下文。操作选择不属于可跨实例保留的业务草稿：desktop/tablet 切到手机卸载 CanvasTable 时，加载 [make-app-actions](../../make-app-actions/) 并按其 `selection-and-operation-snapshot.md` 清空 action selection、使预检失效并清理旧操作表面；返回桌面新实例从空选择开始，不恢复旧写目标。同一 CanvasTable 实例内的尺寸调整不额外清空选择。
- tablet 默认保留桌面信息架构并把长导航改为覆盖层；不要自动套用手机底部 Tab，除非产品明确要求。

## 移动端应用壳层

手机端默认壳层：

- 顶部居中显示当前页面标题，不显示副标题。
- 左上角只显示 32px 圆形头像，不显示姓名或旧的汉堡导航。
- 点击头像打开左侧账户抽屉。抽屉顶部紧凑展示头像、姓名和 `tenantName`；退出登录按钮靠抽屉底部。
- 宿主用 `make-app-auth` 提供退出动作和飞书环境判断。在飞书运行环境中向 `MobileAccountDrawer` 传 `showLogout={false}`；组件包不猜测认证环境。
- 根壳层固定为动态视口高度，`body` 和应用根节点不承担业务滚动。内容、列表和弹层各自管理滚动。

桌面端仍使用左侧对象导航和右上角头像＋姓名菜单；不要把手机头像抽屉强行用于桌面。

## 底部导航与工作台

- 使用 `composeMobileBottomNavigationItems` 和 `MobileBottomNavigation`。
- 最多展示 5 项。最右侧固定为“工作台”，其左侧为可用时的“AI 助手”，最左侧最多三个业务对象；AI 助手不可用时第四个业务对象可占用空位。
- 业务对象顺序使用宿主配置或接口返回顺序，不按名称、key 或图标重新排序。
- AI 助手行为由 `make-ai-assistant` 提供；底部导航只触发宿主打开动作。
- 工作台是独立路由页面，标题为“工作台”。内容区只显示“业务入口”，不显示“全部对象”或“选择对象进入对应业务页面”等副标题。
- 使用 `MobileWorkbenchGrid` 展示两列对象入口，严格保留传入顺序。点击后由宿主跳转动态对象路由。
- 新生成的 Make App 图标默认使用 `lucide-react`。对象图标按语义选择；无法匹配时使用统一保底图标，不为每个项目自造 SVG 或混用图标库。

## 移动列表

- 手机端业务记录列表默认统一使用卡片列表，无论对象是只读还是可写；手机端不得渲染 `CanvasTable`，也不得挂载后用 CSS 隐藏。desktop/tablet 才使用 CanvasTable。
- 卡片字段、权限、查询和请求缓存复用共享业务 Controller，但手机 View 必须独立组合自己的 toolbar 和 list content。toolbar 默认提供搜索；筛选能力已启用或本次明确请求时才加入筛选入口。不得直接复用桌面 `listToolbar`、`listContent` 或 CanvasTable 容器后仅换外壳和 CSS。
- 手机端当前不支持记录多选、全选、Shift 选择、选择操作栏、批量编辑或其他批量操作。这里仅限制业务记录列表，不影响人员／部门等表单字段的多选组件。离开桌面表格时清空其操作选择；手机操作仅使用点击／当前记录，不读取旧表格目标。
- 点击卡片主体进入详情全屏任务路由，不表示选中记录。可写卡片的单条编辑、单条删除必须加载 [`make-app-actions`](../../make-app-actions/) 并读取其中的 `mobile-card-actions.md` reference：通过 `make-app-actions` headless core 解析点击记录的独立权限，并沿用冻结目标、Service 预检和最终写接口鉴权；不得复制权限算法或从桌面选择快照推导目标。
- 搜索入口位于手机独立 toolbar 顶部，使用中号视觉控件（宿主组件库的 `size="middle"`、默认中号或等效样式）。筛选能力已启用或本次明确请求时，才在同排加入中号筛选按钮；两者可视高度保持一致，并为搜索框留可伸缩宽度。不要使用小号或大号规格，也不要用 CSS 强行拉伸小号控件冒充中号。触控目标仍须达到至少 44px，可由外围点击区域提供。
- 手机列表在自身滚动容器的顶部下拉刷新，复用当前搜索、已应用筛选和权限上下文，防止重复并发请求；不显示右侧或任何独立刷新按钮、刷新图标。桌面／平板的工具栏刷新入口保持原样。手机端默认不展示分组和排序；即使 desktop/tablet 已接入 `make-app-group` 或 `make-app-sort`，也不得把其按钮直接搬进手机 toolbar。
- 筛选能力已启用或本次明确请求时，手机筛选入口必须按 [`make-app-filter`](../../make-app-filter/) 的手机合同挂载包面板：在宿主移动 Sheet 中传 `layout="mobile"`，不得把桌面 Popover 组件直接作为手机 toolbar 的筛选节点。包内条件卡片与宿主 Sheet 各司其职；缺少公开移动布局 API 时先按其兼容门禁升级或报告 blocker。未启用高级筛选时不显示空入口或挂载面板；关键词搜索是否需要包的编译器按下节查询合同判断。
- 新建使用 `MobileFloatingAction`，由缓存的 create 权限和授权 `createFields` 控制可见性，点击后进入全屏新建任务路由，并为底部导航和安全区预留空间。
- 单条编辑使用卡片紧凑操作入口：通过 `make-app-actions` 本地校验后冻结单条目标，调用一次 `record-write-permission` 预检，允许后才进入编辑全屏任务路由；正常单条更新接口继续执行最终鉴权。
- 单条删除先冻结点击记录并完成本地权限判断，使用 `MobileConfirmDialog` 确认；确认后执行一次删除权限预检，再调用宿主删除 Service 接口，由最终删除接口执行权威鉴权。异步期间阻止重复确认，失败时保留可恢复反馈。
- 列表自身滚动，弹层打开时根滚动锁必须阻止底层列表跟随手势晃动。
- `MobileListEndStatus` 只在 `hasMore=false` 且已有记录时渲染，文案默认为“已加载全部，共 N 条”。它必须跟随列表正常流滚动到末尾后才出现，不得 fixed、sticky 或吸底。
- 空列表使用宿主空状态，不显示“已加载全部，共 0 条”。

### 列表搜索合同

- 用户停止输入 1 秒后自动应用搜索；按 Enter 立即应用；清空输入立即重置搜索并请求无关键词结果。
- IME 输入法处于组合输入期间不得发起请求；只在 `compositionend` 组合结束后启动新的 1 秒计时器，Enter 也不得提交未完成的组合文本。
- 每次应用搜索都重置分页和已加载页。取消仍在进行的旧请求，并用请求 generation／序号忽略无法取消的迟到响应，迟到响应不得覆盖新关键词结果。
- 搜索关键词只保留在当前会话，不写入筛选 Preset。若宿主使用 `filter.expression` 表达关键词搜索，必须复用 [`make-app-filter`](../../make-app-filter/) 的 `compileListFilter({ fields, searchText })`，省略 `advancedFilter`，不得自行拼接 CEL；仅搜索不读取、回显或写入筛选 Preset，不展示高级筛选入口，也不挂载筛选 Controller／面板。若排序或分组能力独立读取共享 Preset，也不能在没有筛选 UI 时暗中应用其中的 filter 维度。高级筛选已启用时，未确认草稿不得合并进搜索请求；只有已应用筛选和已应用关键词共同构成当前查询。宿主有独立搜索接口时沿用其既有合同，不为手机端另造查询语义。
- 搜索应用后保留列表容器身份，但把滚动位置重置到顶部；请求失败显示可重试状态，不用旧结果冒充新关键词结果。

## 创建、编辑与详情任务页

- 本节只定义任务页框架；字段控件、详情展示、弹层视口和保存区必须同时遵循 `mobile-form-controls.md`。仅把桌面 Drawer 改成全屏一列，不算完成移动端适配。
- 手机端创建、编辑和详情默认使用可寻址的全屏任务路由，不把桌面右侧 Drawer 缩成底部抽屉。
- 使用 `MobilePageHeader`：返回按钮必需；关闭按钮只在宿主任务容器确实支持关闭时显示；更多操作按需显示。
- host chrome 存在时可以通过 `MobileHostChromeBridge` 委托页头；注册失败必须回退到应用页头。
- 手机表单与详情在页面层级使用单列内容区；这不表示普通字段的标签和值要上下堆叠。普通字段仍按 `mobile-form-controls.md` 同行展示为左侧标签、右侧值，详情值尾端对齐；字段顺序、权限和业务校验仍来自共享 Controller。
- 手机新建／编辑通过独立字段展示适配层选择移动安全控件；禁止原样复用桌面 DatePicker、RangePicker、Select 等弹层后仅调整宽度。保存／提交使用 `MobileFormActionBar`：单个主按钮无图标、在底部靠右，并保留安全区；详情记录操作继续使用 `MobileBottomActionBar`。
- 手机详情使用字段 display adapter 的单列标签／值展示，不把桌面编辑表单切成 disabled 状态冒充详情。
- 严格只读记录不展示写操作。可写卡片提供 `make-app-actions` 支持的单条编辑、删除；手机端不使用选择操作栏或批量编辑。
- 手机详情默认使用 `MobileBottomActionBar` 展示编辑和删除；两者读取独立权限并分别复用与卡片相同的单记录 action、冻结目标、预检、确认和最终接口鉴权。详情点击编辑时，预检通过后直接进入当前记录的编辑路由，不经过对象列表；具体单记录生命周期见 `make-app-actions` 的 `mobile-card-actions.md`。卡片已有操作不能替代或取消详情操作；只有编辑与删除都不可用时才移除整条底部操作栏。
- 删除等破坏性操作使用 `MobileConfirmDialog`，异步确认期间禁止重复提交，失败时保持弹窗并允许重试。

## 搜索选择抽屉

人员、部门字段默认使用 `/fields` 的 `MobileIdentityField`；只有用户明确要求超出该组件公共 API 的特殊字段组合时，才直接使用底层 `MobileSearchPickerSheet`。以下为手机端表单选择器合同，不改变桌面控件或其他 Skill 拥有的表格编辑器行为：

- 宿主把真实已提交 id 值传给 `value`，把对应名称、可选头像及当前回显合并到 `selectedItems`；候选项使用 `items`，人员提交 `userId`，部门提交 `departmentId`，不得把名称当业务值。
- 单选人员/部门（`SingleUser` / `SingleDepartment`）：显式使用 `selectionMode="single"`，不展示“确定”；选择、移除或清除后立即提交，由组件调用一次 `onChange` 并关闭。空选择按宿主字段合同归一化为空值。
- 多选人员/部门（`MultiUser` / `MultiDepartment`）：使用 `selectionMode="multiple"`，组件内部维护当前打开周期的临时草稿；勾选、删除顶部标签和清除不调用真实 `onChange`，关闭或取消丢弃草稿，只有“确定”调用一次 `onChange` 提交完整 id 与展示项快照。
- 每次实际提交由 `MobileIdentityField` 依次触发真实表单 `onChange` 与 `onBlur`，各一次；取消或关闭只触发 `onBlur`，宿主不得从 effect、弹层关闭路径或底层回调重复写值。
- 人员候选及顶部已选项显示头像；头像缺失时使用确定性首字回退。部门候选及顶部已选项使用统一圆形部门简称；不得只显示裸文本。候选行、勾选标记和顶部滚动区的几何由包负责，宿主不得覆盖内部 class 修正宽度。
- 手机新建／编辑页的人员／部门多选已提交值必须在字段触发器中以可换行标签展示并整体靠右；不得用 `join("、")` 拼成单行文本，也不得把多值截断为一个省略号。单选显示一个可读名称并靠右。
- 只有直接使用底层 `MobileSearchPickerSheet` 的特殊组合，才由宿主持有 `selectedKeys`／`selectedItems` 草稿，并且只从 `onConfirm(payload)` 提交；`onSelectedKeysChange` 不得写真实表单，`onClose` 放弃未确认草稿并只取消。默认人员／部门字段不重复实现这层草稿控制。
- 参数签名以当前安装包的 `PUBLIC_API.md` 和公开类型为准；无法满足上述合同的旧包必须先通过兼容性门禁升级。不得深层导入源码、复制字段组件或假设尚未发布的 API。
- 打开抽屉时焦点停在弹层面板，不自动聚焦搜索框；只有用户主动点击输入框时才唤起键盘。
- 默认使用 86dvh 的较高抽屉。候选列表独立滚动；顶部搜索与已选区固定在抽屉内部。
- 已选标签横向滚动，隐藏可视滚动条但保留触摸滚动。
- 候选列表滚动后，顶部固定区显示下边线和轻阴影。
- 弹层 Portal 到 `document.body`，约束焦点、恢复原焦点、只让最上层响应 Escape，并使用引用计数锁定 `html`/`body` 滚动。
- 用户和部门候选仍来自宿主 API；包不请求候选、不做远程搜索、不计算权限。

## 图标、主题与可访问性

- 新生成的 Make App 和新增 Make App 图标默认使用 `lucide-react`；现有项目除非用户要求，不进行无关的全量图标迁移。
- 颜色、分隔线、安全区和尺寸通过 `--make-app-*` / `--make-mobile-*` 变量覆盖，不复制组件内部 class 后重写结构。
- 图标按钮必须有中文 `aria-label`；当前底部入口使用 `aria-current="page"`。
- 弹层必须有 dialog 语义、焦点约束、关闭后焦点恢复和可预测的 Escape 顺序。
- 支持 `prefers-reduced-motion`，不要为基础业务操作添加阻塞性动画。

## 组件包升级后的验证

升级移动组件包后，在宿主项目完成以下检查：

1. 检查实际 UI package 的依赖声明、lockfile 和解析到的包版本，确认至少满足 `0.1.7` 基线；若 registry 尚未提供该版本，停止并报告 release blocker。
2. 对使用 Vite 的宿主，重启当前 UI package 的 Vite 开发服务，并向 Vite 传入 `--force` 强制重新预构建依赖。沿用原包管理器、配置、端口和启动流程；若 pnpm 的 UI `dev` 脚本直接运行 Vite，可用 `corepack pnpm run dev --force`。编排脚本必须将参数传到 Vite，不能只重启外层进程或依赖 HMR。
3. 浏览器开发者工具中临时禁用缓存并重新加载真实页面，确认新依赖已加载；检查结束后恢复缓存设置。Vite 的处理依据见[依赖预构建与缓存说明](https://vite.dev/guide/dep-pre-bundling#caching)。
4. 在真实页面分别验证人员和部门的单选、多选：单选无“确定”，选择后立即写回并关闭，从有值状态移除或清除后提交空值并关闭；多选操作只改组件临时草稿，取消不提交，只有“确定”提交快照。核对人员头像／回退首字、部门圆形简称、顶部已选横向滚动、勾选标记不溢出，以及编辑触发器中的多值换行标签；同时核对每次提交的 `onChange`/`onBlur` 调用次数及最终表单值。
5. 在真实编辑页验证 `MobileAttachmentField`：图片显示缩略图，其他文件显示文件图标，文件名、上传状态、失败重试、圆形删除入口和全宽虚线上传区完整；删除确认后才调用宿主删除，上传、重试、删除和持久化请求仍由宿主处理。
6. 在真实业务页面以 390px、767px 宽度检查对象列表：应为卡片和手机独立 toolbar，中号搜索框的触控目标至少 44px；筛选能力已启用或本次明确请求时，中号筛选按钮与搜索框等高同排，打开带 `layout="mobile"` 的宿主 Sheet，字段／操作区不横向溢出；未启用时不显示筛选入口。顶部下拉刷新可用且没有独立刷新图标。DOM 中没有 CanvasTable、分组、排序、记录复选框、选择操作栏或批量编辑；新建、详情、单条编辑和单条删除按权限正常工作，列表和空状态不被裁切。
7. 切回桌面验证 CanvasTable、原人员/部门控件与右侧 Drawer，并复跑宿主测试、类型检查和构建。记录真实页面验证结果；仅更新 lockfile、静态合同测试或构建成功不足以声明宿主升级验收完成。无法进入真实业务页面或视觉走查被阻断时，不得宣称移动端适配完成或验收通过，应明确记录 blocker。

## 交付检查

至少验证：

- 390px、767px、768px、1199px、1200px 宽度下展示模式和布局正确。
- 桌面／移动来回切换后，表单草稿、筛选和请求缓存不丢失、不重复；CanvasTable 卸载只产生一次空选择通知，迟到预检不生效，返回桌面没有旧选择或旧写目标。同实例 resize 则保留正常选择。
- 底部导航不超过五项，工作台最右，AI 助手在其左侧，业务对象和工作台对象顺序与接口／配置一致。
- 账户抽屉紧凑，退出按钮靠底；飞书环境不显示退出。
- 单选人员/部门默认使用 `MobileIdentityField` 和 `selectionMode="single"`，且无“确定”；选择、移除和清除由字段组件通过一次 `onChange` 提交并关闭，最终表单值和校验一致。只有直接使用底层 `MobileSearchPickerSheet` 的特殊组合，宿主才处理其 `onConfirm` 快照；不得在这两层同时写表单。
- 带搜索抽屉打开不唤起键盘；多选的勾选、删除标签和清除只更新草稿，关闭不提交，点击“确定”后才一次性同步外部表单。
- 已选标签可横向滚动且不显示滚动条；列表滚动后固定区有分隔层次。
- 任意抽屉／弹窗打开时底层列表不可滚动；叠加弹层关闭一层不会提前解锁。
- 列表结束状态只在滚动末尾和确认无更多数据后出现。
- 390px 与 767px 的真实业务列表使用卡片和手机独立中号搜索 toolbar；筛选能力已启用或本次明确请求时再显示中号筛选入口，两控件等高且触控目标至少 44px，筛选使用包的 `layout="mobile"` 与宿主 Sheet，取消保留原已应用筛选，确认才提交并刷新列表。未启用筛选时不显示空入口。列表顶部下拉刷新，不显示独立刷新按钮／图标、CanvasTable、分组、排序、记录多选或批量操作。
- 手机卡片的新建、详情、单条编辑和单条删除分别经过创建权限、独立更新/删除权限、必要预检和最终接口鉴权；点击卡片主体不产生选择态。
- 在 390px 与 767px 真实业务页面分别打开新建、编辑、详情以及实际日期／时间／范围／选择／Lookup／附件控件；不得出现桌面弹层横向溢出、裁切或底部栏遮挡。未完成这项视觉走查不得宣称移动端适配完成。
- 运行组件包和宿主项目的测试、类型检查、构建及相应运行时契约检查。
