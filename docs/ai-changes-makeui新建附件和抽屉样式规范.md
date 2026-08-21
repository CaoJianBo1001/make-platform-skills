# makeui 新建附件和抽屉样式规范

## 变更内容

- makeui 版本更新到 `0.3.9`。
- 明确新建流程中如果附件上传依赖已保存记录的 `recordID`，不得渲染 `Make.Field.File` 上传控件，也不得把文件字段写入新建 payload。
- 明确附件字段的模式差异：新建时省略，编辑时仅在存在稳定记录 ID 后展示上传/删除控件，详情中展示已有附件。
- 强化新建/编辑 Drawer 样式规范：右侧 60% Drawer、顶部操作区、无默认 footer、浅色 Drawer body、轻量白色 form panel、两列 grid、长文本跨整行。
- 补充硬规则：新建、编辑、详情必须从右侧弹出；小屏可 `100%` 宽，但仍从右侧进入，不默认使用底部 Drawer/Sheet 或居中 Modal/Dialog。
- 强化详情 Drawer 样式规范：紧凑横向 label/value、两列详情 grid、长文本/附件/Lookup 跨整行、弱化标签、值区域安全换行，禁止未样式化列表。
- 同步 route-based create/edit 页面规则，避免独立新建页也误放附件上传。

## 行为说明

- 新建记录前没有 `recordID`，因此不能展示会产生真实上传行为的附件字段。
- 附件上传、删除等真实持久化动作必须由宿主 data-source 或 Service API adapter 处理，不能放在 makeui 的布局层或 canvas-table 渲染层。
- 编辑与详情 Drawer 应采用统一工作台模式：编辑强调表单分组，详情强调只读信息扫描，两者视觉相关但不混用。

## 验证

- 使用 `rg` 检查 makeui 中 `File`、附件、`recordID`、Drawer 样式相关规则，确认新建省略附件和编辑/详情样式规范已覆盖 `SKILL.md`、`drawer-layout.md`、`component-usage.md`、`principles.md`、`styling-and-responsive.md` 和 `page-route-layout.md`。
- 同步源目录到 `~/.agents/skills/skills-makeui` 后，再次检查安装版版本和关键规则。
