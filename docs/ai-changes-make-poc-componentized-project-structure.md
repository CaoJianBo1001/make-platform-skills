# Make POC UI 和 Service 组件化目录规范

## 背景

新生成的 POC 项目中，`apps/ui` 和 `apps/service` 如果只把文件平铺在 `src` 下，会导致路由、组件、数据加载、Make 适配、业务编排和工具函数边界不清，后续维护、测试和扩展成本都会上升。现有 skill 虽然已经提到组件化和 Service 分层，但对新 POC 的默认目录结构约束还不够强。

## 本次调整

- 强化 `skills/makeui/SKILL.md`：
  - 将 revision 更新为 `0.3.40`。
  - 明确新 Make 应用 UI 默认采用分层目录：`pages`、`components`、`hooks`、`lib/service-api`、`router`、`types`。
  - 对复杂表格或工作流组件，要求继续拆出 `config`、`editing`、`editors`、`hooks`、`renderers`、`types` 等子模块。
  - 明确新生成 POC、明确模块化重构，或本次改动新增混合职责时，平铺 `apps/ui/src` 或单个 `App.tsx`/路由文件承载所有逻辑属于未完成状态，交付前必须拆分；小型无关修改不强制触发全量重构。

- 强化 `skills/makeui/references/component-structure.md`：
  - 新增默认 UI 目录树。
  - 说明小改动例外不适用于新生成 POC、表格页、表单/详情工作流或已经单文件堆逻辑的文件。

- 强化 `skills/make-app-service/SKILL.md`：
  - frontmatter description 增加 Service 分层、`make-client`、`services`、`utils` 等触发词。
  - 明确新 Make 应用 Service 默认采用分层目录：`app.ts`、`server.ts`、`config.ts`、`logger.ts`、`make-client/`、`services/`、`utils/` 和就近测试。
  - 明确新生成 POC、明确分层重构，或本次改动新增混合职责时，平铺 `apps/service/src` 且混合路由、Make 请求构造、schema 归一化、lookup/file 编排、配置和工具函数属于未完成状态；小型无关修改不强制触发全量重构。
  - 路由层只允许做输入校验、委派、错误映射、安全日志和响应发送。

- 强化 `skills/make-app-service/references/service-layering.md` 与 `testing-and-safety.md`：
  - 补充分层 Service 目录树。
  - 在完成前安全清单中加入“不得平铺 Service src”“路由必须保持薄层”“Make 请求构造和业务编排必须进入 adapter/service/helper”的检查项。

## 影响范围

- 本次只修改 skill 规范和 AI 变更记录。
- 不修改业务应用代码。
- 规则默认面向 Make App 的 `apps/ui` 和 `apps/service`，不扩展到 DSL、发布运行时或其他目录。

## 验证

- 搜索确认 MakeUI 主 skill 能命中 `componentized source tree`、`flat apps/ui/src`、`readiness defect` 等规则。
- 搜索确认 make-app-service 主 skill 能命中 `layered, componentized source structure`、`flat apps/service/src`、`make-client/`、`services/`、`utils/` 等规则。
- 检查 reference 文档和安全清单已补充，不再只是主 skill 中的孤立说明。
