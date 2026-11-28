# 宿主记录页组合示例

这是可复制到宿主的受控 View，不是业务 Controller 或新应用框架。先核对宿主实际解析的正式 `@qfei-design/make-app-mobile@0.1.16`；本示例只导入公开子入口。按需复制小文件与 `types.ts`，在 UI 入口导入一次包 `styles.css` 和本目录 `styles.css`。`index.ts` 是手机入口，不导入 AntD；只有主库选择 AntD 的桌面 View 才从 `desktop-record-search.tsx` 导入 `DesktopRecordSearch`。明确选择其他主库时，替换成该库正式受控搜索组件，保留下节完整的受控值、立即应用及输入法事件合同。

PC 搜索在既有 `MakeDesignProvider` 内渲染，PC／手机沿同一个 Controller 接入下述完整搜索事件；不在两个 View 内分别创建查询状态，不新增 Schema、IAM、候选、记录或认证请求。桌面／手机切换沿既有实际容器宽度规则，一次只挂载当前 View，Controller 放在分支共同父级。

## 列表搜索事件

`RecordSearchProps` 的 `value/onChange` 传当前输入值及原 Controller 的编辑处理；`onApply(query)` 传立即应用处理，`onCompositionStart()`／`onCompositionEnd(query)` 传输入法开始／结束处理，`onCompositionCancel()` 接收组合中卸载的取消信号，四个事件都必须接线，不能用空函数代替。`MobileRecordList` 的对应入口为 `query/onQueryChange`、`onQueryApply`、`onQueryCompositionStart`、`onQueryCompositionEnd` 和 `onQueryCompositionCancel`；`MobileLookupPicker.search` 使用同一份 `RecordSearchProps`，仍只在目标可搜索时传入。

