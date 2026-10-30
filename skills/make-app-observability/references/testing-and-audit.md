# 验证与审计

先用行为测试固定请求合同，再实现接线。至少验证：

1. UI 普通业务请求同时发送 `traceparent` 和 `X-Log-Id`，且两个 trace-id 相等、非零。HTTP 成功及业务码失败都结束本次 Span，并记录实际 HTTP 状态码；使用只返回业务数据的认证 SDK 时覆盖非 200 的 2xx 响应。网络异常不虚构状态码。
2. HTTP 非 2xx、网络异常和 HTTP 2xx 业务码异常的分类与卡片展示。三类请求失败只要有合法 ID 均可展示并复制；网络异常保留本地生成的 ID。全局出口、页面内嵌出口和关闭/复制行为按实际使用方式验证。
3. 在真实应用根节点与 AppShell 组合下用浏览器测试桌面和手机全局错误出口，覆盖固定 `100vh + overflow: hidden` 布局及已有 overlay：确认 portal 到 `document.body` 后，桌面顶部 Toast 与手机偏上卡片的标题、说明、Trace ID、关闭和复制全部可见且可操作，没有裁切或遮挡。分别覆盖短内容、超长内容与多卡片长队列：内容应完整显示，长队列可滚动触达末张卡片的操作；有宿主包装节点时也应成立。若页面加载失败需要重试，验证重试按钮本身位于页面主内容区域的水平与垂直正中，不随顶部卡片位置偏移；按钮使用项目已有组件库的合适组件，或无组件库时使用项目现有样式组件，触发原请求且进行中不可重复提交；不得在全局卡片下方出现裸按钮。覆盖权限请求首次加载失败、Schema 加载失败；即使页面路由或 Shell 尚未挂载，全局错误出口仍须存在并显示卡片。权限首次加载失败且需要重试时，还须验证重试按钮在应用根层可用区域正中且可操作。确认 Provider 将 `kind/status/title/description/traceId` 保留到卡片；若页面文案提到 Trace ID，必须断言卡片实际收到并显示可见的有效 ID。
4. Service-fronted App 校验非法、全零、冲突 Header，缺失时生成 ID；成功与失败响应都返回 `X-Log-Id`；Make Gateway 收到相同的安全 ID 和匹配的有效 `traceparent`，冲突或缺失时重新生成下游 parent span；日志包含该 ID 且没有敏感上下文。
5. 启用 AI 时，JSON、SSE、文件和二进制 transport 使用 Header。AI HTTP 非 2xx 在有响应体和无响应体时都把 Span 标记为错误并记录状态码；异常断流、取消及重连按 `make-ai-assistant` 语义收束，不用 URL query 传追踪信息。
6. 使用实际安装的 `0.1.10+` 与真实宿主队列验证计时：默认3秒关闭且 `onClose` 清理对应项，手动/超时不重复清理；`duration={0}`、权限 inline/page 保持常驻；同文案的新 `noticeKey` 独立计时，普通重渲染和管理员异步加载不延长旧通知；卸载清理计时器，不回调旧事件或重放业务操作。虚拟计时可用于确定性回归，但SSR与包表面检查不证明生命周期行为。

静态审计可运行：

```bash
node skills/make-app-observability/scripts/audit-trace-contract.mjs <project-root> --mode auto
```

经用户明确批准的本地 alpha 验证可加 `--allow-prerelease`，且依赖必须固定为精确预发布版本。默认仍拒绝预发布；该开关不接受 Git/file 来源、不证明 registry 发布或权限组件可用，仍须核对实际安装产物并运行 `makeui` 的包表面与宿主行为测试。预发布版本的基础版本须达到 `0.1.9`，并实际验证同一 viewport 合同；这不是正式发布门禁的豁免。

`auto` 依据 Service 源码目录区分直连或 Service-fronted；拓扑已知时可显式传 `--mode direct` 或 `--mode service-fronted`。审计检查 UI 声明的包版本下界至少 `0.1.9`、样式与组件公开入口、全局 viewport 的基本渲染接线、UI 成对 Header、旧 query 做法、Service 响应与网关传递，以及 AI 字面量 URL 直写 `fetch` 时遗漏 Header 的明显问题。还须检查目标 App 锁文件及实际安装产物版本达到 `0.1.9+`；静态审计不解析实际安装包。Service 响应检查识别 `res`、`response`、`reply` 及它们明确赋值的别名；其他框架的响应写法应在项目本地扩展审计器并补正反向用例，不能只改业务代码迎合关键词。AI transport 若复用跨文件的共享适配器，不要求在每个调用文件重复写 Header；应以行为测试证明实际请求携带匹配的两个 Header。静态审计只检查 viewport 的源码存在，不能证明它常驻根层、卡片在真实 AppShell 中可见、Provider 保留结构化错误或页面文案与可见 Trace ID 一致；这些必须靠项目的浏览器与行为测试验证。其他动态分支、日志脱敏、真实 Gateway 行为及集中式导出也须通过项目测试和环境联调验证。

审计器保留 `0.1.9` 的历史兼容下界，不强制升级未改造的存量 App；它通过不代表 Toast 自动关闭已验收。新建或本次改造反馈出口按接入文档安装 `0.1.10+`，并运行上述生命周期回归。

新建或本次明确统一反馈出口时，另按 [错误出口迁移](error-outlet-migration.md) 运行 `audit-error-outlets.mjs` 及其正反向测试，检查新旧 Toast 并存。原 Trace 审计的 viewport 存在性检查不能替代该清点，也不能证明列表、写操作等实际失败路径已接入根出口。

新 App 将审计器复制或包装进项目本地 `scripts/`，以 `trace:audit` 接入项目 `verify:publish`。复制后保留审计测试，并在项目中增加真实请求及真实 AppShell 错误可见性、计时的行为测试，将这些测试纳入发布门禁。存量 App 在本次接入 Trace 时使用既有包管理器和发布命令，纳入等价门禁；不要为 Trace 接入单独迁移运行时。审计失败时先修复接线，不能只添加关键词或空组件让检查通过。审计通过但缺少上述可见性测试，不得声称错误出口已验收。
