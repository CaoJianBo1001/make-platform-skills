# AntD 基座接入

## 适用与边界

组件实现与 Make 表单／详情标准的维护入口统一在 makeui，MakeDesign 使用生成快照完成预览和方案交接；遵循 [维护边界](component-usage.md#设计方案与组件实现的维护边界)，不在设计器快照修另一套组件行为。

新项目的唯一组件基座为 Ant Design 时使用本参考；选择 MakeDesign 默认进入这条接入路径并告知用户。组件库默认主题分支也使用同一套 Form／Detail 骨架，可以省略设计参数。用户已指定 Arco、shadcn/ui 或其他库时保留该选择，按它们的公开 API 适配相同的 [布局](drawer-layout.md)、[字段图标](field-type-icons.md) 和 [受控字段合同](component-usage.md#host-form-controlled-field-contract)，不为使用本基座并装 AntD。

基座合同为 `makeui-antd-foundation/v1`。它提供官方 AntD 组件上的主题与业务表单／详情展示骨架，不提供业务 Controller、字段权限、候选请求、数据模型或保存接口。`CanvasTable`、`make-app-permission`、`make-app-approval`、`make-app-mobile` 仍由各自 Skill 管理；桌面基座不能替换 CanvasTable，也不能覆盖手机包、审批包或其他公共包的私有样式。

默认先验收宿主自己的组件和布局，引用包自有 UI 保留正式版现有外观；后续明确纳入公共包主题时再接其公开能力。宿主提供的 Button、Input 等展示插槽可消费 AntD 上下文，不因此扩展到公共包内部；详见 [宿主与引用包的主题范围](component-usage.md#完整方案应用与差异记录)。

完整方案是所有页面共用的设计输入，不能将基座或验收页面的固定配色作为新项目皮肤。按 [方案应用与差异记录](component-usage.md#完整方案应用与差异记录) 消费整体布局、导航、表面、字体、间距、控件和细节；不仅是 Form／Detail 和主色。当前已核验公开入口负责的范围之外，由宿主通过公开能力组合；没有实际导出的入口不得编造，无法实现的选择必须列出差异并等待明确处理。

## 取得并核对资产

1. 保留原 MakeDesign 方案 URL，按 [方案交接](component-usage.md#makedesign-branch) 读取渲染的 `#makeui-handoff`，以及同部署的 `designPackage`。读取完整 `choices`、`colors`、`metrics` 和旧 `controls.style`，不能只记住风格名称或主色。
2. 方案包含 `foundation` 时，核对其 `contract`／`library` 和下载资产的 `contract`／`library` 分别为 `makeui-antd-foundation/v1`／`antd`；资源须属于方案的同一部署路径，不能因为域名相同就消费其他部署或其他环境的文件。该资源传输的是 makeui 同版资产，来源版本、完整文件集合、逐文件哈希与运行依赖一起核对，不把设计器副本当作另一份标准，也不混搭不同版本的源码。合同、来源、文件集合或依赖无法核实时停止消费该基座，说明缺口，不伪造成功。
3. 旧部署没有 `foundation` 时，可以读取当前已加载 Skill 的 `assets/antd-foundation/`，使用完整同版目录。公开入口 `index.tsx` 会自动引入布局样式，复制时须保留它实际引用的 `components.tsx`、`app-shell.tsx`、`design-context.tsx`、主题／类型／CSS 及声明等全部相对依赖，以及 `foundation.json`，不能沿用旧的文件清单漏掉新增实现。先确认文件实际存在且来自同版安装；在项目 UI 配置中记为“已安装 Skill 资产”，不能描述成远端已交付新的基座。源仓库、安装副本和远端部署分别核对。
4. `foundation.json` 是远端下载与旧部署回退共用的运行依赖合同：当前验证组合为 `antd 6.7.2`、直接依赖 `dayjs 1.11.20`、`lucide-react 1.47.0`，React／React DOM peer 为 `>=18.0.0`；还须检查宿主真实运行时及其他包的兼容性。这份资产使用 AntD 6 的公开 API，不能复制到 AntD 5 后假定相容，也不能擅自升级存量应用。
5. 将已核对的源码与样式一起放入宿主自己的共享组件目录，并保持相对引用。宿主业务代码不得直接依赖某台电脑的 Skill 绝对路径。根据资产与实际官方包的依赖合同，在正确 UI workspace 声明 `antd`、React 和 `lucide-react` 等实际直接依赖；沿用宿主包管理器与锁文件，先通过运行时和 peer 兼容性门禁，不借机迁移运行时或安装第二套库。
6. 旧 `makeui-controls/v1` 仍可读取与核对，供已有原型或明确采用该控件的存量项目使用；新项目不默认复制其 React Aria 控件，也不因其依赖清单自动安装 React Aria。仅使用旧方案主题不等于使用旧原型控件。

## 公开接入面

| 入口 | 用法与归属 |
| --- | --- |
| `MakeDesignProvider` | 根层传入当前完整 `design` 与 `children`，统一提供主题、基座变量与方案上下文；没有 MakeDesign 方案时可省略 `design`，使用相容默认主题。页面和弹层都消费同一上下文，不按设计 ID 重建 Provider。 |
| `MakeAppShell` | 使用 `brand`、`title`、`headerEnd`、`navigation`、`primaryNavigation` 和 `children` 插槽组合宿主已有品牌、标题、身份、已授权导航和业务页面；默认继承根 Provider。独立的 `design` 覆盖只能来自同一当前方案，不引用旧常量。 |
| `MakeRecordSurface` | 传 `mode`（`create`／`edit`／`detail`）、`open`、`title`、可选 `status`／`actions`、`onClose` 与内容；默认继承根 Provider 的当前方案，无需在每处重复传设计数据。新建／编辑默认 60%，普通详情才消费显式的 page／drawer／wide-drawer。独立详情页面的 URL 与返回动作仍由宿主路由负责。 |
| `MakeFormLayout` | 组合官方 Form，使用其 `form`、`initialValues`、`onFinish` 等公开能力；不另造一份表单值、校验或 touched 状态。 |
| `MakeFormItem` | 在官方 `Form.Item` 上统一标签、必填、错误与控件槽；`fieldType` 连接 Make 字段图标，`wide` 表示跨列，`name`、`rules` 等仍为官方字段合同。`null`／`undefined`／`false`／空字符串标签保持官方无标签语义，不生成标签或图标；数字 `0` 及正常文字／ReactNode 标签保留。 |
| `MakeDetailGrid` | 传 `items`，每项包含 `key`、`label`、`fieldType`、展示用 `value` 与可选 `wide`；值由宿主字段展示适配器产生，不直接展示未经归一的对象或 JSON。 |
| `MakeActionButton` | 透传官方 ButtonProps，用 `intent`（`primary`／`default`／`danger`）按当前组件语言的 `rules.action` 选择官方 `color`／`variant`；不要固定 `type="primary"` 绕过已选描边等风格，权限、disabled、loading 和原动作回调保持。 |
| `MakeStatusTag`／`MakeTabs` | 透传官方 TagProps／TabsProps，分别按当前组件语言的 status／tabs 规则选择公开 variant／type；状态语义、已选页签与内容由宿主及原公共包负责，不重写业务状态映射。 |
| `toAntdTokens`／`toMakeDesignVariables`／`toMakeMobileTheme` | 纯映射设计数据，不安装依赖、不请求候选或写入业务数据；手机映射仅在实际移动包支持公开主题 Provider 后接入，见 [手机主题](mobile-theme.md)。 |
| `resolveRecordSurface` | 按设计数据与 `mode` 解析展示选择；只解析展示，不导航、不控制业务请求。 |
| `resolveAppPresentation` | 返回已生效的 navigation mode／widths、surface、presentationId、componentSuite、secondaryCards、illustration，以及 `applicability`／`fallbacks`；宿主据此核对作用范围和回退，不能只看一个风格 ID。 |
| `resolveTypography` | 返回实际生效的业务文字 `roles`、`tracking`、逐角色 `sources` 与 `fallbacks`；旧交接缺少角色时记录官方／Make 或既有明确值的来源，不把一个展示标题字号套给所有文字。 |
| `useMakeDesign()` | 获取根 Provider 的当前方案，下级 Shell、Surface 和业务展示不得继续导入初始方案旧常量；从同一输入解析主题、结构及可用元数据。 |

表单骨架完整示意：

```tsx
<MakeDesignProvider design={currentDesign}>
  <MakeAppShell brand={appBrand} title={pageTitle} headerEnd={accountEntry}
    navigation={businessNavigation} primaryNavigation={moduleNavigation}>
    {authorizedPageContent}
    <MakeRecordSurface mode="create" open title={entity.name}
      actions={authorizedActions} onClose={closeForm}>
      <MakeFormLayout form={form} onFinish={saveAuthorizedValues}>
        <MakeFormItem name={field.key} label={field.name} fieldType={field.type}
          rules={authorizedRules}>
          <Input disabled={!fieldWritable} />
        </MakeFormItem>
      </MakeFormLayout>
    </MakeRecordSurface>
  </MakeAppShell>
</MakeDesignProvider>
```

示意中的 `Input` 为宿主显式导入的官方 AntD 控件；字段集合、规则和动作资格来自现有授权与 Controller，不能照抄示意变量生成新的业务逻辑。日期、选择、人员、Lookup、文件等按实际字段类型选适配器，不全部替换为 Input。

## 当前方案与展示解析

单个 Provider 持有当前完整方案，不能按设计 ID 或主题给 Provider、Shell、业务 Controller 设置新的 `key`。下级默认通过 `useMakeDesign()` 继承，不能继续导入初始方案旧常量、缓存首个方案的派生值，或在方案切换时新建 Form、路由、页面树和请求状态。业务子节点的位置及 key 保持稳定；替换当前方案只更新展示，不清空表单草稿、数据、页签、权限或查询。测试中替换方案输入不等于为业务产品新增风格选择器。

`MakeAppShell` 的 `brand` 可传宿主既有品牌组件。客户端各导航模式共用一份品牌内容树及固定 portal 目标，只在基座自有侧栏／顶部展示槽间移动；不为隐藏位置另挂一份品牌组件，切换保留其状态、订阅和当前回调。其他 Shell 插槽保持原有位置及 React 祖先。无 DOM 的服务端静态导出只在当前导航的一个位置输出品牌；这不构成 hydration 验收。

默认 Vite 客户端接入中，普通详情的 page／drawer／wide-drawer 切换由 `MakeRecordSurface` 保留单份内容树及固定 portal 目标；正文及 `title`／`status`／`actions` 业务插槽均只挂载一份，切换不重建其状态或订阅。它们始终继承官方 Drawer 上下文，只移动基座自有的展示容器，不同时挂载两份业务 View，也不操作组件库私有节点。标题及操作继续使用公开的 `title`／`extra` 插槽，未传操作或传 `null`／`undefined`／`false`／空字符串时不生成空的操作组或 `extra` 占位；数字 `0`、`true` 和其他 ReactNode 按官方 presence 语义保留，不递归执行宿主组件来猜测内容。页面模式不启用 Drawer 的遮罩、Escape 关闭或焦点锁，也不将隐藏承载层的层级强制设为 0；内部弹层继续继承宿主 Modal／Drawer 层级和公开的 `zIndexPopupBase`，抽屉模式保留官方关闭回焦和公共主题作用域。宿主路由、权限、记录身份及关闭保护继续由原 Controller 负责。

服务端检查只覆盖无 DOM 的静态页面导出，不能将其报告为 SSR hydration 的状态保留验收。已有 SSR 宿主接入前须单独验证 hydration、挂载次数与状态交接，不直接沿用 Vite 客户端结论。

### 导航解析优先级

导航模式使用 `resolveAppPresentation` 的实际结果，不手工用旧的解析快照覆盖当前显式选择。解析顺序如下：

| 优先级 | 模式来源 | 适用条件 |
| --- | --- | --- |
| 1 | `choices.navigation`，缺省时兼容 `layout.structure.navigation.id` | 非 `system` 的显式选择 |
| 2 | `layout.structure.resolvedNavigation.mode` | 没有非 `system` 的显式选择 |
| 3 | `layout.recipe.nav` | 前两项缺省 |
| 4 | `single` | 上述均缺省，使用 Make 合同默认并记录回退来源 |

导航宽度优先读取 `layout.structure.resolvedNavigation` 中对应的值，缺省时读取 `layout.structure.widths`；有效性检查及有来源的合同回退以解析结果为准，并核对返回的 `fallbacks`。system 的 rail／workspace 与显式 single／double 宽度不是同一组值：v1 中 rail／workspace 分别为 68／240px，显式 single 为 208px、double 为 64＋184px；这些用于区别当前合同，生成时仍读取本方案返回值，不写死成所有 App 的 CSS。

### 插槽与业务内容

`illustrationSlot`／`secondaryCardsSlot` 仅填充宿主已有内容，不因交接包含插画或次级卡片元数据就新增指标、演示卡片或业务模块。

- `illustrationSlot` 按当前插画选择及适用范围组合已有装饰区域；使用交接返回的同部署 `asset` 及其 `filter`，核对来源和完整性，不继续引用初始方案图片或另一份方案滤镜。
- `secondaryCardsSlot` 的 `enabled=false` 或 `applicability=disabled` 表示不应用所选卡片装饰，不是业务可见性或权限开关。已有概览／统计内容继续展示，保留原指标、单位、语义状态、交互和 Controller；不因装饰开关隐藏或删除已有业务内容。关闭时参考预览可隐藏示例模块，目标项目不新增该模块；基座只撤除相应装饰。

Shell 的 `data-makeui-navigation`、`data-makeui-surface`、`data-makeui-presentation` 以及 `data-makeui-slot`（当前 header-end／primary-navigation）是验收定位信号。必须同时核对真实可见位置、尺寸、样式与交互；属性或能力标记存在不证明布局和功能已实现。

## 主题、字段与布局

字号按 [业务文字层级](business-typography.md) 读取当前方案的 `typography.roles` 及来源；页面展示标题、记录容器、字段、辅助文字与手机页头各用自己的角色，不能共用一个 `headingSize` 放大全部界面。

- 品牌、语义、表面、文字、边框及其状态值从当前方案逐项映射并记录来源；控件尺寸、字重、字号、行距、间距、圆角、阴影和布局规则同样有方案或已核验官方默认来源。没有用户方案时可以使用官方相容默认；有用户方案时不能以一组固定常量冒充不同方案。
- 主题使用公开 Token 和 CSS 变量：已有 `controls.style` 的 `--mk-*` 优先于颜色／尺寸兜底值，`choices.theme` 的显式 light／dark 优先于旧 `--mk-mode`。无对应方案值时才采用官方相容默认。官方浅／深色算法生成其余默认和派生状态后，`createMakeDesignTheme` 保留方案显式给出的品牌与语义颜色；不能将暗色算法二次推导后的主色误当原方案色。字体、背景、文字、边框、强调色、控件尺寸和圆角必须进入表单、详情、禁用态及 portaled 弹层，不能只给首页换色。
- body／heading／mono 均读取当前交接中的完整字体；`--mk-mono-font` 从当前方案映射到代码、编号等对应文字角色，不能继续沿用验收样例字体。图标粗细、motion、阴影、组件语言中的主次操作、状态和页签风格也按同一输入生效，不用新增业务或重建 Controller 实现视觉变化。
- 手机只同步主题主色及对应选中／强调色，按 [手机颜色接入](mobile-theme.md) 核对实际正式包并用 [颜色投影](../assets/mobile-brand-theme.mjs) 过滤完整 mapper；不能直接把 `toMakeMobileTheme(currentDesign)` 整份传入手机 Provider。手机保持原有输入、数字、选择、日期、人员／部门组件及字号、密度、字段布局、任务容器和同一业务 Controller，PC Provider 与样式作用域不能包住手机 View；不覆盖包私有样式。
- 已解析的页面视觉、插画、导航与普通详情选择优先于原始品牌包的示例建议；在 Make 平台合同内保持其设计差异，不能用 AntD 默认主题抹掉用户选择，也不能用能源等页面示例新增业务模块或演示指标。
- `Form.Item` 负责标签、必填、错误与控件绑定；子控件不再输出第二份标签。自定义字段接受并转发 `value/onChange/onBlur/id/disabled`，显示值必须与提交／校验读取的值一致。
- 包装官方控件的字段适配器也须接受并转发公开的 `style`／`className`，在内部使用组件公开的宽度属性填满值槽，例如 DatePicker／RangePicker 默认 `style={{ width: '100%', ...style }}`。基座能识别的官方直接子项与宿主包装器是不同接入形态；不能仅因外层已双列就假定包装后的日期、选择器宽度正确。真实浏览器同时检查字段槽和实际控件边界，不用额外的全局样式或修改组件库私有节点补救。
- DatePicker／RangePicker 的官方值与后端日期、时间精度、`{begin,end}`、Schema 上下限之间的转换仍归宿主字段适配器。基座不提供日期转换器，不以主题转换改变业务值类型，不把值范围和 Schema 范围混用。
- 新建／编辑默认使用纵向标签的双列网格；按所属容器的实际可用宽度和控件复杂度适配列数，长文本、Lookup、附件等按桌面字段合同跨列，控件填满值槽。详情使用紧凑标签／值行与统一分隔；长值可换行但不挤出容器。字段标签、表头和已有字段选择器遵循同一 Make 类型及图标规范，桌面规则不覆盖冻结手机字段行。
- 只有普通详情的显式 surface 选择覆盖默认详情容器；不把详情的 560／960px 宽度套给新建／编辑，不更改审批任务、分析汇总或手机全屏任务合同。

## 验收

所有组件库共用 [页面设计基线与视觉验收](page-design-quality.md)，先完成项目基线和代表页面，再扩展其他对象；下列项目补充 AntD 接入验证，不建立第二份页面或手机标准。

Intercom、GitHub 和其他验收样例只验证不同输入的映射与页面行为，不能作为后续产品默认。每次生成重新读取本项目方案，把已选值与实际 Shell、导航、页面、表单、详情、控件和弹层逐项比较，检查不适用／未支持项及原因；不能仅用“不同于 AntD 默认”作为风格保真的证据。

先用包含普通字段、长标签、TextArea、日期、区间、单多选、身份、Lookup、禁用、必填、错误与长值的最小 PRD／DSL 在隔离目录真实生成，再在真实浏览器检查；不能用文档正则、静态类型或截图文件存在代替生成质量与交互验收。

1. 默认双列与跨列正确，窄屏按所属内容区切换；标签、图标、必填、控件和错误不重叠，textarea 标签不能掉到左下角，控件宽度与高度一致，详情不成为大空白的散列文字。
2. 新建／编辑、普通详情、页面详情、字段弹层的主题一致；至少两个显著不同的 MakeDesign 方案保留各自配色、字体、密度、圆角及明确结构选择。指定非 AntD 库的项目不得出现 AntD 或 React Aria 新依赖。
3. 下拉与日期弹层不被 Drawer 裁剪；Tab、Escape、外部点击、关闭和焦点返回正确。恢复已存值、编辑、清空、必填错误、日期边界与精度、多选、候选请求失败后，最终 Make payload 与受控值一致。
4. 覆盖新 POC、模板、有效方案直接接入、不用 MakeDesign 和存量 App 保留库；分别记录真实宿主组件测试、浏览器、已安装包与未覆盖设备结果。修改布局 CSS、遗漏主题映射或错误的字段 span 必须能让相关验收失败；不能把只渲染成功报告为已交付。
5. 在同一 App 内切换完整方案，比较所有页面、Shell 导航模式／宽度、表面、三类字体、间距、控件语言、图标、阴影、插图及弹层的方案值与实际结果；业务数据、当前路由、表单草稿和选中页签保持。单独切换 `motion` 也必须验证 mount 次数不得增加，已有草稿、数据和原请求状态不丢失；组件测试统计真实 Controller／表单及标题、状态、操作插槽的挂载与清理次数，验证有状态操作、页签及公开弹层上下文在 page／drawer／wide-drawer 往返后保持，浏览器再检查真实交互，不能仅以 props、元数据或截图存在代替。
