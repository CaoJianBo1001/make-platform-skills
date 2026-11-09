---
name: make-ai-assistant
description: "Use when integrating, upgrading, debugging, or reviewing @qfei-design/make-ai-assistant in a Make App: restricted Agent discovery, sessions, streaming, queue/stop/questions, file/image input, authenticated Service routes, and package-owned UI. Does not own Agent configuration, model behavior, generic dialogs, auth/permission policy, DSL, or deployment."
metadata:
  version: 0.4.1
---

# Make AI Assistant

本 Skill 面向 Make App 宿主。基线是正式 npm 包 **0.4.1** 与 Agent Public API v1（合同提交 `7ddbacac599b3fc6780fb7f01f2cf466731c2369`），Skill 版本与 npm 版本独立。旧的私有 Chat 协议不再作为新接入依据。

## 接入流程

1. 同批安装时优先读取本技能仓库/安装根下的关联技能；若本机旧副本仍指导旧私有协议，先报告版本差异并更新对应技能，不混用。确认当前 App、认证身份、包管理器、UI → Service → Gateway 调用链及平台侧 Agent/应用内渠道配置。保留存量运行时，不因接入助手迁移 Node、包管理器或登录。
2. 读 [包契约](references/package-integration.md)，在实际消费包的 UI、Service workspace 安装并锁定官方 `0.4.1`，核对公开导出与类型。未来升级需重新核对契约；不得仅提高版本号或照抄其他 App。
3. 读 [宿主接线](references/make-app-host-integration.md)，在认证后的稳定 Shell 挂载 `MakeAppAssistantEntry`。使用 `/agent` 的 `createAgentClient` 与 `AgentAuthenticatedTransport`；由包负责受限发现和内部 UI。宿主不再自行分页挑 Agent 或回退管理接口。
4. 先更新宿主 API 文档，再按 [Service 协议](references/make-app-protocol.md) 和 [操作清单](references/service-operations.json) 实现同源显式代理。完整 App 数据面为 23 项，另有 Agent Get/List 共 25 项组合；不是开放整个控制面。
5. 文件/图片或流式问题读 [流与附件](references/make-app-stream-and-attachments.md)，布局与手机入口读 [UI 边界](references/ui-and-templates.md)。只修负责该问题的一层，包内缺陷交由包修复，不在宿主复制状态机或 CSS。
6. 按 [验证与交付](references/testing-and-pitfalls.md) 做 TDD：行为测试先失败，最小实现，再整理。运行审计、宿主 UI/Service 测试、类型检查、构建和经授权的已登录 Dev 验收；分别报告合成验证与真实后端/模型结果。
7. 维护本 Skill 的协议或流程时，完成独立 fresh-agent forward test；缺少证据就明确记录，不能称为发布就绪。

从本 Skill 实际安装目录运行（路径可有中文与空格）：

```bash
node scripts/audit-make-ai-assistant-project.mjs "<project-root>" --expected-package-version=0.4.1
```

UI 审计通过消费 workspace 已安装的 TypeScript 分析公开导入绑定，支持命名别名及 namespace import，缺少解析器会明确失败；不安装全局解析器。只做静态预检，不能证明 25 项操作、身份隔离、流式恢复或模型识图正确。用真实安装包执行 `node scripts/verify-agent-package.mjs "<consumer-workspace>"` 核验受限发现请求及公开校验器；执行 `node scripts/verify-host-example.mjs "<consumer-workspace>"` 编译本文档宿主示例（workspace 需有 TypeScript）。这些检查不需要登录和远端写入。独立测试所需原始合同与离线准备命令见[验证与交付](references/testing-and-pitfalls.md)。

## 必须保持的边界

- 浏览器 `/api/make/app/agent/v1/**` → App Service → 已有 Make Gateway。SDK 默认是直接 Gateway 路径，Service-fronted App 必须显式设置 **包含 `/v1`** 的 `basePath`；不能沿用旧版自动追加版本的假设。
- `MakeAppAssistantEntry` 负责 `agents.list({view:"webchat"})`：0 个不展示，唯一入口打开，多个入口提示冲突；403、部署不可用、依赖失败保留错误，不伪装成无入口。入口不额外调用管理详情，不读 `agentType` 推断。
- App key、资源 ID、显示名各自使用。`context.app.id` 是真实 App ID；不能用 appKey、Agent ID 或显示名代替。Agent key 不等于资源 agentId。
- 宿主共享认证层提供有界的原始字节传输，保持 Cookie 会话、状态、响应头、AbortSignal。只设一个 retryOwner；multipart、SSE、下载不进入普通业务 JSON 解析器。Trace 通过 Header 传递。
- 普通路由切换和关闭助手保留 client；App/租户/用户切换释放旧 client，阻止迟到结果。关闭界面不停止服务端 Task；停止、排队、追加、回执恢复由包负责。
- 只使用公开 props、launcher 插槽、主题与 styles.css。包不支持的能力不要在宿主伪造；发现包问题记录版本、最小复现、影响与责任，不自行补丁或改 node_modules。
- [make-app-auth](../make-app-auth/SKILL.md) 负责登录与窄范围字节桥；[make-app-service](../make-app-service/SKILL.md) 负责路由/范围/安全错误；[make-app-permission](../make-app-permission/SKILL.md) 负责 App 授权；[make-app-observability](../make-app-observability/SKILL.md) 负责 Trace；[makeui](../makeui/SKILL.md) 负责外围 Shell；[make-app-runtime](../make-app-runtime/SKILL.md) 负责发布构建与 origin；[make-env-setup](../make-env-setup/SKILL.md) 负责安装技能；[makecli](../makecli/SKILL.md) 负责获授权的平台检查与发布。
