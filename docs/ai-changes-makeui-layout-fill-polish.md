# makeui 侧栏激活态与表格填充布局规范

## 2026-05-25

- 针对新 Poc 中出现的布局细节问题，补充 makeui 默认布局验收规则。
- 明确左侧导航激活态背景必须居中在侧栏内容区域内，左右留白一致，不能用负 margin、绝对定位或硬编码偏移导致背景贴边或错位。
- 明确默认对象列表中的 CanvasTable 包裹层和宿主节点必须填满可用宽度与剩余高度。
- 明确表格高度应通过 flex 高度链动态填充；必须使用 `calc()` 时，应扣除真实 header、toolbar、padding、border 尺寸，不得使用猜测固定值。
- 明确 schema 字段列宽小于页面宽度时，应通过公开的 canvas-table 集成方式拉伸、分配剩余宽度或保留明确的弹性显示区域，不能让可见表格停在页面中间。

## 验证

- 已执行：`quick_validate.py skills/makeui` 通过。
- 已执行：`git diff --check` 通过。
- 已执行：同步到用户级 `skills-makeui` skill 目录后，对 `SKILL.md`、`app-shell-layout.md`、`list-page-layout.md`、`styling-and-responsive.md` 执行 `cmp`，结果一致。