这些是展示事件，不是新的业务请求接口。沿宿主已有 Controller 适配：普通编辑停止1秒才应用，正常清空立即重置并只请求一次；立即应用取消原定时器并沿原分页、取消和迟到响应保护链执行。组合开始取消待应用计时器，组合期间仍更新可见输入但不发请求，组合结束接收最终文本并重新启动1秒计时器；组合期间的 Enter 或桌面搜索按钮不能应用未确认文本。组合中卸载时清理 Controller 的组合标志与计时器，保留草稿但不应用，不能把取消伪装成组合结束。PC 使用 AntD 公开 `onSearch` 交接 Enter／按钮，清空仍只沿 `onChange('')`，不因 `source=clear` 重复应用。其他主库适配相同事件，不引入 AntD。完整查询规则见 [列表搜索合同](../../references/mobile-defaults.md#列表搜索合同)。

## 手机列表与导航

手机根壳层须先建立 `height: 100dvh; display: flex; flex-direction: column`，沿宿主既有 `border-box` 基础重置，既有页头占正常流，正文祖先连续设置 `flex: 1; min-height: 0`。本列表填满正文，**列表底缘必须与视口底缘一致**；不要在其外面再留导航或底部 padding，不要让祖先 `transform/filter/perspective` 改变 fixed 定位包含块。需要其他容器时沿宿主公开布局重新计算与真实视口的距离，不能直接照搬底部偏移。

`navigation` 直接透传公开 `MobileBottomNavigationProps`。正式导航处于正常流，本示例观察宿主自有 wrapper 的实际高度（含边框和安全区），通过公开 `MobileFloatingAction.style.bottom = navigationHeight + 8` 留出冻结的 8px 间隔。显式 `bottom` 替换包的默认公式，**不再额外叠加安全区**，不调整 z-index，也不覆盖包私有 class。首轮测量前暂不挂载新建按钮；尺寸变化用 `ResizeObserver` 和 resize 更新，卸载取消订阅。

`create` 仅在既有 Controller 的创建资格就绪且允许时传入；记录数和搜索结果不影响它。无资格、任务页或权限撤销由宿主不传此动作。正常、空列表、搜索无结果各保留恰好一个可达入口。`items` 由已有字段展示器映射，不硬编码对象名、人员或字段值；每项 `onOpen` 接宿主既有详情打开动作，`openLabel` 可包含当前记录的人类可读标题。非交互内容点击和标题行原生“查看”按钮都只触发一次 `onOpen`，键盘通过原生按钮进入详情；`title/content` 可保留安全 URL anchor，不嵌套在 button 中。URL、编辑按钮及其他内嵌交互有独立点击路径，不同时打开详情。单条动作继续复用 `make-app-actions` 的既有动作，示例只渲染宿主传入的受控回调，不解释或创建路由。

卡片空白点击隔离常见原生交互、`summary`、带controls的音视频和`contenteditable`（含空属性）等已知边界；不能自动识别所有自定义组件。宿主自定义交互区域显式加 `data-makeui-card-interactive`，或在已处理的点击中调用 `preventDefault()`／停止冒泡；卡片尊重 `defaultPrevented`。无交互声明的普通内容仍由卡片打开详情，键盘始终可用原生“查看”按钮。

手机卡片沿冻结基线：灰页面、白卡片、扁平无边框／阴影／大圆角，间距10px，动作至少44px触控目标。CSS 默认颜色来自公开移动变量及其正式默认值，不消费 PC 表面和排版。宿主既有下拉刷新、滚动位置、加载反馈沿原 Controller 通过 `scrollRegionProps`（含 ref／事件）和 `refreshIndicator` 接入；不添加手机独立刷新按钮，不将示例省略视为删除原能力。

## Lookup 候选草稿

`MobileLookupPicker` 是已有新建 Lookup 字段的 Sheet 组合，非新的字段注册表。触发器仍沿宿主表单受控 adapter 转发 `value/onChange/onBlur/id/disabled` 和可访问属性；候选、分页、搜索、迟到响应与字段值结构适配继续由现有 Controller 负责。宿主将已提交值映射为 `MobilePickerItem`，只在本组件 `onChange` 中写回原表单值；该回调不保存记录。普通已有记录编辑 Lookup 继续只读，审批节点编辑由审批合同单独决定。

候选点击、清除仅改变局部草稿；明确点击“确定”才回写一次完整候选快照并关闭。Escape、遮罩或外部关闭不回写，重新打开从宿主值初始化。选中项脱离当前搜索结果时仍保留快照。仅目标支持候选搜索时传入 `search`，按上节接齐输入、应用及组合输入事件；不可搜索时不传，不渲染搜索输入，也不制造搜索请求。加载／空／失败反馈由宿主 `items/emptyContent` 提供；加载时不传可选旧候选，不清空宿主值或已选草稿。

候选单选组保留一个 Tab 入口：当前已选且可用的候选优先，否则为首个可用候选。四个方向键循环移动焦点和草稿选择、跳过禁用项；Tab 进出组，Space／Enter 沿原生按钮激活，修饰键组合不由候选导航接管。选中项离开当前候选或变成禁用时仍保留快照，仅调整可进入的 Tab 入口；刷新候选不自动抢走搜索焦点。全禁用或空列表不制造假入口，清除／确定仍按各自可用状态访问。键盘导航和点击同样不能提前回写表单。

候选反馈需要完整剩余区域。正式0.1.16的通用 `MobileBottomSheet` 公开默认上限为 `min(76dvh,640px)`，不是搜索Picker的86dvh；本例如实保留该差异，不覆盖包面板或正文（包括通过ARIA选择器绕过私有class）。通过公开 `showHeader={false}`／`ariaLabel` 及自有content，宿主按相同通用上限定高（保留vh回退），在自己的flex高度链内分配可见标题、搜索／已选区、可收缩且独立滚动的候选区和带安全区的紧凑操作底栏。正式包正文没有额外padding，焦点、滚动锁、遮罩和Escape仍归公共Sheet负责；升级必须重新核对默认上限与正文容器。

`emptyContent` 放入候选剩余区域的居中反馈slot，不只插一行固定高提示。宿主提供可见加载图标和文字、成功空态、失败及重试；状态和请求所有权沿原Controller。可搜索／不可搜索、已有选中草稿、延迟成功／失败重试及两种CSS顺序均需覆盖。组件测试使用真实Sheet与正式CSS核对语义、状态和计算样式高度链，**不证明浏览器几何**；宿主仍须实测候选剩余区域、反馈图标与文字组合中心、底栏可达和安全区，不能把模拟矩形当成通过依据。

不要将 `MobileSearchPickerSheet selectionMode="single"` 直接用作 Lookup：正式单选原语会即时确认并关闭。普通 `MobileOptionPickerSheet` 单选和 `MobileIdentityField` 人员／部门单选仍保持原即时确认，多选仍依原合同确认；此示例不替换这些组件。

## 宿主原生字段值区

`MobileRecordValueInput` 与 `MobileRecordValueTrigger` 位于 `mobile-record-value.tsx`，须同时复制和加载 `mobile-record-value.css`。它们只适配宿主自己创建的原生输入／按钮；公开包的值槽 class 只提供对齐，不能清除浏览器默认边框，也不使 input 自动达到44px。已有宿主控件满足相同合同时可保留，不强制替换。

输入沿原生受控事件接收 `value/onChange`，数字 raw-text、精度、组合输入、格式与提交仍由原字段 adapter／Controller 负责。触发器始终为 `type="button"`，`onClick` 只打开原选择器；多值内容在右侧槽位换行，不替代普通单选、人员／部门和 Lookup 各自的确认合同。ref、id、name、disabled、onBlur 和 ARIA 传到真实原生控件。

两者使用宿主自己的命名空间提供透明无框、右对齐、至少44px高度及输入至少16px；颜色读取移动公开变量，禁用沿正式inline移动外观，不带入PC边框／表面。输入来源只改变自有控件的焦点提示：指针输入和在其中打字不出现额外盒框，Tab进入仍有清晰焦点，卸载清理订阅。日期、人员、部门、长文本和附件继续使用正式包组件，不给包私有class打补丁。

维护测试 `scripts/test-host-mobile-record-value.mjs` 与上述其他根脚本同属源仓库，支持显式 `--skill` 和 `--dependencies`；安装后宿主应把对应受控交互与 `assertMobileNativeValueSurface` 接到自身默认测试。真实浏览器补测常态、指针聚焦、Tab聚焦、禁用、长值及窄宽；编译声明或DOM测试不证明44px实际布局与命中。

## 品牌色与验收

### 字段标签与控件ID

PC／手机共享受控字段合同时也共享标签接线要求。AntD主库的字段子组件可按下列方式显式传同一个ID，`FieldAdapter`须继续把该id及原生受控属性转给实际控件；不是重新创建一份Form或改值结构。其他主库沿其公开API处理。

```tsx
function RecordFieldItem({ field }: { field: AuthorizedField }) {
  const controlId = useId(); // 从React导入；每个有key的字段子组件持有稳定ID。
  return (
    <Form.Item name={field.key} label={field.name} htmlFor={controlId}>
      <FieldAdapter field={field} id={controlId} />
    </Form.Item>
  );
}
```

示意类型与adapter来自宿主已有授权字段／注册表，不是随包新增API。手机`MobileFieldRow htmlFor`与实际值区也使用相同id。只读详情保持文本展示。实际字段默认测试调用`assertFieldLabelAssociation`并故意制造一次前缀错配，浏览器另点标签检查焦点；不要只检查id属性存在。ARIA非原生控件用可见标签的id及公开aria-labelledby接线，键盘与焦点仍需其原合同。

手机 View 放在既有 `MakeMobileThemeProvider` 下，默认继续复用上一级 `assets/mobile-brand-theme.mjs` 的 `toMobileBrandTheme` 纯颜色投影，不能传完整 PC 主题。手机根和 Lookup 自绘区域用公开 `useMakeMobileTheme()` 应用同一上下文；自绘强调只消费真实 `--make-mobile-primary`、`--make-mobile-on-primary`、`--make-mobile-primary-soft` 与 `--make-mobile-focus-ring`。没有 `--make-mobile-primary-color` 或 `--make-mobile-on-primary-color` API。PC `MakeDesignProvider` 不包住手机分支；字体、密度、表面、圆角、布局和交互沿冻结手机规范。

以下命令仅供 **make-platform-skills 源仓库维护**，不是安装版 Skill 的宿主命令；安装目录不包含根 `scripts/`。源仓库运行 `node scripts/test-makeui-record-page-patterns.mjs --dependencies=<已有 UI 项目或 node_modules 路径>` 和 `node scripts/test-makeui-record-search.mjs --dependencies=<已有 UI 项目或 node_modules 路径>`；验证安装版时另传 `--skill=<实际安装的makeui目录>`，路径缺失直接失败，不回退源文件。真实依赖需 React／ReactDOM、AntD、TypeScript、esbuild、jsdom、`@testing-library/react` 及正式 mobile0.1.16。脚本复制文件到临时目录，执行公开 API 类型检查、真实组件 DOM 交互、搜索时序及 Lookup 键盘草稿回归；另以四项故障注入验证 Lookup 误用实际 single 原语、FAB 漏避让、40px安全区重复叠加、主题变量拼错会失败。CSS 编译检查仅确认有效声明和 DOM 高度链接线，不能用 jsdom 对视口单位的解析结果代替浏览器几何。业务宿主仍把对应交互断言接入自身已有测试入口。

DOM 回归中的导航几何是模拟60px与额外40px安全区的环境边界，不代表真实浏览器测量。实际宿主仍须在390／767px量测导航顶部与FAB底部至少8px、中心 `elementFromPoint` 命中真实FAB，并覆盖正常／空列表／搜索无结果、权限撤销、路由切换和安全区；对照两种品牌方案检查自绘操作的实际计算颜色及卡片44px尺寸。真实iOS／Android／飞书WebView、软键盘和设备安全区另行验收。
