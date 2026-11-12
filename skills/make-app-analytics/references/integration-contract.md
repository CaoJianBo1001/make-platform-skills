# 宿主与分析包接入合同

## 先核对可用制品

能力说明以正式包 `@qfei-design/make-app-analytics@0.1.9` 为基线，发布源为 npmjs；这不是对 registry 最新版本的判断。读取宿主 manifest、锁文件和实际安装产物的 `package.json`、exports、类型声明；UI 与 Service 固定同一正式版本，完整性由锁文件记录。通过宿主既有包管理器安装，不再维护本地压缩包、指向相邻源码的 file/link 依赖或验证包别名，不直接编辑 node_modules。

升级时先核验目标 registry 的实际版本、公开合同和兼容性，再更新清单、锁文件并执行冻结安装、宿主回归和构建。包源码通过不替代发布产物验证；安装正式包不授权重新发布、推送或覆盖全局 Skill。正式包不可获取时保留清晰的失败状态，不偷偷退回旧本地制品或伪装接入成功。

若随包文档的历史发布状态与当前制品冲突，记录文件和冲突，再用该制品的公开 exports、类型及最小执行测试核验可用性；不能仅凭旧状态文字拒绝已提供的能力，也不能只凭版本号猜测 API。参数、结果或行为仍有冲突时，先明确缺口，不自行拼造合同。不要为修正文档而修改 node_modules 或回退为私有入口。

按宿主真实的 TypeScript 模块解析、React 和构建链分别验证 UI／Service，不以另一工程构建通过代替兼容性。依赖声明在 NodeNext 等模式报错时，应记录最小复现并评估兼容正式版本或公共依赖修复；不为通过接入擅改存量项目的解析模式、关闭类型检查、使用 any 或修改 node_modules。隔离演练使用不同工具链时明确其验证范围，不能据此宣称原工具链已通过。

按需求核对最低能力：高级模板自 0.1.2 起、Top N 总体上界校验自 0.1.3 起、分组序列与专用展示自 0.1.4 起提供；0.1.6 包含所选系列的单月回退及明细列选择。旧宿主按所需能力评估升级，不把历史版本文档当作当前实际制品。只有用户明确授权本地研发联调时，允许隔离副本使用指定候选 tarball 并记录校验值；这不改变正式宿主依赖，也不代表对应版本已发布。

| 已验证入口 | 主要能力 |
| --- | --- |
| 包根入口 | 基础定义／结果校验、固定展示与查询集合；业务指标、分组序列、累计／窗口／逐月比较、派生排名；`buildSeriesChartModel`、`buildTargetModel`、`buildExplorationChartModel`及对应公开Schema |
| `/server` | `AnalysisRegistration`、`AnalysisScope`、`AnalysisHost`、`AnalysisSession`、`createAnalysisService`、`createDashboardService`、Make 适配与执行错误 |
| `/react` | 基础卡、图、面板、帮助、明细、结果表与查询Hook；工作台与序列展示、`AnalysisTargetView`和`AnalysisExplorationView` |
| `/echarts` | 受控图形模型与引擎适配；不是任意 option 透传端口 |
| `/react/styles.css` | 包拥有的内容布局、指标、图表、结果表和响应式样式 |

此表不代替安装产物检查。0.1.7新增能力、0.1.8目标紧凑格式及剩余边界见[能力与示例](release-017.md)。基础结果、工作台、分组序列分别消费自己的公开合同；散点／热力消费原标准结果，目标消费分组序列。该基线仍无独立`AnalysisPresentation`协议、运行时分析Agent、BI设计器、复合键对齐、降低型／负值目标或记录加权滚动均值；漏斗、留存、层级及分位数仍需对应数据和公共合同。0.1.9 的 DateTime 显式分桶与自然日范围见 [DateTime 合同](datetime.md)，目标环境仍须核对后端支持。

## 服务端：注册业务，注入可信端口

宿主保留既有 MakeClient、配置、登录、权限、Schema、Trace、日志与错误处理链路，按 [make-app-service](../../make-app-service/SKILL.md) 实现薄编排。MakeCLI 只用于开发和验证，不是线上 Service 的数据源。

服务端注册的 `AnalysisDefinition` 包含 schemaVersion、唯一 id、definitionVersion、semantic、query 和 views：

