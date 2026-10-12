# 公共包接入

目标 UI 包默认依赖 `@qfei-design/make-app-observability@^0.1.8`。`0.1.5` 是包声明的最低运行版本，也是 business Trace ID 展示的最低版本；`0.1.7` 才开始双端 portal，`0.1.8` 才提供本 Skill 的桌面顶部 Toast 默认布局，因此 `0.1.5` 不等于完整视觉交付基线。使用现有 App 已声明的包管理器和锁文件；新建 App 按 `make-app-runtime` 的运行时基线安装。先核对目标 App 锁文件和实际安装包版本，再读取该安装包的 `package.ai.json`，按 `readOrder` 阅读 `README.md`、`PUBLIC_API.md` 等公开文档，并核对 React peer 依赖。存量 App 本次接入或验收 Trace 与错误出口时也应升级到 `0.1.8+` 并验证，以满足本 Skill 的审计门槛；不要根据另一个包仓库或旧安装产物推测 API。若仓库无法解析所需版本，报告包发布阻断，不用宿主 CSS 伪造包的新布局。

公开入口只有包根入口、`/react` 和 `/styles.css`。UI 入口导入样式一次。React 错误出口使用 `MakeAppErrorNotice`；一个全局错误队列使用一个 `MakeAppErrorNoticeViewport` 包裹。在 `0.1.8+`，桌面和手机均将队列 portal 到 `document.body`；首次 SSR 与 hydration 在原位置渲染，挂载后才 portal。默认布局由包负责：桌面顶部居中的 Toast 距顶部至少 `24px` 并避让安全区，手机水平居中且垂直居中偏上；`--make-app-error-center-offset` 只调整手机偏移。四边留出安全区和间距，长错误内容或长队列在 viewport 内滚动，卡片即使有宿主 DOM wrapper 也保持布局与交互。不要给 viewport 添加全屏定位 wrapper，也不要用宿主样式覆盖默认 `position`、`inset`、`padding`；升级旧 App 时移除这些遗留覆盖。宿主拥有错误队列、关闭、重试和安全文案；公共包不提供 `onRetry` 属性或重试按钮，宿主应按 `makeui` 的页面错误态规则呈现重试操作，不能把它当作全局卡片的一部分。页面内嵌错误仍复用同一错误卡片。

全局错误出口须在应用根的持久层挂载，不能依赖权限、Schema 或路由成功分支才挂载；这样首次加载失败时仍有可用出口。包负责 portal 后的 viewport 位置，`makeui` 负责持久挂载及与宿主 overlay 的层级协调。viewport 默认 `z-index: 2000`；若抽屉、预览等 overlay 层级更高，通过公开的 `zIndex` prop 对齐，避免卡片被遮挡。错误队列状态应由这层可访问的共享状态管理，页面内嵌错误无需全局 viewport。

| 宿主传入的 `kind` | 条件 | Trace ID 展示 |
| --- | --- | --- |
| `http` | HTTP 非 2xx | 展示有效 ID |
| `network` | 请求未取得 HTTP 响应 | 展示本次请求有效 ID |
| `business` | HTTP 2xx 但业务码失败 | 展示有效 ID |

Core 的 `normalizeMakeAppTraceId`、`shouldDisplayMakeAppTraceId` 和 `normalizeMakeAppErrorNotice` 可供非 React 逻辑使用。包只接收宿主已经转成安全文案的标题和说明；不要把原始 Error、上游响应正文或服务内部堆栈交给组件。包本身不创建 Trace ID、不发 HTTP 请求、不保存错误状态，也不导出 Span。

共享请求层应产生包含 `kind/status/title/description/traceId` 的安全结构化错误；网络异常没有响应时 `status` 可缺省，`description` 也可按需要缺省。权限、Schema 等 Provider 可以另存加载状态，但必须把可用字段保留到全局或页面内嵌错误出口；不能仅保存“加载失败”字符串，也不能把原始 Error 对象或上游响应正文直接交给组件。仅当卡片实际收到并展示有效 ID 时，页面文案才可提示用户复制 Trace ID。

共享错误出口应覆盖所有 Make 业务页面。页面直接调用 `message.error`、自己拼 Trace ID 复制按钮，或者只在少数页面使用公共卡片，均不满足统一展示合同。保留 App 已有的非业务表单校验展示，不把本地输入错误伪装为服务故障。
