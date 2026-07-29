# makeui 新增 shadcn/ui 组件库候选

## 2026-05-25

- 在 `skills/makeui/references/component-usage.md` 中，将新项目组件库候选从 Ant Design、Arco Design、TDesign 扩展为 Ant Design、Arco Design、TDesign、shadcn/ui。
- 保留 Ant Design 作为推荐项，但仍然要求用户明确选择，不能自动替用户决定组件库。
- 明确 shadcn/ui 是源码型组件系统，不是传统预构建 UI 包；选择后需要先按 Vite 项目接入 Tailwind、`@/*` alias 和 shadcn CLI。
- 补充 shadcn/ui 默认组件映射：`Button`、`Input`、`Sheet`、`Form`、`Popover`、`Alert`、`Skeleton`、`Avatar`、`DropdownMenu` 等按需添加。
- 在 `skills/makeui/references/principles.md` 中同步更新组件库选择规则。

## 验证

- 已执行：`quick_validate.py skills/makeui` 通过。
- 已执行：`git diff --check` 通过。
- 已执行：同步到用户级 `skills-makeui` skill 目录后，对 `component-usage.md` 和 `principles.md` 执行 `cmp`，结果一致。
