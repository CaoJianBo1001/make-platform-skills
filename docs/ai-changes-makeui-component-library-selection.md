# makeui 组件库替换为 shadcn/ui

## 需求

将 Make UI 相关 skill 的组件库默认与示例全部替换为 `shadcn/ui`。替换时需要处理旧一体化组件库曾提供、但 shadcn/ui 不直接提供的高阶组件能力，不能因为缺少现成组件又引入其他 UI 组件库。

## 变更

- 更新 `skills/makeui/SKILL.md`，将版本提升到 `0.3.52`，明确新生成 Make UI 默认使用 `shadcn/ui`，新建/编辑/详情默认使用右侧 `Sheet side="right"`。
- 更新 `skills/makeui/references/component-usage.md`，去除新项目组件库候选选择流程，改为 shadcn/ui 默认组件系统，并按官方 Vite 安装路径要求 Tailwind CSS、`@tailwindcss/vite`、`@/*` alias、`components.json`、package runner 形式的 `shadcn@latest init/add`、`src/components/ui` 和 `lucide-react`。
- 新增 shadcn/ui 缺口处理策略：日期/日期范围用 `Popover` + `Calendar` 组合，本地 `DateField` / `DateRangeField` 受控适配；远程搜索、多选、人员、部门、Lookup 用 `Popover` + `Command` 与本地受控适配；数字用 shadcn `Input` 或本地 `NumberInput`；附件用本地 `Attachment` 展示与 native input/dropzone 上传管理。
- 明确 Make 记录列表继续走 `@qfei-design/canvas-table`，shadcn/ui `Table` 或 Data Table recipe 不能替代 Make 记录表格。
- 更新 `drawer-layout.md`、`principles.md`、`styling-and-responsive.md`，把默认样式体系调整为 shadcn/ui + Tailwind CSS，去除旧组件库选择和 Less 默认候选。
- 更新 `make-app-filter`、`make-app-group`、`make-app-sort` 相关引用，包内面板可见控件通过 shadcn/ui 组件适配合同传入；如果共享包只暴露旧 visual adapter 且没有中立 `components` prop，则作为包能力阻断，先升级或修包，不能为了面板重新引入旧 UI 库。
- 更新 `canvas-table-integration` 编辑器文档，单元格编辑器默认映射为 shadcn/ui `Input`、`Textarea`、`Select`、Date Picker 组合、Combobox 组合，以及本地附件/数字/日期范围适配器。
- 更新 README 总览中的高级筛选说明，避免安装入口继续指向旧 adapter。
- 新增仓库级 `scripts/test-shadcn-ui-library-contract.mjs`，覆盖筛选、分组、CanvasTable 编辑和 README 的 shadcn/ui 替换合同。

## 验证

- `node skills/makeui/scripts/test-component-library-contract.mjs`
- `node scripts/test-shadcn-ui-library-contract.mjs`
- `node skills/makeui/scripts/test-component-structure-contract.mjs`
- `node skills/makeui/scripts/test-current-user-contract.mjs`
- `node scripts/test-cell-edit-standards-contract.mjs`
- `node scripts/test-make-app-sort-contract.mjs`
- `/tmp/codex-skill-validate-makeui/bin/python /Users/caojianbo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/makeui`
- `/tmp/codex-skill-validate-makeui/bin/python /Users/caojianbo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/canvas-table-integration`
- `/tmp/codex-skill-validate-makeui/bin/python /Users/caojianbo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/make-app-sort`
- `git diff --check`
- 使用文本检查确认旧组件库名、旧 adapter 包名、旧 `layout="vertical"` / `colon={false}` / `` `Drawer` on the right `` 表述未在活跃 skill 文档和 README 中残留。

## 2026-08-03 补充修复

- 将 create/edit/detail 默认实现从库无关右侧面板进一步收敛为 shadcn/ui `Sheet side="right"`，仅在堆叠、全屏或 mask 行为超出 stock `Sheet` 能力时使用项目本地 `SidePanel` wrapper。
- 将高级筛选示例从旧 `Popover` API 改为 shadcn/ui `PopoverTrigger` / `PopoverContent` 组合。
- 将认证审计测试中的旧主题 token 夹具改为 shadcn/Tailwind 风格夹具，避免文本检查误判。
- 修正 shadcn CLI 安装说明，明确通过 `pnpm dlx`、`npx` 等 package runner 执行 `shadcn@latest init/add`，避免生成不可直接执行的裸命令。
- 扩展仓库级 shadcn/ui 契约测试，将 `make-app-sort` 的 UI 文档纳入扫描，并要求排序面板通过 shadcn 组件适配器和 `components` prop 接入。
- 迁移 CanvasTable 单元格编辑器漏扫引用：`field-editor-patterns.md`、`track-workflows.md`、`edit-common-pitfalls.md`、`edit-host-architecture.md` 和 `make-cell-edit-defaults.md` 统一改为 shadcn/ui primitives、项目本地受控适配器和合格业务控件。
- 更新 `test-cell-edit-standards-contract.mjs` 和仓库级 `test-shadcn-ui-library-contract.mjs`，覆盖 CanvasTable 编辑器活跃引用，阻止 `host InputNumber`、`host DatePicker`、`host Select`、`Form.Item` 等旧组件库口径回流。
- 修正 CanvasTable 顶层边界和附件编辑器规则，避免继续优先复用“当前组件系统”；附件编辑默认走项目本地 shadcn-compatible `Attachment` adapter，业务上传控件只有满足 CanvasTable editor contract 时才能复用。
- 补强 `test-shadcn-ui-library-contract.mjs`，禁止 `existing/current component system` 旧决策口径，并要求 CanvasTable 顶层与附件编辑器文档正向说明 shadcn primitives、项目本地适配器或合格业务控件边界。
