# 可移植验证工具

命令从本 Skill 实际安装目录执行。`<consumer-workspace>` 是安装正式 SDK 的消费工作区。工具不读取业务凭据、不访问真实 Gateway、不依赖参考 App。

## TypeScript 编译器 API

App 保留既有编译器和构建命令。审计及文档示例按能力依次检查消费工作区的 `typescript`、官方兼容包 `@typescript/typescript6`、官方 TypeScript 制品的 `typescript-compiler-api` 别名；不只看版本号。TypeScript 7 原生入口缺少旧 API 时继续寻找兼容入口。

项目可使用现有包管理器，仅为开发工具安装正式兼容包并核对实际解析结果；不替换主编译器、不增加生产依赖。也可使用精确版本别名 `typescript-compiler-api: npm:typescript@6.0.3`，或显式提供已有工具工作区：

```bash
node scripts/audit-make-ai-assistant-project.mjs "<project-root>" --expected-package-version=0.4.5 --compiler-workspace="<tooling-workspace>"
node scripts/verify-host-example.mjs "<consumer-workspace>" --compiler-workspace="<tooling-workspace>"
```

省略参数时按消费工作区的 Node 依赖规则解析，不主动扫描全局安装或开发者私有目录。显式工具工作区必须存在；缺少能力时返回 `compiler_api_unavailable`，不改用消费工作区兜底。纯 Service 的生产依赖预检仍不强制安装解析器；无法证明纯类型引用时不能豁免运行时依赖。

示例检查用兼容 API 验证消费工作区实际 SDK/React 类型，不替代 App 自身的 TypeScript 7 检查和构建。复制工具到 App 时保留 `load-agent-compiler.mjs` 和 `load-typescript-compiler.mjs`，审计器另需 `react-component-contract.mjs`。日志中的安装包版本来自 manifest，API 自报版本单独标记，不以其中一个代替另一个。维护者执行 `test-load-agent-compiler.mjs` 和 `test-audit-make-ai-assistant-project.mjs`，覆盖完整 API、原生入口、兼容入口、能力缺失和显式工具工作区。认证与错误出口审计的独立随包工具配置分别见关联 Skill，不因 Agent 审计通过而省略它们。

## SDK 终态失败通知

```bash
node scripts/verify-agent-terminal-notice.mjs "<consumer-workspace>"
```

需要机器可读报告时追加 `--report="<json-file>"`；SDK 自身可能输出诊断日志，不直接把整个标准输出当作 JSON。

通过真实公开 `createAgentClient` / `AgentSessionController` 和隔离传输夹具验证 JSON HTTP/网络/业务/协议失败及重试成功、SSE 拒绝/协议错误、下载响应/正文失败、并发相同操作、游标快照/重订阅恢复、写入未知结果的回执 404/403。每次网络尝试分配独立测试 Trace 标识，通过公开 `CallOptions.onAttemptFailure` 登记闭包，检查通知次数、终态时机和请求归属。成功重试/恢复保持静默，不凭 `onDiagnostic.operation` 猜测最近请求。全部场景逐项执行并汇总，任一失败返回非零；不添加已知缺陷豁免。

夹具证明 SDK 通知合同，不证明宿主真实 Header/Span。宿主按 `make-app-auth` / `make-app-observability` 提供认证字节桥、每次网络尝试的 Trace、安全日志、取消和 reader 释放，每个 Span 只收束一次。SDK 负责协议/业务错误、唯一重试与恢复决策，执行最终有效尝试登记的失败通知。宿主不重复解析 JSON/SSE、不按 operation 全局关联、不重放写入来补漏。该公开回调是失败通知，不是成功或主动取消都应触发的通用结束回调。

原 `verify-agent-package.mjs` 检查发现范围、DTO 和未知写入恢复；通过不代表终态通知通过，两项都要执行。

## 公开 UI 夹具

```bash
node scripts/verify-agent-ui.mjs "<consumer-workspace-with-jsdom>"
```

使用该工作区的正式 SDK、React、React DOM 和开发测试依赖 `jsdom`（CI 为 29.1.1），不向 App 生产依赖增加 DOM 模拟器。夹具兼容 SDK 支持的 React 18.2 与 19，CI 分别使用正式依赖执行，不要求宿主升级 React。`scripts/fixtures/agent-ui/question.json` 随 Skill 分发；公开 `AgentChatPanel` 使用公开快照作为视图输入，实际控件与草稿存储来自包，不导入内部组件或复制状态机。

按可访问标签/角色操作日期、日期时间确认/取消、秒编辑和日期范围起点边界；检查非敏感草稿同身份恢复、用户/租户/App/Agent/Session/问题隔离、密码及显式敏感值不落 sessionStorage、关闭题面清理草稿。DOM 未处理错误也会使验证失败。示例 schema 的日期控件扩展只测试既有渲染，不授权宿主改写服务端题面；普通 `format: date-time` 不保证渲染同一控件。可追加 `--report="<json-file>"` 保存报告。

DOM 模拟不证明真实弹窗定位、原生交互、焦点/滚动几何或手机布局。真实 App 仍需桌面/手机浏览器验收，未覆盖项单列记录。

## 门禁结果与包问题

分别记录静态审计、基础 SDK、终态通知、公开 UI、宿主自身类型/测试/构建及认证/Trace 检查。包合同失败时保留非零结果，报告版本、场景和最小复现给维护者；不降低断言、不增加宿主补丁、不改已安装包。正式修复版本发布后用相同夹具重验，再调整安装基线。
