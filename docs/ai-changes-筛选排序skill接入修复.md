# 筛选排序 Skill 接入修复

## 需求

根据筛选包和排序包的通用接入实践，修正 Make 平台技能中的包版本、职责边界、持久化时序和异常状态规范。

## 修改

- 筛选统一使用 `@qfei-design/make-app-filter@^1.0.0`，移除旧包名和旧版本基线。
- 排序统一使用 `@qfei-design/make-app-sort@^0.1.0`，禁止宿主复制排序模型、面板、样式或 dnd-kit 实现。
- 明确排序包使用 `onConfirm` 持久化、同步 `onApplied` 更新应用态、`onApplyError` 上报应用失败，并传入权限感知、单调变化且引用稳定的访问上下文 generation token 作为 `resetKey`。
- 筛选宿主持久化与 records 重载解耦，records 由已应用状态驱动。
- 筛选和排序都增加 `A -> B -> A` 单调请求代次约束。
- 增加并发稀疏保存的 saving 状态约束，避免 filter/sort 请求互相提前解锁。
- 增加 Lookup 完整运行时 schema 解析、unsupported CEL 后端继续生效和可见提示要求。
- 保持未来 `group` 为独立第二阶段，并要求 Preset 稀疏更新保留兄弟维度。

## 验证

- 更新并运行筛选合同脚本。
- 更新并运行排序合同脚本。
- 使用技能机械审查、差异检查和相关仓库测试确认结构与内容。

## 排序 Skill 完整性修复

- 明确 npm 包 helper 只负责 UI 模型、草稿和容错水合；Service 对 PATCH 和
  records 原始输入必须使用严格 transport parser，禁止用
  `sanitizeRecordSort` 静默修复非法客户端数据。
- Preset 上下文增加 permission-enabled 状态和单调 generation；对象或权限
  变化都会刷新稳定的 controller `resetKey` token，并让旧请求失效。
- 权限关闭后阻止新的 Schema/Preset/records 请求；已发出的旧保存结果不得更新
  当前页面，恢复访问后重新读取 Preset。
- 共享 Preset 生命周期通过请求 ID 集合或等价计数管理并发 filter/sort 保存；
  一个成功请求不得提前结束另一个请求的 saving，也不得清除其错误。
- 删除消费者 Skill 中 npm 包内部 dnd-kit API 配方，只保留宿主可观察验收行为。
- 合并重复的包边界、保存时序、分组和回归说明；主 Skill 从 136 行压缩到
  103 行，完整 Skill 在新增安全规则后由 856 行压缩到 790 行。
- 契约测试新增 Service 严格解析、并发稀疏保存、权限失效和消费者/包维护边界
  断言。

## 排序 Skill 平台通用性修复

- Skill 版本升级到 `0.1.3`。
- 删除 `Claim` 等具体业务实体名。
- 将 `createdAt`、`updatedAt`、`priority` 等具体字段示例统一替换为
  `<sortableFieldKey>`、`<primarySortableFieldKey>` 等语义占位符。
- 将具体筛选表达式替换为 `<filterExpression>`；排序 Skill 不提供可被复制的
  业务条件。
- 契约测试禁止 Skill 正文和 references 出现已知项目名、本地路径、具体
  `entityKey`、具体 `fieldKey` 和业务筛选表达式。
- 项目名称只保留在 `docs/ai-changes-*.md` 的需求来源记录中，不进入 AI 实际
  加载的 `skills/make-app-sort`。

## 平台 Skill 提交前复审修复

- `make-app-filter` 升级到 `0.1.5`，增加 `make-app-permission` 协作边界，
  Preset 请求上下文统一为 `{ enabled, entityKey, generation }`。
- 权限关闭后禁止新的 Schema/Preset GET、Preset PATCH 和 records 请求；
  已发出的旧请求不得更新当前页面，恢复权限后重新读取 Preset。
- 筛选宿主示例改为稳定 generation 的 keyed remount，并通过 layout-effect
  cleanup 和请求 ID 阻止卸载后的旧异步结果生效；禁止在 React render 阶段
  修改请求代次或 saving ref。
- 筛选面板的本地防重复提交与共享 Preset pending 状态分离；共享协调器使用
  请求 ID 集合或等价结构管理并发 filter/sort 保存，每个请求只清理自己的状态。
- 筛选宿主示例区分 `onPersistError` 与 `onApplyError`，避免 Preset 已保存后把
  应用态回调异常误报为保存失败。
- 首次 Preset 读取失败在请求结束后进入明确的空回退；同上下文重新读取失败时
  保留 last-known-good 应用态，避免 records 永久等待。
- 从 `canvas-table-integration`、`make-app-filter`、`make-app-service`、
  `make-app-sort`、`makeui` 和 README 中删除具体项目名称，保留行为型平台规范。
- 筛选示例中的业务字段和值改为 `<filterExpression>` 语义占位符。
- 新增平台 Skill 通用性契约测试，并加强筛选权限生命周期、React 并发安全和
  README `resetKey` 一致性检查。
- README 的筛选、排序及组合路由显式包含 `make-app-permission`，避免入口说明
  绕过权限感知的 Preset 生命周期。
