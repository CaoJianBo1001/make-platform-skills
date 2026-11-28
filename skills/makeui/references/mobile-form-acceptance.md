# 手机表单公共验收工具

当本次工作涉及手机表单、只读字段或远程候选时，使用随 Skill 分发的 [DOM 断言](../scripts/mobile-form-acceptance.mjs) 和 [类型声明](../scripts/mobile-form-acceptance.d.mts)，将对应断言接入宿主已有测试。工具无运行时依赖，不限定组件库、类名、测试框架或 CSS 方案；它不扫描业务源码，也不会自动修复 App。

## 接入宿主测试

从当前实际安装的 makeui 目录复制上述两个文件到项目既有测试工具目录，保留相同文件名及相邻关系。两者一起更新；不要让宿主测试引用某位开发者的 Skill 绝对路径，不依赖 Skill 源仓库的根级 scripts。沿用宿主的包管理器与测试框架，无需为此换技术栈。

挂载真实路由或该路由实际使用的共享字段组件，加载公共包 CSS 和宿主实际编译后的样式。只能 mock 请求、授权及环境边界，不能用手写测试表单、测试选择器或预先算好的布局结果代替真实 UI。宿主仅适配元素定位和交互，调用同一份断言：

| 断言 | 传入元素及覆盖范围 |
| --- | --- |
| `assertFormColumns(grid, columns)` | 真正承载字段的网格；手机普通及关联区域各测单列，同时验证桌面／平板原列数。不是标签与值的两槽行容器 |
| `assertRightAlignedValue(value)` | 只读值的实际内容容器，包括 Lookup 列表；按 flex 方向、换行方向及 LTR／RTL 判断物理右端，column 的 justify-content 不代表水平对齐。文字换行及实际右边缘另验；竖排及 Grid 值布局需宿主等价几何断言，不默认为通过 |
| `assertFieldLabelAssociation({label,control})` | 跨端真实字段标签与内部可编辑控件的原生／ARIA关联；DOM即可验证，不使用模拟几何。完整Form.Item／字段行经adapter挂载，不能只查外层id；另在浏览器点标签检查实际焦点 |
| `assertDisabledMatches(control, reference)` | 真实禁用控件及同一主题、同类公共控件的禁用基线；比较背景与文字，不写死颜色。只读纯展示不套此断言 |
| `assertLoadingFeedback({region,status,indicator,message,optionSelector})` | 所属弹层／候选区域、加载状态节点、加载图形、独立提示文案、真实候选元素选择器；检查可见图形、非空文案，以及候选自身和 DOM 后代是否仍可见，不限制 Flex、Grid 或定位，也不证明居中。已选区不要误算成候选 |
| `assertLoadingGeometry({region,status,indicator,message,footer})` | 只在真实浏览器调用；region 为标题／搜索／已选区及底栏之外的候选区域，不能传加载节点自身。按布局／可见视口及定位包含块链中的矩形裁剪取得实际可见区域，以图形与 Range 文字行并集检查中心；逐项检查图形／文字未被裁剪，保留状态外框边界及底栏不重叠检查 |

加载图形可以使用装饰性的 aria-hidden 图标；该属性并不使图形在视觉上隐藏。图形动画及实际绘制由真实浏览器复核。旧候选检查包含匹配元素及其 DOM 后代：候选自身 visibility:hidden，但内部标签恢复 visible 时仍拒绝通过；display:none、透明度为零或内容隐藏的祖先继续阻断后代。工具不穿透 Shadow DOM，也不会证明宿主选择器覆盖了所有分支。

标签关联断言接收真实原生`label`。原生input／textarea／select／button必须经label.control及control.labels指向同一控件，不能用placeholder、aria-label或另一个名称属性掩盖错误for。非原生分支只支持单一明确的字段／组角色：combobox、textbox、searchbox、button、group、listbox、radiogroup、checkbox、radio、spinbutton、slider、switch、tree、grid；需经aria-labelledby真实引用可见label.id。generic、none、presentation、未知或组合role拒绝。本工具只认证当前DOM关联，不是完整无障碍审计，也不证明全页ID唯一、Shadow DOM／跨文档引用、焦点或可访问名称的全部计算规则；这些另按实际组件核验。

