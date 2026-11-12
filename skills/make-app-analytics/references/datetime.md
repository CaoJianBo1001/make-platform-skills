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
