# 序列计算与扩展图形接入

本页用于累计、滚动、逐月比较、派生排名、目标、组合双轴、百分比堆叠、散点或热力需求。累计等能力自0.1.7提供；实际制品、升级与版本核验统一按[接入合同](integration-contract.md#先核对可用制品)执行。

## 计算与展示各自负责什么

| 需求 | 公共包合同 | 宿主必须声明或证明 |
| --- | --- | --- |
| 累计／年内累计 | `transforms[].operation: cumulative`，`reset: never/year` | 起算范围、重置含义；当前仅可加的原始count／sum时间输入，不相加跨期去重人数 |
| 近几期合计／均值 | `rollingSum/rollingAverage`，`size: 1..1000` | 连续日历窗口；均值是每期汇总的均值，不是记录加权均值；窗口不足、NULL或未完整期不可用 |
| 逐月同比／环比 | `periodDifference/periodChangeRate`，`comparison: previousPeriod/previousYear` | 月粒度、同口径完整自然月；增长率要求正基期，差额与百分数的百分点区别 |
| 无记录分组显示零 | `inputs[].missing: zero`，默认仍留空 | 仅可加原始count／sum且非Percent；时间桶须在来源实际覆盖内，类别只补其他来源已有身份，真实NULL不变 |
| 计算与显示范围不同 | `displayRange: { start, end }`，结束桶不含 | 先查询足够历史、计算后裁剪；保留真实计算范围与裁剪说明，不在裁剪后的数据上重算 |
| 先计算增速再取前几名 | 类别对齐＋`ranking: { series, order, limit }` | 所有可见候选先取全，再按派生值排序；不可比组单列，不能先取金额前十 |
| 类别业务顺序 | `alignment.order` | 原始类型身份与完整顺序；类别折线表示有序对照，不冒充时间或流程转化 |
| 实际与目标 | `buildTargetModel`／`AnalysisTargetView` | 同组织、月份、指标、单位唯一匹配；仅higherIsBetter、非负实际、正目标。超额率保留、进度条封顶；未完整期不外推 |
| 多来源／派生柱线双轴 | `SeriesChartSpec.kind: combo`，逐条`kind/axis` | 同轴同单位／币种，主轴0、可选次轴1，按轴设置参考线；不同轴高度不直接比较 |
| 百分比组成 | `percentStackedBar`＋所选组成分母 | 组成互斥可加；不允许负值、Percent、均值或去重数组成。缺组成、零合计或溢出不可用；原值不被归一化覆盖 |

`calculations`仍仅接受已有受控二元运算；累计、滚动和逐月比较放在`transforms`。公开结果保留操作数、窗口、基期、实际期间及不可计算原因；不要在页面重新计算。转换的串接、输入资格与容量由公开校验器约束，不能把任意派生比率当可加事实。

## 可执行配置示例

以下是通用配置形状，alpha／beta由宿主注册的真实来源提供，别名amount、bucket须映射到实际结果。示例的公司、群体、日期与可加性不是所有App的默认口径。Service仍通过`createDashboardService`或可信`evaluateGroupedSeries`执行，来源context由真实查询推导。

<!-- analytics-017-example -->
```js
export const monthlyDefinition = {
  id: "monthly_extensions", definitionVersion: "1",
  alignment: { kind: "time", granularity: "month", timeZone: "Asia/Shanghai", range: "sources" },
  inputs: [
    { key: "a", source: "alpha", metric: "amount", dimension: "bucket", label: "实际", description: "宿主定义的可加事实", missing: "zero", precision: 2 },
    { key: "b", source: "beta", metric: "amount", dimension: "bucket", label: "目标", description: "同范围每月唯一目标", precision: 2 },
  ],
  calculations: [{ key: "share", operation: "ratio", left: "a", right: "b", label: "完成率", description: "实际除以同月目标乘100%", precision: 2 }],
  transforms: [
    { key: "year_total", operation: "cumulative", source: "a", reset: "year", label: "年内累计", description: "实际计算范围内按年重置", precision: 2 },
    { key: "average_3", operation: "rollingAverage", source: "a", size: 3, label: "近三月月均", description: "完整连续三个月汇总的均值", precision: 2 },
    { key: "yoy", operation: "periodChangeRate", source: "a", comparison: "previousYear", label: "逐月同比", description: "完整自然月与去年同月比较", precision: 2 },
  ],
  displayRange: { start: "2026-01", end: "2026-03" },
};
export const rankingDefinition = {
  id: "growth_ranking", definitionVersion: "1", alignment: { kind: "category" },
  inputs: monthlyDefinition.inputs.map(({ missing, ...input }) => ({ ...input, label: input.key === "a" ? "本期" : "基期", description: "同维度的本期／基期完整汇总" })),
  calculations: [{ key: "growth", operation: "changeRate", left: "a", right: "b", label: "增长率", description: "可比范围先计算增长率再排序", precision: 2 }],
  ranking: { series: "growth", order: "desc", limit: 1 },
};
export const targetSpec = { actual: "a", target: "b", bucket: "2026-01", direction: "higherIsBetter", description: "宿主证明同月同范围唯一匹配" };
export const targetViewOptions = { numberNotation: "compact" };
export const comboSpec = { kind: "combo", series: [{ key: "a", kind: "bar", axis: 0 }, { key: "b", kind: "line", axis: 0, lineStyle: "dashed" }, { key: "share", kind: "line", axis: 1 }] };
// 独立组成定义：alpha／beta在本场景注册为互斥状态来源，不能复用实际／目标的业务含义。
export const compositionDefinition = {
  id: "status_composition", definitionVersion: "1", alignment: { kind: "category" },
  inputs: [
    { key: "confirmed", source: "alpha", metric: "amount", dimension: "bucket", label: "已确认金额", description: "本场景已确认状态完整汇总", precision: 2 },
    { key: "completed", source: "beta", metric: "amount", dimension: "bucket", label: "已完成金额", description: "本场景已完成状态完整汇总", precision: 2 },
  ],
};
export const compositionSpec = { kind: "percentStackedBar", series: [{ key: "confirmed" }, { key: "completed" }], stacking: { additive: true, disjoint: true, denominator: "selectedSeries", description: "仅所选互斥状态合计，不自动代表业务总体" } };
```

三个定义属于独立场景：实际／目标用于目标及combo；状态组成使用另一组互斥来源，不能把实际与目标相加。排名来源是同维度的本期／基期完整候选，Service须提供对应真实范围。别名只在各自注册内生效，不授权新增无关来源或重复查询。

## 散点与二维热力

使用`ExplorationChartSpec`、`buildExplorationChartModel`和`AnalysisExplorationView`；输入是原有`AnalysisDefinition/AnalysisResult`，不是GroupedSeriesResult。ECharts适配为`createExplorationChartOption`，不向基础`views.kind`填入scatter／heatmap；两者不由旧自动推荐器启用。

<!-- analytics-017-example -->
```js
export const scatterSpec = { kind: "scatter", group: "bucket", xMetric: "other", yMetric: "amount" };
export const heatmapSpec = { kind: "heatmap", x: "bucket", y: "category", metric: "amount" };
```

在已有Provider内使用公开组件；下例仅是成功分支，加载、失败和身份失效沿宿主既有状态处理：

```tsx
<AnalysisSeriesView title={title} definition={groupedDefinition}
  state={{ status: "success", result: groupedResult }} spec={comboSpec} theme={chartTheme} />
<AnalysisTargetView title={title} definition={groupedDefinition}
  state={{ status: "success", result: groupedResult }} spec={targetSpec} />
<AnalysisExplorationView title={title} definition={analysisDefinition}
  state={{ status: "success", result: analysisResult }} spec={scatterSpec}
  theme={chartTheme} labels={businessLabels} />
```

组件从`@qfei-design/make-app-analytics/react`导入。目标bucket使用原始分组身份；示例月份由实际选中月份替换，不能固定到所有App。图形与明细的状态和定义必须对应同一返回结果。

- 散点：恰好一个分组和两个不同数值指标，每点保留原始分组ID、两个单位和原始行位置；最多1000组。表达关系分布，不推断相关系数或因果关系。
- 热力：恰好两个不同维度和一个数值指标；网格最多2500交叉项、单轴最多100分类。不隐式归并第三维，不把均值或去重数再次相加。
- 两者均要求完整查询及完整结果；partial、Top N、超预算、全NULL或无数据回退原表，不抽样截断。零值／负值保留，NULL不当零；热力分别解释NULL组数与缺失交叉项数。
- 轴按原始类型身份对齐，同名不同ID不合并。时间按已声明的canonical桶排序，其他分类稳定排序；热力轴只包含已出现的分类／桶，不补整段缺失月份或猜测筛选边界。
- 颜色条有数值／单位，常量单值图例不伪造差异；跨度溢出回退表。提示保留完整值，精确原值与ID在共用汇总明细核对。手机不能只缩小PC图；核对轴、图例、点／单元格点击和底部明细局部滚动。

## 页面、性能与剩余边界

历史数据必须进入计算范围，不能仅扩大前端横轴。多图复用、元数据生命周期和调用预算统一按[页面请求规则](query-performance.md)实施。

目标匹配、数据来源、期间、状态与布局由宿主负责；算法、模型和明细复用包。[帮助与汇总明细](integration-contract.md#帮助与汇总明细)沿用统一适配器，原始记录钻取按独立业务需求处理。

`AnalysisTargetView`自0.1.8支持`numberNotation="compact"`，默认仍为standard，旧0.1.7须先升级。宿主按展示模式显式选择，例如手机紧凑、桌面标准；通过既有Help提供可点击完整值说明，无障碍标签和明细保留标准金额，计算、完成率及查询不变。紧凑布局按实际容器将整项指标换行，并用真实金额验收窄屏。

当前基线仍无降低型／负值目标、记录加权滚动均值、复合键对齐、树图／旭日图或通用漏斗／留存／分位数合同。正式0.1.9已支持DateTime显式粒度分桶；接入按 [DateTime合同](datetime.md) 验证实际制品、自然日范围和授权Schema，不换用不同含义的Date字段掩盖依赖。

验收覆盖独立已知答案、缺月／NULL／零／负值、起止部分月、跨年、零／负基期、同名不同ID、超预算、PC及手机提示与明细、身份失效，以及实际下游调用次数。包测试、Skill示例执行、宿主真实接口和浏览器验收分别记录。
