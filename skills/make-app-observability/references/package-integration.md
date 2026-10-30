# 公共包接入

新建或本次改造反馈出口的 UI 包默认依赖 `@qfei-design/make-app-observability@^0.1.10`，以获得包内 Toast 自动关闭。`^` 只选择兼容范围内的版本，不会更新已有 lockfile 或线上 App；升级必须显式更新依赖和锁文件、复跑验证并重新发布。未涉及反馈改造的存量 App 保留其锁定版本。历史版本中，`0.1.5` 支持 business Trace ID，`0.1.7` 开始双端 portal，`0.1.8` 提供桌面顶部 Toast，`0.1.9` 提供权限提示；这些能力不证明已具备 `0.1.10` 的计时生命周期。使用现有 App 已声明的包管理器和锁文件；新建 App 按 `make-app-runtime` 的运行时基线安装。先核对目标 registry、锁文件和实际安装包，再读取其 `package.ai.json`，按 `readOrder` 阅读公开文档并核对 React peer 依赖。不要根据另一个包仓库或旧安装产物推测 API。若仓库无法解析所需版本，报告包发布阻断，不用旧版、Git 或宿主 CSS 伪造包的新能力。

公开入口只有包根入口、`/react` 和 `/styles.css`。UI 入口导入样式一次。React 错误出口使用 `MakeAppErrorNotice`；一个全局错误队列使用一个 `MakeAppErrorNoticeViewport` 包裹。在 `0.1.9+`，桌面和手机均将队列 portal 到 `document.body`；首次 SSR 与 hydration 在原位置渲染，挂载后才 portal。默认布局由包负责：桌面顶部居中的 Toast 距顶部至少 `24px` 并避让安全区，手机水平居中且垂直居中偏上；`--make-app-error-center-offset` 只调整手机偏移。四边留出安全区和间距，长错误内容或长队列在 viewport 内滚动，卡片即使有宿主 DOM wrapper 也保持布局与交互。不要给 viewport 添加全屏定位 wrapper，也不要用宿主样式覆盖默认 `position`、`inset`、`padding`；升级旧 App 时移除这些遗留覆盖。`0.1.10+` 由包管理关闭计时与隐藏；宿主保留错误队列、`onClose` 后的状态清理、重试和安全文案，不再叠加 `setTimeout`。普通错误卡片不提供 `onRetry` 属性或重试按钮，宿主应按 `makeui` 的页面错误态规则呈现重试操作，不能把它当作全局卡片的一部分。页面内嵌错误仍复用同一错误卡片。

全局 viewport 的 `duration` 默认3秒，单条错误可覆盖，0表示常驻；独立内嵌错误默认常驻。权限组件只有 `variant="toast"` 计时，默认继承 viewport 或3秒，inline/page忽略时长。每次新事件在宿主分配唯一id，同时作为 React `key` 和 `noticeKey` 传给错误或权限组件；同文案新事件也须新id。稳定 `noticeKey` 避免普通重渲染新建 `onClose` 引用而重置计时，管理员加载不应延长时长。回调只移除对应队列项，不重新请求权限或重放操作。

全局错误出口须在应用根的持久层挂载，不能依赖权限、Schema 或路由成功分支才挂载；这样首次加载失败时仍有可用出口。包负责 portal 后的 viewport 位置，`makeui` 负责持久挂载及与宿主 overlay 的层级协调。viewport 默认 `z-index: 2000`；若抽屉、预览等 overlay 层级更高，通过公开的 `zIndex` prop 对齐，避免卡片被遮挡。错误队列状态应由这层可访问的共享状态管理，页面内嵌错误无需全局 viewport。

权限拒绝使用同包 `/react` 的 `MakeAppPermissionNotice`，不再新增独立 feedback 包。Trace-only 最低版本不代表该新增 API 已发布：按 `makeui/references/permission-feedback.md` 验证安装产物的公开导出、CSS、`toast/inline/page` 和本地预发布门禁。已知权限拒绝走其局部出口一次，保留 Trace 诊断上下文；普通网络/HTTP/业务错误仍沿用下述合同。

