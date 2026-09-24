# make-platform-skills
make 平台的 skill

# 安装
```
  npx skills add qfeius/make-platform-skills --all -g
```
# 升级
```
  npx skills update  qfeius/make-platform-skills
```

## Skill 路由总览

用户问题先按下面的关键词选择 skill。一个任务可以组合多个 skill，但每个 skill 只负责自己的边界。

Codex 判断优先级：

1. 用户明确点名某个 skill 时，优先使用该 skill。
2. 用户没有点名时，按问题关键词从下表选择最匹配的 skill。
3. 一个需求跨多个领域时，可以组合多个 skill，但只在主责 skill 中写具体规则，其他 skill 只写“转交/配合”提示。
4. 不要把登录、打包发布、DSL 建模、Make CLI 操作、CanvasTable 内部规则或高级筛选包内部规则写进 `makeui`；`makeui` 只负责页面布局、样式和 UI 组件组织。

| 用户问题 / 关键词 | 使用 skill | 边界 |
| --- | --- | --- |
| Make 环境安装、更新 Make 环境、makecli 登录校验、Node/pnpm/git/makecli 版本检查 | `make-env-setup` | 只负责本地开发环境准备、工具链更新、Make skills 更新、环境选择和登录校验；不负责 PRD、DSL、Service、UI、apply、deploy 或 git 提交 |
| 页面、布局、App Shell、侧边栏、顶部栏、列表页、新建/编辑/详情、Drawer、移动端卡片列表、工作台、底部导航、人员/部门选择抽屉、响应式、UI 状态、`@qfei-design/make-app-mobile` | `makeui` | desktop/tablet 使用表格布局，手机使用独立卡片 View，并保留共享业务 Controller；不负责认证、打包、Service、业务 API 设计和发布 |
| CanvasTable、表格渲染、字段类型展示、表格编辑、序号列、行头详情图标、`showSN`、`bodyRowHeadSuffixOptions`、`GroupTableComponent` 底层接入 | `canvas-table-integration` | 只负责 `@qfei-design/canvas-table` 消费侧接入，不负责页面 Shell 和业务 API；Make 记录分组完整能力交给 `make-app-group` |
| 操作按钮、行操作、手机卡片单条编辑/删除、复选框选择、批量编辑、暂无可用操作、行级写权限预检、`selectAllMode`、`@qfei-design/make-app-actions` | `make-app-actions` | 手机卡片复用 headless 单条操作；desktop/tablet CanvasTable 使用选择操作栏和批量能力。负责独立操作权限、预检、选择意图和批量写入编排，不负责 CanvasTable 内部、IAM 权限策略或 Service 分层实现 |
| 筛选、高级筛选、表格筛选、表头筛选、筛选条件组、AND/OR、字段类型操作符、CEL/DNF、系统变量、DateRange/File/Lookup 筛选、filter expression、筛选值归一化、表头按字段筛选联动、`@qfei-design/make-app-filter` | `make-app-filter` | `search-only` 仅用包 core 编译关键词为 `filter.expression`，不读写筛选 Preset、不挂载 Controller／面板；`advanced-filter` 才共用 Controller、Preset 与表达式，desktop/tablet 配套 CanvasTable 表头联动，手机使用顶部筛选入口和移动安全面板、不挂载 CanvasTable；不负责页面 Shell、Service 实现、认证或发布 |
| 排序、高级排序、多字段排序、排序优先级、升序/降序、拖拽排序条件、表头排序、`openWithField`、`capabilities.sortable`、Entity Preset sort、records sort、dnd-kit | `make-app-sort` | 负责排序模型、Preset 与 records sort；desktop/tablet 提供工具栏和 CanvasTable 表头联动，手机默认隐藏排序入口并保留已应用的排序结果；不负责页面 Shell、CanvasTable API 细节、Service 实现或分组 |
| 分组、高级分组、多级分组、分组条件、拖拽分组、表头分组、`capabilities.groupable`、Entity Preset group、record-groups、groupFilter、分组叶子明细分页、`@qfei-design/make-app-group` | `make-app-group` | 负责分组模型、Preset、Service group 合同和 CanvasTable 分组渲染；desktop/tablet 显示分组能力，手机使用普通卡片记录查询、不挂载分组表格且不清除已保存的分组 Preset；不负责页面 Shell、CanvasTable 内部或筛选/排序模型 |
| 助手、AI助手、MakeAI AI 助手、Make AI 助手、AI 对话框、SSE、Agent Gateway、`@qfei-design/make-ai-assistant`、make-ai-assistant 包 | `make-ai-assistant` | 负责 Make App AI 助手接入：已安装包公开类型门禁、Skill 内置 Make App v1 协议、18 项操作的多会话/流式响应/文件图片上传、Agent 发现、历史/反馈/取消与包内 UI；不负责普通 Dialog、业务 Agent 提示词、权限算法、认证实现、发布或 DSL |
| Service 接口、`apps/service` API、UI-Service 合同、`apps/docs/api.md`、schema `fields/createFields`、records/users/departments/lookup/file 代理接口、Make Data API adapter、Service 网关 origin 与服务 scope 配置语义 | `make-app-service` | 只负责 Service API、薄编排、Schema 集合无损传输和按主体隔离缓存，不负责 UI、认证、权限算法、打包发布、端口/构建产物、DSL 建模、Make CLI、CanvasTable |
| 权限、单应用权限、App 权限、`/principal/permission`、`/api/make/app/principal/permission`、菜单权限、对象导航、路由权限、按钮权限、字段可新建、可见、可编辑、`creatable`、`createFields`、read/create/update/delete、URL 防绕过、刷新权限 | `make-app-permission` | Make 项目默认必须接入；负责单个 App 权限链路、Service 调 Make IAM、App scope、`meta.entity.read` 对象导航、`meta.field.read` 表头和 `data.record.read` 数据行的独立权限，以及 `createFields` 与字段 `creatable/readable/editable` 独立权限、创建提交白名单、路由和按钮权限、刷新重取和测试；不负责平台管理权限、认证机制、通用 Service API、UI 布局、CanvasTable 内部、DSL 或部署 |
| 登录、认证、Token、统一登录、OAuth、Cookie、Session、logout、401/403、current-context 身份、`tenantName`、飞书容器退出可见性、`/api/make/**` 鉴权请求 | `make-app-auth` | 负责认证、身份上下文与宿主环境信号，不负责账户抽屉布局和打包发布 |
| 打包、发布、镜像入口、K8s、Service 启动失败、`apps/ui/dist`、`apps/service/dist/server.js`、Service 端口 `3000`、workspace/package.json、`X-Forwarded-Host` | `make-app-runtime` | 只负责运行态和打包发布契约，不负责 Service API、认证实现或 Make adapter 配置语义 |
| App/Entity/Relation/Field 建模、DSL YAML、对象、字段、关系、选项 | `makedsl` | 只负责 DSL 设计和生成，不负责远端 apply |
| `makecli` 命令、diff、apply、部署、查看应用/实体/关系/记录、配置 token/server-url | `makecli` | 只负责 Make CLI 操作，不负责 UI/认证实现 |
| 发票、票据、OCR、验真、识别金额/税号/票据内容 | `make-integration` | 只负责 Make 集成服务能力 |

