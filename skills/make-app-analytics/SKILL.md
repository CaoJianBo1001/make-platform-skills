---
name: make-app-analytics
description: "Use when a Make App PRD or iteration requests business reports, analytical charts, KPI cards, trends, composition, rankings, 数据分析/可视化, or fixes to existing analytics layout/request/performance behavior. Includes intent such as 看每月金额如何变化. Select the smallest useful surface from verified business metrics and data, then guide host–analytics-package integration. Does not own temporary CLI lookups, existing list totals, record-list grouping, print/export reports, IAM policy, or runtime conversational BI; ordinary App creation alone does not trigger analytics."
metadata:
  version: 0.1.19
---

# make-app-analytics

指导开发 Agent 在 Make App 的项目建设或迭代中，按用户已提出的问题选择指标、统计口径及固定可视化，再接入宿主与分析包。业务用户查看结果；图表类型在实施阶段确定。

## 先判断是否进入本流程

- 初始化 PRD 已包含分析需求，或用户后续要求趋势、构成、排名、指标卡、业务报表等，按本次范围进入；已明确的需求不重复询问是否启用。
- 普通 CRUD、审批、搜索、筛选、列表维护，以及仅存在金额、日期或大量数据，都不构成触发。未触发时继续原业务开发，不做分析访谈、统计探查、包安装、Provider、API、路由、导航或隐藏占位。
- 临时查数用 [makecli](../makecli/SKILL.md)；列表现有总数沿用原链路；列表分组用 [make-app-group](../make-app-group/SKILL.md)。打印／导出明细按实际文档或导出任务处理；“报表”一词本身不决定接入分析包。
- “想了解每月变化”“哪些类别贡献最高”等业务意图也能触发，不要求用户说出包名。手机工作台的业务入口网格、待办入口或一个日期／金额字段不表示分析需求；“工作台”含义不明时先查 PRD，仅在确实影响范围时澄清。

## 已触发后的工作流

1. 复用 PRD、已确认口径和宿主调用链。明确要回答的问题、记录粒度、时间字段与范围、状态、去重、空值和单位。关键语义无法确定且会改变结果时才集中询问；不要让用户选择图表类型或完成技术问卷。多指标、专题页或驾驶舱先读 [分析规划与渐进建设](references/analysis-planning.md)，单卡单图只记录必要决策。
2. 选最小交付：一个指标嵌入卡片，一个趋势／构成问题嵌入一张图，多项相关问题才组合专题页或页签。需要复用宿主适配器不意味着必须增加分析中心。嵌入列表并要求随列表筛选时，先读 [列表筛选联动](references/list-filter-integration.md)，核对全部已应用条件能否等价进入统计；不能静默忽略关键词、多选或条件组。
3. 通过现有 Make Skill 核对授权 Schema、字段能力和必要的只读统计，观察日期桶、分类数、覆盖范围、缺失、负值及异常值。只探查本次问题需要的数据，不默认扫描全 App。接入前读 [页面请求与大数据验收](references/query-performance.md)，列出唯一统计来源与调用预算：兼容指标合并、多图复用、当前区域按需查询，初始化元数据不随每张图重复读取。
4. 读取 [选图与业务口径](references/selection-and-scope.md)，结合实际结果选择已实现的模板。使用 [接入合同](references/integration-contract.md) 核对实际制品、公开导出与宿主分工；字段、数据质量或模板不适合时说明限制，采用可信的结果表或调整已授权范围内的方案。
5. 在宿主服务端注册现有 `AnalysisDefinition` 与 `AnalysisRegistration`。同时记录业务标签、解释条目及选择原因；不新增一套分析 DSL，也不向严格 V1 定义塞入布局字段。UI 只引用服务端已注册的 ID、版本与视图。
   按 DateTime 统计时读 [DateTime 分桶与制品门槛](references/datetime.md)：自正式0.1.9支持五种显式粒度及完整自然日范围；先核对后端和实际制品，保持真实字段类型及能力标志，旧版升级后再使用。
   需要同比／环比、条件比率、贡献度、质量指标或多来源工作台时，先读 [高级指标与共同范围](references/advanced-metrics.md)。需要跨来源逐月计算、部门／整体对照、面积／分组柱／堆叠柱时，再读 [分组序列与对照展示](references/grouped-series.md)。查询和解释从共同范围注册生成，不仅凭相同 scopeKey 或文字证明分母一致。
   需要累计、滚动、逐月同比环比、派生排名、目标模板、组合双轴、百分比堆叠或散点／热力时，读 [既有分析能力与接入示例](references/release-017.md)。这些已有正式公共合同，不在宿主重写计算；按需求选用，不把所有新模板自动加入每个App。
