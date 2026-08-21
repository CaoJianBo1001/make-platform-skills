# make-app-service 内部网关 /make 前缀规范

## 背景

Service 转发到内部 make-gateway 时，如果 `MAKE_API_BASE_URL` 配成 `http://make-gateway.make-dev`，再拼接 `/meta/v1/**` 或 `/data/v1/**`，实际请求会缺少 gateway 需要的 `/make` 路径前缀，导致路由匹配不到正确后端服务。

## 调整

- `skills/make-app-service/SKILL.md` 新增 hard rules：
  - Service 内部调用 make-gateway 时，`MAKE_API_BASE_URL`、`MAKE_AUTH_BASE_URL`、`MAKE_BUSINESS_BASE_URL` 若指向内部 make-gateway，必须包含 `/make` 路径前缀。
  - 正确示例是 `http://make-gateway.make-dev/make`。
  - 错误示例是 `http://make-gateway.make-dev` 再拼 `/meta/v1/**`、`/data/v1/**` 或 `/auth/**`。
  - `/api/make/**` 只属于浏览器同源访问或 ingress 入口，Service 内部上游请求不得使用该前缀。
- `references/make-data-adapter.md` 明确 Meta/Data/Auth 请求路径是在 normalized gateway base 下追加 `/meta/**`、`/data/**`、`/auth/**`，base 本身必须承担 `/make` scope。
- `references/service-layering.md` 强化配置归一化和校验要求，要求内部 gateway base 缺少 `/make` 时必须归一化或报清晰配置错误，并拒绝 Service 上游使用 `/api/make`。
- `references/testing-and-safety.md` 增加配置测试和安全检查项，覆盖内部 gateway base 带 `/make`、裸 gateway host 处理、以及避免误用 `/api/make`。

## 边界

- 本次只调整 `make-app-service` 的 Service 内部 make-gateway 路径规范。
- 不修改任何 Make App 业务代码。
- 不修改 `make-app-auth`、`makeui`、`canvas-table-integration`、`make-app-runtime`、`makecli`、`makedsl` 或 `make-integration`。