常见组合：

- 做一个对象列表页：`makeui` + `canvas-table-integration` + `make-app-actions`。desktop/tablet 使用 CanvasTable，手机使用独立卡片 View；手机只提供点击记录的单条编辑/删除，不提供记录多选或批量操作
- 做记录编辑、删除、批量编辑或行级写权限预检：`make-app-actions` + `make-app-permission` + `make-app-service` + `makeui`；desktop/tablet 表格选择和批量能力再加 `canvas-table-integration`，手机只接单条操作
- 做字段可新建、`createFields` 或新建页字段权限：`make-app-permission` + `make-app-service` + `makeui`；Permission 计算权限与提交白名单，Service 独立传输/缓存 Schema 集合，MakeUI 只渲染授权字段和空状态
- 仅关键词搜索且通过 `filter.expression` 查询：`make-app-filter` + `make-app-permission` + `makeui`；只用包编译器，不读取／写入筛选 Preset 或挂载高级筛选面板，手机只显示搜索入口
- 做高级筛选、表格筛选或表头按字段筛选：`make-app-filter` + `make-app-permission` + `makeui`；desktop/tablet 再配合 `canvas-table-integration` 完成表头筛选联动，手机显示顶部搜索／筛选入口与移动面板，不挂载隐藏 CanvasTable
- 做筛选 Service 合同或 filter.expression 透传：`make-app-filter` + `make-app-service`
- 做多字段排序、拖拽排序或表头升降序：`make-app-sort` + `make-app-permission` + `makeui` + `canvas-table-integration` + `make-app-service`，必须同时完成权限感知的 Preset 保存/回显和 records sort
- 同时做高级筛选和排序：`make-app-filter` + `make-app-sort` + `make-app-permission` + `makeui` + `canvas-table-integration` + `make-app-service`，共享一次权限感知的 Entity Preset 加载与并发请求协调器，但按维度独立保存；仅关键词搜索不读取或应用 Preset 的筛选维度
- 做多级分组、拖拽分组或分组表格：`make-app-group` + `make-app-permission` + `makeui` + `canvas-table-integration` + `make-app-service`，必须同时完成权限感知的 Preset 保存/回显、record-groups、groupFilter、CanvasTable 分组和叶子明细分页
- 同时做高级筛选、分组和排序：`make-app-filter` + `make-app-group` + `make-app-sort` + `make-app-permission` + `makeui` + `canvas-table-integration` + `make-app-service`，共享一次权限感知的 Entity Preset 加载与并发请求协调器，但按维度独立保存；仅关键词搜索不读取或应用 Preset 的筛选维度
- 做 Make App AI 助手或 AI 对话框：`make-ai-assistant` + `makeui` + `make-app-service` + `make-app-auth` + `make-app-permission`，需要发布或接口域名注入时加 `make-app-runtime`；`make-ai-assistant` 主责公开包接入、Make App v1 契约、多会话、SSE、文件图片上传与包内 UI
- 做 UI 需要的 Service 接口：`make-app-service` + `makeui`
- 做 Make 项目默认权限体系：`make-app-permission` + `make-app-service` + `make-app-auth` + `makeui`，涉及表格编辑时加 `canvas-table-integration`
- 做一个登录后的页面：`makeui` + `make-app-auth`
- 做新 Make App 的桌面/移动双端 UI：`makeui` + `make-app-permission` + `make-app-auth`；移动端不是可选项，除非用户明确退出或指定特殊定制，否则默认接入 `@qfei-design/make-app-mobile@^0.1.9` 并遵循冻结的 Make App 手机视觉与交互基线。`0.1.7` 只是最低 API 版本，当前视觉交付至少需要 `0.1.9`，已安装包还必须通过 `skills/makeui/scripts/verify-mobile-package-surface.mjs` 的 iOS 输入与附件视觉校验，失败时报告包依赖阻断。手机对象列表默认卡片化，不显示 CanvasTable、分组、排序、记录多选或批量操作；表格、操作、筛选、AI 助手再按对应 Skill 组合
- 做 Service-fronted 登录后接口：`make-app-service` + `make-app-auth`
- 打包发布失败或 Service 启动失败：`make-app-runtime`
- 新增对象字段并部署：`makedsl` + `makecli`
- 新建完整 Make App：默认包含 `make-app-permission` 和 `make-app-actions`，通常组合 `makedsl` + `makecli` + `make-app-auth` + `make-app-service` + `make-app-permission` + `makeui` + `canvas-table-integration` + `make-app-actions`

