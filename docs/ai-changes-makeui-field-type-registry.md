# MakeUI 字段类型映射表规范

## 背景

新生成的 Make POC 项目虽然使用了 `@qfei-design/canvas-table`，但表格列没有稳定按 Make 字段类型展示。Make 字段类型和接口返回值形态本身是固定合同，不能在每个表格、详情、表单、筛选或编辑模块里各自写一套字段类型判断，否则容易退化成普通字符串展示。

## 调整

- `skills/makeui/SKILL.md` 将 MakeUI revision 更新为 `0.3.42`，并要求新 Make POC UI 在 `apps/ui/src/lib/make-field-types.ts` 或宿主等价文件维护统一字段类型 registry。
- `skills/makeui/references/component-structure.md` 在默认 `apps/ui/src` 结构中加入 `lib/make-field-types.ts` 和 `lib/make-field-display.ts`，明确 registry 是表单、详情、CanvasTable、筛选和单元格编辑的共享来源。
- `skills/makeui/references/component-usage.md` 明确字段驱动 UI 必须从统一 registry 读取 `Make.Field.*` 语义，禁止各模块重复维护本地映射。
- `skills/canvas-table-integration/SKILL.md` 和 `references/make-field-display-patterns.md` 强化 Track C：新 Make schema 表格必须从共享 registry 派生 `displayGroup`、`renderKind`、默认列宽、对齐、多值属性和 UI 能力提示，再构建 CanvasTable 列和 renderer。
- `skills/canvas-table-integration/references/track-workflows.md` 增加 Track C 工作流和 checklist：先建 registry，再做 schema 归一化、列配置、值适配和 canvas renderer。
- 新增仓库级 `scripts/test-field-type-registry-contract.mjs`，用静态合同测试覆盖 registry 路径、CanvasTable 列元数据和 18 种 Make 字段类型；该脚本校验 `makeui` 与 `canvas-table-integration` 的组合合同，可选接收 repo root 参数。

## 边界

- 本次只修改 skill 规范和测试，不修改具体业务应用代码。
- `makeui` 负责 `apps/ui` 结构和字段类型 registry 的消费边界；CanvasTable 的具体渲染接入仍归 `canvas-table-integration`。
- 字段类型 registry 不负责接口设计、数据持久化、认证或发布运行时。

## Review 修复

- 将字段类型 registry 合同测试移动到仓库级 `scripts/test-field-type-registry-contract.mjs`，避免 `canvas-table-integration` skill 内部脚本依赖兄弟 skill 的固定目录结构。
- 为新增合同测试脚本补齐 shebang 和可执行权限，并支持显式 repo root 参数，便于从任意工作目录执行。
- 压缩 `skills/canvas-table-integration/SKILL.md` 主说明，将详细 Track A/Track B 内容下沉到参考文档，保证主入口符合渐进披露长度约束。
- 补充 `skills/canvas-table-integration/agents/openai.yaml`，保持共享 skill 的 agent 元数据结构与 `makeui`、`make-app-filter` 一致。