6. 编排图形前读 [图表占位与布局](references/chart-layout.md)，按类型、分类／系列数、实际卡数和所属容器宽度安排跨列、并排或堆叠；指标末行、单图空轨道及嵌套区块须检查整组占位。同排同层级卡片对齐上下边缘及已有页脚底缘，各行按内容分配高度，避免全页机械等高或只拉长外框留下空白。页面外边距与业务文案遵循宿主规范和 [业务页面约束](references/integration-contract.md#业务页面与验证环境)；不复制验证标记，不覆盖包私有样式，公开能力不足时说明包侧缺口。
   需要汇总明细时按 [默认容器](references/integration-contract.md#汇总明细的默认容器) 接入宿主唯一适配器：PC 居中弹窗，手机底部弹层；原始业务记录沿用宿主详情／抽屉。同一 App 不按图表或数据量随意切换容器。
7. 按 [验收要求](references/acceptance.md) 检查真实查询、权限、口径、覆盖范围、固定展示、手机和异常状态；布局用截图及真实边界测量覆盖至应用最宽内容区，不能只验算列数。测量首次初始化、筛选、页面返回、刷新及取消的实际下游次数和耗时，不只看浏览器路由数。测试所生成的接入产物与实际请求，不能仅凭文档关键词检查声称 AI 任务验证完成。

## 职责交接

| 主体 | 职责 |
| --- | --- |
| 本 Skill | 触发与范围、业务问题及询问策略、数据核对、指标和固定视图选择、验收 |
| 宿主 | 业务对象、字段、群体、状态、日期、分母、目标来源与公式含义；注册与公开目录、可信身份和 Schema、既有请求适配器、页面组合及业务动作 |
| 分析包 | 定义／结果校验、受控统计编排、按宿主声明计算派生指标和分组序列、固定模板资格、覆盖范围、渲染、格式、解释内容／明细和查询生命周期 |

Service 统计路径、组合计算与 HTTP 合同交给 [make-app-service](../make-app-service/SKILL.md)；只读资源发现交给 [makecli](../makecli/SKILL.md)；列表筛选与编译交给 [make-app-filter](../make-app-filter/SKILL.md)；页面布局及宿主组件库适配交给 [makeui](../makeui/SKILL.md)；读取资格、字段和撤权生命周期交给 [make-app-permission](../make-app-permission/SKILL.md)。只在本次需要时读取对应 Skill，不复制它们的实现或权限算法。

制品核验、UI／Service同版及升级边界统一按[接入合同](references/integration-contract.md#先核对可用制品)执行；分析包发布、Skill安装与宿主验收分别记录。

接入前确认本入口、随附 references 和本次需要的关联 Skill 实际可读；缺失时按所选发布通道补齐，或使用任务明确提供的源路径。无法取得时说明具体缺口，继续不依赖它的工作，不假设本机存在另一个仓库。makecli 内嵌快照和仅更新既有 Skill 不能证明新增入口已交付；发现 Skill 也不表示向普通新 App 安装分析包。

当前流程不引入运行时 LLM、用户选图器或通用 BI 编辑器。用户另行提出这些能力时，按新需求核对其数据、交互及运行时支持。