## 可用 Skill 列表

### make-env-setup
准备或更新本地 Make 开发环境，覆盖 Node、包管理器、git、makecli、Make platform skills、Make 环境选择和登录校验；新 App 使用固定 Node/Corepack/pnpm 基线，存量 App 保留兼容的既有运行时与锁文件。

#### 升级 skill
```bash
npx skills update make-env-setup
```

**使用场景**
- 配置 Make 开发环境
- 开始 Make 开发前检查和更新本地工具链
- 校验 makecli 版本和登录状态
- 处理前置环境、makecli 登录校验或 Make skills 更新

### makecli
指导如何使用 `makecli` 命令行

#### 升级 skill
```bash
npx skills update makecli
```

**使用场景**
- 你需要指导使用 `makecli` 命令

### makedsl
指导如何生成 dsl 文件

#### 升级 skill
```bash
npx skills update makedsl
```

**使用场景**
- 根据业务的需求生成服务要求的 dsl 文件

### canvas-table-integration
指导如何在消费侧项目中接入 `@qfei-design/canvas-table`

#### 升级 skill
```bash
npx skills update canvas-table-integration
```

**使用场景**
- 在页面里接入 `@qfei-design/canvas-table`
- 接普通表格；分页表格、虚拟加载、分组表格仅在用户明确要求时添加
- Make 记录列表分组的完整行为、Preset、Service、groupFilter 和叶子分页由 `make-app-group` 主责；此 skill 只提供 `GroupTableComponent` 底层公开 API 接入
- 从 `package.ai.json.readOrder` 动态读取当前 CanvasTable 包文档，不硬编码包内 `docs/`、`examples/` 或 monorepo 路径
- 非 Make 表格使用 Track A 基础；Make schema 表格使用 Track C 展示基础；需要单元格编辑时在对应基础上叠加 Track B
- 把 JSON meta 转成 `IColumn[]`
- Make schema 表格默认按平台字段展示规范渲染附件、lookup、下拉标签、人员和部门，并仅在内容溢出时显示省略号和 tooltip
- desktop/tablet Make 记录列表默认通过 `make-app-actions` 接入复选框选择、底部操作栏和编辑/删除/批量编辑；手机使用卡片单条操作，不使用 CanvasTable。CanvasTable skill 只负责公开选择、清空和行颜色 API
- 切换左侧对象或动态路由时，canvas-table 默认重置滚动位置和对象级临时状态

