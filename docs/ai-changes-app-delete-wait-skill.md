# makecli App 删除等待说明

## 2026-10-21：同步异步删除命令
- 摘要：将 makecli skill 的删除参数从 `--env` 更新为必填的 `--appRole beta|prod|all`。
- 涉及：`skills/makecli/SKILL.md`、`skills/makecli/references/cli-reference.md`。
- 决策：写明等待最终结果、30 分钟默认超时、退出码、重跑接续和 `all` 的 Beta→Prod 顺序；`--context` 仍只选后端。
- 验证：对照 makecli `app delete --help`，运行 skill 校验及仓库契约测试。
