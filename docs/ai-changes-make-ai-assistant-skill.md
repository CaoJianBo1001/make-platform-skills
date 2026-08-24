# Make AI 助手 Skill 修复记录

## 2026-08-24

- 为 `make-ai-assistant` 增加 Adapter 选择前置门禁：已配置或可查询 Console Agent、或明确 Agent Gateway 时使用 `make-console`；仅在已确认 Make App AI Chat 后端契约时使用 `make-app`；无法确认时停止并要求确认。
- 新增 Make Console BFF/SSE 参考契约，限定 Agent 查询、Session、持久事件、发送消息、Run SSE 五类操作，补齐输入白名单、稳定错误映射、首帧后断流关闭及客户端断开中止上游规则。
- 补充错误 Adapter/路由、Console BFF、SSE 断流与既有页面渲染回归要求，并让 `make-app-service` 将 `/api/make/app/ai/**` 明确为 `make-app` 专用，避免误导 Console 集成。
- 将 `make-app-service` 中的 Console BFF 契约引用改为完整的 `make-ai-assistant/references/` 路径，避免跨 skill 按当前目录解析失败。