### make-app-actions
指导生成、接入、重构或审查 Make 记录列表的标准操作能力。手机卡片复用包的 headless core 处理点击记录的单条编辑/删除，不提供记录多选和批量操作；desktop/tablet CanvasTable 覆盖复选框选择、底部操作栏、批量编辑、独立权限点、行级写权限预检和选择态并发安全。

#### 升级 skill
```bash
npx skills update make-app-actions
```

**使用场景**
- 接入 `@qfei-design/make-app-actions@^0.3.1`，按 `package.ai.json.readOrder` 读取公开文档，禁止复制包内 action 模型或批量弹窗
- 手机卡片通过 `resolveRecordSelectionActionState` 和 `validateRecordSelectionAction` 解析单条编辑/删除；目标只来自点击记录，不来自桌面选择快照
- 手机不渲染 CanvasTable、记录复选框、全选、选择操作栏或批量编辑；desktop/tablet 保持标准选择与批量链路
- 一条选择显示编辑/删除，两条及以上显示批量编辑，无可用操作采用带锁提示的方案二
- 独立使用 `data.record.update`、`data.record.delete`、`data.record.bulkUpdate`，不得把单条编辑与批量编辑权限耦合
- 区分明确选择 `include` 与表头全选 `exclude`；手动或 Shift 选满全部数据仍是明确选择
- 显式选择和全选排除列表分别遵循 200 ID 上限，改变搜索、筛选、排序、分组或对象时清空选择
- 全选时将搜索、状态、快捷筛选和高级筛选统一为最后一次成功列表查询的 `effectiveFilter`，预检和批量写入复用同一目标
- 预检前冻结不可变操作快照，Service 对完整目标只调用一次 `/data/v1/permission`，批量更新只调用一次 `/data/v1/field`
- 批量弹窗按字段类型使用宿主控件，不降级复杂字段，不包含自动化流程选项
- Ant Design 宿主使用包适配器并转发 `0.3.1` 的 `control.disabled`；非 AntD React 宿主使用通用 `RecordBatchEditModal` 并注入自身设计系统组件，不得混入 AntD 或复制弹窗
- 弹层按已安装组件库的公开 portal/overlay API 处理裁剪、焦点和关闭顺序，不把 AntD 的 prop 约定写成通用标准
- CanvasTable 1.3.1 分组表格不支持 Shift 区间选择，宿主不得自行模拟
- 只有准确无权限行 ID 才触发行标红；后端仅返回布尔拒绝时只显示 toast
- 页面布局交给 `makeui`，Canvas 选择 API 交给 `canvas-table-integration`，principal 权限交给 `make-app-permission`，Service 实现交给 `make-app-service`

### makeui
指导生成或修改 Make App 前端 UI，覆盖桌面/移动页面布局、App Shell、列表页、工作台、底部导航、任务页、选择抽屉、抽屉表单、详情页和响应式样式。

#### 升级 skill
```bash
npx skills update makeui
```

