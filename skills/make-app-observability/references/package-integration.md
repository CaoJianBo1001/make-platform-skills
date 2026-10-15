# 公共包接入

目标 UI 包默认依赖 `@qfei-design/make-app-observability@^0.1.5` 或兼容的更新版本；低于 `0.1.5` 的安装版不具备本 Skill 要求的 business Trace ID 展示合同。使用现有 App 已声明的包管理器和锁文件；新建 App 按 `make-app-runtime` 的运行时基线安装。先读取已安装包的 `package.ai.json`，按 `readOrder` 阅读 `README.md`、`PUBLIC_API.md` 等公开文档，并核对 React peer 依赖。不要根据本地另一个包仓库的旧版本推测安装版 API。

公开入口只有包根入口、`/react` 和 `/styles.css`。UI 入口导入样式一次。React 错误出口使用 `MakeAppErrorNotice`；全局错误队列可用一个 `MakeAppErrorNoticeViewport` 包裹。Viewport 行为按实际安装版公开文档核验：旧版桌面端不会 portal，保留在宿主文档流中，只有 `640px` 及以下 portal；新版桌面和手机均 portal 到 `document.body`，由包处理定位、安全区和队列滚动。不要给已经 portal 的队列再包一层固定定位。若旧版 App Shell 使用 `100vh + overflow: hidden`，必须将桌面错误出口放入可见内容区域，或由宿主明确定位，避免被固定高度容器裁切；不能把它直接追加在固定高度 Shell 后面。具体挂载与定位遵循 `makeui` 的 App Shell 规则。宿主拥有错误队列、关闭、重试和安全文案；页面内嵌错误仍复用同一错误卡片。

全局错误出口须在应用根的持久层挂载，不能依赖权限、Schema 或路由成功分支才挂载；这样首次加载失败时仍有可用出口。视觉上按安装版的 portal 合同处理，旧版桌面仍由 `makeui` 将卡片放在可见 Shell 区域或提供宿主定位。错误队列状态应由这层可访问的共享状态管理，页面内嵌错误无需全局 viewport。

权限拒绝使用同包 `/react` 的 `MakeAppPermissionNotice`，不再新增独立 feedback 包。Trace-only 最低版本不代表该新增 API 已发布：按 `makeui/references/permission-feedback.md` 验证安装产物的公开导出、CSS、`toast/inline/page` 和本地预发布门禁。已知权限拒绝走其局部出口一次，保留 Trace 诊断上下文；普通网络/HTTP/业务错误仍沿用下述合同。

| 宿主传入的 `kind` | 条件 | Trace ID 展示 |
| --- | --- | --- |
| `http` | HTTP 非 2xx | 展示有效 ID |
| `network` | 请求未取得 HTTP 响应 | 展示本次请求有效 ID |
| `business` | HTTP 2xx 但业务码失败 | 展示有效 ID |

Core 的 `normalizeMakeAppTraceId`、`shouldDisplayMakeAppTraceId` 和 `normalizeMakeAppErrorNotice` 可供非 React 逻辑使用。包只接收宿主已经转成安全文案的标题和说明；不要把原始 Error、上游响应正文或服务内部堆栈交给组件。包本身不创建 Trace ID、不发 HTTP 请求、不保存错误状态，也不导出 Span。

共享请求层应产生包含 `kind/status/title/description/traceId` 的安全结构化错误；网络异常没有响应时 `status` 可缺省，`description` 也可按需要缺省。权限、Schema 等 Provider 可以另存加载状态，但必须把可用字段保留到全局或页面内嵌错误出口；不能仅保存“加载失败”字符串，也不能把原始 Error 对象或上游响应正文直接交给组件。仅当卡片实际收到并展示有效 ID 时，页面文案才可提示用户复制 Trace ID。

共享错误出口应覆盖所有 Make 业务页面。页面直接调用 `message.error`、自己拼 Trace ID 复制按钮，或者只在少数页面使用公共卡片，均不满足统一展示合同。保留 App 已有的非业务表单校验展示，不把本地输入错误伪装为服务故障。
