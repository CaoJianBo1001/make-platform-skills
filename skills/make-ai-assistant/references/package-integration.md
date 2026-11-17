# 0.4.6 包契约

## 安装与证据

使用宿主现有的包管理器和锁文件，在 UI workspace 安装正式 `@qfei-design/make-ai-assistant@0.4.6`。Service 使用 `assertAgentRequest` 时也在 Service 的 dependencies 声明同版本，不能依赖 UI 的传递安装。核对 manifest、lockfile、实际 resolution 与发布构建提交；记录 registry 与 integrity。不要用本地 link、包源码、patch-package 或放宽校验代替正式包。

当前基线明确为 0.4.6。用户要求未来最新版本时先查询 registry，再核验实际公开契约；遇到不一致时报告版本和缺失符号，不猜测或切回旧协议。

从安装包 export map 的 types 目标及其传递引用读取声明。公开字段以导出类型为准，内部源码/示例不能增加公开 API。

| 公开入口 | App 接入使用 |
| --- | --- |
| `/agent` | `createAgentClient`、`AgentClient`、`AgentAuthenticatedTransport`、`AgentHttpRequest`、`assertAgentRequest`、`assertAgentResponse`、`AgentApiError`、`AGENT_UPLOAD_LIMIT` |
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

## 升级到 0.4.6

相对 0.4.5，0.4.6 保持公开入口、请求 DTO、Node/React 范围、固定公共合同 `1238c719e70ed80fd26976aedbc174bdff7998b4`、25 项 App 代理组合及原件 multipart 协议。UI 与 Service 同时锁定 0.4.6，同步锁文件、宿主 API 文档及版本断言。包继续使用精确依赖 `react-aria-components@1.22.1` 和 `@internationalized/date@3.12.4`，由包管理器解析；宿主不另建日期控件，不迁移既有运行时或路由，也不扩大权限与重试职责。

0.4.6 补齐 `/agent` 的终态失败通知。认证传输层按每次 I/O 通过 `options.onAttemptFailure?.(notify)` 登记当前尝试的安全通知，SDK 在重试或恢复最终失败时执行一次；并发请求、下载体与回执请求分别保留各自归属。主动取消按实际 AbortSignal 判断，不能仅因服务端错误码为 `AI_CLIENT_ABORTED` 就静默；流连接与读取超时保留 `AI_REQUEST_TIMEOUT` 并通知。完整接线见[宿主接线](make-app-host-integration.md#同源认证字节桥)，验证见[终态通知夹具](validation-tools.md#sdk-终态失败通知)。

0.4.5 修复回答、停止、取消排队与继续消息的未知结果恢复：再次操作或重建控制器后仅查询原 requestId，保留原目标身份；已发出字节的上传因暂停或断开而未确认时也不得重传。问题回执异步到达后由包收敛本地提交状态，按请求及操作身份确认；题面终态不能独立证明原答案已受理，冷恢复不得以默认值或当前草稿伪造已提交摘要。日期/范围/时间控件、统一时间线、滚动与思考折叠状态、附件原生弹窗定位均由包负责。详细行为和验证见[流与附件](make-app-stream-and-attachments.md)及[验证与交付](testing-and-pitfalls.md)。

从更早版本升级时保留 0.4.3 引入的非敏感问答草稿隔离与本人 owner 范围，保留 0.4.4 引入的 Task/TaskView waitReason 和结构化连接鉴权状态。宿主不手动迁移包内恢复键，不将等待状态当成写入授权。Service App 范围、multipart 与认证字节桥仍须独立验收，包升级不会修复宿主 CEL 拼接或合同校验器误用。

## 包缺陷与验收边界

0.4.5 的终态通知缺失已由 0.4.6 修复；存量 App 仍锁定旧产物时不会自动获得修复，应更新实际消费 workspace 并重验。终态通知门禁继续独立执行，不设缺陷豁免，也不以包内错误可见或基础包检查通过代替。夹具只证明公开 SDK 合同，宿主真实 Trace Header、通知队列和浏览器行为仍须单独验证。

旧版高层答案在回执 404 后重复 POST 的问题，以及无入口写成 `entry: null` 的文档冲突，已在 0.4.5 修复；当前受限列表为空使用 `data: []`。不再沿用旧版缺陷豁免、拦截器或 entry:null 兼容。已修复的入口发现竞态也不作为当前未修问题。

宿主仍需在身份变化时释放旧 client、阻止迟到响应，并保持服务端鉴权。包修复不取代这些职责。新发现的包问题必须记录正式版本、最小复现、实际结果、预期与影响，交给包维护者；不修改包源码、node_modules 或复制包状态机。验证通过的范围与未执行的真实后端、模型和浏览器验收分别报告，不把历史问题已修等同于全部能力无缺陷。