**使用场景**
- 生成或调整 Make App 前端页面
- 所有新 Make App 默认交付移动端；只有用户明确退出或指定特殊定制时才覆盖该默认。新建或改造移动端时接入 `@qfei-design/make-app-mobile@^0.1.9`，并验证目标 App 实际安装产物通过 `skills/makeui/scripts/verify-mobile-package-surface.mjs`；低于 `0.1.9` 的已安装包或不满足 iOS 输入、附件视觉合同的包，应报告包依赖阻断。遵循冻结的 Make App 手机视觉与交互基线，只切换 View 并复用同一个业务 Controller
- 手机业务记录列表无论只读或可写都使用独立卡片 View，不渲染 CanvasTable；可写卡片复用 `make-app-actions` headless core、单条权限、预检和最终写接口合同
- 手机工具栏默认提供中号搜索；筛选能力已启用或本次明确请求时，才同排显示中号筛选入口。仅搜索若使用 `filter.expression`，复用 `make-app-filter` 编译器，但不读取／回显／写入筛选 Preset，也不挂载高级筛选面板。不展示分组、排序、记录多选或批量操作，也不得直接复用桌面 `listToolbar`/`listContent` 后仅靠 CSS 改样式
- 手机新建／编辑／详情不仅切换为全屏任务页，还必须使用移动字段适配器：桌面 DatePicker／RangePicker／Select 等弹层不能原样复用；日期时间、候选选择、Lookup、附件、详情值和安全区底部保存栏按 `mobile-form-controls.md` 验收
- 移动端默认使用头像账户抽屉、最多五项底部导航、独立工作台、全屏任务页，以及 `/fields` 的标准人员／部门与附件字段组件；底层搜索抽屉只用于特殊定制
- 人员/部门多选中的勾选、删除标签和清除只更新 `MobileIdentityField` 当前打开周期的临时草稿；关闭放弃草稿，只有“确定”提交真实表单值。只有特殊字段直接使用底层 Sheet 时，宿主才自行持有这份草稿
- 手机人员/部门单选默认使用 `MobileIdentityField` 和 `selectionMode="single"`，不显示“确定”；选择、移除和清除由字段组件通过一次 `onChange` 提交并关闭。只有直接使用底层 `MobileSearchPickerSheet` 的特殊组合，宿主才处理 `onConfirm` 快照，不得两层重复写表单。升级移动包后重启 Vite 并传入 `--force`，重新加载真实页面验证单选、多选和桌面回归
- 设计 App Shell、侧边栏、顶部栏、列表页、创建/编辑/详情抽屉
- 基于宿主项目提供的字段元数据生成表单和字段展示
- 详情页/详情抽屉按字段类型和返回结构展示值，日期范围、下拉、人员、部门、附件、lookup 等不能直接展示原始 JSON
- 表单/详情中的人员、部门字段默认使用候选接口源；Make App 默认 UI-Service 候选接口为 `/api/users` 和 `/api/departments`，如宿主已有等价路由则遵循宿主合同
- 需要在 UI 中接入 Make 记录表格时，配合 `canvas-table-integration`
- 分组按钮位置由 `makeui` 决定，但完整分组行为交给 `make-app-group`
- 不负责认证细节；认证、统一登录、logout 和 `/api/make/**` 请求规则交给 `make-app-auth`
- 不负责打包发布、Service runtime、镜像入口和构建产物；这些交给 `make-app-runtime`

### make-app-filter
指导生成、重构或审查 Make App 筛选能力。先区分 `search-only` 与 `advanced-filter`：仅关键词搜索走 `filter.expression` 时只用包 core 编译器，不启用筛选 Preset、Controller 或面板；高级筛选由用户要求或项目已有能力触发，不因手机适配自动新增。`advanced-filter` 在各展示模式共享包 Controller、Preset 与 `filter.expression`；desktop/tablet 同时完成高级筛选和 CanvasTable 表头联动，手机提供顶部筛选入口和移动安全面板，不挂载隐藏 CanvasTable。

#### 升级 skill
```bash
npx skills update make-app-filter
```

**使用场景**
- 设计或修改完整筛选能力：高级筛选弹层、筛选条件组、`且 / 或` 关系和确认提交；desktop/tablet 增加 CanvasTable 表头“按该字段筛选”，手机不展示表头入口
- 接入或升级 `@qfei-design/make-app-filter@^1.0.0`，先读取 `package.ai.json`，再动态按 `package.ai.json.readOrder` 读取实际发布的包文档，不硬编码 `docs/` 或 `examples/` 内部路径
- `search-only` 只用包 core 的 `compileListFilter({ fields, searchText })`；不读取或写入筛选 Preset、不挂载 Controller／面板，也不要求移动面板布局 API
- `advanced-filter` 使用包内 core、React panel、Controller、所需 adapter 和 `styles.css`；手机须先确认已安装包的公开 API 支持 `layout="mobile"`，否则升级或报告 blocker；禁止复制或手写本地筛选模型、操作符矩阵、校验器、CEL compiler/parser 或高级筛选面板
- 根据 Make 字段类型使用包内筛选操作符和值编辑器
- 两种模式都通过包内 `compileListFilter` 生成 Service 可消费的 `filter.expression`；只有 `advanced-filter` 才合并已应用的高级筛选
- 对齐后端 Record 列表筛选：新请求使用 `filter: { expression }`，无有效表达式时省略 `filter`，不生成 `[]`、`{}`、空表达式或旧对象 DSL
- `1.0.0` 基线支持 DateRange、File 和已解析 Lookup；字段展示、操作符、CEL 与布尔分组全部以 `@qfei-design/make-app-filter` 公开能力为准，宿主不得手写或重排表达式
- `advanced-filter` 的 desktop/tablet 表头更多菜单与高级筛选联动：点击“按该字段筛选”调用同一个包 Controller 追加草稿条件并打开高级筛选
- 两种模式都使用 `make-app-permission` 的列表访问门禁；权限关闭时阻止新的 Schema/records 请求并让旧结果失效。仅 `advanced-filter` 需要 `{ enabled, entityKey, generation }` 筛选 Preset 上下文并阻止相关 GET/PATCH
- 仅 `advanced-filter` 与排序共享父级 Entity Preset 协调器，以请求 ID 管理并发保存；筛选面板本地提交锁不能替代共享 pending 状态
- `advanced-filter` 的 desktop/tablet 不允许只做高级筛选或只做表头筛选；手机按移动合同只做顶部包筛选入口，不视为缺失表头联动
- 约束空筛选、未完成条件、unsupported 字段、人员/部门筛选值和测试
- 不负责页面 Shell 和工具栏整体布局；这些交给 `makeui`
- 不负责 CanvasTable 渲染和 suffixRender API 细节；这些交给 `canvas-table-integration`
- 不负责 Service route 实现；这些交给 `make-app-service`

