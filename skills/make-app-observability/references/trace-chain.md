# Trace ID 链路

## UI 请求边界

统一的已认证请求适配器为每次 Make 业务请求创建 W3C `traceparent`，格式为 `00-<32 位非零十六进制 trace-id>-<16 位非零十六进制 span-id>-<2 位 flags>`。`X-Log-ID` 使用同一个 trace-id。OpenTelemetry Client Span 是已验证的实现方式；如果宿主采用等价实现，须用测试证明格式、关联、结束语义和异常路径。

将 Header 注入 `make-app-auth` 的共享 `auth.api` 适配器，不在页面散落裸 `fetch`，不手写 `Authorization`。在发请求前保存本地 Trace ID；网络中断时没有响应 Header，错误出口仍能展示它。正常完成、HTTP 非 2xx、网络异常及 HTTP 2xx 业务码失败都要结束 Span，失败标记为错误。日志可写方法、去除 query 的安全路径、状态和 Trace ID；不要写 query、正文、token 或完整 Error.message。

## Service-fronted

请求入口只接收合法的 `X-Log-ID` 和 `traceparent`：Trace ID 必须为 32 位非零十六进制，parent span ID 必须为 16 位非零十六进制。优先使用合法的 `X-Log-ID`；若它缺失或非法，则使用合法 `traceparent` 中的 trace-id；两者均不可用时生成新 Trace ID。两者不一致时保留合法的 `X-Log-ID`，丢弃不一致的入站 `traceparent`，并以保留的 Trace ID 和新生成的非零 span-id 重新生成下游 `traceparent`；入站 `traceparent` 缺失或非法时也按此规则生成，不能转发原值。响应无论成功或失败都返回 `X-Log-ID`，不改变原有 JSON 合同。异步请求上下文供安全日志及下游 adapter 读取同一个 ID。

向 Make Gateway 仅白名单传递有效且一致的 `traceparent`、`X-Log-ID` 和原有认证所需的上下文。不要直接转发未经校验的浏览器 Header，也不要把 Service token、Cookie 或 Authorization 写入日志。`make-app-auth` 继续拥有认证上下文；`make-app-service` 继续拥有实际代理路由和响应形状。

## 直连 Gateway 与 AI

直连 Gateway 的 App 仍由共享 UI 请求适配器注入 Header；不为 Trace ID 绕开 `auth.api`。若使用 AI v1 原始响应桥接，沿用 `make-app-auth` 限定的已认证 transport，JSON、SSE、上传和二进制请求都携带相同 Header。SSE/文件流在完成、失败或取消时正确收束 Trace；短暂重连不应直接当成最终失败。不要把 `traceparent` 放进 query，也不要把 SSE 事件正文写入日志。

Trace ID 关联日志并帮助定位请求；只有在另行配置经确认的采集与导出链路后，才能声称支持集中式 Trace 查询。本 Skill 不推断后端已有 Collector 或 exporter。
