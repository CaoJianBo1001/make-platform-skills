# AI 变更记录：Make App 排序 Skill

## 需求背景

已有参考应用实现高级筛选、Entity Preset 和多字段排序，
但当前 Make Platform Skills 只有完整筛选规范，缺少排序字段能力判断、五级
排序、拖拽优先级、表头联动、Preset 保存/回显和 records 调用时序的统一
标准。

本次先完成排序 Skill 能力。排序稳定后再规划独立分组 Skill；本次不实现
`group` UI、Preset group 更新或 records group 参数。

## TDD

先新增 `scripts/test-make-app-sort-contract.mjs`，首次运行按预期失败，原因是
`skills/make-app-sort/SKILL.md` 尚不存在。

随后完成最小 Skill 和跨 Skill 路由调整，并逐项修正合同测试中对文档出现
顺序的无意义约束。最终合同测试覆盖：

- 五级排序、字段唯一、`asc | desc` 和数组优先级
- `capabilities.sortable === true` 作为唯一字段能力来源
- dnd-kit 由 npm 包持有、宿主不重复实现，以及手柄拖拽的可观察行为
- `openWithField(fieldKey, order?)` 表头联动
- 确认前不请求 records，保存失败保留旧应用态和草稿
- Preset 先读取再查询 records、先保存再应用
- 对象切换时丢弃旧 Preset 和 records 响应
- Service Preset/records 校验、局部更新和安全日志
- 筛选 Preset 保存/读取/回显
- MakeUI、CanvasTable、Service 和 README 对 `make-app-sort` 的路由

## 新增 Skill

新增 `skills/make-app-sort`：

- `SKILL.md`：定义完整排序能力边界、落地流程、硬规则、npm 包迁移和后续
  分组边界。
- `references/sort-model.md`：定义 `{ fieldKey, order }[]`、最多五级、唯一性、
  `sortable` 能力、纯函数和清洗规则。
- `references/ui-and-drag.md`：定义 dnd-kit 拖拽、草稿确认、样式、可访问性和
  CanvasTable 表头预填。
- `references/preset-and-data-flow.md`：定义首次请求顺序、保存优先、局部更新、
  records 刷新和对象切换并发控制。
- `references/service-contract.md`：定义 Entity Preset GET/PATCH、Make Preset
  adapter、records sort、运行时 Schema 校验和边界日志。
- `references/testing-and-pitfalls.md`：定义纯模型、UI、集成、Service 测试和
  常见回归。
- `agents/openai.yaml`：提供 Skill 展示信息和默认调用提示。

## 跨 Skill 调整

- `make-app-filter` 增加 Entity Preset 筛选保存、读取、回显、清空、保存失败
  屏障和对象切换防旧响应覆盖，并新增 `preset-integration.md`。
- `make-app-service` 增加 Entity Preset 默认路由、Make Preset upstream 合同、
  sort 运行时能力校验、局部更新和测试要求。
- `makeui` 将排序行为路由到 `make-app-sort`，仅保留工具栏位置：筛选之后、
  刷新之前。
- `canvas-table-integration` 仅负责表头菜单/suffix 机制，排序状态、
  `openWithField`、Preset 和 records 时序交给 `make-app-sort`。
- `README.md` 增加 Skill 路由、常见组合和使用场景。

## npm 包与分组边界

- `@qfei-design/make-app-sort` 已发布，宿主必须先读
  `package.ai.json.readOrder`，只消费公开 core、React 组件/controller 和样式；
  不允许保留宿主 fallback 或直接依赖 dnd-kit。
- 后续分组使用独立 `make-app-group`、`@qfei-design/make-group` 和
  `capabilities.groupable`；排序与分组只共享可复用拖拽基础，不共享领域
  模型。
- 当前 Preset 更新采用按维度局部写入，保证保存 filter/sort 不覆盖未来
  group。

## 验证结果

- `node scripts/test-make-app-sort-contract.mjs`：通过。
- 仓库全部 12 个 Node 契约/审计测试：通过。
- `node scripts/lint-skill-metadata.mjs`：通过，共检查 12 个 Skill 入口和
  74 个 Markdown 文件。
- `quick_validate.py skills/make-app-sort`：通过。系统 Python 缺少 PyYAML，
  使用临时虚拟环境安装后完成校验，随后已删除临时目录。
- `git diff --check`：通过。

## 前向测试补强

使用独立只读代理仅加载新 Skill 模拟真实接入，主流程可独立产出，但发现并
补齐以下边界：

- Schema 归一化合同明确保留 `capabilities.sortable/groupable`。
- Make Preset `UpdateResource` 给出完整稀疏 payload，并要求集成测试证明
  上游按维度原子合并；不允许用易产生并发覆盖的读改写兜底。
- 接入表头排序前必须读取 CanvasTable `package.ai.json.readOrder` 并验证公开
  header API；缺失公开能力时停止，不猜内部实现。
- Preset 保存成功但 records 刷新失败时，以 Preset 成功为提交点，保留新
  applied 状态并提供 records 重试，不回滚。
- 分页/虚拟排序依赖后端稳定排序合同，不注入隐藏 tie-breaker。
- Preset GET 对旧的非法/失效规则做安全清洗，PATCH 和 records 对客户端
  输入继续严格返回 400。
- 空值顺序、大小写、locale 和关系字段比较语义由 Make Data 定义，Skill
  要求按上游合同做集成测试，UI/Service 不重复实现。
- 达到五级后从表头添加新字段会显示上限错误；没有可排序字段时隐藏排序
  入口和表头菜单。
