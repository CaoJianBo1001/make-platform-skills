# 验证与审计

先用行为测试固定请求合同，再实现接线。至少验证：

1. UI 普通业务请求同时发送 `traceparent` 和 `X-Log-Id`，且两个 trace-id 相等、非零。HTTP 成功及业务码失败都结束本次 Span，并记录实际 HTTP 状态码；使用只返回业务数据的认证 SDK 时覆盖非 200 的 2xx 响应。网络异常不虚构状态码。
2. HTTP 非 2xx、网络异常和 HTTP 2xx 业务码异常的分类与卡片展示。网络异常保留本地生成的 ID；业务码异常不展示 ID。全局出口、页面内嵌出口和关闭/复制行为按实际使用方式验证。
3. Service-fronted App 校验非法、全零、冲突 Header，缺失时生成 ID；成功与失败响应都返回 `X-Log-Id`；Make Gateway 收到相同的安全 ID 和匹配的有效 `traceparent`，冲突或缺失时重新生成下游 parent span；日志包含该 ID 且没有敏感上下文。
4. 启用 AI 时，JSON、SSE、文件和二进制 transport 使用 Header。AI HTTP 非 2xx 在有响应体和无响应体时都把 Span 标记为错误并记录状态码；异常断流、取消及重连按 `make-ai-assistant` 语义收束，不用 URL query 传追踪信息。

静态审计可运行：

```bash
node skills/make-app-observability/scripts/audit-trace-contract.mjs <project-root> --mode auto
```

`auto` 依据 Service 源码目录区分直连或 Service-fronted；拓扑已知时可显式传 `--mode direct` 或 `--mode service-fronted`。审计检查包依赖、样式与组件公开入口、UI 成对 Header、旧 query 做法、Service 响应与网关传递，以及 AI 字面量 URL 直写 `fetch` 时遗漏 Header 的明显问题。Service 响应检查识别 `res`、`response`、`reply` 及它们明确赋值的别名；其他框架的响应写法应在项目本地扩展审计器并补正反向用例，不能只改业务代码迎合关键词。AI transport 若复用跨文件的共享适配器，不要求在每个调用文件重复写 Header；应以行为测试证明实际请求携带匹配的两个 Header。静态审计不能证明所有动态分支、日志脱敏、真实 Gateway 行为或集中式导出；这些必须靠项目测试和环境联调验证。

新 App 将审计器复制或包装进项目本地 `scripts/`，以 `trace:audit` 接入项目 `verify:publish`。复制后保留审计测试，并在项目中增加真实请求的行为测试。存量 App 在本次接入 Trace 时使用既有包管理器和发布命令，纳入等价门禁；不要为 Trace 接入单独迁移运行时。审计失败时先修复接线，不能只添加关键词或空组件让检查通过。
