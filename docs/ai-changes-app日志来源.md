# AI 变更记录

## 2026-11-16：同步 Gateway 归属规则

- 应用归属使用 `X-Make-App-Key`，不再要求请求体或 query 包含 appKey。

## 2026-11-13：统一应用来源

- 应用页面及应用 Service 请求统一使用 `X-Make-Source: app`。
- 更新 Service 适配器示例及 observability 验证说明，保留应用标识与 Trace 传递规则。

## 2026-11-13：Make App 日志来源

- 为应用和 Service 的 Make 公共请求适配器补充来源与应用归属合同、示例和验证范围。
- 涉及 make-app-auth、make-app-service、make-app-observability 及其参考文档。
- 页面来源为 app，Service 独立任务为 service；保留现有认证与 Trace，说明 Gateway 归属限制。