### make-app-group
指导生成、重构或审查 Make App 完整分组能力，覆盖最多三级的有序
`{ fieldKey, order }[]`、`capabilities.groupable === true` 字段判断、
`@qfei-design/make-app-group` 拖拽草稿、工具栏与可选表头分组入口、Entity Preset
保存/读取/回显、Service record-groups/groupFilter 合同、Make Data 分组模式、DNF
表达式追加和 CanvasTable 分组叶子明细分页。

#### 升级 skill
```bash
npx skills update make-app-group
```

**使用场景**
- 设计或修改多级分组、分组条件、分组优先级、清空分组
- 分组只在 desktop/tablet 展示；手机标准卡片列表隐藏分组入口并使用普通 records，不渲染 `GroupTableComponent`
- 接入 `@qfei-design/make-app-group@^0.1.0` 的 React controller、面板、适配器和样式；dnd-kit 由包内部维护，宿主不直接安装或编排
- 按运行时 Schema `capabilities.groupable === true` 选择字段，不维护字段类型白名单；Lookup 是否可分组以运行时能力为准，不做平台级一律排除
- 分组最多三级，字段唯一，数组顺序就是层级
- 通过 `openWithField(fieldKey, order?)` 将可选 CanvasTable 表头分组入口接入同一个分组面板，确认前不刷新 records 或 record-groups
- 外层分组弹层必须受控并由 click/press 打开，禁止 hover、移出和失焦关闭；下拉、日期等 portal/teleport 子弹层属于同一交互边界，选值不能关闭分组面板
- 先读取 Entity Preset 再查询 records 或 root record-groups；确认时先保存 Preset，成功后才应用和刷新，失败保留旧应用态与当前草稿
- Preset 按维度局部更新：分组只写 `{ group }`，不覆盖 filter 和 sort；Preset 清空使用 `{ group: [] }`
- Data API 叶子明细回到普通 records 模式时必须省略 `group` 或传 `null`，不得传 `group: []`
- `groupFilter` 由宿主按 DNF 表达式规则追加组路径条件，不能把复杂 OR 表达式直接拼成嵌套条件
- 页面位置交给 `makeui`，CanvasTable 分组渲染机制交给 `canvas-table-integration`，Service 路由和 Make adapter 交给 `make-app-service`

### make-app-sort
指导生成、重构或审查 Make App 完整排序能力，覆盖最多五级的有序
`{ fieldKey, order }[]`、`capabilities.sortable === true` 字段判断、dnd-kit
拖拽优先级、工具栏与 CanvasTable 表头共用排序面板、Entity Preset 保存/读取/回显，
以及 records sort 的 UI-Service 合同。

#### 升级 skill
```bash
npx skills update make-app-sort
```

**使用场景**
- 设计或修改多字段排序、升序/降序、排序优先级、清空排序
- 排序控件只在 desktop/tablet 展示；手机标准卡片列表隐藏排序按钮和 CanvasTable 表头排序入口
- 接入 `@qfei-design/make-app-sort@^0.1.0` 的 React controller、面板、适配器和样式；dnd-kit 由包内部维护，宿主不直接安装或编排
- 按运行时 Schema `capabilities.sortable === true` 选择字段，不维护字段类型白名单
- 排序最多五级，字段唯一，数组顺序就是优先级
- 通过 `openWithField(fieldKey, order?)` 将 CanvasTable 表头升降序接入同一个排序面板，确认前不刷新 records
- 先读取 Entity Preset 再查询 records；确认时先保存 Preset，成功后才应用和刷新，失败保留旧应用态与当前草稿
- Preset 按维度局部更新：排序只写 `{ sort }`，不覆盖 filter 和 group
- 使用 `onConfirm` 持久化、同步 `onApplied` 更新应用态、`onApplyError` 上报应用失败，并把权限感知、单调变化且引用稳定的访问上下文 generation token 作为 `resetKey`
- 分组使用独立 `make-app-group` 和 `capabilities.groupable`
- 页面位置交给 `makeui`，CanvasTable 表头菜单机制交给 `canvas-table-integration`，Service 路由和 Make adapter 交给 `make-app-service`

