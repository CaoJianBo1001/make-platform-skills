# UI、Service 与 Workflow 接口适配

复用 `make-app-service` 的认证、应用配置、请求解析、Trace、取消和上游响应透传。下面列出已核对的接入路由及上游合同；宿主有等价路径则复用，并在 `apps/docs/api.md` 明确成功形状与包装层，不并排新建同义 API。表中的 `/api` 是 UI 适配层逻辑路径；需要 `/api/make/app` 挂载前缀的宿主由既有请求/路由层统一映射，不在页面拼接两套路径。

## 宿主 Service 路由

| 路由（均以 /api 开头） | 请求与返回形状 |
| --- | --- |
| GET `/api/schema` | 普通业务运行时的权限过滤 Schema、对象流程绑定判定；不用于审批任务字段基础信息或任务附件类型核验 |
| POST `/api/bpm/tasks/form` | `{ processInstanceId, taskId }`；一次读取任务并核验定位，从 data.formMetadata 解析字段及内嵌 Lookup 关系和目标 key/type；返回 `{ ...Workflow原信封, metadata: 宿主MakeAppSchema }`，metadata 仅含可见字段和必要 Lookup 辅助定义 |
| POST `/api/bpm/tasks/lookup-options` | reference、fieldKey、可选 keyword/pagination；每次重查任务及目标读取权限，返回 `{ options, searchable, total }`，不复用普通源字段授权 |
| GET `/api/entities/:entityKey/bpm-start-config` | 新建不带 recordID；返回规范化启动配置 |
| POST `/api/entities/:entityKey/records` | 原创建接口；普通/审批模式在 Service 判定 |
| POST `/api/entities/:entityKey/bpm-files/:fieldKey` | 新建预上传；multipart 重复 file，返回文件元数据数组 |
| POST `/api/entities/:entityKey/bpm-submit` | `{ data, relations?, starterDepartmentId? }`；返回含字符串 recordId 的规范化流程发起结果 |
| GET `/api/users/:userId` | 单人详情及所属部门；规范化结果见 [发起部门](initiation-contract.md#发起部门) |
| POST `/api/entities/:entityKey/records/:recordID/bpm-start` | `{ starterDepartmentId? }`；返回规范化流程发起结果 |
| POST `/api/entities/:entityKey/records/:recordID/bpm-withdraw` | `{comment}`；保留 Workflow 信封 |
| POST `/api/bpm/process/form` | 一个实例或业务记录定位；从同次读取的 data.formMetadata 返回 `{ ...原信封, metadata: 宿主MakeAppSchema }`，只读 |
| POST `/api/bpm/process/query` | 固定 viewType: MY；已发起列表，详见 [已发起合同](initiated-instances.md) |
| POST `/api/bpm/process/detail` | 一个实例定位或一个业务记录定位；保留 Workflow 信封 |
| POST `/api/bpm/tasks/query` | taskStatus、分页及可选条件；保留 data 数组和 pagination.total |
| POST `/api/bpm/tasks/detail` | `{ processInstanceId, taskId }`；保留 Workflow 原始信封，任务 UI 加载改用 form 聚合接口 |
| POST `/api/bpm/tasks/actions` | 任务 reference、actionType、comment、recordPatch、RETURN 的 targetNodeKey；保留 Workflow 信封 |
| POST `/api/bpm/tasks/:processInstanceId/:taskId/files/:fieldKey` | multipart file；任务授权预上传，返回文件元数据数组 |
| POST `/api/bpm/timeline/query` | 一个实例或业务记录定位；不分页，保留完整 data、actionResult 和 TASK_PENDING |

不要假定所有 API 都直接返回 data 或都带信封。启动配置/首次发起是宿主规范化结果；原始任务、流程详情、撤回、时间线保留 Workflow 信封；任务 form 成功时保留 data 并增加 metadata，lookup-options 是规范化结果。聚合是宿主编排，不是新增 Workflow Target；失败保留上游 HTTP/业务错误，不把失败变为空元数据。UI provider 在声明的边界解析一次，不能多次猜测 `data.data`。

## Workflow 资源与 Target

以下均 POST，Service 设置 `X-Make-Target`。网关前缀沿用运行时：部署 `/make`，本地预览 `/api/make`；下面只列其后的资源路径，不硬编码域名。

| 资源 | Target | 正文 |
| --- | --- | --- |
| `/workflow/v1/bpm-start-config` | MakeService.GetResource | `{ appKey, entityKey }` |
| `/workflow/v1/bpm-process-submit` | MakeService.CreateResource | `{ appKey, entityKey, bpmKey, data, starterDepartmentId? }`，仅新建提交 |
| `/data/v1/user` | MakeService.GetResource | `{ userId }`，取得该人员的 departments |
| `/workflow/v1/bpm-process` | MakeService.CreateResource | `{ appKey, entityKey, recordId, starterDepartmentId? }`，已有记录发起 |
| `/workflow/v1/bpm-process` | MakeService.UpdateResource | `{ appKey, entityKey, recordId, comment }` |
| `/workflow/v1/bpm-process` | MakeService.ListResources | `{ appKey, viewType: "MY", pagination, entityKey?, processStatus?, startDate?, endDate? }` |
| `/workflow/v1/bpm-process` | MakeService.GetResource | `{ processInstanceId }` 或 `{ appKey, entityKey, recordId }` |
| `/workflow/v1/bpm-task` | MakeService.ListResources | `{ appKey, viewType: 'MY', taskStatus, pagination, ...filters }` |
| `/workflow/v1/bpm-task` | MakeService.GetResource | `{ processInstanceId, taskId }` |
| `/workflow/v1/bpm-task` | MakeService.CreateResource | `{ processInstanceId, taskId, actionType, comment, recordPatch, targetNodeKey? }` |
| `/workflow/v1/bpm-timeline` | MakeService.ListResources | 一个实例或业务记录定位；无 pagination，返回完整事件数组 |

实例定位与业务记录定位二选一，不混传；业务记录定位的 appKey 由 Service 注入。任务详情/动作只带已声明 reference，不擅自追加 bpmKey、客户端 appKey 或另一个记录身份。服务端继续对实例和任务执行访问授权，不能因路径有 ID 就允许访问。

## 审批节点字段元数据

三个读取资源一次返回 `data.formMetadata`；成功仍以 code === 200 判断。沿用上述网关、登录、Trace 和取消上下文，不另发元数据请求，不提供旧接口或旧完整字段对象的回退。

| 页面 | GetResource | 参数 | 元数据对照 |
| --- | --- | --- | --- |
| 新建/发起 | bpm-start-config | `{ appKey, entityKey }` | 当前启动配置 processKey/startNodeKey |
| 待处理/已完成 | bpm-task | `{ processInstanceId, taskId }` | 已授权任务 appKey/entityKey；有 bpmKey 时核对 processKey |
| 已发起实例 | bpm-process | `{ processInstanceId }` 或 `{ appKey, entityKey, recordId }` | 实例 bpmKey 对应 formMetadata.processKey |

formMetadata 为 `{ appKey, entityKey, processKey, nodeKey, nodeName, fields, relations }`。节点和字段范围取实例绑定的 BPM 版本，字段名称、选项、校验、关系等读取当前 Meta。新建取当前已启用且已部署流程发起节点；实例详情取其绑定版本发起节点。退回重提 taskDefinitionKey 可能带 `bpm_resubmit_` 前缀，实际表单节点以 formMetadata.nodeKey 为准，不能强行比较这两个 key，也不能挑 currentTasks 代替实例表单。

fields 必须保留完整 properties、validations、capabilities 及类型专用配置。Service 规范化 fieldKey/fieldName/makeFieldType 为现有字段合同，见 [18 种字段转换合同](form-metadata.md)。类型专属配置允许缺省或为空，已提供但非法或冲突的配置明确报错；空节点 fields/relations 均为空数组，没有 Lookup 时 relations 为空数组。

元数据不替代 formData、fieldPermission、actions；新建仍按 fields[].field 字符串匹配定义，按启动配置顺序投影 readable 字段并使用 editable。任务按当前 fieldPermission/actions；已完成/无动作任务只读。实例按 viewPermission 固定只读。隐藏字段不要求定义，额外元数据不扩大授权。

任务详情、办理前重读、任务附件类型核验、候选源字段均从本次 bpm-task 响应取得 formMetadata。每次只读一次对应资源，不另请求元数据；合法空字段直接展示，缺失内嵌定义或可见 key 缺定义直接报错，不回退 entity/Schema 或最新 START。结果不写入普通 Schema 缓存。已完成上游错误保留 HTTP、业务码、Content-Type、正文和 Trace，HTTP 200 不代表业务成功。

### Lookup 依赖边界

三个读取响应的 formMetadata.relations[] 返回标准 Make.Relation，Lookup 配置含 relationKey/targetFieldKey/targetFieldType；不通过普通 Meta 或 Schema 补依赖。

最小合同和实现见 [Lookup 节点依赖](lookup-metadata.md)、[纯依赖解析器](../assets/bpm-lookup-metadata.mjs)。关系需要 key、from/to.entityKey、from/to.cardinality；目标对象取当前对象的另一端，目标端 one/many 决定单选/多选。目标字段 key/type 足以定位候选列和判断现有文本搜索能力；无需为了选择记录强求目标实体完整定义。若要增加依赖 options、格式等配置的展示能力，先确认对应合同，不能自行伪造。

候选记录仍按既有目标对象、目标字段和记录读取权限查询，不要求节点元数据返回全部候选。辅助定义不成为额外可见/可编辑字段。单次表单按关系/目标去重；单次搜索只解析当前 Lookup 链路，不为搜索加载所有字段的关系。无跨请求授权或元数据缓存。

## 参数与响应

- recordID→recordId 仅在边界改名，业务记录/任务/实例 ID 始终为字符串。任务列表与 Lookup 候选分页 page 从 1 开始，size 1–200；timeline 不分页，旧 pagination 兼容忽略。
- 列表允许 recordId、entityKey、starterId、assigneeId、processStatus、startDate、endDate 等已声明条件；页面只生成 [列表合同](package-and-list.md) 中的默认条件。两个页签只请求 PENDING/COMPLETED；Service 支持 CLOSED 不代表 UI 要额外查询它。
- 人员过滤：UI/Service DTO 用十进制字符串；Service 校验 Long 范围（有符号 64 位），转给 Workflow 时用无损 JSON 整数编码，例如 `lossless-json` 的 LosslessNumber。不能 `Number(id)` 后 JSON.stringify，也不能以姓名替代 ID。保留已有 lossless 响应解析。
- 日期为空省略；当前 Workflow 请求为 `YYYY-MM-DD HH:mm:ss`，自然日边界按 [列表合同](package-and-list.md) 转换一次，不自行换时区。
- 任务 actionType 仅 APPROVE/REJECT/RETURN/SUBMIT；comment trim、长度检查，RETURN/REJECT 必填。recordPatch 必须为对象；RETURN 固定空对象。Service 不能把任务补丁送入普通 IAM 更新过滤器或普通 Data 关系转换器。
- 附件预上传复用既有文件 API；Service 按启动节点或当前任务分别重新授权，调用 uploadFiles 时不传已有 recordID。不增加另一个文件存储或绕过 Service 的上传地址。
- 当前 Workflow 信封成功码为 200；即使 HTTP 200 也须检查 code，其他响应保留 HTTP、业务码、安全消息和 Trace。透传完整错误不等于 provider 接受结构无效的成功响应。
- 发起结果校验 processInstanceId/processStatus/status/reused，START_FAILED 不算成功；任务动作和撤回按各自 reference/结果校验。预检查失败与写请求已发出后结果未知要区分，不能把任意 4xx 当作无副作用保证。

Service 保持薄编排，不新增数据库、状态缓存真相或审批引擎。新边界日志只记录操作名、分页、阶段、是否已保存等安全上下文；不打印意见、表单值、附件内容、token 或原始上游异常对象。
