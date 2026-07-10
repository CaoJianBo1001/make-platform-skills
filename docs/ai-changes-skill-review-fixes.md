# skill review 问题修复

## 背景

根据本次 `$review-skills` 复查结果，当前 skill 集合还存在三类问题：`make-app-runtime` frontmatter 含非标准字段、部分共享 skill 缺少 `agents/openai.yaml`、CanvasTable 单元格编辑规范未明确拦截可见 helper/hint 文案和固定窄宽编辑器。

## 修改内容

- 删除 `skills/make-app-runtime/SKILL.md` frontmatter 中的 `metadata.homepage`，保持 frontmatter 只包含 `name` 和 `description`。
- 新增 `skills/make-app-runtime/agents/openai.yaml` 和 `skills/make-app-service/agents/openai.yaml`，补齐共享 skill 的 UI 元数据。
- 更新 `skills/canvas-table-integration/references/make-cell-edit-defaults.md`，明确禁止在单元格编辑器内显示 `0-5` 等 helper/hint/校验说明文案，并禁止将编辑器 clamp 成固定窄宽。
- 更新 `skills/canvas-table-integration/references/edit-common-pitfalls.md`，把可见提示文案和非全宽编辑器列为常见错误。
- 更新 `scripts/test-cell-edit-standards-contract.mjs`，用静态合同测试覆盖 helper/hint 禁令和 full-cell 尺寸禁令。
- 删除 `makecli`、`makedsl`、`make-integration` frontmatter 中的 `version` 和 `metadata` 非标准字段，并补充 description 职责边界，降低跨 skill 误触发风险。
- 新增 `makecli`、`makedsl`、`make-integration`、`make-app-auth` 的 `agents/openai.yaml`，补齐共享 skill 的 UI 元数据。
- 在 `makedsl` 中新增 reference map，直接链接 `DepartmentFieldDesign.md`、`EntityDataFilterUsage.md`、`FileFieldDesign.md`、`UserFieldDesign.md` 等引用文件，满足渐进披露可发现性要求。
- 保留 `make-app-auth/examples/service-fronted-node` 作为 Service-fronted 样例项目，并在 `SKILL.md` 中标明用途；该目录对应 review 的非阻断 Minor，不再为了消除 Minor 迁移样例路径。
- 为 `make-app-auth/scripts/test-audit-auth-contract.mjs` 补充执行权限，满足脚本可执行性建议。

## 验证

- 先更新合同测试并确认其在文档修复前失败。
- 待文档和元数据修复后，重新运行 review 和合同测试。

## 2026-07-10 三个前端 Skill 边界优化

### 修改内容

- 将 `canvas-table-integration` 调整为 Track A/Track C 展示基础加可叠加 Track B 编辑增强，明确 Make schema 可编辑表格必须使用 Track C + Track B。
- 将 CanvasTable 包文档发现改为动态读取 `package.ai.json.readOrder`，去除固定 `docs/`、`examples/` 和 monorepo 路径。
- 收紧宿主 `make-field-types.ts` 的职责，只负责表单、详情、CanvasTable 展示和宿主单元格编辑提示；高级筛选操作符、默认值、校验和值编辑器继续由 `@qfei-design/make-filter` 公共 API 决定。
- 将用户/部门候选接口的精确 UI 合同集中到 `makeui/references/component-usage.md`，CanvasTable 和高级筛选 Skill 只消费宿主候选源并交接到 `makeui` / `make-app-service`。
- 压缩 `canvas-table-integration/SKILL.md` 的重复 Track 描述和 `makeui` 的重复当前用户视觉说明，详细规则继续保留在直接可发现的引用文档中。
- 更新 Skill metadata：`canvas-table-integration` 为 `0.1.1`、`make-app-filter` 为 `0.1.2`、`makeui` 为 `0.3.47`。

### 防回归

- 更新 `test-field-type-registry-contract.mjs`，禁止宿主 registry 接管高级筛选语义，并确保候选接口精确合同只有一个所有者。
- 更新 `test-canvas-table-data-sync-contract.mjs`，校验动态 `readOrder`、Track C + Track B 组合规则，并禁止恢复固定包文档路径。

### 验证结果

- 8 个 CanvasTable、筛选、MakeUI 相关契约测试全部通过。
- 三个 Skill 的结构、frontmatter、引用和跨 Skill 机械检查通过。
- `git diff --check` 通过。