- 当前制品的定义 ID、视图 ID、字段引用和输出 alias 使用 `^[A-Za-z_][A-Za-z0-9_]*$` 标识符且最长 128 字符；新分析 ID 可用下划线，不使用短横线。实际业务字段 key 必须与 Schema 一致，不为满足格式擅自重命名字段。该约束由运行时校验器执行，TypeScript 的 string 类型不替代 `validateDefinition`。
- `query.entityKey` 为真实对象；dimensions 为字段、可选 alias／granularity；metrics 为合法函数、真实字段及唯一 alias；sort、coverage 描述顺序及完整／Top N 范围。
- 固定主图在 `views` 声明 `metric/line/bar/pie/table` 和合法 x/y，必要时加 table 视图。业务标签、解释条目、页面排列属于宿主公开展示元信息，不是新增 V1 字段。
- `AnalysisRegistration` 组合 definition、服务端 `baseFilter` 及显式允许的 parameters。参数筛选经分析包复用公共筛选编译器；UI 不提交 CEL 或覆盖基础条件。

`AnalysisHost.openSession(signal)` 建立请求内会话，提供：

1. `identity`：可信 tenantId、appKey、principal、permissionVersion；不来自浏览器任意输入。
2. 应用 `timeZone`，与定义的日期口径一致；缺少或冲突先查证，不使用本机时区替代。
3. `getEntity(entityKey, signal)`：当前授权字段快照、filterFields 和 canRead。复用当前应用权限方法及后端过滤后的 Schema，不另建 IAM 匹配规则；条件引用的字段同样受授权约束。
4. `aggregate(body, signal)`：使用现有 Make 适配器，将包提供的查询绑定当前 App 与登录上下文，维持原错误合同。
5. `assertActive(signal)`：识别会话／权限变化，阻止过期结果返回。

