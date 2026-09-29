# 公共包接入

目标 UI 包默认依赖 `@qfei-design/make-app-observability@^0.1.4` 或兼容的更新版本。使用现有 App 已声明的包管理器和锁文件；新建 App 按 `make-app-runtime` 的运行时基线安装。先读取已安装包的 `package.ai.json`，按 `readOrder` 阅读 `README.md`、`PUBLIC_API.md` 等公开文档，并核对 React peer 依赖。不要根据本地另一个包仓库的旧版本推测安装版 API。

公开入口只有包根入口、`/react` 和 `/styles.css`。UI 入口导入样式一次。React 错误出口使用 `MakeAppErrorNotice`；全局错误队列可用一个 `MakeAppErrorNoticeViewport` 包裹，移动端由组件处理 portal、安全区和滚动。宿主拥有错误队列、关闭、重试和安全文案；页面内嵌错误仍复用同一错误卡片。

| 宿主传入的 `kind` | 条件 | Trace ID 展示 |
| --- | --- | --- |
| `http` | HTTP 非 2xx | 展示有效 ID |
| `network` | 请求未取得 HTTP 响应 | 展示本次请求有效 ID |
| `business` | HTTP 2xx 但业务码失败 | 不展示 |

Core 的 `normalizeMakeAppTraceId`、`shouldDisplayMakeAppTraceId` 和 `normalizeMakeAppErrorNotice` 可供非 React 逻辑使用。包只接收宿主已经转成安全文案的标题和说明；不要把原始 Error、上游响应正文或服务内部堆栈交给组件。包本身不创建 Trace ID、不发 HTTP 请求、不保存错误状态，也不导出 Span。

共享错误出口应覆盖所有 Make 业务页面。页面直接调用 `message.error`、自己拼 Trace ID 复制按钮，或者只在少数页面使用公共卡片，均不满足统一展示合同。保留 App 已有的非业务表单校验展示，不把本地输入错误伪装为服务故障。
