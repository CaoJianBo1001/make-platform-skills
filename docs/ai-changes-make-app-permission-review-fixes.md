# Make App 权限 Skill 审查问题修复

## 范围

修复 `make-app-permission` 平台级 Skill 的上游权限过滤审计、IAM 返回行分类和默认触发边界，并同步相邻 Service、认证和运行时 Skill 的一致性说明。

## 变更

- 审计器现在拒绝 IAM 上游请求中包含 `make.platform.*` 的权限过滤，同时允许 UI 对 IAM 返回的多余平台行做本地忽略。
- 审计器会追踪平台权限字面量数组直接经本地变量进入 `body`、`payload` 或 `request.permissionKeys` 的常见写法，避免变量别名绕过上游过滤检查。
- 将权限行分类固化为资源和权限键的确定性表：仅支持的当前 App 业务权限进入严格校验；明确无关的租户根、其他 App 和未知业务键忽略；资源无法分类或行结构异常时失败关闭。
- 行为合同新增未知当前 App 权限键忽略、无法分类资源失败关闭的回归用例。
- 收紧 `make-app-permission` 的触发描述和默认行为；只有用户请求或仓库本地交付基线要求时，才新增完整单应用权限链路。
- `make-app-service`、`make-app-auth` 和 `make-app-runtime` 同步改为条件性协作，避免无关改动默认引入权限代理或发布门禁。

## 验证

- 运行权限审计器、行为合同、安装副本同步和 Skill 机械审查。
- 执行 `git diff --check`，确认无空白错误。
