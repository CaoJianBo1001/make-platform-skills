# makeui 组件化拆分规范

## 背景

Make App 前端页面如果把路由、数据加载、字段适配、表格配置、表单映射、抽屉状态和渲染细节都写在一个文件里，后续维护和复用成本会快速上升。`makeui` 需要把组件化拆分和模块化边界作为明确规范。

## 调整

- `skills/makeui/SKILL.md` 新增 hard rule：生成或修改 `apps/ui` 时必须按职责进行组件化拆分和模块化组织。
- `skills/makeui/SKILL.md` frontmatter description 补充“组件化拆分”“模块化拆分”触发词，便于中文请求命中 `makeui`。
- 明确页面级文件只负责路由级编排、路由参数读取、模块组合和少量页面状态衔接。
- 明确禁止单文件堆逻辑：不能把数据请求、字段归一化、表格列配置、表单映射、抽屉状态、行操作和渲染细节全部写在一个页面组件里。
- 新增 `skills/makeui/references/component-structure.md`，补充推荐目录分层、路由页职责、feature 模块职责、表格页拆分要求和极小改动例外。
- `skills/makeui/SKILL.md` 的 topic reference map 新增组件结构 reference 入口。
- `skills/makeui/SKILL.md` revision 更新为 `0.3.36`。

## 2026-06-17 追加调整

- 将 MakeUI revision 更新为 `0.3.43`。
- 将组件化拆分升级为新 Make POC UI 和非平凡 UI 改动的 readiness blocker；未完成职责拆分时不得报告 ready、complete 或已交付。
- 明确 `App.tsx` 只能承担 providers、router mounting 和 app-level shell composition，不能承载数据加载、schema 归一化、表格列构建、表单/详情映射、Drawer 状态、行操作或字段展示渲染。
- `skills/makeui/references/component-structure.md` 新增组件化交付前 checklist，要求至少拆出 route/page、page shell、feature container、toolbar、CanvasTable host、table config、field display adapter、Drawer/form/detail、hooks 和 `lib/service-api`。
- 新增 `skills/makeui/scripts/test-component-structure-contract.mjs`，用静态合同测试防止组件化规则再次退化为软建议。

## 边界

- 本次只调整 `makeui` 的前端组件化和模块化规范。
- 不修改任何 Make App 业务代码。
- 不修改 `canvas-table-integration`、`make-app-auth`、`make-app-service`、`make-app-runtime`、`makecli`、`makedsl` 或 `make-integration`。
