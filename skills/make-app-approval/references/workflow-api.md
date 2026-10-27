# UI、Service 与 Workflow 接口适配

复用 `make-app-service` 的认证、应用配置、请求解析、Trace、取消和上游响应透传。下面列出已核对的接入路由及上游合同；宿主有等价路径则复用，并在 `apps/docs/api.md` 明确成功形状与包装层，不并排新建同义 API。表中的 `/api` 是 UI 适配层逻辑路径；需要 `/api/make/app` 挂载前缀的宿主由既有请求/路由层统一映射，不在页面拼接两套路径。

## 宿主 Service 路由

| 路由（均以 /api 开头） | 请求与返回形状 |
| --- | --- |
| GET `/api/schema` | 普通业务运行时的权限过滤 Schema、对象流程绑定判定；不用于审批任务字段基础信息或任务附件类型核验 |
| POST `/api/bpm/tasks/form` | `{ processInstanceId, taskId }`；先取任务并核验定位，再取 TASK 节点定义并补查必要 Lookup 依赖；返回 `{ ...Workflow原信封, metadata: 宿主MakeAppSchema }`，metadata 仅含可见字段和必要 Lookup 辅助定义 |
| POST `/api/bpm/tasks/lookup-options` | reference、fieldKey、可选 keyword/pagination；每次重查任务及目标读取权限，返回 `{ options, searchable, total }`，不复用普通源字段授权 |
| GET `/api/entities/:entityKey/bpm-start-config` | 新建不带 recordID；返回规范化启动配置 |
| POST `/api/entities/:entityKey/records` | 原创建接口；普通/审批模式在 Service 判定 |
| POST `/api/entities/:entityKey/bpm-files/:fieldKey` | 新建预上传；multipart 重复 file，返回文件元数据数组 |
| POST `/api/entities/:entityKey/records/:recordID/bpm-start` | `{}`；返回规范化流程发起结果 |
| POST `/api/entities/:entityKey/records/:recordID/bpm-withdraw` | `{comment}`；保留 Workflow 信封 |
| POST `/api/bpm/process/detail` | 一个实例定位或一个业务记录定位；保留 Workflow 信封 |
| POST `/api/bpm/tasks/query` | taskStatus、分页及可选条件；保留 data 数组和 pagination.total |
| POST `/api/bpm/tasks/detail` | `{ processInstanceId, taskId }`；保留 Workflow 原始信封，任务 UI 加载改用 form 聚合接口 |
| POST `/api/bpm/tasks/actions` | 任务 reference、actionType、comment、recordPatch、RETURN 的 targetNodeKey；保留 Workflow 信封 |
| POST `/api/bpm/tasks/:processInstanceId/:taskId/files/:fieldKey` | multipart file；任务授权预上传，返回文件元数据数组 |
| POST `/api/bpm/timeline/query` | 一个定位与 `pagination: {page,size}`；保留 data 与 pagination.total |

不要假定所有 API 都直接返回 data 或都带信封。启动配置/首次发起是宿主规范化结果；原始任务、流程详情、撤回、时间线保留 Workflow 信封；任务 form 成功时保留 data 并增加 metadata，lookup-options 是规范化结果。聚合是宿主编排，不是新增 Workflow Target；失败保留上游 HTTP/业务错误，不把失败变为空元数据。UI provider 在声明的边界解析一次，不能多次猜测 `data.data`。

## Workflow 资源与 Target

以下均 POST，Service 设置 `X-Make-Target`。网关前缀沿用运行时：部署 `/make`，本地预览 `/api/make`；下面只列其后的资源路径，不硬编码域名。

| 资源 | Target | 正文 |
| --- | --- | --- |
| `/workflow/v1/bpm-node-form-metadata` | MakeService.GetResource | `{ scene: "START", appKey, processKey }` 或 `{ scene: "TASK", processInstanceId, taskId }` |
| `/workflow/v1/bpm-start-config` | MakeService.GetResource | `{ appKey, entityKey }` |
| `/workflow/v1/bpm-process` | MakeService.CreateResource | `{ appKey, entityKey, recordId }` |
| `/workflow/v1/bpm-process` | MakeService.UpdateResource | `{ appKey, entityKey, recordId, comment }` |
| `/workflow/v1/bpm-process` | MakeService.GetResource | `{ processInstanceId }` 或 `{ appKey, entityKey, recordId }` |
| `/workflow/v1/bpm-task` | MakeService.ListResources | `{ appKey, viewType: 'MY', taskStatus, pagination, ...filters }` |
| `/workflow/v1/bpm-task` | MakeService.GetResource | `{ processInstanceId, taskId }` |
| `/workflow/v1/bpm-task` | MakeService.CreateResource | `{ processInstanceId, taskId, actionType, comment, recordPatch, targetNodeKey? }` |
| `/workflow/v1/bpm-timeline` | MakeService.ListResources | 一个实例或业务记录定位，加 pagination |

实例定位与业务记录定位二选一，不混传；业务记录定位的 appKey 由 Service 注入。任务详情/动作只带已声明 reference，不擅自追加 bpmKey、客户端 appKey 或另一个记录身份。服务端继续对实例和任务执行访问授权，不能因路径有 ID 就允许访问。

## 审批节点字段元数据

字段基础信息使用 `POST /workflow/v1/bpm-node-form-metadata` + `X-Make-Target: MakeService.GetResource`，沿用上述运行时网关、登录、Trace 和取消上下文。两种场景不混传参数，不追加 entityKey、recordId 或自造的 fieldKeys 筛选：