两个加载断言均必须显式传入 `message`，它与图形节点互不包含，不能把整个状态容器当作文案或继续省略参数。DOM 检查只读取可见的非空文本节点，不再使用状态容器的 textContent 证明提示可见；它仍不能证明文字没有被空间裁剪。几何检查补充实际文字行与可见区域检查，不回退到占位外框。文案元素本身可以占满整行；横向／上下排列均检查图形与文案整体居中，不强求图标自身位于整区中心。缺少文案、文字矩形、裁剪容器尺寸或 Range 测量能力时拒绝通过。

`visibility` 按目标的计算样式判断，允许后代覆盖祖先的隐藏值；元素及祖先的 `display:none`、透明度为零仍会阻断。不直接以 `hidden` 属性判定：默认隐藏按实际计算样式处理，被 CSS 恢复显示的候选必须拒绝通过，文案恢复显示则可继续验收。`content-visibility:hidden` 阻断文字及后代，不能据此将元素自身仍显示的背景／边框视为隐藏。DOM 反馈通过后，仍须在真实浏览器调用 `assertLoadingGeometry` 或宿主已有的等价几何断言验证中心与边界；所有布局方案都适用，不能将 DOM 通过或 Flex／Grid 对齐声明当作实际居中证据。

几何检查支持布局／可见视口及轴对齐的矩形 `overflow: hidden/clip/auto/scroll`、paint containment 裁剪，按实际 client 区域排除边框和滚动条。absolute／fixed 按包含块关系跳过不参与裁剪的中间 DOM 祖先；视口 fixed 不因普通 overflow 包装器而被误裁剪，遇到实际包含块仍保留其裁剪。判定覆盖 position、变换、filter、contain、content-visibility 及对应 will-change；图形自身定位和文字所在元素均参与计算，不能统一忽略所有祖先。定位规则依据 [CSS 包含块合同](https://www.w3.org/TR/css-position-3/#def-cb)，仍需在宿主浏览器核对实际样式和测量结果。

正常滚动容器可以通过；当前滚动已反映在实时矩形里，不重复减 scrollTop。候选范围很高时，不能按被裁掉的完整范围判居中。非矩形 clip-path／mask、旋转或斜切裁剪、其他元素覆盖及跨 iframe 可见性不由本工具认证，宿主需另做真实浏览器检查；不能将此工具当作通用可见性判定器。宿主测试不得伪造矩形冒充浏览器验收。

列数断言只适用于 CSS Grid。宿主使用 flex／自然流且已满足单列时，沿用该结构并补等价的真实布局断言，不为使用工具而改成 grid。工具不能解析的布局明确记录，不能静默跳过后记为通过。

Flex对齐的`flow-start/end`与`flex-start/end`按[CSS对齐规范](https://drafts.csswg.org/css-align/#positional-values)作为别名处理，保留`start/end`的独立逻辑；浏览器可能返回不同序列化关键字。此兼容不放宽物理右端、反向排列、换行方向或真实裁剪要求。

测试必须进入宿主默认 test 或已有发布门禁，不留下只能手动运行且没人调用的脚本。沿用原测试目录自动发现即可，不要求新增统一命令名。初次接入至少故意恢复一次已知错误，确认测试失败，再恢复正确实现：例如手机双列、Lookup flex-start、主题色覆盖禁用色、隐藏加载图形或保留旧候选。不能只证明“正确代码运行成功”。

## 列表、宿主组合与主题门禁

新项目还须读取 [宿主组合示例与交付门禁](record-page-patterns.md)，把以下断言接入实际列表和手机展示的测试。几何检查沿用同一套真实矩形／裁剪／命中要求，不把 JSDOM 替身当浏览器证据。

| 断言 | 使用范围 |
| --- | --- |
| `assertMobileCreateEntry({state,creatable,entry,navigation})` | 正常／空／搜索空列表分别调用；授权入口真实触控尺寸、视口裁剪、中心及内侧命中和导航避让，无资格不保留可交互旧入口。宿主另查入口唯一性、真实路由、资格撤销及请求次数 |
| `assertListSearch({region,input,presentation,control,reference,hitTarget})` | 真实搜索输入及其公开控件；PC／平板参照同主题主库实际控件。手机触控目标为input本身或原生关联label，至少44px、输入至少16px；不能用不负责聚焦的div冒充触控外围。自定义回调外围另做实际点击聚焦测试；本断言不推断库来源或替代搜索请求测试 |
| `assertMobileCardBaseline({card,reference,actions,parts})` | 参照实际冻结卡片的非颜色属性、透明度、滤镜和背景；显式传入宿主完整的授权单条操作集合。启用动作验证至少44px与真实命中；合法native禁用动作仍查可见、尺寸与裁剪，不要求可点击。不把正文URL猜成编辑／删除动作 |
| `assertMobileListBaseline({list,reference,cards,referenceCards,page,pageReference})` | 同宽度、同状态的冻结页面／列表与至少两张相邻卡片；列表比较非颜色样式、背景与真实间距，所属页面另外比较背景、透明度和滤镜。仅一张卡片的场景补多卡代表数据，不以此证明间距 |
| `assertThemeColorsMatch({element,reference,properties})` | 宿主自绘元素与独立公开主题参照的已解析颜色，支持属性见相邻类型；默认／两方案逐项对照，手机非颜色属性另由冻结基线检查 |
| `assertMobileNativeValueSurface({owner,control,kind,phase,hitTarget,disabledReference})` | 仅检查显式标记 `data-makeui-native-value="input"`／`"trigger"` 且属于自有 owner 的宿主原生值区，不用于包控件。真实计算样式与矩形需满足无盒框、右对齐、至少44px触控及输入至少16px；按常态／指针聚焦／键盘聚焦分别检查，聚焦状态须匹配实际activeElement，键盘提示必须可见。合法native禁用保留可见与44px，不要求命中，另传同主题独立禁用参照；输入放大触控范围只接受真实关联label。没有DOM-only几何放行路径 |

参照来源、状态和覆盖的授权动作由宿主负责给出，工具不能证明一个任意参考就是批准基线。文字、图形是否可见及键盘／触控状态还要实际操作；门禁不能因为工具输入未知而静默跳过。Lookup 的“候选不回写、取消不回写、确定一次回写”和搜索的应用／清除／结果恢复必须由真实组件交互断言证明，不能仅比对CSS。

无创建资格时，入口自身的`visibility:hidden/collapse`必须连同后代逐支核验；后代恢复`visible`且未被`display:none`或`inert`实际阻断时拒绝通过，即使整树`opacity:0`。正常隐藏继承、卸载及入口自身原生禁用路径保留；子控件`disabled`不能证明父入口整体已阻断。此DOM检查不证明真实指针命中，也不替代宿主操作时的资格复核与后端鉴权。

透明度与滤镜须在相同控件状态下比较：两侧相同的批准效果可以通过，方案切换引入的淡化或模糊不得被当成品牌色变化。检查范围为传入的卡片／部位、列表及所属页面自身，不遍历任意祖先，也不替代整页实际绘制验收。

宿主原生值区示例和此断言只补足公开包对齐类没有承担的原生reset；原有字段类型、值结构、日期／身份／附件组件与移动交互不变。`owner` 传实际字段自有容器，不能传html、body或control本身；marker声明不证明来源，宿主须核对确是自有控件。任意`div`不能冒充输入的44px点击范围；有自定义点击聚焦逻辑时另外实际验证。`phase`只核对当前焦点和视觉，不证明输入来源，需先真实指针点击／Tab进入后再检查。不能伪造activeElement或getBoundingClientRect让App通过。

## 交互与浏览器补充

工具只承担通用断言；宿主仍要按 [远程候选反馈](component-usage.md#远程候选加载反馈) 驱动首次加载、带旧结果重新加载、成功、合法空结果、失败重试和取消。覆盖搜索／无搜索分支，并断言加载不改表单、取消不提交、重新加载保留已选及草稿，迟到响应不覆盖当前请求。用可控延迟响应验证实际请求调用链，不能只切换 loading 属性。

按 [独立表单作用域](mobile-form-controls.md#独立页面的样式作用域) 覆盖无工作台 Shell 的地址；按 [禁用态与容器衔接](styling-and-responsive.md#控件禁用态与容器衔接) 检查页头色带、边框及留白。工具未自动覆盖这些项目，继续保留宿主相应验收。

DOM 测试可验证样式声明与交互，不能验证媒体查询、真实排版、滚动、软键盘或飞书 WebView。几何断言遇到零矩形会失败，禁止伪造 getBoundingClientRect 让宿主验收通过。工具自身故障注入单测中的矩形替身只验证检测器，不作为 App 的布局证据。

真实浏览器按 320／390／767px 及桌面／平板复核，并对照基础 CSS 先／后加载两种顺序。公共包缺少所需高度链或插槽时记录能力缺口，在包侧修复；不要为了通过而缩小 region、放宽容差、覆盖包私有 class，或复制包内选择器实现。浏览器／飞书未测的项目明确标为待验，不因两个样板通过 DOM 测试就宣称所有 App 已适配。
