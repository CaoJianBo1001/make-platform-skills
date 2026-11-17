# DateTime 分桶与自然日范围

## 先区分接口和制品

按[Data API 合同](../../makedsl/references/DataAPIDesign.md#聚合统计-record-数据)，可读业务 DateTime 在同一个 group 项声明 day／week／month／quarter／year 后可分桶，真实 Schema 仍保持 aggregable=false。不得改成 Date、伪造 aggregable=true，或按显示 label 拼接身份。目标环境仍须只读验证。

DateTime 显式分桶及完整自然日范围自正式0.1.9提供，0.1.8及旧版须先升级。制品核验、UI／Service同版及安装约束统一按[接入合同](integration-contract.md#先核对可用制品)执行。

## 自然日范围合同

- dimensions 中字段保留 Make.Field.DateTime，granularity 必填；Date 原有能力规则保持不变，普通字段不因存在粒度而获得权限。
- dateRange 参数仍为两个有效日期的 `[start,end]`，结束日不包含。包按字段类型为 DateTime 生成 `YYYY-MM-DD 00:00:00` 的 gte／lt 边界，Date 仍传日期。不改成结束日 23:59:59，不使用本机时区或 toISOString 偏移业务日期。
- 使用宿主已确认的业务时区；字段值遵守后端业务 DateTime 格式，不将带 Z／offset 的时刻直接截成日期。0.1.9 只承接完整自然日；日内时分秒范围不能套入日级共同范围，须另行定义合同。显式共同 baseFilter 仅支持同字段 gte／lt 的自然日零点边界；不能将 DateTime 等值瞬间解释为一整天。
- 来源实际过滤、共同范围解释和分组字段必须一致。NULL、缺月、未来与未完整周期继续保留原语义，窗口／同比／排名沿用现有资格，不因新增字段类型放松。
- 图表消费后端规范桶 value，复用现有 AnalysisView／AnalysisSeriesView、Help、明细、主题与分页；不新增原始记录查询、引擎配置或每桶请求。身份、权限及 Schema 继续复用宿主的受控快照。

## 周粒度展示与实际覆盖

以下展示规则适用于Date与DateTime的周粒度。后端周桶value为该周周一日期，跨年不拆周；保留这个原始身份用于排序、对齐和交互，完整周区间只作为展示解释，不改写查询或返回值。

- 横轴空间足够时优先显示周一至周日的区间，例如`10/05–10/11`。周区间跨年或同图涉及多个年份时标明可消歧的年份，例如`2026/12/28–2027/01/03`，不能让不同年份的同月同日看起来是同一周。
- 空间不足时可显示周起始日，轴标题注明“周起始日（周一）”；多年份时仍保留必要年份。标签密度按实际容器宽度处理，不能以截断关键年份或日期边界通过验收。
- 悬浮提示、手机点击提示和汇总明细展示完整自然周区间，例如`2026-10-05 至 2026-10-11`。筛选仅覆盖半周时，同时标明查询实际纳入的日期范围：例如共同范围为`[2026-10-07,2026-10-10)`，该周仅纳入`2026-10-07 至 2026-10-09`，结束日不计入。范围取自已验证的实际过滤与该周的交集，不由第一条／最后一条有数据的日期推测，也不把整周标签解释为整周均已统计；业务时区沿用已确认合同。
- 若类别轴跳过无数据的周，注明“仅展示有数据的周”，并说明等间距分类不代表连续的时间距离。缺周、真实零、NULL及部分结果沿用既有语义；不能仅为使图形连续而自动补零，返回不完整也不能用该说明冒充完整时间覆盖。

这些是展示与验收要求，不是正式0.1.9已具备全部显示能力的声明。该制品支持周分桶，但尚未提供上述周区间轴、提示与明细的统一展示能力；通用格式化应收敛到公共包，宿主提供真实粒度、业务时区和可验证的筛选范围。接入前核对实际公开合同；缺少公开能力时记录包侧缺口，不修改后端桶value、不在宿主重写图形或补一套私有formatter。日期区间解释与响应式标签本身不需要新增后端聚合请求。

### 周展示候选的接入

公共包本轮源码候选已增加上述展示及`AnalysisTimeContext`，尚未发布，正式0.1.9不能使用新增props。先按[制品门槛](integration-contract.md#先核对可用制品)核对目标制品的公开类型及实际行为；`validateDefinition`接受`week`、能画日期或已有同名组件，都不能证明它支持周区间和范围说明。用户授权的候选联调仍使用隔离副本，不修改正式宿主依赖或已安装Skill。

基础`AnalysisView`、`AnalysisPanel`与`AnalysisMultiMetricView`使用可选`timeContext: { fieldKey, timeRange }`；类型`AnalysisTimeContext`从包根入口或`/react`导入，timeRange复用既有`BusinessTimeRange`。字段必须绑定实际周维度，时区与已声明业务口径一致，范围取自当前结果已执行查询的服务端上下文或已确认请求快照，不能取未查询的筛选草稿。结束日仍不含；不新增请求，也不把这些展示参数写入`AnalysisDefinition`或查询DSL。

<!-- analytics-week-example -->
```js
export const weekPresentationProps = {
  timeContext: {
    fieldKey: 'eventAt',
    timeRange: {
      kind: 'range', start: '2026-10-07', end: '2026-10-10',
      timeZone: 'Asia/Shanghai',
    },
  },
};
```

这是合成的半周接入示例，字段和范围须映射真实业务。基础图传上述props；独立使用`AnalysisDetails`或`AnalysisResultTable`时，另外传与结果匹配的`definition`，并复用同一timeContext，避免图表与明细口径不一致。只有result时其列不携带粒度，明细维持原始标签；未提供范围时只能解释完整自然周，不能声称已核对实际半周。

低层映射使用`buildChartModel(definition, result, kind, { timeContext })`或`buildMultiMetricChartModel(definition, result, spec, { timeContext })`后接既有ECharts映射器，不直接拼option。分组序列及其明细自动复用`GroupedSeriesResult`的各来源／点范围，不需要额外props；多个来源期间不一致时分别说明，不伪造共同范围。候选目前覆盖基础柱／折线、同结果多指标柱线组合及分组序列，不据此宣称散点／热力等其他模板已有相同展示。

## 可执行正式配置

以下只有合成标识；实际接入替换为授权 Schema 中的字段和已确认业务口径。宿主已有身份、请求与日志通过原有 AnalysisHost 注入。

<!-- analytics-datetime-example -->
```js
export const dateTimeFields = [{
  key: "eventAt", type: "Make.Field.DateTime", readable: true,
  capabilities: { aggregable: false, groupable: false },
}];
export const dateTimeDefinition = {
  schemaVersion: 1, id: "event_time", definitionVersion: "1",
  semantic: { goal: "trend", description: "按业务发生时间统计事件量", timeZone: "Asia/Shanghai" },
  query: {
    entityKey: "event",
    dimensions: [{ fieldKey: "eventAt", granularity: "month", alias: "period" }],
    metrics: [{ aggregate: "count", alias: "events" }],
    sort: [{ alias: "period", order: "asc" }], coverage: { mode: "complete" },
  },
  views: [{ id: "main", kind: "line", x: "period", y: "events" }, { id: "table", kind: "table" }],
};
export const dateTimeScope = {
  key: "visible_events", entityKey: "event", label: "当前授权范围及所选自然日的事件",
  timeZone: "Asia/Shanghai", dateParameter: "period",
  parameters: [{ name: "period", fieldKey: "eventAt", kind: "dateRange", required: true }],
};
export const dateTimeRequest = {
  definitionVersion: "1", parameters: { period: ["2026-01-01", "2026-03-01"] },
};
```

使用 createAnalysisService 注册 `{ definition: dateTimeDefinition, scopeKey: dateTimeScope.key }` 及 scopes，执行 event_time。输出继续为标准 AnalysisResult，不自行构造成功结果。接入 groupedSeries 时引用同一 eventAt、period 维度及真实 scope；保留实际自然日期间解释。

## 验收

在满足上述最低版本的实际正式制品上执行公开校验器、实际筛选及标准结果；旧版升级前仍须阻止不支持的定义和无权限查询。覆盖五种粒度、缺粒度、隐藏字段、非法日期、跨年／月底／闰日／零点、NULL、缺月与未完整周期。日内范围及未经确认的时刻格式须明确失败，不能降成完整日。

在宿主既有测试与Make适配器中执行本页配置，核对实际生成的gte／lt零点边界、返回桶value及期间解释。代码、真实接口与页面的验收范围分别按[验收要求](acceptance.md)记录。

周粒度另覆盖完整周、起止边界落在周中、结束日恰为下周一、跨月／跨年及多年份同月同日、缺周、真实零与NULL。使用已知周一桶及分界日样本，核对记录只进入正确周、结束日排除、周区间与实际纳入范围一致；例如`2026-12-28`桶展示至`2027-01-03`，不能按年份拆开。桌面宽容器、窄容器与手机分别核对轴标签、轴标题、提示及明细；缩放和打开说明不得额外聚合，展示前后桶身份、数值、顺序和覆盖状态保持一致。正式制品尚缺上述显示能力时记录未完成，不将规则或分桶测试通过记为页面已修复。

候选接入还须验证错误字段、错误时区、非法范围及返回周与范围不相交时明确失败；查询结果未更新时不能套用新筛选范围。图表、回退表及独立汇总明细使用同一结果与范围；`[2026-10-07,2026-10-10)`的实际纳入结束日期应为10月9日。缺周说明分别覆盖分类柱图省略首尾／中间周、折线NULL缺口，以及部分结果／Top N不冒充完整有数据周。
