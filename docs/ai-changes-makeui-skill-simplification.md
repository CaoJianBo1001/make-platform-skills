# makeui skill 结构精简

## 2026-05-25

- 将 `skills/makeui` 修订标识更新为 `0.3.24`。
- 精简根 `SKILL.md`：删除重复的 `Common gotchas`、`Pre-flight workflow`、`Required references` 和长 `Core defaults` 展开，保留 Quick start、Topic reference map、Hard rules 和 Out of scope。
- 将根文件从 288 行压缩到约 80 行，避免同一规则在根文件中反复出现。
- 保留最近新增的关键边界：运行时禁止读取 DSL、Service 端口固定 `3000`、表格/表单从 schema API 获取、人员/部门走候选接口、默认对象管理布局、导航/头部无副标题、刷新在表格上方工具栏。
- 将根文件中原有的 schema 身份规则迁入 `references/principles.md`：`entity.key` / `entity.name`、`field.key` / `field.name`、Lookup relation 与 `qfei_relation` 写入约定。
- 修正 `references/principles.md` 的章节归属，将 workspace、构建产物、Service 配置、端口和环境变量边界统一放入 `Project runtime baseline`，Node 版本规则单独归入 `Node runtime`。

## 验证

- 已执行：`quick_validate.py skills/makeui` 通过。
- 已执行：`git diff --check` 通过。
- 已执行：reference 断链检查通过，超过 100 行的 reference 均有 Contents。
- 已执行：同步到用户级 `skills-makeui` skill 目录后，对 `SKILL.md` 和本次改动的 reference 文件执行 `cmp`，结果一致。
