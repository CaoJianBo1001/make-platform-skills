# 验证与审计

先用行为测试固定请求合同，再实现接线。至少验证：

1. UI 普通业务请求同时发送 `traceparent` 和 `X-Log-Id`，且两个 trace-id 相等、非零。HTTP 成功及业务码失败都结束本次 Span，并记录实际 HTTP 状态码；使用只返回业务数据的认证 SDK 时覆盖非 200 的 2xx 响应。网络异常不虚构状态码。
2. HTTP 非 2xx、网络异常和 HTTP 2xx 业务码异常的分类与卡片展示。三类请求失败只要有合法 ID 均可展示并复制；网络异常保留本地生成的 ID。全局出口、页面内嵌出口和关闭/复制行为按实际使用方式验证。
3. 在真实应用根节点与 AppShell 组合下用浏览器测试桌面全局错误出口，覆盖固定 `100vh + overflow: hidden` 布局：错误卡片及其 Trace ID 必须位于可见区域，且未被祖先容器裁切或遮挡，关闭和复制可操作。覆盖权限请求首次加载失败、Schema 加载失败；即使页面路由或 Shell 尚未挂载，全局错误出口仍须存在并显示卡片。确认 Provider 将 `kind/status/title/description/traceId` 保留到卡片；若页面文案提到 Trace ID，必须断言卡片实际收到并显示可见的有效 ID。
4. Service-fronted App 校验非法、全零、冲突 Header，缺失时生成 ID；成功与失败响应都返回 `X-Log-Id`；Make Gateway 收到相同的安全 ID 和匹配的有效 `traceparent`，冲突或缺失时重新生成下游 parent span；日志包含该 ID 且没有敏感上下文。
5. 启用 AI 时，JSON、SSE、文件和二进制 transport 使用 Header。AI HTTP 非 2xx 在有响应体和无响应体时都把 Span 标记为错误并记录状态码；异常断流、取消及重连按 `make-ai-assistant` 语义收束，不用 URL query 传追踪信息。

静态审计可运行：

```bash
node skills/make-app-observability/scripts/audit-trace-contract.mjs <project-root> --mode auto
```

`auto` 依据 Service 源码目录区分直连或 Service-fronted；拓扑已知时可显式传 `--mode direct` 或 `--mode service-fronted`。审计检查包版本、样式与组件公开入口、UI 成对 Header、旧 query 做法、Service 响应与网关传递，以及 AI 字面量 URL 直写 `fetch` 时遗漏 Header 的明显问题。Service 响应检查识别 `res`、`response`、`reply` 及它们明确赋值的别名；其他框架的响应写法应在项目本地扩展审计器并补正反向用例，不能只改业务代码迎合关键词。AI transport 若复用跨文件的共享适配器，不要求在每个调用文件重复写 Header；应以行为测试证明实际请求携带匹配的两个 Header。静态审计不能证明卡片在真实 AppShell 中可见，也不能证明 Provider 保留了结构化错误或页面文案与可见 Trace ID 一致；这些必须靠项目的浏览器与行为测试验证。其他动态分支、日志脱敏、真实 Gateway 行为及集中式导出也须通过项目测试和环境联调验证。

新 App 将审计器复制或包装进项目本地 `scripts/`，以 `trace:audit` 接入项目 `verify:publish`。复制后保留审计测试，并在项目中增加真实请求及真实 AppShell 错误可见性的行为测试，将这些测试纳入发布门禁。存量 App 在本次接入 Trace 时使用既有包管理器和发布命令，纳入等价门禁；不要为 Trace 接入单独迁移运行时。审计失败时先修复接线，不能只添加关键词或空组件让检查通过。审计通过但缺少上述可见性测试，不得声称错误出口已验收。