| 宿主传入的 `kind` | 条件 | Trace ID 展示 |
| --- | --- | --- |
| `http` | HTTP 非 2xx | 展示有效 ID |
| `network` | 请求未取得 HTTP 响应 | 展示本次请求有效 ID |
| `business` | HTTP 2xx 但业务码失败 | 展示有效 ID |

Core 的 `normalizeMakeAppTraceId`、`shouldDisplayMakeAppTraceId` 和 `normalizeMakeAppErrorNotice` 可供非 React 逻辑使用。包只接收宿主已经转成安全文案的标题和说明；不要把原始 Error、上游响应正文或服务内部堆栈交给组件。包本身不创建 Trace ID、不发 HTTP 请求、不保存错误状态，也不导出 Span。

共享请求层应产生包含 `kind/status/title/description/traceId` 的安全结构化错误；网络异常没有响应时 `status` 可缺省，`description` 也可按需要缺省。权限、Schema 等 Provider 可以另存加载状态，但必须把可用字段保留到全局或页面内嵌错误出口；不能仅保存“加载失败”字符串，也不能把原始 Error 对象或上游响应正文直接交给组件。仅当卡片实际收到并展示有效 ID 时，页面文案才可提示用户复制 Trace ID。

共享错误出口应覆盖所有 Make 业务页面。页面直接调用 `message.error`、自己拼 Trace ID 复制按钮，或者只在少数页面使用公共卡片，均不满足统一展示合同。保留 App 已有的非业务表单校验展示，不把本地输入错误伪装为服务故障。

存量 App 本次明确改造反馈出口时，按 [迁移清单与门禁](error-outlet-migration.md) 验收全部相关入口。公共卡片放在旧浮动消息容器里仍是另一个 Toast 出口，显式补三秒时长只能修复生命周期，不能替代统一迁移。

## Toast 默认关闭与宿主接线

以下生命周期按主仓库的 `0.1.10+` 接入基线执行，仍须核对目标 registry 的实际发布产物。不能仅凭 `0.1.9` 版本号认定已支持自动关闭；原有 `0.1.9` 基线只证明既有展示能力，不证明新增 duration/noticeKey API。新建或升级错误出口时，先按安装包的公开文档、类型及实际挂载行为确认本节能力；产物尚不支持时报告发布阻断，不向旧组件盲传新属性，不复制源码或另加宿主计时器伪造新能力。区分源码能力、目标 registry 发布状态与目标 App 验收结果；现有锁文件和部署不会因新版本发布自动更新。

- 包负责计时：`MakeAppErrorNoticeViewport` 默认 `duration={3}`，即 3 秒；其中的错误卡片继承该时长，单条 `duration` 优先，单位为秒，`0` 为常驻。无 viewport 的内嵌错误默认常驻，可显式覆盖；权限 Toast 即使独立渲染也默认 3 秒，权限 `inline/page` 始终常驻并忽略 duration。不要为页面内权限提示增加自动关闭。
- 宿主不重复设置计时器；通过每条通知的 `onClose` 删除对应队列项，自动和手动关闭共用同一清理路径。清理只影响该条通知，不能清空其他新通知、重试业务请求、改变权限或清除表单。手动关闭会取消该条计时；卸载不调用 onClose。移除旧的宿主 Toast timeout，并排查显式 `duration={0}` 是否确需常驻。
- 每次触发分配新的稳定 `noticeKey`（字符串或数字），作为该事件的标识；同一事件的普通重渲染保持该值，不能在 render 中生成随机标识。相同文案及相同 Trace ID 的新事件也用新 key，从触发重新计算完整时长。建议 React 队列 key 同样使用事件 ID。兼容未传 noticeKey 的旧宿主时，新的 onClose 引用会被当作新通知；普通渲染创建新回调可能意外延长计时，因此优先传显式 noticeKey。
- 需要更长阅读或复制 Trace ID 的场景，使用已确认的公开 duration 调整时长或设为 0；关闭提示不等于解决原请求失败，页面错误态和重试能力仍独立保留。

宿主全局错误队列中，每条卡片通过 `noticeKey={notice.id}` 和 `onClose={() => removeNotice(notice.id)}` 绑定同一事件，removeNotice 使用宿主现有队列更新方式只删除该 ID。不要按 title 或 traceId 去重成同一通知身份；业务去重规则仍由宿主决定。
