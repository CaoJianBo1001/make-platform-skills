# 高级指标、共同范围与制品边界

本参考仅供已触发的高级分析需求使用。版本基线、能力起点及制品核验见 [接入合同](integration-contract.md#先核对可用制品)。按本次所需能力核对实际导出，不因某个模板可用就推断其他模板也已支持。

## 核对实际消费能力

只有实际制品公开以下入口和类型后才生成对应代码：根入口的 `dashboardResultSchema`、`evaluateBusinessMetrics`、`createMonthComparisonPeriods`、`MetricExplanation`，`/server` 的 `createDashboardService`、`AnalysisScope` 及注册的 `scopeKey`，`/react` 的 `DashboardMetricGroup`、`AnalysisMultiMetricView` 和 `ContributionBreakdown`。根据本次需求检查所需子集，不为一张条件比例卡引入所有图形。

宿主版本缺少本次所需能力时，按接入合同评估 UI／Service 同版升级并验证兼容性；无法升级或获取制品时说明实际缺口。已有 Service 允许少量汇总组合，但不能假装旧包有新导出。用户明确授权本地研发验证时可使用隔离副本与指定候选 tarball；UI/Service 必须消费同一个制品，记录文件校验值、实际导出、测试与浏览器结果。生产依赖仍锁定正式版，不自动发布 npm、不更改全局安装的 Skill。

## 一份共同范围生成查询与解释

宿主提供实际 Schema、业务对象、状态底层值、过滤范围、日期和时区。包提供通用计算与约束，Skill 帮助 AI 选用它们。不要在每个 App 中复制比例、缺失率或“其他”的算法。

在 `createDashboardService` 或 `createAnalysisService` 的 `scopes` 一次注册 `AnalysisScope`：key、entityKey、label、timeZone、baseFilter、parameters 和可选 dateParameter。每个 `AnalysisRegistration.scopeKey` 引用它；查询自己的 baseFilter 只追加本指标的专属条件，参数只能由共同范围声明。包合并真实筛选条件，从实际参数生成时间说明，不再靠手写 describeSource 回调证明分母一致。

例如完成订单占比：共同范围为“当前可见有效订单”，总体查询不追加条件，分子只追加已确认的完成状态。两者复用相同时间参数映射和基础过滤。逾期还须确认截止日、业务终态、空日期及退款等规则；Schema 有一个日期字段并不意味着已确认逾期定义。

```ts
import { createDashboardService, type AnalysisScope, type AnalysisRegistration } from "@qfei-design/make-app-analytics/server";

// 字段、状态值和既有 host/limits/logger 须由实际项目提供。
const scope: AnalysisScope = {
  key: "visible_orders", entityKey: "order", label: "当前身份可见订单",
  timeZone: "Asia/Shanghai",
  parameters: [{ name: "period", fieldKey: "orderDate", kind: "dateRange" }],
  dateParameter: "period",
};
// all 和 completed 的定义都使用同一 order 对象及 count 别名 orders。
const all: AnalysisRegistration = { definition: allDefinition, scopeKey: scope.key };
const completed: AnalysisRegistration = {
  definition: completedDefinition, scopeKey: scope.key,
  baseFilter: { id: "completed", logic: "and", children: [
    { id: "status", fieldKey: "orderStatus", operator: "eq", value: "completed" },
  ] },
};
const service = createDashboardService({
  host, limits, logger, scopes: [scope], analyses: [all, completed],
  registrations: [{
    id: "orders_summary", definitionVersion: "1", metrics: [],
    sources: [
      { key: "all", analysisId: all.definition.id, parameters: { period: "period" } },
      { key: "completed", analysisId: completed.definition.id, parameters: { period: "period" } },
    ],
    recipes: [{ kind: "conditionalRatio", key: "completion", label: "已完成订单占比",
      description: "已完成订单数占同范围全部订单数的比例", precision: 2,
      numerator: { source: "completed", metric: "orders" },
      denominator: { source: "all", metric: "orders" },
    }],
  }],
});
```

这个示例用于解释公共合同，业务值不作为其他 App 的默认值。继承范围与结构校验仍不能确认“完成”“销售额”等名称是否符合业务，PRD 和已确认规则仍是语义来源。

## 按问题选择最小模板

| 需求 | 模板与展示 | 约束 |
| --- | --- | --- |
| 比上月／去年同月增减多少 | periodComparison；差额、变化率卡，必要时趋势图 | 首版为已结束完整自然月；current/baseline 共享范围与日期字段，仅期间不同。用 createMonthComparisonPeriods 生成范围；零或负基期不显示增减率，差额仍可用 |
| 完成、取消或已确认逾期占多少 | conditionalRatio；指标卡＋问号 | 首版为记录 count；分母是无附加条件的共同范围总体，分子仅追加条件。状态占比不叫流程转化率 |
| 哪些客户贡献最多，其他占多少 | contribution；排行与贡献表 | 分组 count/sum、一个明确维度、独立完整全局总体；最多 Top 20；sum 型 Top N 未取齐分组时，总体须同时提供同字段、同单位的 min ≥ 0。排名和总体的附加过滤必须相同，保留原始 ID、空值组；负数、NULL、avg/countDistinct、HAVING、部分结果不能冒充构成 |
| 字段有多少可用样本、缺失多少 | dataQuality；样本数、空值数和缺失率卡 | total 为共同范围 count，valid 只追加该字段 is_not_empty；非空不等于业务有效或异常检测。空总体时两项数量为 0，缺失率不可计算 |
| 同图查看金额与数量 | AnalysisMultiMetricView | 同一个聚合结果、一个维度，最多 6 个明确指标；柱、线或混合，最多双轴，不同单位／币种不能共轴 |
| 按月计算人均、覆盖率，或对照部门与整体 | groupedSeries 与 AnalysisSeriesView | 使用实际日期范围对齐，保留原始分组身份；业务先证明同月分母、群体、单位与可比性，详见 [分组序列](grouped-series.md) |
| 实际值距目标多少 | ratio/difference 等通用计算，宿主匹配目标 | 目标的组织、指标、期间、版本、单位和唯一性由宿主核对；学习率等百分率差距说明百分点；不生成隐含目标 |

### 金额 Top N 的总体查询

sum 型排名未取齐全部分组时，同范围、完整的全局总体查询必须同时注册同字段、同单位／币种的 `min`，并得到有限数值且 ≥ 0。仅验证已返回 Top N 的金额非负不足以证明尾部分组非负。包不隐式增加该指标，也不另发查询；宿主在原总体查询的 `definition.query.metrics` 中组合：

<!-- contribution-total-metrics -->
```json
[
  { "aggregate": "sum", "fieldKey": "amount", "alias": "amount_sum", "unit": { "kind": "currency", "code": "CNY" } },
  { "aggregate": "min", "fieldKey": "amount", "alias": "amount_min", "unit": { "kind": "currency", "code": "CNY" } }
]
```

示例字段、币种与 alias 按真实 Schema 和业务口径替换；排名首要排序为贡献指标降序，recipe.total 仍引用 `amount_sum`。最小值缺失、NULL、负值、字段或单位不匹配时保留不可计算状态，不补零、不绕过校验。含负金额的净额业务另行确认展示语义。记录 count，以及已经返回全部分组并通过可加性核对的路径，不要求额外 min。

一页可组合多个对象的独立统计，包 `/server` 在宿主 Service 内执行；不表示后端支持跨对象 JOIN，也不允许按名称拼接来源。多查询没有数据库快照保证。需要跨对象业务比例时，先确认关联群体、去重、时间、退款及币种，不直接以订单金额减全部回款得应收。

累计、滚动均值、月中同期、季度比较、专用目标序列、中位数、P90、漏斗和留存尚不是上述模板能力。目标来源属于宿主；通用 ratio/difference 和参考线不等于目标管理。按实际制品和后端能力另行设计；不把各组 avg 简单平均，不相加重叠 countDistinct，不将未返回日期桶补零。中位数／P90 不可从 count/sum/avg/min/max 还原，但范围合理时可按 Service 指导精确读取必要明细；大规模高频需求评估专用后端支持。

## 解释、展示与失败

复杂指标的 MetricExplanation 随服务端结果返回：统计口径、时间范围、时区、公式、分子与分母、单位精度、结果完整性。页面复用 DashboardMetricGroup 或 ContributionBreakdown，不重算统计。一般统计也可通过 metricExplanationItems 复用说明组织。

宿主只配置一套 AnalysisUIProvider：Help 复用现有问号／Tooltip，桌面 hover/focus、手机 click；长内容分条换行、限制宽度，窄屏限制高度并能内部滚动，不能裁掉首尾。DetailsSurface 负责现有弹层、Portal、主题和手机容器，包负责明细内容、列宽、对齐与格式。页面外边距属于宿主，图表和指标内部排版属于包。

idle、loading、error、unavailable、成功 0 分别处理。NULL、失败、未加载、部分结果、零分母不显示为成功 0；实际读取被拒绝时清除旧业务结果。精度只影响显示，不改原始数值；小于显示精度的非零比例采用边界提示（如 <0.01%），不能误读为真实零。前端不下载明细计算，Skill 不参与线上每次请求，不引入用户选图器或运行时 LLM。

## 验证交付

测试实际生成的查询和结果，至少覆盖：共同基础过滤与时间条件同时进入分子/分母请求；额外过滤分母被拒绝；质量条件不是非空时被拒绝；同名 ID 保留；Top N 具有独立总体和其他；sum 型 Top N 未取齐分组时，验证总体同字段 min 缺失／NULL／负值拒绝、0／正数允许，且字段与单位必须匹配；NULL、失败、零分母不显示 0。确认实际制品能构建 UI 与 Service，再做真实只读核对和桌面/手机提示及明细验收。

记录范围、制品校验值和真实验收证据。代码通过、候选包可用、正式版本已发布、Skill 已安装、Agent 可按需求生成项目是独立状态，不互相代替。
