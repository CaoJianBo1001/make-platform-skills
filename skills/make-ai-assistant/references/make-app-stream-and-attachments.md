# 会话、流与文件图片

## SDK 状态机

包负责 Session/Message/Task/Run、获权快照、SSE、问题回答、反馈、队列、追加、停止及请求回执恢复。宿主只提供认证字节传输与显式 Service 代理，不自行构建 reducer、事件解析、EventSource 或重连循环。

数据写入的 requestId 是同一用户意图的稳定 ID；网络结果未知时先查 RequestResult，查询失败或未找到都不能证明未执行。不得换新 ID 重发。配置写入不自动重试。401/403、范围/协议错误停止自动重试；网络/429/5xx 由唯一 retryOwner 有界处理。

重新打开会话先读获权事实与安全 asOf，再续订。持久事件 after/Last-Event-ID 保持字符串；delta 的 messageId/streamId/seq 是临时预览位置，不推进持久位置，正式消息到达后由包合并去重。连接断开不等于任务失败；本地 dispose 不等于远端 stop。停止受理与 Task 最终终态分别显示。

会话标题、重命名、置顶、归档走 sessions/preference；没有硬删除。新对话先清空视图，首条用户消息才建立 Session。历史标题可能含旧测试版本文字，不是 npm 版本展示。持久化只留身份隔离的必要标识和恢复元数据，不存 Token、消息正文或题面答案。

## 上传和识图

0.4.2 是 `POST /content` multipart 原件上传，不是“初始化→分片→complete”的旧协议。包公开 `AgentAttachmentController` 与 `AGENT_UPLOAD_LIMIT` 管理上传、重试、未知回执恢复；宿主不复制上传引擎。消息只引用获确认的 Content；失败项保留重试/移除，不能把本地文件名当成功引用。

`agents.getInputCapabilities({agentId,source:"webchat"})` 是获权入口输入能力，包负责读取和刷新。上传接口可用不代表模型支持该格式；不要在宿主固定 text-only，也不要承诺所有文件都可理解。

`content.get` 读元信息，`content.download` 按字节读取原件。读取需要合法 via 上下文，不能接收任意 URL。中断/超时是错误，不伪装成完整文件；预览对象 URL 在切换、关闭和卸载时释放。

定位失败按边界记录：
1. Service 返回“接口不存在”：检查最终版本前缀、POST /content allowlist 与 Target，不先断言模型不支持。
2. 上传 4xx/5xx：核对 multipart boundary、字段、大小、Origin、认证和公开 reason。
3. 上传成功但发送失败：核对已确认 Content 引用及消息数据面，不在宿主改写文件 DTO。
4. 消息/Task 受理但不能识图：核对输入能力与实际模型配置，记录正式 Run/Task 错误。

包展示附件、Markdown、思考和生成中的预览；宿主不覆盖内部样式。HTML 不执行，Markdown 图片不自动加载，外部链接只允许安全协议。是否展示具体思考只能使用当前公开 props，不能用内部 CSS 隐藏或透传未声明字段。