这些回调不等于每次都重新请求整套身份／权限／Schema；包的来源、分页和返回阶段可能多次检查。按 [Service 查询规划](../../make-app-service/references/aggregate-query-planning.md#元数据复用与授权复核) 复用宿主已有快照与受控请求租约，保留必要权威复核、取消及失效；不能简单把守卫改成总为 true。跨请求缓存须遵守已有授权生命周期，不由分析组件自行引入。

通过 `createAnalysisService({ registrations, host, limits, logger })` 执行已注册查询。limits 的页大小、总组数及时间预算按宿主情况设置；不能为了完整图表无限抓取。普通后端错误保留原链路和 HTTP 状态，包的上下文／定义错误由 Service 明确映射，不能统一伪装成空结果。

## UI-Service 交接

API 前缀及路由沿用宿主 `apps/docs/api.md`，分析包不强制 `/analytics/sales` 等业务路径。目录只返回当前授权且定义、基础筛选依赖可用的场景；查询输入限于已注册 ID、definitionVersion 和 parameters。App、租户、主体、原始 CEL、任意定义、字段列表和引擎 option 不接受浏览器覆盖。

对已经返回目录之后发生的撤权，实际查询仍须由后端逐次授权。首次启用只安装所需适配，不创建无关业务对象的图表或查询。

### 参数形状与日期边界

以下为正式0.1.9基线。DateTime 在维度中须显式指定粒度；dateRange 仍传自然日数组，由包生成业务 DateTime 零点边界。完整约束见 [DateTime 配套合同](datetime.md)，0.1.8 及旧版须先升级。

本基线的 `kind: "dateRange"` 参数值是两个日期字符串组成的数组 `[start, end]`，不是 `{ start, end }`。例如已确认完整自然月范围可以传 `parameters: { period: ["2026-07-01", "2026-10-01"] }`，实际条件为所注册日期字段 `>= start && < end`，结束日不包含；参数名及日期按本次业务范围替换。授权 Schema 中对应字段可为 `Make.Field.Date` 或 `Make.Field.DateTime`：Date 保留日期边界，DateTime 使用已确认业务时区的 `YYYY-MM-DD 00:00:00` 边界。日内范围和带 Z／offset 的时刻不能截成日期套入；真实 DateTime 的 `aggregable=false` 保持不变。

UI 日期控件只负责映射到合同；Service 仍校验日期有效性、先后顺序、已确认范围和允许参数，不能因类型是数组就跳过边界校验。标量参数只接收已注册参数的 string／number／boolean，业务枚举及可见群体由宿主再限制。共同 scope 的日期字段、`dateParameter`、来源参数映射、实际请求及解释须一致；修改标题或横轴不能代替修改真实筛选。至少执行一个真实包请求核对起止边界，并覆盖错误对象形状、未知参数和单月切换。

`scalar` 只生成所注册字段的等值条件，不表示 contains、in 或任意运算符。需要跟随记录列表时，按 [列表筛选联动](list-filter-integration.md) 交接完整已应用快照。现有注册参数不能承接的复杂条件须明确限制并停止对应统计；不得直接透传列表 CEL、静默丢条件或把更宽范围结果标作当前筛选。

## 前端：只组合本次需要的展示

固定展示使用以下已验证的正式包入口：

```tsx
import { AnalysisView } from "@qfei-design/make-app-analytics/react";
import "@qfei-design/make-app-analytics/react/styles.css";

<AnalysisView definition={item.definition} state={state}
  mode="fixed" viewId="main" labels={item.labels} theme={chartTheme} />;
```

`viewId` 引用 definition.views；固定模式不再传 kind 或 metricAlias。一张卡可以直接使用 AnalysisView；多指标概览使用 AnalysisMetricGroup，业务区块使用 AnalysisPanel。不为复用包而复制整个示范 App 页面。

`AnalysisPanel` 自带固定展示，仍接收 `definition/state/viewId`，不接收 `mode`；不能把它当作无需分析状态的普通外壳，也不能原样复制 AnalysisView 的全部 props：

```tsx
import { AnalysisPanel } from "@qfei-design/make-app-analytics/react";

<AnalysisPanel title={item.title} definition={item.definition} state={state}
  viewId="main" labels={item.labels} theme={chartTheme} />;
```

派生指标卡使用 DashboardMetricGroup；贡献与其他使用 ContributionBreakdown；同一聚合的多指标柱线使用 AnalysisMultiMetricView；跨来源逐组计算与对照使用 AnalysisSeriesView。组件按本次问题选用，不因包公开多个入口就全部挂载。单图也可直接消费宿主已有状态，无需强制建立整页目录和查询控制器。

0.1.7目标卡使用`AnalysisTargetView`，多来源／派生双轴使用`AnalysisSeriesView`的combo，散点／热力使用`AnalysisExplorationView`。均复用同一Provider、主题及汇总明细，不向基础views枚举塞入新图形，不透传ECharts option。

## 业务页面与验证环境

- 页面外边距、最大宽度、页签与图表排列属于宿主。沿用既有业务工作台的间距和密度，宽屏充分使用工作区；没有明确阅读需要时，不额外套居中限宽容器或叠加多层 padding。标题、页签、指标组和图表区的外缘保持对齐，长说明可单独限制行宽。
- 业务页面不默认显示“本地预览”“真实接口”“演示数据”“仅用于验证”等研发标记；调试环境、制品和样例来源写入开发记录。独立合成样例页仍应明确标记数据来源，不能将该页的环境提示一并复制到真实业务 App。
- 影响理解的空值、单位、状态范围和异常值处理仍须说明，优先放在对应指标或统计口径的问号中，使用业务语言、按条换行。需要用户处理的错误、权限拒绝、部分结果和不可用状态继续明确展示，不因去除研发提示而隐藏。
- 包负责组件内部排版、格式和交互；宿主通过公开 props、主题与适配端口接入。不通过覆盖包私有选择器修复页面边距，也不在宿主复制指标、表格或明细逻辑。若问题确属多个宿主共有的组件缺陷，再在包中修复并验证消费方。

图形占位、内容密度、ECharts 容器与内部绘图区的定位和验收见 [图表布局](chart-layout.md)。这套规则不代表当前每种模板都已提供自动高度或任意布局参数，接入前须核对实际公开能力及断点效果。

## 帮助与汇总明细

需要帮助／明细时，由宿主通过 `AnalysisUIProvider` 配置一次 `AnalysisUIAdapter`：

| 端口 | 包传入 | 宿主负责 |
| --- | --- | --- |
| Help | label、children | 文字后的问号及现有 Tooltip；桌面悬浮／聚焦，手机点击；内容分条换行由包提供 |
| ValueHelp（可选） | label、value、children | 数值本身触发当期解释；保留完整可访问名称和键盘聚焦 |
| DetailsTrigger | label、onClick | 现有按钮和可访问名称 |
| DetailsSurface | title、width、onClose、children | 按下列默认容器统一实现，负责焦点、Portal、关闭及尺寸限制 |

### 汇总明细的默认容器

| 场景 | 默认形式 |
| --- | --- |
| PC 查看图表的分组汇总明细 | 居中弹窗，宽度随列数合理调整并受可用视口约束 |
| 手机查看汇总明细 | 底部弹层；宽表在所属区域内横向滚动 |
| 查看原始业务记录、连续处理业务 | 沿用宿主已有详情页或右侧抽屉；手机记录详情继续遵循宿主全屏任务路由 |

这一区分按内容和任务决定；“汇总明细”不是普通记录详情。同一 App 的基础图、多指标图和序列图复用同一套 `DetailsSurface`，不按图表种类、行数或页面随机改成抽屉。呈现模式复用宿主既有判断，不另外发明设备断点。项目或用户明确要求其他形式时，记录应用级约定并统一适配，不覆盖已确认需求。

- PC 宽度以公开传入的 `width` 为内容参考，再限制在视口内；少列短表保持紧凑，多列按公开合同使用合理宽度，仍不足时由包的表格区域局部横向滚动。宿主不解析 children 推断列数，也不为决定尺寸另发查询或新增未声明 props。
- 弹窗最大高度受可见视口约束，短表按内容收缩，不固定撑满屏幕；长表在内容区滚动，标题、关闭入口及表头保持可见，背景页面不跟随滚动。底部弹层沿用移动公共组件的高度、安全区与关闭合同；宽表不使整个页面横向滚动。
- 在应用公共适配层配置一次 `AnalysisUIProvider`，复用当前组件库的 Modal／Dialog 和移动公共包底部弹层。分析包负责结果表、列宽、数字对齐及格式；宿主负责容器，Skill 负责默认规范，不要求分析包绑定某个组件库。缺少必要的公开能力时记录具体缺口，不通过私有样式补丁实现。
- 打开与关闭汇总明细只使用当前结果，不改变统计或新增业务读取。原始记录下钻另行处理权限、筛选、导航及返回，不把原始记录加载塞进汇总明细端口。

更新 Skill 只改变后续实施指导，不自动迁移已生成 App。任务要求统一现有 App 时，修改该宿主公共适配器并验收全部分析入口；不在每张图单独包装容器。

### 主题、提示与生命周期

宿主沿用当前组件库和主题 token，注入 ChartTheme／公开 CSS 变量；不因接入而强制换 Ant Design、品牌色或 App Shell。解释内容不常驻长段落，省略标签可查看完整值。数据格式、列宽、数字对齐和明细内容不在各页面重写。

Portal 挂载到页面外时，宿主须把同一组公开主题变量传到明细表面，不能假定页面祖先变量会自动继承。滚动表头有可解析的不透明背景，层级高于表格内容，避免正文穿过表头。帮助浮层放在不会被滚动表格裁剪的所属明细容器内，并在模态焦点管理范围中；不要仅提高一个全局 z-index。

桌面 hover/focus 与手机 click 的开关方式保持一致且可测试，避免 focus 先打开、随后 click 又关闭。长提示限制在可见视口内并支持内部滚动，数值／问号可实际点击。Escape 先关闭打开的提示，再关闭所属明细，关闭后焦点回到合理入口；复用宿主现有弹层与移动公共包，不另建业务专用弹窗系统。

明细复用当前 AnalysisResult 或 GroupedSeriesResult，不再次获取业务明细。它是“分组汇总明细”，不是原始订单／回款记录列表；需要钻取原始记录时单独设计权限、筛选和导航。切换业务主题、筛选、刷新、撤权或查询上下文变化后清除旧明细。

宿主已有状态管理时可直接传 AnalysisState；需要集合查询时注入稳定引用的 loadCatalog、query、onError 给 `useAnalysisCollection`。context key 包含实际影响查询的 App、身份、权限代际、业务主题、筛选及刷新代际；取消贯穿宿主请求，晚到结果不能覆盖新主题。单纯视觉主题切换不应无故重查统计。集合 Hook 消费基础 AnalysisResult，工作台／分组序列沿用宿主已有请求状态，不能把不同合同强行塞入该 Hook。仅读取本次区域或活动主题的数据。

读取拒绝的业务区卸载数值、标题、工具栏、图表及明细，保留授权导航和身份；刷新、登录过期与故障反馈继续由宿主公共链路处理。边界与测试使用 [make-app-permission](../../make-app-permission/SKILL.md)，不在分析组件中重建权限系统。
