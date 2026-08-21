# 附件下载代理 Skill 规范

## 背景

参考应用曾出现附件图片无法展示的问题：Make 原始文件下载接口需要 `Authorization`，但浏览器 `<img src>`、`object data` 和普通链接无法附带自定义请求头。如果继续把 Make 原始下载地址直接交给 UI，后续应用会重复出现同类问题。

## 变更内容

- 在 `make-app-service` 中补充文件下载代理规则：UI 不能暴露原始 Make 下载 URL；附件预览必须使用 Service 代理路径。
- 在 `make-app-service` 的 Make Data adapter、API contract、testing safety reference 中补充：
  - Service 下载代理应返回二进制或流，保留安全的 `Content-Type` / `Content-Disposition`。
  - 当 Make 下载接口需要 bearer token 时，Service 必须先校验当前 App session，再使用服务端下载 token。
  - 服务端下载 token 只用于附件下载边界，不替代普通 schema、record、candidate、lookup、upload、delete 请求的登录上下文。
  - 下载 token 不进入 `/api/config`、UI 环境变量、日志或错误信息。
- 在 `make-app-auth` 中补充 Service-fronted 附件下载认证边界：
  - 浏览器资源请求不能附带 `Authorization`。
  - Service 必须通过 make-gateway `/auth/current-context` 校验 Cookie 对应登录态。
  - Service 使用下载 token 前必须移除或覆盖浏览器侧 `Authorization`。
- 更新 `audit-auth-contract.mjs`，在 Service-fronted 模式下检查 UI 中明显的原始 Make 下载 URL 直接用于 `src`、`href` 或 `data` 的情况。

## 验证

- `node skills/make-app-auth/scripts/test-audit-auth-contract.mjs`
- `node` 轻量检查 `skills/make-app-auth/SKILL.md` 和 `skills/make-app-service/SKILL.md` frontmatter 必填字段
- `git diff --check`

## 验证限制

- `quick_validate.py` 依赖 Python `yaml` 模块；当前系统 Python 和 Codex bundled Python 均缺少该模块，因此未能完成该脚本校验。
- 使用更新后的 audit 脚本抽检参考应用时，本次新增的原始下载 URL 检查不再误报；剩余 `token_mode_present` 为该脚本既有 token 字符串规则命中，和本次附件下载代理规范无关。
