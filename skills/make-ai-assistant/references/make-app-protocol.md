# Agent Public API v1 与 Service 边界

核对来源：[接口总览](https://make-agent-design-1183132516685447241.make.qfei.cn/api-reference/overview)、正式包 0.4.5 的 `/agent` 生成类型和校验器。包固定合同源为 `agent-design/docs/contracts/public` 提交 `1238c719e70ed80fd26976aedbc174bdff7998b4`。网站与已安装包不一致时记录具体差异，不能擅自合成第三套协议。

## 路径与操作

Service-fronted：浏览器 `/api/make/app/agent/v1/**` → Service。
Service 使用现有可信 Gateway origin：
- local preview：`make_api_origin + /api/make/agent/v1/**`；
- published：运行时 Gateway origin + `/make/agent/v1/**`。

origin 只来自可信部署配置（既有 MAKE_API_BASE_URL/MAKE_SERVER_URL 等），必须是 HTTP(S) origin，禁止用户信息、path、query、fragment。受信内部 HTTP Gateway 可用；不新增 Agent 专用域名/Token，不接受浏览器指定上游。保留项目既有 auth、Scope 与转发头 helper。

[机器可读操作清单](service-operations.json) 是 23 个数据面操作及 Agent Get/List 的 25 项组合。POST 在资源路径上用 `X-Make-Target: MakeService.<Action>` 区分，不能只按 URL 放行所有动作。

| POST 路径（相对版本前缀） | 允许的 Action |
| --- | --- |
| /agent | GetResource、ListResources |
| /agent/input-capabilities | GetResource |
| /session | CreateResource、GetResource、ListResources |
| /session/preference | UpdateResource |
| /session/message | CreateResource、GetResource、ListResources |
| /session/message/queue | ListResources |
| /session/message/cancel | CreateResource |
| /session/message/resume | CreateResource |
| /session/message/feedback | UpdateResource |
| /session/task | GetResource、ListResources |
| /session/task/stop | CreateResource |
| /session/task/steer | ListResources |
| /session/run | GetResource、ListResources |
| /session/run/answer | CreateResource |
| /session/request | GetResource |
| /content | CreateResource（multipart；公共合同允许省略操作头） |

另有 GET `/session/stream` 与 GET `/content`（metadata/download）。Agent Get 是公共只读合同，但标准入口不主动查询管理详情；其权限仍由服务端校验。Agent 写入/删除、Plugin、Model、Runtime 目录和批量清理共 8 项控制面操作不向普通 App 开放，平台配置由 Console 负责。未知方法、路径、action 返回安全拒绝，不做 wildcard 透明代理。

## 校验与范围

Service 从部署配置读取 appKey，不信任 body/query 覆盖。按精确 method/path/action allowlist 处理后，复用同版本公开 `assertAgentRequest(operation,input)` 校验请求；操作名形如 `session.message.CreateResource`（斜杠转点），不是重新实现 SDK DTO。

JSON 校验先作用于原始请求，再检查 App 范围并重建允许的常量 filter；不能先裁剪或规范化再校验，以免吞掉合同禁止的顶层或嵌套字段。保留公开合同明确允许的扩展，不自行放宽校验器。

multipart 例外：`assertAgentRequest("content.CreateResource", metadata)` 只接收 `{requestId,fileName?,mediaType?}`，不传二进制 file 或 file 占位字符串；这个公开校验器已经移除了 multipart 的 file 字段。Service 另行验证恰好一个 file、大小、字段数量与重复项，再以 FormData 转发。不能套用生成类型里的 `N17Request.file:string`，也不必借用无关 Request 查询来校验 upload requestId。

Agent List 的部署范围不能靠括号拼接未经解析的 CEL 文本保证。默认 App 入口只接受无 filter/null 或 SDK 自动生成的当前 App 等值条件（用 JavaScript 模板 `appKey == ${JSON.stringify(deployedAppKey)}` 求值生成的字符串）；Service 按部署值重建常量 filter，其余 Agent 筛选明确返回 400，不静默丢弃或拼接。此限制针对 App 入口，不是声称公共 Agent 管理列表不支持 CEL。需要扩展 Agent 查询条件时，使用已有可信的完整 CEL 解析器生成 AST 后构造 AND；不可仅用 schema 字符串校验或局部括号/引号扫描冒充完整语法校验。`assertAgentRequest` 只验证 DTO，不能证明 filter 的 CEL 语法或 App 隔离；例如 `true) || true || (true` 仍可能通过 DTO 校验。Agent Get 的 appKey 必须匹配。WebChat 输入能力 source 限定 webchat；建会话限定 personal、channel/webchat、externalId:null。Session/Message/Task/Run/Content 的归属由服务端独立鉴权，不能从客户端 scope 或可见状态推断。

所有 POST（包括读取类 POST）要求恰好一个合法同源 HTTP(S) Origin，与实际 App Host 对比，拒绝缺失、重复或跨源值；不能信任浏览器的 X-Forwarded-Host。preview 在验证浏览器 App origin 后，才采用 Service 的预览凭据与可信上游 origin；published 保留经验证的 App origin。认证、Trace、转发 Host/Proto 和断开取消复用共享 helper。

query 用 Map 或无原型对象累积并逐项拒绝重复/未知键，包括 `__proto__`、`constructor`；不能先赋给普通对象后依赖 Object.entries 校验，避免原型 setter 吞键。拒绝无效编码和错误 Content-Type。JSON 请求/响应当前边界 8 MiB；multipart 单文件上限复用 `AGENT_UPLOAD_LIMIT`，限制字段与开销。若用 multer，必须用真实 SDK 四段 requestId/fileName/mediaType/file 验证限制：已验证 files=1、fields=3、parts=5 可接收，parts=4 会误拒绝；这是该解析器配置证据，不把阈值当成通用协议常量。GET stream 允许 `sessionId,after,streamDeltas` 与 Last-Event-ID，持久位置是十进制字符串，不转 Number、不与列表 cursor 混用。GET content 使用 `contentId,mode,viaType,viaId,viaView`，校验公开 DTO，不接受任意下载 URL。POST 不额外接受 query。

## 响应

JSON 为 `{code,msg,data,pagination?}`；成功 code 为数字 200。HTTP 状态和业务 code 分别处理，不能套普通 Service 的 data envelope、旧 bare JSON 或把“保存成功”当“任务完成”。Agent 管理列表是 page/size/total，数据面 cursor/nextCursor；入口列表按 view 使用专门响应结构。

公开错误为 `{code:number,msg:string,data:{reason:string,requestId?,currentRevision?,agentMsg?,details?}}` 等声明字段。currentRevision 可为不透明字符串或整数，不能只保留数值或转 Number；数据面的 agentMsg 按公开合同有界保留。reason 可扩展，不能闭集匹配或根据文案决定流程。保留实际 HTTP/业务状态与可展示字段；限制大小，未知 reason 仍保留状态，不自动映射 502。仅输出经审查的公开字段，内部 details/诊断不能原样泄露。HTML、重定向或畸形响应变安全 Service 错误；认证边界的非 JSON 401/403仍保留认证状态。

GET stream 是 `text/event-stream`，GET content download 是字节；保留 Content-Type、Content-Disposition、Cache-Control、Retry-After、X-Request-ID、WWW-Authenticate 等需要的响应头，移除逐跳头。SSE 禁缓冲、禁代理转换，及时 flush；开始响应后遇错关闭流，不追加 JSON。下游断开取消上游并释放资源。

本协议不要求旧私有 API 的版本响应头、分片上传或 responses 路由。不要为旧错误结构在宿主增加兼容层。
