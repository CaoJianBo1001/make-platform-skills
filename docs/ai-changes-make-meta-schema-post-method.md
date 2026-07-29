# Make Meta Schema 请求方法修复

## 背景

对照本地后端资料 `AgenticDSL/Design/MetaAPIDesign.md` 和 makecli 实现，`/meta/v1/schema` 属于 Make Meta API 上游调用，必须使用 `POST`，并通过 `X-Make-Target: MakeService.GetResource` 表达动作，body 中注入 `appKey`。

同时对照本地 Data API 设计，`/data/v1/record` 这类 Make Data API 上游调用也统一使用 `POST`，动作由 `X-Make-Target` 指定，不能依赖 fetch 默认 GET。

## 修改

- 修正 `skills/make-app-service/references/make-data-adapter.md` 中 published 和 local-preview schema 示例，把 `/meta/v1/schema` 从 `GET` 改为 `POST`。
- 补充 schema adapter 规则：调用 schema 路径时必须使用 `POST`、`X-Make-Target: MakeService.GetResource`、JSON `Content-Type`，并从 `config.appKey` 构造 body。
- 修正 `skills/make-app-auth/references/service-fronted-mode.md` 中直接调用 Make Data/Meta 上游接口的示例，显式使用 `POST`、JSON body 和必要的 `X-Make-Target`。
- 修正 `skills/make-app-auth/scripts/test-audit-auth-contract.mjs` 的测试 fixture，避免继续出现默认 GET 调用 `/data/v1/record` 的好案例。
- 新增 `scripts/test-make-api-method-contract.mjs`，把 Meta/Data API 请求方法契约固化为回归检查。

## 验证

- 已通过 `node scripts/test-make-api-method-contract.mjs`。
- 已通过 `node skills/make-app-auth/scripts/test-audit-auth-contract.mjs`。
- 已通过 `node scripts/test-platform-skill-genericity-contract.mjs`。
