# Make App 字段可新建权限链路历史决策

> 状态：历史实施记录，不是规范或可执行合同。当前唯一真值为 `skills/make-app-permission/SKILL.md` 及其直接引用的 `references/`；测试、审计和实现不得从本文件读取规则。

## 决策摘要

- 不新增与 `make-app-permission` 并列的“可新建” Skill；`creatable` 是单应用权限体系中独立于可见、可编辑的字段维度。
- `make-app-permission` 负责权限语义和端到端约束，`make-app-service` 负责 Service/Schema 边界，`makeui` 负责表单与页面交互表现。
- 新建字段以上游 `createFields` 为结构上界，并与 `data.record.create` 的字段权限、UI 字段能力取交集；缺失时为空，不回退到 `fields`。
- 列表与详情继续使用 `fields + meta.field.read`；编辑继续使用可见 `fields + meta.field.update`，不消费 `editableFields`。
- 提交时必须基于最新权限和 Schema 重建白名单；权限刷新必须同时刷新或失效权限裁剪后的 Schema，并拒绝旧代响应回写。
- 系统字段按精确类型/key 判断；Lookup/Relation、File、required、通配、deny、资源具体度和畸形 IAM 输入均纳入专项合同与测试。

## 当时的改造范围

- 主 Skill：`skills/make-app-permission/`
- 关联 Skill：`skills/make-app-service/`、`skills/makeui/`
- 可执行验证：权限一致性套件、静态审计、自测试、宿主测试/构建和独立前向测试。
- 参考宿主：`expensePoc`、`bizFinancePoc`。

## 当前入口

- 核心工作流：`skills/make-app-permission/SKILL.md`
- 权限、资源与 Schema 语义：`skills/make-app-permission/references/permission-boundaries.md`
- Service/IAM 边界：`skills/make-app-permission/references/service-principal-permission.md`
- UI 运行链路：`skills/make-app-permission/references/ui-permission-runtime.md`
- 系统字段规则：`skills/make-app-permission/references/system-field-contract.md`
- 测试与审计：`skills/make-app-permission/references/testing-and-audit.md`
- 当前改动记录：`docs/ai-changes-make-app-creatable-permission-skill.md`
- 当前独立验证：`docs/make-app-permission-forward-test.md`

## 维护规则

本文件只记录“为什么这样拆分”的历史背景，不复制现行权限规则、测试矩阵或实现步骤。后续语义调整只修改对应 Skill/reference、测试和 AI 变更记录。
