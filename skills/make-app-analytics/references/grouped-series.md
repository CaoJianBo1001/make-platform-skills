# 分组序列与对照展示

用于多个来源按月份／类别对齐、逐组派生、多系列对照和面积／堆叠需求。版本基线及能力起点见 [接入合同](integration-contract.md#先核对可用制品)。先检查实际导出的 `GroupedSeriesDefinition`、`evaluateGroupedSeries`、`buildSeriesChartModel`、`AnalysisSeriesView` 和 `AnalysisSeriesTable`，不只看版本号。

## 数据与业务仍由宿主声明

宿主提供每个来源的对象、字段、指标函数、基础条件、时间范围、授权、单位、业务名称与公式含义。每次后端聚合仍是单对象，包在宿主 Service 内组合多个已注册来源；它不完成跨对象 JOIN，不提供多次查询的数据库事务快照。

- 时间序列使用真实筛选的同一日期字段，明确粒度和时区。`alignment.range = "sources"` 从实际查询期间生成日历桶，筛选变化时横轴同步变化；固定桶范围也可显式声明 `start/end`，结束桶不包含在范围内。
- 类别按原始身份及类型对齐，不能按显示名称合并。存在其他分组维度时，输入必须用 `dimensions` 明确选择全部其他维度，不默认取第一组。当前不支持复合键对齐。
- `calculations`仅使用`sum/difference/divide/ratio/changeRate`及已声明引用；累计、滚动和逐月比较使用0.1.7的`transforms`，不是任意表达式。`divide`除数为无单位数值；比例与增减率输出中25表示25%。[新能力与可执行示例](release-017.md)说明累计起点、窗口、展示裁剪和先派生后排名。
- 业务须证明比较群体和公式合理。例如当月人数与同月人员快照匹配；公司人数独立去重，不能相加可能重叠的部门去重数。包的类型和单位检查不能代替业务证明。
- 外部快照作分母且业务要求每期每范围唯一时，宿主须验证唯一性和数值约束；直接 sum 或只取 min 不能证明唯一。若业务要求唯一、非空、非负，可在同次分母聚合组合 count 和 min，再经公开结果归一化验证每个返回桶 count 为 1、min 有限且非负，不为校验重复补查同范围。缺桶和零分母保留不可用；重复、NULL 或非法数值按已确认策略拒绝该项或标记该点，不合成正常分母。是否唯一、能否为负及异常影响范围仍由业务决定，不写成所有比例的默认规则。
- 来源完整性、期间完整性分别保留。缺月、NULL、零分母、截断周期和未来周期不能统一转为零；只有明确声明可加原始count／sum且非Percent输入的missing: zero才补缺组。时间桶须实际覆盖且非未来，类别仅补其他来源已有身份，真实NULL不变；原始Percent不自动换算。

## 最小配置示例

下例仅演示配置形状。假设宿主已确认甲乙可比较且比例有业务意义；两份来源别名为 `alpha/beta`，指标别名为 `measure`，月维度别名为 `bucket`，时区为 Asia/Shanghai。实际名称、时区和范围应按宿主替换，不把示例作为行业默认值。

<!-- grouped-series-config -->
```js
/** @type {import("@qfei-design/make-app-analytics").GroupedSeriesDefinition} */
export const groupedDefinition = {
  id: "monthly_comparison",
  definitionVersion: "1",
  alignment: {
    kind: "time",
    granularity: "month",
    timeZone: "Asia/Shanghai",
    range: "sources",
  },
  inputs: [
    { key: "a", label: "指标甲", description: "宿主定义的指标甲",
      source: "alpha", metric: "measure", dimension: "bucket", precision: 2 },
    { key: "b", label: "指标乙", description: "宿主定义的指标乙",
      source: "beta", metric: "measure", dimension: "bucket", precision: 2 },
  ],
  calculations: [
    { key: "portion", label: "甲乙比例", description: "宿主已确认甲除以乙的业务含义",
      operation: "ratio", left: "a", right: "b", precision: 2 },
  ],
};

/** @type {import("@qfei-design/make-app-analytics").SeriesChartSpec} */
export const chartSpec = {
  kind: "area",
  series: [{ key: "a" }, { key: "b", lineStyle: "dashed" }],
};
```

仅需要两条对照曲线时，移除未被需求使用的 `calculations`。比例若需要展示，使用独立的百分率图或相应数值展示，不与原数值共用一条值轴。

接入已有工作台注册，不另建查询协议：

```ts
import { createDashboardService } from "@qfei-design/make-app-analytics/server";

// existingOptions 是宿主已有 host、scopes、analyses、limits、logger。
// alphaDefinition/betaDefinition 引用同次注册中的实际分析定义。
const service = createDashboardService({
  ...existingOptions,
  registrations: [{
    id: "overview", definitionVersion: "1", metrics: [],
    sources: [
      { key: "alpha", analysisId: alphaDefinition.id,
        parameters: { period: "period" } },
      { key: "beta", analysisId: betaDefinition.id,
        parameters: { period: "period" } },
    ],
    groupedSeries: [groupedDefinition],
  }],
});
```

示例假设两个 scope 都声明 `period` 日期参数及 `dateParameter`，并且时间分组使用对应字段；无参数时移除映射。浏览器只传已允许的日期参数，不传 groupedSeries、公式、对象或身份。若已有 Service 编排，可在可信服务端用 `evaluateGroupedSeries(definition, sources)`；sources 必须来自实际 `definition/result/context/timeFieldKey`，手写 context 不能证明真实查询口径。

UI 使用独立序列合同，不把它伪造成 `AnalysisResult`：

```tsx
import { AnalysisSeriesView } from "@qfei-design/make-app-analytics/react";

<AnalysisSeriesView
  title={title}
  definition={groupedDefinition}
  state={{ status: "success", result: response.groupedSeries[0] }}
  spec={chartSpec}
  theme={chartTheme}
/>;
```

上述片段仅表示成功分支；实际接入保留 idle/loading/error/success 并校验注册结果存在。复用宿主已有 Provider、公共 CSS 与基础组件适配，不复制整页演示工程。

## 选择受控展示

| 配置 | 适用条件 |
| --- | --- |
| `line/area` | 有序时间桶，满足至少两个桶等资格；面积为独立填色，不是累计或堆叠面积 |
| `bar` | 同单位系列比较；可声明横向或纵向，分组柱可有负值 |
| `stackedBar` | 宿主明确声明 `stacking: { additive: true, disjoint: true, description }`，组成互斥且可加；当前拒绝负值及百分比，不堆叠去重数或均值 |
| `percentStackedBar` | 同样证明互斥可加，并声明`denominator: selectedSeries`；缺组成、零合计、溢出不可用，明细保留原值／分母／占比 |
| `combo` | 每条显式声明柱／线与轴0／1，同轴同单位；只在业务确需不同单位时使用双轴 |
| `lineStyle` | `solid/dashed` 区分实际与参考系列，语义与图例由宿主给出 |
| `referenceLines` | 最多 5 条同单位常量参考线，显式标签、说明、值和单位；不代表动态目标序列，也不是计算输入 |

同图显式选择1–6条系列。普通序列保持同单位；0.1.7的combo可按轴0／1展示不同单位和派生比率，参考线也按轴核验。单聚合多指标仍可使用AnalysisMultiMetricView。配色使用宿主主题与公开色序号，不传原始颜色、HTML、函数或任意ECharts option。

当前单结果最多 1000 桶、20 条输入及计算序列、20000 点；这是容量约束，不是生产 SLA。按用户问题控制来源、时间和输出体积，不自动把全部对象展开为图。

## 说明与明细

列头问号解释定义、公式及来源；数值说明解释该期实际操作数和期间。可通过 `groupedSeriesPointExplanationItems` 生成条目，复用 Help／可选 ValueHelp。正常值配置数值触发器后不重复堆放问号，缺失及期间异常保留明确入口。

AnalysisSeriesView的汇总明细与图形选择同一系列子集。单月、图形不适用或全部点不可计算时保留真实序列表及原因。补零只按输入显式规则执行；占比明细同时保留原值、分母、占比和原因。移动表头、Tooltip、Portal主题及点击／焦点按[接入合同](integration-contract.md#帮助与汇总明细)验收。

详细计算边界和组件调用以安装制品附带的 `docs/分组序列计算.md`、公开类型和运行时校验为准，不依赖相邻源码工程。
