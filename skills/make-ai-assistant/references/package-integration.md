# 0.4.1 包契约

## 安装与证据

使用宿主现有的包管理器和锁文件，在 UI workspace 安装正式 `@qfei-design/make-ai-assistant@0.4.1`。Service 使用 `assertAgentRequest` 时也在 Service 的 dependencies 声明同版本，不能依赖 UI 的传递安装。核对 manifest、lockfile、实际 resolution 与发布构建提交；记录 registry 与 integrity。不要用本地 link、包源码、patch-package 或放宽校验代替正式包。

当前基线明确为 0.4.1。用户要求未来最新版本时先查询 registry，再核验实际公开契约；遇到不一致时报告版本和缺失符号，不猜测或切回旧协议。

从安装包 export map 的 types 目标及其传递引用读取声明。公开字段以导出类型为准，内部源码/示例不能增加公开 API。

| 公开入口 | App 接入使用 |
| --- | --- |
| `/agent` | `createAgentClient`、`AgentClient`、`AgentAuthenticatedTransport`、`AgentHttpRequest`、`assertAgentRequest`、`AgentApiError`、`AGENT_UPLOAD_LIMIT` |
| `/react` | `MakeAppAssistantEntry`、`MakeAppAssistantEntryProps`；低层面板仅在明确需要时使用 |
| `/make-app` | `createMakeAppAssistantTransport`：已经确认 ID 的低层同步绑定；标准入口无需宿主调用 |
| 根类型 | `MakeAssistantHostContext`、主题及通用公开类型 |
| `/styles.css` | 全 App 导入一次 |

`/client` 虽仍随包导出，但属于旧私有协议；存在旧路由不代表完成新 Agent 接入。新入口不得从旧 SDK 拼接 DTO、错误解析、上传或流恢复。

## 客户端

```ts
import { createAgentClient } from "@qfei-design/make-ai-assistant/agent";
const client = createAgentClient({
  scope: { appKey, identityKey },
  basePath: "/api/make/app/agent/v1",
  transport: authenticatedTransport,
});
```

`basePath` 是完整版本前缀，SDK 不再替它追加 `/v1`。SDK 默认 `/api/make/agent/v1` 面向 Gateway；Service-fronted App 使用上面的同源前缀。`identityKey` 来自当前用户/租户稳定标识，只用于客户端状态隔离，不授予服务端权限。

`AgentAuthenticatedTransport.request(request, options)` 返回 `{status, headers, body?: AsyncIterable<Uint8Array>}`。请求方法是 GET/POST，请求体为字节或异步字节流。一次网络尝试对应一次认证 I/O；`retryOwner:"sdk"` 表示桥不重试。保留请求操作头、Content-Type、signal 与响应体，不在桥内拆业务 data。

`MakeAppAssistantEntry` 负责入口解析、同步 transport 的 effect 创建/释放及 UI。不要为它再手工调用发现、管理详情、构造 bootstrap transport 或关闭 StrictMode。公开 `createMakeAppAssistantTransport` 也不再先异步读取旧 capabilities。

## 包缺陷与验收边界

已复现的 0.4.1 包问题：同一个入口组件直接替换 client 时，发现结果可能在 effect 重置前短暂沿用旧 client 的 Agent，形成“新 client + 旧 Agent ID”的绑定尝试。应由包将解析结果与产生它的 client 关联后修复；宿主继续履行正常身份切换释放职责，不加专用发现兼容。尚无越权或数据泄露证据，需服务端独立鉴权。

包导出类型通过、App 测试通过、发布 Ready、真实对话/识图成功是不同证据。不能用其中一个代替另一个；标题含旧版本文字通常是会话 title，而非运行包版本。
