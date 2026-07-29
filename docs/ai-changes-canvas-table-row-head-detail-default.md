# canvas-table 行头详情入口默认规则

## 2026-05-25

- 检查 `skills/canvas-table-integration` 后确认，原规则已经包含 Make record list 默认 `showSN` 行序号和 `bodyRowHeadSuffixOptions` 进入详情图标。
- 补充精确默认视觉：常态行头以序号为主，鼠标悬浮到行或键盘聚焦时显示进入详情图标，点击该图标打开详情 Drawer 或项目既有详情入口。
- 根据反馈将适用范围从 Make record list 提升为所有表格：只要接入 `CanvasTable`，默认启用 `showSN` 和 `bodyRowHeadSuffixOptions` 详情入口；除非用户明确说明该表格不需要详情入口。
- 同步更新 `makeui` 中的表格默认行为说明，避免 `makeui` 仍把该规则描述为仅 Make record list 默认。
- 明确该入口必须使用 `bodyRowHeadSuffixOptions`，不得为了放图标新增假的固定左侧业务列。
- 明确即使图标 hover 后才显示，也要预留稳定 suffix 宽度，避免首列数据抖动。

## 验证

- 已执行：`quick_validate.py skills/canvas-table-integration` 通过。
- 已执行：`git diff --check` 通过。
- 已执行：同步到用户级 `canvas-table-integration` skill 目录后，对 `SKILL.md`、`references/row-head-action-patterns.md`、`references/core-props-methods-events.md` 执行 `cmp`，结果一致。
