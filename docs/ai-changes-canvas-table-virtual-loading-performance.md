# CanvasTable 大数据虚拟滚动加载规范

## 2026-08-08

## 需求

- 将已在下游项目验证过的大数据量 CanvasTable 滚动加载经验沉淀到 `canvas-table-integration`。
- 覆盖快速滚动、拖拽滚动条跨越大量分页时的请求收敛、并发限制、过期请求取消、缓存淘汰和失败重试。
- 保持平台 Skill 通用，不在 Skill 正文中写入具体项目名称、业务字段或本机路径。

## 设计决策

- 主 `SKILL.md` 只保留触发入口、交付准入和引用路由，详细实现规则统一放在 `references/virtual-table-patterns.md`，避免主入口膨胀。
- 将虚拟加载分为基础分页链路和高数据量调度链路；普通远程分页不强制引入复杂调度，高数据量、快速滚动或拖拽滚动条场景必须使用有界宿主调度器。
- 只允许使用已安装 npm 包文档声明的公共 API；`runVirtualPageLoad`、`markPageLoadFailed`、`getPagesInView` 和 `maxCachedRows` 使用前必须先按 `package.ai.json.readOrder` 核对。
- `120ms` 合并窗口、最多 `2` 个并发、邻页预取半径 `1`、约 `30` 页缓存作为经过验证的可调推荐基线，不作为所有项目不可修改的固定常量。
- 将请求取消定义为浏览器、Service 和下游 fetch/DataAPI 的全链路能力；仅丢弃旧响应不能宣称完成端到端取消。

## 变更内容

- `skills/canvas-table-integration/SKILL.md`
  - 版本从 `0.1.4` 更新为 `0.1.6`。
  - frontmatter 增加大数据快速滚动触发语义。
  - 压缩重复能力枚举，在保留触发词和跨 Skill handoff 的同时满足 description 长度上限。
  - Quick start 和 Topic reference map 增加快速滚动、拖拽滚动条的专项路由。
  - 明确虚拟模式按已安装包合同选择 `setData(rows, page)` 或身份感知的 `setData(rows, page, request)`，高数据量场景必须限制调度、释放 pending 页并限制缓存。
  - 明确浏览器宿主调度归本 Skill，Service 断连处理和下游 AbortSignal 传播交给 `make-app-service`，避免跨 Skill 重复定义 Service 实现。
- `skills/canvas-table-integration/references/virtual-table-patterns.md`
  - 补充总数从 count 接口或第一页响应初始化的两种方式。
  - 补充同页 pending 去重、失败和取消后的 `markPageLoadFailed`、越界页短路及仅在 loader 就绪时订阅。
  - 补充视口目标页收敛、邻页预取、距离优先、合并窗口、并发上限、排队请求取消和 in-flight 请求中止。
  - 补充宿主缓存与 CanvasTable 缓存对齐、最远页淘汰、反向滚动重载和滚动页直接写表格。
  - 补充查询上下文切换时的请求、队列、缓存、数据和滚动位置重置；身份感知路径只在新代次开始前清空，不在当前回包内清空并复用失效请求。
  - 补充 AbortSignal 全链路传递、边界日志和完整验证清单。
- `skills/canvas-table-integration/references/validated-usage-notes.md`
  - 标记高数据量虚拟加载调度、取消和缓存策略已经过下游记录列表验证。
- `scripts/test-canvas-table-virtual-loading-contract.mjs`
  - 新增静态契约测试，防止后续退化为只有 `data:load + setData` 的基础说明。
  - 增加交接落点校验，确保 `make-app-service` 不只是被引用，还实际定义了断连、信号传播、`AbortError` 和监听器清理规则。
  - 增加身份感知请求、包请求信号与宿主调度信号组合、原子总数提交、`clearData` 代次边界及旧版兼容声明校验。
  - 增加无辅助函数时的同步身份认领、预取页身份隔离、过期同页任务禁止跨代复用、预期取消不记失败日志及清空后单一引导校验。
- `skills/canvas-table-integration/agents/openai.yaml`
  - 更新技能展示说明和默认提示词，使其覆盖大数据虚拟滚动加载，而不是只体现 schema 字段展示。
- `skills/make-app-service/SKILL.md`
  - 版本从 `0.1.1` 更新为 `0.1.2`。
  - 承接 CanvasTable 交出的 Service 端请求取消职责，并路由到 API 合同参考。
- `skills/make-app-service/references/service-api-contracts.md`
  - 补充客户端断连、请求级 `AbortController`、下游 `AbortSignal`、`AbortError`、监听器清理和安全日志规范。
