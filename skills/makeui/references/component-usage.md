# Component usage

## Contents

- [设计方案与组件实现的维护边界](#设计方案与组件实现的维护边界)
- [Selection strategy](#selection-strategy)
- [完整方案应用与差异记录](#完整方案应用与差异记录)
- [明确纳入公共组件主题时](#明确纳入公共组件主题时)
- [Overlay portal contract](#overlay-portal-contract)
- [Default candidate mapping](#default-candidate-mapping)
- [Make field-metadata-driven components](#make-field-metadata-driven-components)
- [Field-type icons](#field-type-icons)
- [Make field properties contract](#make-field-properties-contract)
- [Numeric input and IME composition](#numeric-input-and-ime-composition)
- [Host form controlled field contract](#host-form-controlled-field-contract)
- [远程候选加载反馈](#远程候选加载反馈)
- [Detail value display](#detail-value-display)
- [Table component rule](#table-component-rule)
- [Action hierarchy](#action-hierarchy)
- [Optional action policy](#optional-action-policy)

## 设计方案与组件实现的维护边界

MakeDesign 负责风格、布局选择、预览和方案交接，交付完整设计数据及其来源；makeui 统一维护组件行为和 Make 表单／详情标准。Ant Design 基座的唯一实现来源是本 Skill 的 [assets/antd-foundation/](../assets/antd-foundation/index.tsx)，字段、值适配、授权结果和业务接口仍按各自合同接入。

MakeDesign 的 `src/foundation/antd/` 是生成快照，不得手工修改组件行为；组件修复与行为回归先在 makeui 完成，再显式同步固定版本供预览和下载使用。同步需核对完整文件集合、来源版本、逐文件哈希及运行依赖，普通官网构建只消费已固定快照，不读取某台电脑的兄弟仓库。远端 `foundation` 是 makeui 资产的同部署分发，不建立另一套组件标准；旧来源字段仅作兼容读取，新快照不以独立 `localPatch` 维护分叉。源仓库、安装副本、官网快照和实际部署分别核对，不能把任一处更新当成全部同步。

设计器内的示例字段、静态候选、保存演示和 `components.html` 仅作视觉参考，不作为真实 Make Schema、候选、权限、校验或提交规则。新项目继续使用本 Skill 的表单／详情与字段适配合同。旧 `makeui-controls/v1` 保留历史兼容，新项目不默认消费其 React Aria 实现或安装相关依赖；原方案 URL 与设计数据仍可完整恢复。其他公共包的自有 UI 按 [主题范围](#完整方案应用与差异记录) 后续单独同步。

## Selection strategy

选定唯一主组件库和视觉来源后，所有新 POC／模板先执行 [页面设计基线与视觉验收](page-design-quality.md)，检查本项目需要的表单、详情、日期、选择、反馈和弹层均有公开组件支撑，再生成代表页面。完整组件库不要求安装无关组件，也不扩展 Make 公共包的职责。

For every new project, after PRD/DSL confirmation and before installing UI dependencies or scaffolding components, check the PRD and the user's description. If either explicitly selects the project's UI component library, use that library directly. If either supplies a selected MakeDesign plan URL, verify it through the MakeDesign branch below and use the resolved plan directly. Dependencies or UI supplied by a starter template, a library mentioned only as an example, a style name, and the gallery URL alone still require the question.

In all other cases, ask **要使用 MakeDesign 选择项目风格吗？** using the available structured input UI (`request_user_input_async` or `request_user_input`). If unavailable, ask the same question in chat. Wait for an explicit answer before starting UI work. Silence or dismissal leaves the choice pending. Reuse an answer already given for this project when resuming the same task.

视觉来源与唯一组件基座是两项配置：视觉来源是 MakeDesign 方案或组件库默认主题，组件基座是承载真实业务控件的一套 React 库。设计路线未确认前不安装依赖或生成 UI。MakeDesign 分支默认使用 Ant Design，告知用户“采用所选 MakeDesign 风格，业务控件使用 Ant Design 基座”，不增加新的必答问题；已明确指定 Arco Design、shadcn/ui 或其他兼容 React 库时保留该选择。模板自带依赖不是用户已选择该基座的证据。已有项目保留其既有库，用户要求迁移时另行确认迁移范围。

- 使用 MakeDesign → immediately perform both actions in the same handoff. Open [MakeDesign](https://test-make.qtech.cn/design/) in a visible, focused tab in the user's browser and send a clickable link to that page in the conversation, including when opening succeeds. Tell the user to choose a style, adjust it if needed, click 复制方案链接 in the upper-right corner, and paste the URL back into this conversation. Verify the target URL and visible style-gallery content before reporting that the page is open. If the tab is blank or hidden, recover the navigation or bring it into view. If browser control is unavailable or opening fails, explain the opening problem in the same message with the clickable link and instructions. Wait for a valid plan and read its handoff before generating UI.
- 选择组件库 → use the library selection below；此分支使用所选库的默认主题。用户可明确从 MakeDesign 返回此分支，或在已有唯一基座上应用 MakeDesign 风格，不因此并装另一套库。

### MakeDesign branch

1. Open the exact returned official design link with its query intact in a browser, replacing the fragment with `#makeui`. Read the rendered JSON in `#makeui-handoff`. Static HTML alone is the app shell. With a local matching MakeDesign checkout, the alternative is `npm run --silent read:design-url` in the prepared module; pass the URL via stdin to preserve query encoding. If the user sends a gallery link, ask them to choose a style and click 复制方案链接. For an unrecognized version, invalid URL or unreachable site, explain which input is missing and retry or request a newly copied plan link. Keep the chosen design branch pending.
2. Use `choices` for the selected design, layout, theme, illustration, document options and fine edits. Use the resolved layout rules, colors, metrics, typography roles and component style variables for implementation. Read the selected `designPackage` from the browser result for original tokens, DESIGN.md and USAGE.md; for the local reader use the matching prepared system package. Only consume assets from the same MakeDesign deployment. Treat a style ID such as `antd` or `github` as a design choice.
3. 先记录唯一基座，AntD 宿主再读取可选的 `foundation`：校验 `foundation.contract` 与资产 `asset.contract` 均为 `makeui-antd-foundation/v1`，`foundation.library` 与资产 `library` 均为 `antd`，`foundation.asset` 必须属于当前方案的同一部署。按 [AntD 基座接入](antd-foundation.md) 消费源码与样式。缺少 `foundation` 的旧部署可使用已安装 Skill 的同版资产读取 v1 方案主题，必须记录资产来自本机安装副本，不能声称远端已提供新基座资产。声明了 `foundation` 却合同不符、资产无法读取或来源不符时，不消费该声明，说明问题并请求兼容资产；不静默回退另一来源。非 AntD 宿主跳过 AntD 资产消费，不能因方案附带该声明改变已指定的库。
4. 旧 `controls.asset` 继续兼容：读取时校验 `controls.contract` 与返回的 `asset.contract` 都是 `makeui-controls/v1`。其 `controls.style` 可提供 v1 主题映射，不再默认复制 React Aria 的 `fields.tsx`/`fields.css`，也不自动安装该原型包依赖。指定 Arco、shadcn/ui 或其他库时，沿所选基座的公开主题和控件 API 接入 `choices`、颜色、尺寸及已支持能力，不因为缺少 AntD 基座而安装 AntD、复制 AntD 组件或混入 React Aria。旧控件包合同错误时不得消费其中源码或样式；独立有效的设计数据能否继续使用，应说明受影响的具体字段与能力。
5. 普通桌面／平板记录 **detail** 才消费 `choices.detailOpening`：`page` 使用有返回导航的详情路由；`drawer`／`wide-drawer` 使用对应 `layout.structure.widths.drawer`／`wideDrawer`（v1 为 560／960px，上限 88vw）。`system` 或缺省使用 Make 平台默认。新建／编辑默认仍为 60% 右侧 Drawer，不受详情宽度选择覆盖。无论主题或详情容器如何选择，都遵循 [统一表单与详情骨架](drawer-layout.md) 和 [字段图标](field-type-icons.md)。手机继续使用 Make 移动包的全屏任务页与字段适配；CanvasTable、权限、审批、操作和分析详情遵循各自合同。
6. 保存原方案 URL、实际加载的 Skill 路径与版本、唯一基座与版本、主题映射及明确的能力差异。先检查 workspace、Form、Detail、禁用态和弹层均消费当前主题，再用真实宿主恢复已保存字段、编辑并检查最终 Make payload，包括日期边界、时间精度、多选和级联变化。页面示例及演示指标不扩展 PRD／DSL 的业务范围。

| Desktop/tablet field | Controlled adapter |
| --- | --- |
| `Make.Field.Date` | Use the selected foundation's `DatePicker` for date-only values. Map `properties.format` to its documented display and keyboard format; normalize the result to the agreed date-only payload. |
| `Make.Field.DateTime` | Use a themed host date-time picker that supports the configured format and preserves the backend time precision through submission. |
| `Make.Field.DateRange` | Bind the selected foundation's `RangePicker` through a nullable `{begin, end}` record adapter. Treat begin, end schema limits separately as inclusive bounds; enforce interval order and every configured bound on selection and submit. |
| `Make.Field.SingleSelect` | Bind the selected foundation's `Select` to the selected option key and preserve the scalar option value through the [host adapter](#singleselect-read--form--submit). |
| `Make.Field.MultiSelect` | Use a themed host multi-select that restores and submits the array of option values. |

For a cascade, map the selected ID path to the agreed payload and clear descendants when a parent changes. Identity and Lookup pickers use host candidate data. All adapters follow the [host form contract](#host-form-controlled-field-contract).

### Component library branch

For a new project on the component-library branch, show a structured choice UI when available (`request_user_input_async` or `request_user_input`). Present exactly these three suggested options in order, with Ant Design marked as the recommended default:

1. Ant Design (recommended default)
2. Arco Design
3. shadcn/ui

Allow the UI's free-text/custom answer so the user can specify another compatible React component library; the three suggestions are not a restriction. If structured input is unavailable, ask the same concise question in chat and allow a custom answer. Honor an explicit selection. If the user delegates the choice or makes no selection after a reasonable opportunity to respond, use Ant Design; state this default when proceeding. Do not wait indefinitely for an unanswered optional choice. For an existing project, keep its component library unless the user asks to change it. This choice does not change the default Lucide icon library.

Keep one component library unless the user asks to retain an existing mixed stack. For either branch, follow the [field icon contract](field-type-icons.md) and its independent Lucide default.

所有新项目的字段包装、表单、详情和 Drawer 都必须读取 [布局合同](drawer-layout.md)；不得把缺失控件直接降级为裸 `input`／`select`／`textarea`，或每个页面临时生成一套互不兼容的控件和校验。字段适配继续消费同一 Make registry、权限字段集和 [受控值合同](#host-form-controlled-field-contract)。

## Presentation priority

The component-library mapping below is the desktop/tablet default. On phones, `mobile-defaults.md` takes precedence for shell, task pages, account navigation, pickers, and record-list presentation, and `mobile-form-controls.md` defines field adapters and overlay fit. Use public `@qfei-design/make-app-mobile` components where they exist rather than treating a desktop Drawer or Sheet as the mobile CRUD default; do not invent package exports for field types the package does not own.

## 完整方案应用与差异记录

先落实 PC／平板宿主自有的 Shell、导航、页面表面、工具栏、普通表单／详情和所选组件库控件；颜色、布局、字体和细节均消费当前方案。手机只通过 [手机颜色接入](mobile-theme.md) 同步主色／选中强调色，其输入、数字、下拉、日期、人员／部门控件及其余视觉、布局和交互继续遵守冻结移动规范，不能传整份 PC 主题。Canvas、审批等其他引用包的自有 UI 暂沿用正式版本现有外观，完整主题同步须另行明确纳入范围。PC 宿主传给公共包的按钮、字段等展示插槽仍按宿主方案渲染；手机插槽遵守移动规范并只跟随主色。不主动给包自有区域接完整主题 Provider／mapper、不覆盖私有 CSS、不为这轮宿主验收要求修改或发布公共包。将这些差异记为“公共包主题后续同步”，不记作已实现，也不作为宿主交付阻断；Make 业务、权限、字段和手机合同继续生效。下文完整方案要求按此职责和本轮范围验收。

文字按 [业务字号角色](business-typography.md) 消费 `typography.roles`、`tracking` 与来源；页面展示标题、记录容器、字段、辅助文字及手机页头不能共用一个大字号，用户已明确的微调保留原含义。

MakeDesign 分支必须以同一份已解析方案驱动 PC／平板 Shell、导航、页面布局、表面、字体、间距、控件、细节与弹层，覆盖首页、列表、新建／编辑、详情、独立业务页面和各类状态；不能只把主色传给 AntD Provider 就报告完成。`choices` 的整体方案、页面视觉、导航、普通详情、组件语言、字体／密度／控件／圆角微调、插画与已有次级卡片样式按各自作用范围消费，原始设计包提供规范与 Token 来源。手机默认只消费主色／选中强调色，PC 的字体、密度、导航和组件语言不适用于手机；这属于明确平台范围，不是遗漏方案。Make 的权限、字段语义、受控值、操作资格、表单／详情结构及手机包合同保持生效，不用统一结构为理由把外观改回固定模板。

方案明确的导航优先于默认左侧栏；`system` 继承本方案 recipe，而不是统一生成左侧栏。普通详情的显式 page／drawer／wide-drawer 继续按方案执行；新建／编辑、审批任务和分析汇总遵循各自的容器合同。方案未给出对应值时，才使用当前已核验基座的官方 fallback，并记录来源；属于 Make 展示合同的默认行为也记录对应合同，不能把未知能力伪装成方案选择。Intercom、GitHub 等验收样例用于检验映射，不是新项目默认，不得复制它们的固定色值、字体、尺寸或布局来替代另一份方案。

生成前和验收时，逐项记录选择的适用范围、已实现、不适用、未支持及差异。一个选择不适用须有 PRD／页面类型或公开能力依据，例如没有既有统计卡片时不新增演示指标；不能省略记录后声称所有选择都已应用。不支持的选择不得静默忽略，也不能捏造公开 API、Token、组件导出或外部资源；说明原选择、所需效果、当前能力、受影响页面与可选处理，暂停依赖该缺口的实现，等待用户明确取舍或所需能力补齐，不阻塞无关业务。

整体视觉的公开能力按实际安装包与当前资产核验；主题或布局未覆盖公共组件时，明确记录差异，不覆盖其私有 DOM／CSS。旧部署回退仍消费用户的原方案，只替换已明确记录的基座来源，不将本机样例当作用户方案。验收必须比较方案值与真实页面计算样式和布局；源码存在变量、某个主题文件或颜色相似不能证明完整方案已生效。

同一 App 切换完整方案时，不能按设计 ID 重建业务 Controller、Form 或路由树，也不能让下级继续使用初始方案常量；由单个 Provider 提供当前方案，主题、Shell、Surface 与弹层统一继承。AntD 接入按 [当前方案与展示解析](antd-foundation.md#当前方案与展示解析) 使用已核验入口，覆盖 motion 单项变化在内的挂载次数、草稿、数据与请求状态保留验收。

### 明确纳入公共组件主题时

用户已将公共组件主题同步纳入范围时，按 [公共组件语义主题](public-component-theme.md) 的正式接入基线和宿主实际安装产物，使用唯一适配资产。默认固定项目方案、主动更新；同一语义合同下只改快照数据，不在各包维护风格分支。旧版缺少能力时保留原公开接入并说明差异；后续未发布扩展仍须隔离候选验收。此例外只扩展已核验的 PC 视觉面，手机仍只同步品牌色，字段、表单／详情、权限和业务行为不变。

## Overlay portal contract

For `Select`, `DatePicker`, `Popover`, user/department/lookup pickers, and other
popup controls rendered inside a Modal, Drawer, panel, or scroll region, inspect
the full ancestor chain before choosing the popup root. If a modal body, visual
panel, table region, or intermediate wrapper uses `overflow: hidden`,
`overflow: auto`, transforms, filters, or another stacking-context boundary,
mount the popup through the component library's public portal hook such as
`getPopupContainer` into a host-owned container outside the clipping ancestor.
The prop name is only an example: do not impose AntD props on Arco, shadcn/ui,
Radix, or another design system. Read the installed library contract and use its
public overlay mechanism.

Prefer the nearest owning Modal/Drawer wrapper when it sits outside the visual
panel. Otherwise use a dedicated document-level overlay root. The overlay must
remain in the owning surface's stacking context or have a z-index above that
surface and its mask. Do not try to repair overflow clipping by increasing the
z-index of a popup that is still nested under the clipped panel; z-index does not
escape ancestor clipping.

Apply the same popup-root policy to every control on one surface. Test both DOM
containment and browser presentation: the popup is outside the clipped panel,
appears above the Modal/Drawer, preserves its full border and last option/date
row, and stays usable when the owning body scrolls.

Portal placement is not complete until interaction semantics pass. Verify focus
containment and return, keyboard navigation, Escape ordering, and outside-click
behavior with the chosen Modal/Drawer and popup library. A document-level root
that looks correct but escapes the library's focus or dismiss layer is invalid.

## Default candidate mapping

以下是组件库分支的桌面／平板普通记录默认映射。图表的分组汇总明细按 [分析明细容器](../../make-app-analytics/references/integration-contract.md#汇总明细的默认容器) 统一为 PC 居中弹窗、手机底部弹层；Ant Design 宿主复用 Modal，shadcn/ui 宿主复用 Dialog 等现有居中容器，不机械使用记录详情的右侧 Drawer／Sheet。

When Ant Design is the selected component library on desktop/tablet:

- shell: `Layout`
- sidebar navigation: `Menu`
- global and page actions: `Button`
- search: `Input` with a search icon or search affordance
- optional filters: `Drawer`, `Popover`, or compact form controls
- create/edit/detail: `Drawer`
- route forms: `Form`
- read-only details: `Descriptions`, simple grids, or cards/panels
- feedback: `message`, `Alert`, `Result`, `Spin`, `Empty`
- avatar and user menu: `Avatar`, `Dropdown`

Use `lucide-react` by default for newly generated Make App icons, including Ant Design hosts; honor an explicit request for another icon library. Keep existing project-standard icons only where replacing them would be an unrelated migration.

When shadcn/ui is the selected component system on desktop/tablet:

- shell: CSS/Tailwind layout with project-local shell components
- sidebar navigation: project-local sidebar/menu components, or shadcn/ui navigation primitives when already added
- global and page actions: `Button`
- search: `Input` with a search icon from the selected icon library (Lucide by default)
- optional filters: `Popover`, `Sheet`, or compact form controls
- create/edit/detail: right-side `Sheet` with `side="right"` by default; do not use bottom Sheet for Make object CRUD unless explicitly requested
- route forms: `Form` with type-appropriate field controls
- read-only details: simple grids or project-local panels; avoid inventing nested card layouts
- feedback: `Alert`, `Skeleton`, toast/sonner, and explicit empty states when those components are installed
- avatar and user menu: `Avatar` and `DropdownMenu`

When shadcn/ui is selected, treat it as a source-code component system, not a traditional prebuilt UI package. Follow the official Vite path for new or existing Vite projects:

- ensure Tailwind CSS is configured before generating shadcn/ui components
- ensure the `@/*` alias is configured in TypeScript and Vite
- run the shadcn CLI from `apps/ui` or pass the correct config path for the workspace
- add only the components actually needed by the generated UI
- keep generated shadcn/ui components under the host project's established component path, usually `src/components/ui`
- use `lucide-react` icons for newly generated Make App UI unless the user explicitly requests another icon library

## Field-type icons

The [field-type icon contract](field-type-icons.md) is a default requirement for desktop/tablet field-name surfaces, not an optional decorative add-on. Reuse one type mapping for form/detail labels, card field labels, and true field-choice options. Phone field labels and field-choice options remain plain text. CanvasTable header drawing follows the same mapping through `canvas-table-integration`.

## Make field-metadata-driven components

Before generating Make forms or field editors, identify the host-provided object/field metadata shape used by the UI. `makeui` chooses controls and layout from that metadata; it does not define business APIs, Service contracts, local DSL loading, or persistence behavior. User/department candidate endpoints are the narrow exception: this file documents how selector UIs consume the host candidate source.

Form and field components should consume normalized UI field metadata, not raw backend objects. If raw metadata is still leaking into components, call out that another layer must normalize it before `makeui` can safely choose controls, required markers, readonly/disabled state, options, or lookup presentation.

If no field metadata exists, stop and call out the missing UI dependency instead of inventing static form controls.

### Permission-derived field-set handoff

以下 edit 字段与必填规则用于普通业务记录表单。我的审批任务按 [当前节点字段与动作合同](../../make-app-approval/references/task-detail.md) 消费 fieldPermission/actions，bpm-task 响应的 data.formMetadata 补字段定义，不从普通 entity/Schema 获取，不展示节点未授权的字段；不能改用普通 edit/IAM 或启动配置。RETURN 跳过业务字段校验，其余任务动作按该合同区分必填校验与已修改数值校验。

任务 Lookup 复用关联选择器外观并注入任务候选 provider，每次查询携带当前任务 reference，不能沿用普通 CRUD 源字段查询。包直接渲染的字段错误与宿主控件内部错误分别对齐输入区，避免嵌套缩进；意见区保持自己的对齐。审批列表四列图标和动态列宽由包提供，宿主历史表格才复用字段类型图标配置。

先区分新建分支：普通新建消费权限层从 `createFields` 得到的字段集；有效审批新建按 [make-app-approval](../../make-app-approval/SKILL.md) 消费启动配置授权字段，不再与普通 IAM 字段集合求交。`makeui` 接收宿主已授权的字段元数据，不自行计算权限策略：

- 普通新建接收权限层提供的 `createFields` / create field set，只渲染该集合；审批新建接收启动配置中 `readable` 授权的字段，并仅允许 `editable` 且受宿主类型能力支持的字段输入
- edit mode receives visible fields plus an editable-key set; visible non-editable fields may render read-only, while invisible fields do not render
- 普通 `createFields` 缺失或为空时不回退到 visible `fields`；审批启动配置加载失败或无效时显示错误与重试，不能回退普通字段
- do not read backend `editableFields` directly in a component; use the host's existing visible/editable result from `make-app-permission`

Schema requiredness has one metadata source: `field.validations.isRequired`. Derive the UI control's `required` prop and 必填 validation from it, scoped only to rendered authorized fields in the active mode. A required field excluded by the current mode's authorization must not leave a hidden validator that blocks submit. Before submit, the host must rebuild the mode-specific authorized payload allowlist; approval create also requires Service to recheck the authoritative start config.

普通新建允许创建但没有可新建字段时，显示 `暂无可新建字段` 空态并禁用提交，不从 visible 或 editable fields 拼凑输入。审批新建不得因普通 `createFields` 为空进入该空态或禁用提交；按启动配置授权字段、校验结果与当前分支的提交合同决定表单和按钮状态。

For new Make App projects, create or reuse a shared field type registry at `apps/ui/src/lib/make-field-types.ts` before implementing field-driven UI. The registry is the shared source for host-owned form controls, detail display, CanvasTable table display, and table cell editors; these consumers should resolve common `Make.Field.*` presentation behavior from the registry instead of carrying separate local mappings. The registry must preserve normalized `field.properties` and expose the properties needed by generated UI, including `format`, `precision`, `decimalPlaces`, `maxCount`, `begin`, `end`, `symbol`, and `useGrouping`. Advanced-filter controls resolve support and editor behavior through `make-app-filter` package APIs, not this registry.

Use type-appropriate controls:

| Make field group | Default control |
| --- | --- |
| `ID`, generated fields | read-only text |
| `Text`, `TextArea`, `URL` | text, textarea, or URL input |
| `Number`, `Currency`, `Percent` | desktop/tablet numeric control; phone plain controlled text input per `mobile-form-controls.md`; display formatting stays out of submit values, which are finite numbers or pure numeric strings |
| `Date`, `DateTime`, `DateRange` | date, date-time, or range picker |
| `SingleSelect`, `MultiSelect` | single or multiple select from schema options |
| `SingleUser`, `MultiUser` | searchable user selector using the host-provided candidate source |
| `SingleDepartment`, `MultiDepartment` | searchable department selector using the host-provided candidate source |
| `File` | exact type `Make.Field.File`; create: omit for persisted-record-only upload, or accept only a backend-approved attachment array when an explicit pre-upload/direct-create host contract exists; edit: attachment component only with saved record identity; detail: attachment display |
| `Lookup` | exact type `Make.Field.Lookup`; read-only by default; relation selector only when relation metadata plus dedicated candidate/write Service contracts are present |

Do not silently degrade date, user, department, select, file, or lookup fields to a bare `Input`.

The table above names value semantics, not a requirement to reuse the same visual component at every breakpoint. Desktop/tablet may use the chosen design system's DatePicker, RangePicker and Select. Phone create/edit/detail must resolve these field groups through `mobile-form-controls.md`: wheel-based Date/DateTime, a single-month DateRange calendar, ordinary non-search Select sheets, searchable identity pickers, confirm-only Lookup, and mobile-safe attachment presentation.

If a field type is unknown, prefer a read-only display or an explicit unsupported-field fallback. Do not pretend it is a plain text field unless the user confirms that downgrade.

File fields are mode-sensitive. If the host exposes only `.../records/:recordID/files/:fieldKey`, create forms must omit `Make.Field.File` controls. A create control is allowed only when the host explicitly implements and tests pre-upload/direct-create returning the backend-approved attachment array without `recordID`; submit that array, never browser `File`, `blob:` or `data:` values. Render persisted-record attachment upload/edit only after a record exists and the stable id is available. Detail views may display existing attachments.

## Make field properties contract

Generated Make UI must treat schema `field.properties` as behavior input, not passive documentation. Normalize the raw schema once at the metadata boundary and pass these properties through the shared field registry, form adapters, detail display adapter, CanvasTable handoff, and cell-editor handoff.

| Field type | Property | Required UI behavior |
| --- | --- | --- |
| `Make.Field.Date` | `format` | Use the schema format for DatePicker display, typed input parsing, detail text, and table handoff. If absent, use the host date default consistently instead of mixing formats per surface. |
| `Make.Field.DateTime` | `format` | Use the schema format for date-time picker display, parsing, detail text, and table handoff. Keep submit values in the backend-agreed date-time shape. |
| `Make.Field.DateRange` | `begin`, `end` | Treat `begin` and `end` as the selectable range. Date range controls must disable dates before `begin` or after `end`; with only one boundary present, apply a one-sided disabled-date rule. Submit a structured range such as `{ begin, end }`, not display text. |
| `Make.Field.Number` | `precision` | Desktop/tablet: configure InputNumber / NumberInput / 数字输入控件 with `precision` as the maximum decimal-place limit. When the user exceeds it, show `最多保留 N 位小数`, keep the field invalid, and block the submit persistence request. Do not submit formatted display strings. |
| `Make.Field.Currency` | `symbol`, `decimalPlaces`, `useGrouping` | Desktop/tablet: configure InputNumber / NumberInput / 数字输入控件 with `decimalPlaces` as the maximum decimal-place limit and show `最多保留 N 位小数` on overflow. Use `symbol` and `useGrouping` only for input/display formatting. Block the submit persistence request while invalid; store and submit only finite numbers or pure numeric strings. |
| `Make.Field.Percent` | `decimalPlaces` | Desktop/tablet: configure InputNumber / NumberInput / 数字输入控件 with `decimalPlaces` as the maximum decimal-place limit and show `最多保留 N 位小数` on overflow. Block the submit persistence request while invalid; add `%` only in formatter/renderers and do not multiply or divide values by 100 unless the host metadata or backend contract explicitly says so. |
| `Make.Field.File` | `maxCount` | Use `maxCount` as the attachment selection/upload limit. Disable or block extra choose, drag/drop, paste, and add actions after the limit; show the host validation/error state instead of silently dropping files. Default to the DSL default of `1` when the property is absent. |
| `Make.Field.MultiUser` | `maxCount` | Use `maxCount` as the maximum selected user count. Once reached, disable further candidate selection or prevent the next commit while preserving clear/remove actions. Default to the DSL default when absent. |
| `Make.Field.MultiDepartment` | `maxCount` | Use `maxCount` as the maximum selected department count. Once reached, disable further candidate selection or prevent the next commit while preserving clear/remove actions. Default to the DSL default when absent. |

On phones, follow `mobile-form-controls.md`: use a plain controlled text input without steppers for Number, Currency, and Percent, while keeping the same raw-text decimal-limit validation and submit values. The desktop/tablet numeric-control mapping above does not select the phone View's control.

For Ant Design on desktop/tablet, this usually maps to `DatePicker` / `RangePicker` `format` and `disabledDate`, `InputNumber` `precision` / formatter / parser, `Upload` or project attachment controls with `maxCount`, and multiple `Select` controls that block extra selections after `maxCount`. Other component libraries should implement equivalent controlled behavior.

Do not hide these rules inside business field-name checks. A field named `amount` is not enough to infer currency behavior; use `type: Make.Field.Currency` plus `field.properties.symbol` and `field.properties.decimalPlaces`.

### Number, Currency, and Percent decimal-place validation

Form validation owns decimal-limit failures before persistence. Do not treat a Data API validation error as the normal way to teach the user the field precision.

- Resolve the maximum decimal places from field type: `Make.Field.Number -> field.properties.precision`, `Make.Field.Currency -> field.properties.decimalPlaces`, and `Make.Field.Percent -> field.properties.decimalPlaces`.
- The field type registry only supplies normalized field metadata. Put decimal-place validation in a separate pure helper shared by form adapters and CanvasTable cell editors; do not put validation decisions in the registry, implement three unrelated counters, or let the two surfaces drift.
- Preserve the untouched raw numeric input string separately from the parsed submit value. Derive the trimmed candidate only as `normalizedText`, and validate it before finite-number parsing so binary floating-point conversion cannot invent or erase decimal places.
- If the shared helper retains the untouched input, expose it as `rawText` for diagnostic display only. Also return `normalizedText = rawText.trim()` as the parse/submit candidate; only `normalizedText` may enter finite-number parsing or a pure numeric-string payload. Whitespace-only input therefore normalizes to `""` before required/optional validation.
- Accept only plain decimal text equivalent to `[+-]?(?:\d+(?:\.\d+)?|\.\d+)` at the commit/submit boundary. Count every digit after the decimal point, including trailing zeroes, toward the configured limit. Reject scientific notation, grouping separators, currency/percent symbols, a trailing decimal point, and other formatted text as invalid numeric input.
- Configure the numeric component with the resolved limit when its public API supports it, but do not rely on a formatter that silently destroys the user's extra digits before validation can see them. If the component exposes only an already-rounded number, use its string/raw-input mode or a host wrapper that preserves the raw text.
- Validate on change or blur and again at the form submit boundary. On overflow, mark the field invalid, show the field-level message `最多保留 N 位小数`, block that invalid submit and its persistence API request. Candidate searches, metadata reads, and other unrelated read-only requests remain allowed.
- Apply declared `field.validations.minimum` / `maximum` with exact decimal-text comparison before conversion; do not invent missing business bounds. Check equality and just-outside values without floating-point rounding.
- After raw-text validation succeeds, preserve the existing write contract. For JSON numbers, require decimal-value equivalence with the serialized number and block value-changing conversion or underflow. Use a pure numeric string only when the write API explicitly supports it; a string in a read response is not sufficient evidence. Never count decimal places from a JavaScript `number` or from `String(parsedNumber)`.
- The default policy forbids silent rounding. Automatic rounding is allowed only when the host project has an explicit product/backend contract for it; the normalized value must be written back and shown to the user before submit.
- Empty/null handling remains owned by required/optional validation. Skip decimal-place counting for an empty raw input; for every non-empty value, validate raw syntax and decimal places before parsing.

For desktop/tablet Ant Design, `InputNumber.precision` can constrain the control, but the adapter still needs a raw-text buffer and field-level validation because formatter/parser behavior may normalize input before submit. Desktop/tablet Arco, shadcn, and project-owned NumberInput components must provide equivalent behavior. Phone text inputs reuse the same validation helper, not the desktop numeric control.

### Numeric input and IME composition

Apply this behavior to `Number`, `Currency`, and `Percent` form controls on desktop/tablet and phone, including project-owned controlled numeric inputs. Keep it at the control/adapter boundary; the raw-text precision and submit-value rules above still apply.

- While an IME is composing, do not commit its interim text as a numeric value. If composition temporarily replaces selected digits with Pinyin, Chinese characters, or other invalid text, the last committed number must remain intact. Stripping invalid characters and parsing the remainder must not turn that temporary draft into a shorter committed number.
- When composition finishes, an invalid candidate leaves the committed value and displayed digits unchanged, with the user's caret or selection restored where practical. Accept a changed numeric candidate that passes the host field contract exactly once; a following browser input event for the same composition must not submit it twice or discard an independent subsequent edit.
- Keep ordinary digit entry, explicit Backspace/Delete, and supported numeric formatting or paste behavior working after either outcome. Invalid text entered without an IME must also leave the existing digits intact rather than silently deleting them.
- Cover invalid composition over selected digits, a valid numeric composition, any trailing input event, and normal deletion afterward in controlled-component tests. When the defect is reported for a particular browser and IME, reproduce those steps there before claiming the browser-specific defect resolved; synthetic DOM events alone do not establish its actual event order.

These are observable requirements, not a mandated `compositionend` or `inputType` event sequence. Follow the installed control library's public API and the host's existing value contract.

## Host form controlled field contract

Host form controlled custom field components are mandatory for Make create/edit Drawer forms and route forms. Any reusable field adapter, remote selector, or field-type control rendered under the host form layer must accept the host form's controlled props and forward them to the interactive control that owns the input value:

- required controlled props: `value`, `onChange`, `onBlur`, `id`, `disabled`
- also preserve when provided: `name`, `ref`, `required`, validation status, `aria-invalid`, `aria-describedby`, and project-specific form item context
- normalize event shapes if needed; call `onChange(nextValue)` with the submitted value shape at the control's commit boundary. Immediate controls commit input/selection/clear; confirm-only pickers commit the complete snapshot only on confirmation
- call or forward `onBlur` so touched state, required validation, and submit-time validation behave the same as native/project controls

The form store and validation state must match the displayed selection. If `validateFields`, a resolver, or a submit handler reads an empty value while the control visually displays a selected user, department, lookup record, date, or option, the field adapter is broken. Display labels, avatars, option objects, and popup rows are presentation data; the form value remains the source of truth.

This contract applies to all type-specific field controls, especially `SingleUser` / `MultiUser`, `SingleDepartment` / `MultiDepartment`, `Lookup`, select, date, file, and custom relation selectors. The committed trigger/display value comes from host `value`; candidate labels and transient search/open/loading state are not the source of truth for committed values.

Immediate controls write each committed selection/clear once. On phones, `MobileIdentityField`, `MobileDateField` and `MobileDateRangeField` keep their transient sheet draft inside the package; the host passes committed `value` and forwards the public `onChange`/`onBlur` once, without mirroring that draft or adding a close-path commit. Host-composed `MobileOptionPickerSheet`, direct `MobileSearchPickerSheet`, and editable Lookup (even single) keep a host-owned draft initialized from `value` on open. Their draft selection/removal/clear callbacks, including `onSelectedKeysChange`, never write the real form; only `onConfirm` writes one snapshot (a single option may confirm immediately), while cancel/close discards unconfirmed changes. Cancel/close never writes `onChange`, but must preserve the control's documented `onBlur` behavior; package-owned identity/date fields call `onBlur` on close. For host-composed controls, the adapter forwards `onBlur` once when the interaction ends, after confirm or cancel/close, never per draft change. Reopen from committed `value`. Use `mobile-form-controls.md` and `mobile-defaults.md` for phone commit boundaries; preserve the existing desktop control's documented commit behavior.

Component library choice does not require a different contract.

Ant Design, Arco, shadcn, or any existing project component library can be used for the visible control. Do not solve controlled-field bugs by forcing a project to use a specific form item or select component. The required behavior is the library-neutral adapter boundary between the host form layer and the field control.

Common failure pattern to reject:

```tsx
// Broken: the visual selector updates local state, but the host form value stays undefined.
function RemoteUserSelect() {
  const [selected, setSelected] = useState<UserOption | null>(null);
  return <HostSelect value={selected?.label} onChange={setSelected} />;
}
```

Use a controlled adapter instead:

```tsx
type RemoteUserSelectProps = {
  value?: string;
  onChange?: (nextUserId?: string) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
};

function RemoteUserSelect({
  value,
  onChange,
  onBlur,
  id,
  disabled,
}: RemoteUserSelectProps) {
  return (
    <HostSelect
      id={id}
      disabled={disabled}
      value={value}
      onChange={(nextUserId) => onChange?.(nextUserId)}
      onBlur={onBlur}
    />
  );
}
```

User and department selectors require a real host-provided candidate source. For generated Make App projects, use the platform default UI-Service candidate contract unless the host project already documents equivalent endpoints or Service/API routes:

- users: `GET /api/make/app/users?keyword=&page=&size=` -> `{ users, total }`
- departments: `GET /api/make/app/departments?keyword=&page=&size=` -> `{ departments, total }`
- user option identity: `userId`; label: `userName`; optional avatar: `avatar`
- department option identity: `departmentId`; label: `departmentName`; flatten department trees before presenting selector options
- UI sends `keyword`, `page`, and `size`; do not expose a UI-side sort control for these candidate pickers
- search uses the candidate endpoint instead of filtering stale local demo data

This candidate-source rule applies to every user or department selector UI. For surfaces owned by another skill, keep the same candidate-source contract and let that skill own the surface behavior:

- create/edit Drawer forms and route forms
- table cell editors and any canvas-table popup selector
- candidate selectors rendered inside the advanced-filter package panel and table-header filter flow
- reusable business selectors embedded in custom panels

Do not read user/department candidates from field schema `options`, `meta.options`, current table rows, static fixtures, or hardcoded demo data. Those sources may not represent the current org. Current record values may be merged into the selector options only so existing selections keep readable labels while `/api/make/app/users` or `/api/make/app/departments` is loading or returns no matching page.

If the host project uses different route names, keep the same behavior contract and normalize the response at the UI boundary. Do not call Make user/department backend services directly from `makeui` components when the host project requires a Service/API adapter or another owning transport layer.

When the candidate source is missing and the user confirms a placeholder, use a searchable selector shell that:

- displays the current value from the record
- leaves a clear integration point for the real candidate source
- avoids fake global demo candidates
- shows loading, empty, error, and retry states

For Ant Design on desktop/tablet, the default form-control mapping is:

- text: `Input`, long text: `Input.TextArea`
- number/currency/percent: desktop/tablet `InputNumber`; phone plain controlled text input without steppers per `mobile-form-controls.md`
- date/date-time/date-range: `DatePicker` / `DatePicker.RangePicker`
- select/user/department/lookup candidates: `Select` with `showSearch` and `mode="multiple"` for multi-value fields
- file: no create upload when a saved record identity is required; edit/detail attachment UI after persistence

Platform selector behavior:

- `SingleUser` / `SingleDepartment`: single `Select`; `MultiUser` / `MultiDepartment`: `Select` with `mode="multiple"`
- set `showSearch`, `allowClear`, and `optionFilterProp="label"`
- for user/department fields, use remote search: `filterOption={false}` and call the candidate search function from `onSearch`
- show loading while candidates load; show an error/disabled state such as `人员候选加载失败` or `部门候选加载失败` when the candidate API fails
- merge current record values into options before candidate results so existing selections still display readable labels while async options are empty
- submit user values as `userId`; submit department values as `departmentId`; keep labels only for display
- do not submit display labels, fake ids, or local demo candidates

On phones, present user and department fields through `MobileIdentityField` from `@qfei-design/make-app-mobile/fields` at the `0.1.7` baseline in `mobile-defaults.md`; use `MobileSearchPickerSheet` directly only for an explicit custom field composition that the field-level API cannot represent. `MobileIdentityField` is the controlled boundary: forward its `onChange` and `onBlur` to the host form exactly once. Present ordinary options through `MobileOptionPickerSheet` and dates through `MobileDateField` / `MobileDateRangeField` from `/pickers`. Preserve the remote candidate and normalized id contract. Follow the frozen Make App phone visual baseline in `mobile-visual-standard.md`; desktop controls and selectors owned by other Skills retain their own surface contracts.

- `SingleUser` / `SingleDepartment`: pass `selectionMode="single"`; the field omits “确定”. Selection, selected-chip removal, and clear immediately call the field `onChange` with the committed snapshot and close.
- `MultiUser` / `MultiDepartment`: pass `selectionMode="multiple"`; the package owns transient open-session draft state, and “确定” remains the only call to the field `onChange`. Selection, chip removal, and clear do not write the host form; cancelling discards them.
- 初始已选人员也要在候选到达时缓存姓名/头像，而非只在确认后缓存。搜索、取消、重开不得丢失照片；新响应缺头像不覆盖已有值，缓存按会话隔离且只保留已选 ID。与数值提交和桌面/手机样式一起执行 [字段适配回归](field-adapter-regressions.md)。
- Pass committed ids as `value`, labels/avatar metadata as `selectedItems`, and current remote results as `items`. Normalize single empty selection to the host field's empty value; submit user ids or department ids, not labels. Forward package `onChange` and `onBlur` into the host-form controlled adapter once; do not add a second effect or close-path commit.
- Multi-value create/edit triggers render wrapped tags rather than joined/truncated text. User items show avatar or deterministic initials fallback; department items show the standard circular abbreviation in both selected chips and candidate rows.
- If a special composition directly uses `MobileSearchPickerSheet`, the host must manage draft `selectedKeys`/`selectedItems` and commit only the `onConfirm(payload)` snapshot. This low-level exception must not replace `MobileIdentityField` for ordinary user/department fields.

Phone edit attachment fields use `MobileAttachmentField` from `/fields`. The host maps its normalized attachment state to package `items` and owns upload, retry, remove, permission, record identity, and persistence calls; the package owns thumbnails/file icons, filename/status cards, removal confirmation, and the full-width upload entry. Do not use the component-library default Upload list as the standard phone presentation.

Detail display for identity fields:

- `SingleUser` / `MultiUser`: read-only avatar/name display; use avatar when present and deterministic initials/color fallback otherwise
- `SingleDepartment` / `MultiDepartment`: read-only department tag/name display
- if the record contains only ids and no labels, resolve labels through normalized current record values or the host candidate source before display; do not show raw ids as the intended final UI unless no label source exists and the UI explicitly marks the dependency gap
- do not render detail identity fields as disabled text inputs

## 远程候选加载反馈

Lookup、人员、部门等远程选择器在桌面／平板及手机的候选面板内区分加载、成功、空结果及失败。首次展开与再次搜索等待时提供可见的加载图标和文字提示，使用宿主现有加载组件或公共包的公开状态插槽；仅设置 `aria-busy`、保留空白或暂时展示“暂无候选项”不算加载反馈。已选值和选择草稿继续保留，它们不等同于当前候选列表。手机 Lookup 使用加载占位时，旧候选不参与占位布局或点选，当前有效请求成功后再恢复候选；不通过清空已选值实现列表替换。

只有当前有效请求成功且没有候选时才显示空态；失败提供错误及重试，不同时显示成功空态。状态结束后移除加载提示；旧请求迟到、取消及关闭继续沿用原请求所有权，不覆盖新结果或清空已提交值。加载、搜索和重试不自行调用字段 onChange，选择确认语义保持原合同。

加载文案须实际可见，不能仅凭容器 textContent 判断；隐藏子节点的文字或图标文字不充当提示。真实几何验收按视口与裁剪／滚动祖先的可见交集检查反馈组，避免内部长容器居中但图形及文字已被裁掉。正常滚动且反馈在当前可见区域居中的布局仍可通过，不因存在 overflow 就一律拒绝。

手机 Lookup 的加载视图占据标题、搜索／已选区和操作底栏之外的候选剩余可用区域，图标及提示在该可见区域水平、垂直居中；不能只在列表中插入一行固定高度的提示。核对内容区到候选区的实际高度链、滚动和最小高度，加载不挤走底栏或遮挡搜索／已选区。可用 flex、grid 或定位实现，不统一要求某个类名、绝对定位或固定像素高度。

宿主用真实选择器与候选 provider 的延迟响应覆盖成功、有选中值、空结果、失败重试及搜索／关闭时序。无搜索的 Lookup 也要覆盖，不能只验证带搜索框或身份选择器的分支。分别以基础 UI 样式在宿主样式之前、之后加载验证实际组件，避免依赖导入先后维持加载区高度和居中；真实浏览器还需测量加载区域及图形与文案组成的实际反馈组中心、确认底栏可达，再做飞书手机交互验收。不能仅测占位外框，也不要求横向或上下排列时图标自身位于整区中心。自动样式检查不能代替浏览器几何验证。公共包缺少必要公开展示能力时报告具体缺口，不虚构 props 或修改包私有样式。

## Detail value display

Detail Drawer and route detail pages must use a normalized field-display adapter pattern. The adapter receives normalized field metadata plus the record value and returns a small display model such as `kind`, `text`, `labels`, `empty`, `href`, `attachments`, `users`, and `lookupReferences`. Detail components render that model; they do not call `String(value)`, `JSON.stringify(value)`, or read backend wrapper objects directly in JSX.

URL 字段必须使用 [跨端链接字段合同](url-field-display.md)：保留 href、语义化链接、主题链接色和独立导航，不能仅输出继承文字颜色的裸 anchor。该规则覆盖 PC／手机详情、只读表单与审批字段；手机卡片不能经通用文本格式化丢失链接。

CanvasTable cell rendering still belongs to `canvas-table-integration`. Keep the detail display adapter compatible with the same field-type semantics, but do not implement canvas renderers in `makeui`.

Default detail display by Make field type:

| Make field type | Stable value shape | Detail display |
| --- | --- | --- |
| `Make.Field.ID`, `Make.Field.Text` | primitive or object with display keys | plain read-only text |
| `Make.Field.TextArea` | long text | full-row text, preserved line breaks, safe wrapping |
| `Make.Field.URL` | string or `{ href/url/value, label/name }` | safe clickable link when href is valid; otherwise text |
| `Make.Field.Number` | number or numeric string | formatted number |
| `Make.Field.Currency` | number or pure numeric string | formatted currency added by the frontend field-type display adapter, defaulting to the field/schema symbol or `￥` when absent |
| `Make.Field.Percent` | number or pure numeric string | formatted percent text with `%` added by the frontend field-type display adapter |
| `Make.Field.Date` | date-like value | `YYYY-MM-DD` or the host project date format |
| `Make.Field.DateTime` | date-time-like value | `YYYY-MM-DD HH:mm` or the host project date-time format |
| `Make.Field.DateRange` | `[begin, end]` or `{ begin, end }`, also accepting `start/from/to` aliases when the host already returns them | `YYYY-MM-DD 至 YYYY-MM-DD`; do not render raw JSON such as `{"begin":...,"end":...}` |
| `Make.Field.SingleSelect` | Data/Workflow `[{ label, value }]` (normally one item); also existing raw scalar or `{ label, value }` inputs | normalize to the selected scalar `value` for the form; display metadata option label, then saved label, then value |
| `Make.Field.MultiSelect` | array of raw values or option objects | labels/tags joined or wrapped in the project's detail tag style |
| `Make.Field.SingleUser`, `Make.Field.MultiUser` | user object or array, normally with `userId/userName` or `recordID/name` | read-only avatar/name list |
| `Make.Field.SingleDepartment`, `Make.Field.MultiDepartment` | department object/id or array, normally with `departmentId/departmentName` or `recordID/name` | read-only department name/tag list |
| `Make.Field.File` | URL string, file object, JSON string, or array | attachment thumbnails/file chips/links; do not flatten to raw filenames when richer metadata exists |
| `Make.Field.Lookup` | object/JSON wrapper, often `{ entity, field, data }` | extract labels/references from `data`; openable references are links, deleted references are muted/struck through when status is available |

### SingleSelect read → form → submit

The [Data API read contract](../../makedsl/references/DataAPIDesign.md) returns an array for SingleSelect too. Normalize `[{ label: "未开始", value: "not_started" }]` to form value `"not_started"`; `[]`, null and absent values produce an empty control. Preserve the original label for read-only fallback when metadata no longer contains that option. Existing scalar/option-object inputs stay supported; do not turn the array into JSON text or a multi-select control.

Use the same field registry for ordinary create/edit/detail, approval create and approval task fields. Submit the scalar option **value**, never its label, `{label,value}` object or the read array. MultiSelect remains an array of option values. Preserve valid falsy values. Empty/clear/unchanged-field behavior follows the host's confirmed API contract; do not infer null, omission or a clear operation from an empty read value.

A small [executable reference adapter](../assets/single-select-value.mjs) covers extraction, display fallback and serialization. Reuse or adapt the existing host helper; do not add a parallel field store. The reference's default empty submit value is undefined; pass a different clear value only when the host contract establishes it. Test actual host controls and task `recordPatch`, not just this helper.

Value extraction should be tolerant but deterministic:

- Number, Currency, and Percent backend/API values stay numeric: accept finite numbers or pure numeric strings only. Do not submit or persist display strings containing `￥`, `¥`, `%`, thousands separators, or unit text.
- Currency and Percent symbols are presentation. Add them only in detail/table renderers or input formatters after finite-number validation, never in the form store value or API payload.
- Use field properties when formatting detail values: `Number.precision`, `Currency.symbol`, `Currency.decimalPlaces`, `Currency.useGrouping`, `Percent.decimalPlaces`, `Date.format`, and `DateTime.format`. DateRange detail values display the record value's range while the field schema `begin` / `end` remains the selectable-boundary rule for edit controls.

- empty values display a muted `-`
- generic object label priority is `label`, `name`, `title`, `displayName`, then `value`
- select labels come from field metadata options, then the saved option label, before falling back to raw values
- user label priority is `name`, `userName`, `displayName`, then `label`; identity uses `recordID`, `userId`, or `id`
- department label priority is `name`, `departmentName`, `displayName`, then `label`; identity uses `recordID`, `departmentId`, or `id`
- file name priority is `name`, `fileName`, then filename from URL; file URL priority is string value, `url`, then `fileURL`
- lookup wrappers with `data` display extracted data labels; an empty `data` array displays `-`
- JSON-like strings may be parsed only as a compatibility fallback for known structured field types, but raw JSON must not be the intended visual output

Detail layout and overflow:

- common detail values occupy one grid column in the two-column layout
- `TextArea`, long text, URL/link-rich values, `File`, `Lookup`, relation/association values, attachment-heavy values, and rich custom values span the full row
- values wrap safely in detail views; do not force single-line ellipsis on every value
- use ellipsis only in constrained title/action areas or compact chips, and expose the full value through tooltip/title only when actual overflow occurs

## Table component rule

For Make record lists and related-data tables, do not use the table component from the selected UI library.

Always use:

- package: `@qfei-design/canvas-table`
- skill: `canvas-table-integration`

This applies to:

- table display
- row sequence numbers and row-head detail entry by default for every table unless the user explicitly opts out
- pagination or virtual loading layout around the table, only when explicitly requested
- row selection: default for writable Make record lists through
  `make-app-actions`; only when requested for non-Make or strictly read-only
  tables
- cell editing, when requested

The selected UI library can still provide surrounding controls such as buttons, inputs, drawers, popovers, forms, and feedback components.

Do not add pagination controls, page-size selectors, page state, page query params, total-count handling, or paginated data-fetch logic unless the user explicitly asks for pagination.

## Action hierarchy

- Primary action: create/new, save, submit, or the user's stated main action.
- Secondary actions: refresh, export, import, settings, cancel.
- Destructive actions: visually separated from primary actions.

Do not make every toolbar button primary.

## Optional action policy

Optional controls only appear when requested:

- pagination
- filter
- group
- sort
- column settings
- import
- export

If requested, place them according to `list-page-layout.md`.
