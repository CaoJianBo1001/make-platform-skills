# 高级筛选固定面板布局规范

## 背景

uju_mdm 项目中的高级筛选弹层把条件组、顶部标题、清空入口、底部新增和确认入口放在同一个滚动区域里，导致条件较多时头部和尾部操作不可见。BizFinancePoc 项目中的高级筛选已经形成更稳定的三段式布局：顶部固定区域、条件滚动区域、底部固定区域。

## 本次调整

- 更新 `skills/make-app-filter/SKILL.md`，把 BizFinancePoc 高级筛选固定面板布局写成强制规则和交付阻断条件。
- 更新 `skills/make-app-filter/references/ui-style.md`，明确顶部固定区域左侧为 `筛选`、右侧为 `清空所有`，中间条件区为唯一滚动区域，底部固定区域左侧为 `+ 添加条件` 和 `+ 添加条件组`、右侧为 `确认`。
- 更新 `skills/make-app-filter/references/testing-and-pitfalls.md`，补充固定头部、固定底部、条件区滚动和全弹层滚动回归的检查项。
- 更新 `skills/makeui/SKILL.md`，明确高级筛选三段式固定面板布局归 `make-app-filter` 负责，`makeui` 不生成自定义高级筛选面板。
- 新增 `scripts/test-make-filter-panel-layout-contract.mjs`，用静态契约测试锁定高级筛选固定面板布局要求。
- Review 后修复滚动职责说明：包负责 `AdvancedFilterPanel` 的 header/body/footer 结构，宿主 CSS 负责外层 `overflow: hidden` 和 `.advanced-filter__body { overflow-y: auto; }`。
- Review 后将高级筛选包最低版本统一为 `@qfei-design/make-filter@^0.2.2`，避免继续按未验证的旧版本生成固定面板布局。

## 验证

- 2026-06-24 17:46 CST：先运行新增契约测试，确认旧文档因缺少 BizFinancePoc 固定布局基线而失败。
- 修改后已运行新增高级筛选面板布局契约测试、现有字段类型/单元格编辑契约测试和 `git diff --check`，均通过。
- `quick_validate.py` 需要 `PyYAML`；本机和 bundled Python 默认缺少该依赖，已临时安装到临时依赖目录后校验 `skills/make-app-filter` 和 `skills/makeui`，均通过。
- 2026-06-25 CST：review 后扩展契约测试，新增宿主 CSS 滚动责任和 `@qfei-design/make-filter@^0.2.2` 版本基线检查，修复后相关测试通过。

## 边界

- 本次只修改高级筛选相关 skill、makeui 边界说明和测试脚本。
- 本次不修改 uju_mdm 或 BizFinancePoc 业务项目代码。