### make-ai-assistant
指导在 Make App 中接入 `@qfei-design/make-ai-assistant`。Make App v1 覆盖 18 项操作：capabilities、分页 Agent 发现、多会话、历史、消息、反馈、响应快照/取消、SSE 续传、文件图片分片上传和内容引用。当前适配器不承载 Artifact。

#### 升级 skill
```bash
npx skills update make-ai-assistant
```

**使用场景**
- 接入或升级 `@qfei-design/make-ai-assistant`，从实际 registry 安装最新已发布版本并核对消费 workspace 的 lockfile 精确版本、`/client`、`/make-app` 与 `/react` 公开类型；当前协议以本 Skill 内置的版本化 reference 为准，不得从已有项目、其他 POC、项目历史、包内源码或示例推断
- 使用正式组件 `MakeAiAssistant`、`AssistantPanel` 和 `styles.css`；包负责标题、任务列表、消息区、输入框、上传菜单等内部 UI，宿主只负责外部摆放和公开主题变量
- 当前 Make App 的 `/api/make/app/ai/v1/**` 使用 `make-app`；已安装版本缺少所需公开类型时明确报告“当前包版本缺少所需公开契约”并停止，不猜测旧路由或旧环境变量；当前 Skill 未内置 legacy adapter
- Make App 先用 `/client` 读取完整 Agent 分页，仅选当前 App 唯一的 `agentType=app_internal` Agent，随后异步创建 `/make-app` transport 并读取 capabilities；`agentId` 不得来自环境变量、公开配置、部署配置、URL、存储或硬编码
- 对接 Make App 多会话、SSE 增量/快照/续传、历史对账、反馈、取消、文件图片上传；分别处理裸 JSON、204 空响应、SSE 和字节，不使用统一 JSON 解包
- 当前 `make-app` v1 适配器不提供 Artifact 输出，不得伪造 Artifact capabilities、消息字段或 UI 承诺；文件/图片输入不受此限制。若未来有新协议，先升级公开契约和 Skill
- 规范 AI 助手接口域名：浏览器始终同源调用 `/api/make/app/ai/v1/**`；local preview 的 Service 上游使用 `make_api_origin + /api/make/app/ai/v1/**`；published Service 使用 `MAKE_API_BASE_URL` / `MAKE_SERVER_URL` 严格 origin 加 `/make/app/ai/v1/**`。不得新增独立 AI Gateway / Agent Gateway 域名、Token 或配置变量；Service 必须校验请求 `appKey` 等于部署注入的 `MAKE_APP_KEY`
- 页面布局、入口位置和响应式交给 `makeui`；Service route/proxy/log/test 交给 `make-app-service`；登录态交给 `make-app-auth`；权限策略交给 `make-app-permission`；运行时变量注入和发布检查交给 `make-app-runtime`

### make-app-service
指导生成、重构或审查 Make App 的 `apps/service` API，覆盖 UI-Service 合同、Service 路由、Make Meta/Data API adapter、`MAKE_APP_KEY` / Make adapter 环境变量/config 语义、schema/records/users/departments/lookup/file 代理接口和 Service API 测试。

#### 升级 skill
```bash
npx skills update make-app-service
```

**使用场景**
- 设计或修改 `apps/service` 接口
- 更新 `apps/docs/api.md` 中的 UI-Service 合同
- 生成 schema、fields、records、record detail、create、update、delete、cell update 等通用对象接口
- 当分组启用时生成 record-groups、records `groupFilter` 和 Entity Preset `group` 合同；分组语义由 `make-app-group` 主责
- 生成人员、部门、lookup options、文件上传/删除/下载代理接口
- 设计 Make Meta/Data API adapter、错误返回、请求参数校验、日志脱敏和接口测试
- 线上 Service 读取记录必须通过 Make gateway 的 `/make/data/v1/record`，并把请求登录态转发给 gateway；不得通过 `makecli` 获取运行时数据
- 约束 `apps/service/src/config.ts` 中 Make adapter 配置语义：`MAKE_APP_KEY` 由部署注入且 Service 调 Make Meta/Data 时使用，`MAKE_API_BASE_URL` 是严格网关 origin（如 `http://make-gateway.make-dev`），`MAKE_SERVER_URL` 兼容，Make adapter 按服务 scope 显式拼 `/make/**`，缺少必需配置时启动失败
- 不负责页面布局；页面和组件展示交给 `makeui`
- 不负责认证实现；统一登录、cookie、session、401/403 交给 `make-app-auth`
- 不负责打包发布；端口、`dist/server.js`、package scripts 和镜像入口交给 `make-app-runtime`
- 不负责 DSL 建模、Make CLI 操作或 CanvasTable 渲染；这些分别交给 `makedsl`、`makecli` 和 `canvas-table-integration`

