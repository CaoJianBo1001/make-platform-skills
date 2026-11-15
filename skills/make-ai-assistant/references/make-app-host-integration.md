# 宿主接线

## 平台准备

在平台 Console 为目标 App 配置并启用 Agent，启用应用内渠道 channel_webchat，确认该 App 部署已集成 Agent 能力且依赖已就绪。模型、Runtime 与插件配置由平台维护；普通使用者不需要获得配置管理权限。宿主不通过业务记录接口创建 Agent，也不把平台配置失败补成假聊天。零个可用入口不显示助手是预期行为；配置错误与依赖故障必须保留错误。

## App 与身份

从宿主当前认证 App 取得 appKey，从可信 Schema/运行时元数据取得真实 App ID（标准 Schema 为 `app.meta.appID`）。按后端已声明的类型归一；数字仅接受安全整数，不能把无效值转成字符串。若 ID 暂缺，等待其加载或报告数据合同问题，不用 appKey 顶替。

`context.app.id`、appKey 与显示名各自独立。上下文只提供必要页面信息，不传 Token、Cookie、完整业务记录或个人信息集合，不作为授权依据。

```tsx
import { MakeAppAssistantEntry } from "@qfei-design/make-ai-assistant/react";
import "@qfei-design/make-ai-assistant/styles.css";

// client 由宿主认证层按 App/租户/用户稳定创建；appId 是真实资源 ID。
<MakeAppAssistantEntry
  client={client}
  context={{
    app: { id: appId, name: appName },
    locale: navigator.language || "zh-CN",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    location: { pathname },
    resource: entityKey ? { entityKey, recordId } : undefined,
  }}
  title={assistantTitle}
  open={assistantOpen}
  onOpenChange={setAssistantOpen}
/>;
```

客户端由 effect 创建并在 cleanup dispose，不在 render/useMemo 中创建具有副作用的资源。绑定状态同时记录 scopeKey，渲染只接受当前 scopeKey；StrictMode 的创建/清理/重建不得留下已释放客户端。scopeKey 使用 App key、真实 ID、租户、用户组成的无歧义元组，不包含 displayName、路由或打开状态。

身份或 App 切换先隔离旧绑定，取消旧 I/O、dispose client；迟到结果不得挂载到新身份。普通页面导航仅更新 context；关闭面板仅改变 open，不销毁 Shell/client，不发送 stop。

## 入口发现由包拥有

标准 App 入口使用 `MakeAppAssistantEntry`。内部执行 `client.agents.list({view:"webchat"})`，JSON filter 限定当前 appKey，使用已有登录身份。成功读取列表返回 `data: []` 或 `[{agentId,name}]` 与页码 pagination，不是手写 `entry:null` 协议。

- 零个：不展示入口；不是错误，也不发 toast。
- 唯一：用资源 agentId 绑定 WebChat。
- 多个：服务端 `409/webchat_entry_conflict`，包显示“配置冲突”，不挑第一个。
- `403`、`409/channel_unavailable`、依赖错误：读取失败，不当作零个入口，也不回退管理列表/详情。

`view:"webchat"` 不能与 sort 同传。管理列表省略 view，详情按 `key + appKey`，需要额外管理权限；App 使用资格不等于配置查看资格。受限返回的 agentId 不能当业务 key 再查详情。一般不传显式 agentId；公开参数只能匹配受限发现的唯一入口，不能绕过冲突和授权。

## 同源认证字节桥

在共享请求层限定 `/api/make/app/agent/v1/` 路径与当前 origin，拒绝编码绕行、反斜杠、片段和任意外部 URL。普通业务请求继续走 auth.api；仅 Agent 桥直接返回字节响应。

桥保持 method、SDK 生成的 headers、signal，使用宿主既有认证 fetch 与 `credentials:"include"`。不读取或复制 Cookie/Token，不拼 Authorization。401 按统一登录策略恢复；403 保留权限拒绝，不默认触发登录循环。检查错误类型如需读取正文，使用 clone，不吞掉 SDK 的原始响应。

浏览器 Fetch 不能直接使用 SDK 的异步迭代 multipart body 时，在桥边界有界转换为 Blob。上限使用 `AGENT_UPLOAD_LIMIT` 加有界 multipart 元数据预算（0.4.5 参考 64 KiB），逐块检查取消与累计字节；不把整个上传转成 JSON、字符串或 base64。原 Content-Type 的 multipart boundary 必须与字节匹配；Service 重建 FormData 时让运行时生成新 boundary。

响应保持 status、all headers 与惰性字节迭代器。正常结束、错误、主动取消和未消费就取消均释放 reader/body；Trace 仅结束一次。JSON、SSE、下载都传 `traceparent` 与对应 `X-Log-Id`，日志只包含操作、状态、尝试和安全标识。