- `skills/make-app-service/references/testing-and-safety.md`
  - 增加断连取消与下游信号传播测试要求。

## 测试策略

- 先新增契约测试并确认在旧规范上失败。
- 更新 Skill 后验证以下合同：
  - 公共 API 和 pending 页释放；
  - 快速拖拽前置合并、并发上限和目标页优先级；
  - 过期队列与进行中请求取消；
  - 缓存上限、越界短路和反向重载；
  - 上下文切换、短第一页身份保持、原子总数提交和滚动页直写；
  - AbortSignal 跨浏览器、Service 和下游请求传递；
  - 推荐参数可调，不被描述成通用硬编码值。

## 当前状态

- 已完成规范、验证记录和契约测试更新。
- 已完成 `quick_validate.py`、Skill metadata、平台通用性、CanvasTable 数据同步和新增虚拟加载专项校验。
- 已完成仓库内全部 12 个 `test-*.mjs` 契约脚本回归，全部通过。
- 已执行公司级 Skill 审查：无 Critical 或 Major 问题；机械检查提示的 `must / do not` Minor 经人工核对为不同规则之间的正常强约束，不构成矛盾。
- 提交前复核发现并修复跨 Skill 交接无落点、技能展示元数据过窄两项问题；相关失败断言已先行补充。
- 已将本次涉及的 CanvasTable 文件同步到 `.codex` 与 `.agents` 用户级副本，并将 Service 取消规范同步到 `.agents` 用户级副本；逐文件一致性校验通过。

## 提交前二次审查修复

- 对照 CanvasTable 当前公共合同补齐 `data:load(page, request)`、`IVirtualPageRequestContext`、`request.signal` 以及成功/失败原样回传请求上下文的身份感知路径。
- 保留旧包仅页码回调的兼容路径，但明确它不具备请求代次、同页立即重发和迟到回包隔离能力；不再用旧路径代表所有版本。
- 当分页响应包含最新权威总数且包公开 `setVirtualPageData` 时，要求原子提交总数和页面数据。
- 修正短第一页处理：`clearData()` 只能作为新代次或重新引导前的重置边界，不得在认领当前请求后清空并继续复用已失效请求。
- 要求组合包请求信号与宿主调度信号；任一信号中止都必须终止真实网络请求。
- 将 `runVirtualPageLoad` 定义为可替代的辅助封装，将 pending 释放、视口页获取和表格缓存上限定义为高数据量路径的安全能力；缺失且无公开替代时必须升级或报告阻塞。
- 明确下游项目验证的是旧版仅页码路径；身份感知路径当前由包文档、示例和包测试验证，尚未获得下游项目验证，避免夸大验证范围。
- 明确 `runVirtualPageLoad` 不可用时必须在第一个 `await` 前调用 `request.useRequestIdentity()`；示例在记录失败日志前过滤包信号中止和 `AbortError`。
- 邻页推测预取只能先写入有界宿主缓存，不得借用锚点页 request 回填另一页；必须等目标页自己的 `data:load` 到来后再带对应身份提交。
- 调度去重限定在同一查询上下文和有效代次，新的同页 request 不得挂接到已中止或过期任务。
- 上下文重置期间增加同步门控，并把身份感知 `clearData()` 触发的全新 page `0` 事件作为唯一引导，避免与手动首屏请求竞态。
- 越界页必须跳过网络并用同一 request 显式释放 pending 标记；过渡期产生的请求也必须逐一释放。

## 提交前第三次审查修复

- 修复 `core-props-methods-events.md`、`common-pitfalls.md` 和 `track-workflows.md` 中仍残留的无条件 `setData(rows, page)` 指引，改为先使用身份感知 `setData(rows, page, request)`，仅在已安装公开文档没有请求上下文时才走旧版仅页码合同。
- 将虚拟加载身份感知路径的选择条件从任一符号命中收紧为完整公开合同：`data:load(page, request)`、`IVirtualPageRequestContext`、同步 `useRequestIdentity()`、请求感知成功/失败 API 必须同时可用。
- 将第一页分页转换示例改为纯数据源 helper，不再在 `await` 后直接写表格；身份感知表格必须等 page `0` 请求被同步认领后再提交缓存的首屏结果。
- 补充 Service 正常完成和提前断连的区别：正常响应结束不得触发下游 `AbortSignal`，Node/Express 路径使用 `res.writableEnded` 或框架等价完成标记保护 `close` 钩子，清理逻辑必须幂等。
- 扩展专项契约测试，覆盖直接路由 reference 的旧版分页指引清理、完整身份合同选择、纯 bootstrap helper，以及 Service 正常完成不 abort 的测试要求。
