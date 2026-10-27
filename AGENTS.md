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

2026-10-23：beta 候选中的业务字段编辑指导存在错误，已由 2026-10-26 的 Make App 权限合同纠正取代。

2026-10-23：将审批导航与业务字段权限修复合并至 canvas/skill，保留分支现有 CLI 指导并执行合并验证。

2026-10-23：修复权限审计对未使用导航、同页未过滤菜单及同名回调参数的漏报，补充正反例；跨回调来源未证明时仍保留非零结果。

2026-10-23：明确审批列表非活动面板不参与布局，补充页签往返切换时筛选栏上方无额外占位的验收项。

2026-10-26：反馈接入推荐已发布0.1.10，包管理Toast计时，宿主使用稳定事件标识清理队列；保留存量锁版本并增加生命周期回归要求。

2026-10-26：按 Permission/Meta API 设计纠正 Make App 记录与字段授权，区分 Schema 与 principal 响应，更新审计、前端提交及 App Service 拒写回归。

2026-10-26：权限文档未定义或存在冲突时先向用户提出疑问，确认前不将推断写入 Skill；正文与示例只使用文档已注册的权限点。

2026-10-26：Make App 仅消费已配置的 data/meta 权限和权限过滤后的 Schema；已核对的权限点、响应及字段规则随 Skill 提供。Console 配置校验与权限后端聚合实现不属于本 Skill，不作为应用修改的阻塞项。

2026-10-27：清除未正式发布候选中的无效权限名称、专用检查与历史迁移说明；正文、示例、审计和回归仅保留真实 Make App 权限合同。

2026-10-27：多条适用的已返回允许结果不以数量撤销字段权限，保留后端返回的限制；补充顺序不变、UI 提交和 App Service 拒写回归。

2026-10-27：依据正式文档统一合法空字段 map 与未列字段的默认态，保留 Schema 上限；缺失整个字段 map 按响应不完整拒绝，不自动补空。补齐对应 UI 提交和 Service 原子拒写回归。

2026-10-27：发布的权限 Skill 使用随包本地合同，不依赖内部设计文档的地址或章节；新增可移植性回归，保留已确认的权限语义。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
