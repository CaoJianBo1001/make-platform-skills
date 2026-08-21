# 通用经验回填 Make skills

## 背景

复盘通用变更后，以下经验需要回填到 `makeui` 和 `canvas-table-integration`：

- Service 型项目改 UI 本地端口时，要同步 Vite、Service CORS、环境示例、API 文档和测试。
- Lookup 值打开关联详情需要使用抽屉栈，并防止异步响应重新打开已关闭来源抽屉。
- canvas-table 表头 `suffixRender` 打开宿主弹窗时，需要处理 active 显示、横向滚动定位、滚动关闭和 header-only 刷新。
- Make FileField 服务适配里，宿主路由可叫 `fieldKey`，但 Make `/data/v1/file` 请求体字段名应为 `field`。
- 人员/部门字段编辑需要兼容 `recordID/name` 与 `userId/userName`、`departmentId/departmentName` 两类值形态。

## 变更

- `skills/makeui/SKILL.md` 升级到 `0.3.16`，新增 Service 型本地开发端口联动规则，并补充 Lookup 关联详情抽屉栈规则。
- `skills/makeui/references/drawer-layout.md` 补充 Lookup 关联详情打开、关闭、动作绑定和异步防陈旧规则。
- `skills/makeui/references/principles.md` 补充 Service 型项目本地端口变更的联动范围。
- `skills/canvas-table-integration/references/column-patterns.md` 补充表头 `suffixRender` 宿主弹窗集成规则。
- `skills/canvas-table-integration/references/attachment-editor-patterns.md` 补充 Make FileField `field` 参数规则和验证项。
- `skills/canvas-table-integration/references/field-editor-patterns.md` 补充人员/部门字段编辑值归一化规则。
- `skills/canvas-table-integration/references/make-field-display-patterns.md` 和 `shape-render-patterns.md` 补充 Lookup 引用可点击边界。
- 复查后收紧 FileField 表述：`fieldKey` 只保留在宿主 Service 边界，转发 Make `/data/v1/file` 时映射为 `field`，不把 `fieldKey` 透传到 Make payload。

## 验证

- 使用 `rg` 检查关键规则已写入源目录和安装版 skill。
- 使用 `cmp` 校验同步后的安装版文件与源文件一致。
- 使用 `git diff --check` 检查格式。
