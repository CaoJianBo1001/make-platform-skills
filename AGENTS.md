# make-platform-skills - Make 平台的 Agent Skill 内容仓库
Markdown + Node.js 原生脚本 + GitHub Actions

```text
README.md           安装、发布通道、Skill 路由与使用说明
skills/             各 Skill 的 SKILL.md、references、scripts 与 Agent 元数据
scripts/            仓库级 metadata lint、契约测试和维护脚本
.github/workflows/  push / PR 的验证入口
LICENSE             仓库许可证
```

Skill 内容以本仓库为单一真相源；makecli 通过 npx 分发，构建时另行嵌入固定快照。
发布通道复用 makecli 的 settings.channel：stable → main，beta → beta；安装、更新与远端检查使用相同分支，角色只决定范围。
候选修改先进入 beta，完成静态检查与实际任务验证后合入 main。通道切换覆盖同名 Skill，目标分支缺失的旧条目由用户显式卸载。

修改 Skill 后运行 `node scripts/lint-skill-metadata.mjs` 及 `.github/workflows/skill-metadata-lint.yml` 中的契约测试；规则与可观测结果保持一致。

2026-10-20：建立 main/beta 发布约定，README 补充配置、覆盖安装和 npx 分支来源。

2026-10-23：修正业务字段编辑权限为 data.field.update，同步权限审计与批量编辑契约，增加 UI 提交与 Service 拒写验证。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
