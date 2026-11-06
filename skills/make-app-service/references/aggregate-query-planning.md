# 聚合查询规划与请求预算

新增或优化报表、工作台、多来源指标时读取本参考；单对象 API 语义以 [Data API 聚合合同](../../makedsl/references/DataAPIDesign.md#聚合统计-record-数据) 为准。页面需求先由 [分析 Skill](../../make-app-analytics/SKILL.md) 确认范围。服务端执行聚合，Service 组合必要结果，UI 消费结果；保留当前业务口径和权限链路。

## 先画实际调用链，再规划查询

记录一次页面动作从 UI、Service 到 Make 的实际请求：身份、IAM、Schema、目录、聚合、必要明细各多少次，哪些串行、哪些并行、何处复核授权。一个浏览器请求仍可能展开成大量下游调用；不要只数路由请求或图表数量。

按实际查询语义建立清单：对象、授权上下文、定义版本、基础／参数筛选、时间字段与时区、分组及粒度、指标、聚合后筛选、排序、完整／Top N 范围和预计分页。标记同一结果被哪些卡片、图表、派生指标及明细复用。业务数据量和返回分组数分别估计：万条事实可能只返回十几个月桶，多维高基数也可能超过展示预算。

调用预算由“唯一查询的必要分页＋必要元数据读取／复核＋受限业务补读”组成；定义中几个来源别名不等于几个独立查询。先记录冷初始化、同上下文查询、筛选、路由返回和刷新各自预算，再用真实适配器的计数验证。

## 减少扫描与重复调用

| 情况 | 查询方案与边界 |
| --- | --- |
| 相同对象、WHERE、分组、范围的多个指标 | 在后端允许的指标数内组合 count/sum/avg/min/max/countDistinct；基础合同最多 10 个指标，不按一张卡一个请求拆分 |
| 同一分组结果用于多图／表／明细 | Service 查询一次，下游共享标准结果；打开“汇总明细”不重新拉原始业务记录 |
| 多个质量指标使用同一总体 | 复用同一个已注册总体分析和相同参数；字段非空条件分别查询，不能为省请求改变分母 |
| 相同 analysisId 和规范化参数被重复引用 | 使用包现有工作台执行去重；0.1.6 在单次 execute 内复用在途结果，不根据标签推断等价，也不跨请求缓存业务统计 |
| 按客户、部门等逐个循环查询 | 优先按维度一次分组，再按原始 ID 映射；避免对象数量增加就线性增加请求的 N+1 调用 |
| 只取前 N 名或需聚合后过滤 | 使用后端排序、Top N 分页及受支持的 HAVING；部分排名不冒充完整构成；存在独立总体时另保留它 |
| 单次聚合不能表达 | 先改用等价主体或少量汇总组合；确需逐条判断时限制范围、字段、分页、预算，并证明完整；大规模高频补读评估专用后端支持 |

筛选、分组、币种、日期、分母、权限或 HAVING 不同的请求不能合并。相同标签或相同 scopeKey 字符串不证明等价。全局 countDistinct 直接请求，不累加可能重叠的去重数；全局 avg 优先直接请求，不平均各组均值。质量统计涉及日期缺失时，不为提速加日期条件而排除缺失样本。

## 可执行的注册示例

下面只演示通用查询规划：宿主已确认需要同一范围的记录数、指标甲总量／均值，以及甲乙非空情况。业务对象和字段均为占位，必须映射授权 Schema。四个工作台来源引用三个唯一分析；总体同时返回 count/sum/avg，不把三个卡片拆成三个总体查询。示例使用 0.1.6 的公开合同，先检查实际导出。

<!-- aggregate-query-plan -->
```js
/** @type {import("@qfei-design/make-app-analytics/server").AnalysisScope} */
export const scope = {
  key: "visible_records", entityKey: "sample_record",
  label: "宿主已确认的可见业务范围", timeZone: "Asia/Shanghai",
};

/** @type {import("@qfei-design/make-app-analytics").AnalysisDefinition} */
const totalDefinition = {
  schemaVersion: 1, id: "all_records", definitionVersion: "1",
  semantic: { goal: "total", description: "宿主声明的规模与指标甲统计", timeZone: scope.timeZone },
  query: {
    entityKey: scope.entityKey, dimensions: [], sort: [], coverage: { mode: "complete" },
    metrics: [
      { aggregate: "count", alias: "records" },
      { aggregate: "sum", fieldKey: "metric_a", alias: "amount" },
      { aggregate: "avg", fieldKey: "metric_a", alias: "average" },
    ],
  },
  views: [{ id: "records", kind: "metric", y: "records" }],
};

/**
 * @param {string} id
 * @param {string} fieldKey
 * @returns {import("@qfei-design/make-app-analytics/server").AnalysisRegistration}
 */
const nonEmpty = (id, fieldKey) => ({
  scopeKey: scope.key,
  definition: { ...totalDefinition, id,
    query: { ...totalDefinition.query, metrics: [{ aggregate: "count", alias: "records" }] } },
  baseFilter: { id: "nonempty", logic: "and", children: [
    { id: "field_present", fieldKey, operator: "is_not_empty" },
  ] },
});

/** @type {import("@qfei-design/make-app-analytics/server").AnalysisRegistration[]} */
export const analyses = [
  { definition: totalDefinition, scopeKey: scope.key },
  nonEmpty("nonempty_a", "metric_a"), nonEmpty("nonempty_b", "metric_b"),
];

/** @type {import("@qfei-design/make-app-analytics").DashboardDefinition} */
export const dashboard = {
  id: "sample_overview", definitionVersion: "1", metrics: [],
  sources: [
    { key: "total_a", analysisId: "all_records" },
    { key: "total_b", analysisId: "all_records" },
    { key: "valid_a", analysisId: "nonempty_a" },
    { key: "valid_b", analysisId: "nonempty_b" },
  ],
  recipes: [
    { kind: "dataQuality", key: "quality_a", label: "指标甲填写情况",
      description: "非空不等于业务有效", precision: 2,
      total: { source: "total_a", metric: "records" }, valid: { source: "valid_a", metric: "records" } },
    { kind: "dataQuality", key: "quality_b", label: "指标乙填写情况",
      description: "非空不等于业务有效", precision: 2,
      total: { source: "total_b", metric: "records" }, valid: { source: "valid_b", metric: "records" } },
  ],
};
```

把 scopes、analyses 和 registrations 注入宿主现有 `createDashboardService`，保留真实 host、logger、limits 和取消链路。需要参数时在 scope 声明并在 sources 显式映射；不同参数必须独立执行。同请求去重不是持久缓存；再次查询仍读取业务统计。单图表可选用总体返回的 amount／average，UI 不重算均值。

## 元数据复用与授权复核

包会在来源、分页和返回阶段调用守卫；宿主若将每次守卫都实现为整套身份＋IAM＋Schema 网络重读，请求数会随来源和分页放大。先核对现有授权合同，区分请求存活检查、使用可信快照判定资格、权威重新读取三类工作。

- 优先在同一逻辑分析请求内打开可信会话并复用已读快照；检查入口、实体／字段与条件、取消、失败及结果交付。不在每个图表、来源或 getEntity 中重复打开初始化链路，也不为每个对象先发送一次无业务需要的 count 作为通用权限探针。
- 若宿主已有“请求开始取快照、结束权威复核”的协调层，复用它并证明中间守卫检查请求租约、失败取消在途工作、身份／权限／Schema 改变时丢弃整份结果，复核阶段及结束后不能继续旧会话读取。不能通过直接 `return true`、移除守卫或省略最终复核换取速度。
- 跨请求复用是额外的授权生命周期设计；仅在现有身份／权限合同已允许时使用。按 [元数据缓存合同](service-api-contracts.md#分析元数据的复用与失效) 处理隔离、刷新、取消及失败；不把某个 App 的访问代次协议当作包内已有能力或所有宿主默认实现。
- 每个真实 Make 数据请求继续携带原会话并由后端授权。权限匹配与刷新仍由对应 Skill 拥有，不借性能优化创建第二套 IAM 或改变授权生效规则。

## 有界并发、分页与截止时间

独立聚合可并行，有依赖的查询等必要输入就绪；沿用包的并发池，不对全部对象、字段或时间桶直接无界 Promise.all。0.1.6 工作台默认并发 4，公开范围 1–8；这是制品配置边界，不是平台吞吐承诺。根据网关容量与实测选择，不把所有页面统一调到上限。

多次 UI 请求会叠加 Service 并发；同时考虑页面实际激活范围、Service 总在途量及后端限流。限流／上游故障沿既有错误和重试策略处理，不盲目立即重试放大负载。不同用户或独立查询不能共享业务取消器。

pageSize、单来源 maxGroups、工作台 maxTotalGroups、timeoutMs 和响应体积分别设预算。包内执行阶段的 timeoutMs 不自动覆盖宿主在包外进行的初始化、排队或最终权威复核；核对宿主总截止时间与取消链路是否覆盖这些阶段，未覆盖时不能声称端到端超时已受控。完整图需要读取全部必要分组并检查分页稳定性；预算不足按包合同显示 partial／不可计算或明确错误，不伪称完整，也不通过无限加页或超时来掩盖问题。

## 性能证据

以同一 Trace 关联 UI 动作、Service 总耗时、元数据各类次数、唯一聚合与分页数、必要明细数、最大在途量、响应字节和渲染耗时。日志只记录安全的路由、实体、计数、覆盖和取消信息，不记录凭据、Cookie、完整筛选或原始业务数据。

顺序测量与并发压测分开；冷初始化、命中、筛选、刷新、不同身份及故障分别测。前后使用相同身份、范围和统计答案，说明 preview／published 差异；并发调用耗时之和不等于总等待时间，网关耗时也不等于数据库 SQL 时间。万条事实、海量返回分组和多用户并发是不同负载，不能互相替代验收。