### make-app-permission
指导生成、重构或审查 Make App 单应用权限体系。Make 项目默认必须接入此能力，除非用户明确要求跳过权限。

#### 升级 skill
```bash
npx skills update make-app-permission
```

**使用场景**
- 增加或审查 `/api/make/app/principal/permission` Service 接口
- Service 调 Make IAM `/api/make/iam/v1/principal/permission`，使用 App scope，不混用平台权限
- 前台登录后加载权限，使用 `meta.entity.read` 控制对象导航和路由、`meta.field.read` 控制表头、`data.record.read` 控制数据加载；即使没有数据读取权限，只要对象和字段已授权仍展示左侧对象与表头，并在撤销数据读取权限后清空缓存行数据，结合 Schema 的 `fields` / `createFields` 和独立的 `creatable` / readable / editable 字段权限，控制列表、详情、新建、编辑、删除、单元格编辑和提交白名单
- 防止通过手动修改 URL 进入未授权 App、对象页或固定业务页面
- 刷新时重新获取权限，再决定是否刷新数据或关闭已打开工作区
- 使用 `scripts/audit-make-app-permission.mjs` 做权限合同检查
- 不负责后台权限策略配置、认证机制、通用 Service API、UI 布局、CanvasTable 内部、DSL 建模或部署

### make-app-runtime
指导 Make App 运行态和打包发布契约，覆盖 `apps/` workspace、`apps/ui/dist`、`apps/service` 构建产物、Service 端口、镜像启动入口和发布前契约检查。

#### 升级 skill
```bash
npx skills update make-app-runtime
```

**使用场景**
- 生成、重构或审查 Make App 的 `apps/` workspace 结构
- 处理打包、发布、镜像启动、K8s 启动入口相关问题
- 排查 `Cannot find module '/app/apps/service/dist/server.js'`
- 约束 `apps/service/src/server.ts` 必须构建出 `apps/service/dist/server.js`
- 约束 `apps/service/package.json` 的 `build/start` 和 `apps/service/tsconfig.json`
- 约束 Service 固定端口 `3000` 在启动配置中的落实，以及发布前构建契约测试；Make adapter 环境变量/config 语义交给 `make-app-service`

### make-app-auth
指导 Make App 前端接入 `@qfeius/make-app-auth`，只保留统一登录模式，覆盖 `/api/make/**` 鉴权请求、401/403、logout、current-context 身份、飞书容器退出可见性和 Cookie/Session/redirect 排障。

#### 升级 skill
```bash
npx skills update make-app-auth
```

**使用场景**
- 生成或审查 Make App 统一登录启动逻辑
- 发布态、vibe App 和本地联调都只走统一登录；缺少域名、`/api/make/**` 路由或 Org callback 白名单时标记 blocker，不降级为 token/no-login
- 验证 OAuth、SSO、Cookie、logout、redirect callback
- 处理权限不足、登录态过期和退出链路
- 为 `makeui` 账户表面保留 `name`、`avatar`、`tenantName`，集中并测试普通浏览器／飞书容器识别；飞书内隐藏移动退出入口但不改写认证退出逻辑
- 约束普通 Make 后端请求通过共享 API adapter 包装 `auth.api`，统一处理 401/403；Make App AI v1 的 `/client` 另有严格限定同源路径的 `AuthenticatedTransport` 原始字节流桥接，保留状态、响应头、SSE 和文件字节，不扩展为普通 API 的裸请求惯例
- 使用 `scripts/audit-auth-contract.mjs` 做发布前认证合同检查，拦截 token 模式、裸 `/api/make` fetch 和 Service auth proxy 缺失
- 约束前端不要手写 `Authorization`、不要传 `accessToken`/`tokenProvider`/`unifiedLogin:false`、不要操作 `zs_session`、不要自行拼 Org OAuth/logout URL

### make-integration
Make 集成服务, 扩展 make 平台的能力, 目前集成能力有
- 发票 OCR

#### 升级 skill
```bash
npx skills update make-integration
```

**使用场景**
- 识别发票(打车, 火车票, 宾馆, 餐饮等)的内容(金额等相关信息)