- 发起：`{ scene: "START", appKey: 部署配置, processKey: 启动配置.processKey }`。先取得权威 bpm-start-config，再读取最新已部署流程的发起节点定义；后端核验发起资格。
- 任务：`{ scene: "TASK", processInstanceId, taskId }`。先校验任务所属应用及 reference，再读取实例绑定版本的节点定义；不使用当前对象绑定的新版流程或启动字段替代历史节点。

成功信封为 `{ code: 200, msg, data: { appKey, entityKey, processKey, nodeKey, nodeName, fields } }`。fields 是当前节点可见/可编辑 key 的去重并集；空集合返回空数组。校验应用/对象定位，START 还须与启动配置的 processKey/startNodeKey 对齐；缺失或重复定义明确报错。接口不提供 formData、fieldPermission、actions；这些仍来自 bpm-task，readable/editable 仍来自 bpm-start-config，元数据不能扩大授权。

fields 必须保留完整 properties、validations、capabilities 及类型专用配置。在 Service 边界规范化 `fieldKey/fieldName/makeFieldType` 为宿主 key/name/type；数字 `type: 1` 不代表控件类型。完整的 18 种枚举映射、配置归位、脱敏响应、规范化示例和可执行参考见 [节点字段转换合同](node-form-metadata.md)。标准 Make.Field.* 与 makeFieldType 同时存在时核对一致性；未知枚举、冲突或非法结构明确报错，不能猜类型或丢校验。

启动配置有可见字符串 key 时只请求一次 START 元数据；旧的完整字段对象响应无需额外请求。任务详情、办理前重读、任务附件类型校验及候选源字段使用 TASK 元数据；已完成/无动作任务仍可加载只读定义，不开放编辑、上传和候选。结果不写入普通 Schema 缓存，源定义失败不回退 entity/Schema；完成的上游错误保持 HTTP、业务码、Content-Type、正文和 Trace。

### Lookup 依赖边界

当前成功样例的 lookup 只有 relationKey/targetFieldKey，尚未包含关系两端/基数和目标字段完整定义。不能将“字段结构与 entity 一致”理解为已内嵌全部关系和目标对象。普通 entity 存在权限过滤，不能再保证它包含 BPM 源字段。

已有集成暂保留最小依赖补查：`POST /meta/v1/relation` + GetResource、正文 `{ appKey, key: relationKey }`，校验关系身份、from/to.entityKey 和 cardinality；目标字段通过已有 Entity GetResource 查找。自关联已包含的目标定义可复用，否则仅补目标定义，不用它补 BPM 源字段。目标定义被过滤时明确失败，不能静默丢字段或放宽权限；需后端补充节点内 Lookup 所需关系定义及目标字段完整定义，并确认响应位置后才能移除这些补查。

候选记录仍按既有目标对象、目标字段和记录读取权限查询，不要求节点元数据返回全部候选。辅助定义不成为额外可见/可编辑字段。单次表单按关系/目标去重；单次搜索只解析当前 Lookup 链路，不为搜索加载所有字段的关系。无跨请求授权或元数据缓存。

## 参数与响应

- recordID→recordId 仅在边界改名，业务记录/任务/实例 ID 始终为字符串。分页 page 从 1 开始，size 1–200。
- 列表允许 recordId、entityKey、starterId、assigneeId、processStatus、startDate、endDate 等已声明条件；页面只生成 [列表合同](package-and-list.md) 中的默认条件。两个页签只请求 PENDING/COMPLETED；Service 支持 CLOSED 不代表 UI 要额外查询它。
- 人员过滤：UI/Service DTO 用十进制字符串；Service 校验 Long 范围（有符号 64 位），转给 Workflow 时用无损 JSON 整数编码，例如 `lossless-json` 的 LosslessNumber。不能 `Number(id)` 后 JSON.stringify，也不能以姓名替代 ID。保留已有 lossless 响应解析。
- 日期为空省略；当前 Workflow 请求为 `YYYY-MM-DD HH:mm:ss`，自然日边界按 [列表合同](package-and-list.md) 转换一次，不自行换时区。
- 任务 actionType 仅 APPROVE/REJECT/RETURN/SUBMIT；comment trim、长度检查，RETURN/REJECT 必填。recordPatch 必须为对象；RETURN 固定空对象。Service 不能把任务补丁送入普通 IAM 更新过滤器或普通 Data 关系转换器。
- 附件预上传复用既有文件 API；Service 按启动节点或当前任务分别重新授权，调用 uploadFiles 时不传已有 recordID。不增加另一个文件存储或绕过 Service 的上传地址。
- 当前 Workflow 信封成功码为 200；即使 HTTP 200 也须检查 code，其他响应保留 HTTP、业务码、安全消息和 Trace。透传完整错误不等于 provider 接受结构无效的成功响应。
- 发起结果校验 processInstanceId/processStatus/status/reused，START_FAILED 不算成功；任务动作和撤回按各自 reference/结果校验。预检查失败与写请求已发出后结果未知要区分，不能把任意 4xx 当作无副作用保证。

Service 保持薄编排，不新增数据库、状态缓存真相或审批引擎。新边界日志只记录操作名、分页、阶段、是否已保存等安全上下文；不打印意见、表单值、附件内容、token 或原始上游异常对象。
