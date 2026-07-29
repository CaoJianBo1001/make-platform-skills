# 平台 skill 个人信息脱敏

## 背景

平台级 skill 及其随仓库提交的变更记录不能暴露个人用户名、本机绝对路径或临时系统路径。Review 发现 Make Meta Schema 请求方法修复记录中包含本机绝对路径，需要脱敏并补充自动检查。

## 修改

- 将 `docs/ai-changes-make-meta-schema-post-method.md` 中的本机绝对路径改为不含用户名和工作区路径的后端资料相对描述。
- 检查其他 skill 相关变更记录，发现 5 处历史同步记录包含用户级绝对路径，已统一改为“用户级 skill 目录”描述。
- 发现 1 处历史验证记录包含本机临时依赖目录路径，已改为泛化描述。
- 扩展 `scripts/test-platform-skill-genericity-contract.mjs`，对平台 skill 文档、README、`docs` 下的 Markdown 记录和 `scripts` 下的脚本增加个人本机路径与系统临时路径泄漏检查。

## 验证

- 已通过 `node scripts/test-platform-skill-genericity-contract.mjs`。
- 已通过个人信息残留扫描。
