# UI、Service 与 Workflow 接口适配

复用 `make-app-service` 的认证、应用配置、请求解析、Trace、取消和上游响应透传。下面列出已核对的接入路由及上游合同；宿主有等价路径则复用，并在 `apps/docs/api.md` 明确成功形状与包装层，不并排新建同义 API。表中的 `/api` 是 UI 适配层逻辑路径；需要 `/api/make/app` 挂载前缀的宿主由既有请求/路由层统一映射，不在页面拼接两套路径。

## 宿主 Service 路由

| 路由（均以 /api 开头） | 请求与返回形状 |
| --- | --- |
| GET `/api/schema` | 普通业务运行时的权限过滤 Schema、对象流程绑定判定；不用于审批任务字段基础信息或任务附件类型核验 |
| POST `/api/bpm/tasks/form` | `{ processInstanceId, taskId }`；先取任务并核验定位，再补 Entity/Relation 定义；返回 `{ ...Workflow原信封, metadata: 宿主MakeAppSchema }`，metadata 仅含可见字段和必要 Lookup 辅助定义 |
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
| `/workflow/v1/bpm-start-config` | MakeService.GetResource | `{ appKey, entityKey }` |
| `/workflow/v1/bpm-process` | MakeService.CreateResource | `{ appKey, entityKey, recordId }` |
| `/workflow/v1/bpm-process` | MakeService.UpdateResource | `{ appKey, entityKey, recordId, comment }` |
| `/workflow/v1/bpm-process` | MakeService.GetResource | `{ processInstanceId }` 或 `{ appKey, entityKey, recordId }` |
| `/workflow/v1/bpm-task` | MakeService.ListResources | `{ appKey, viewType: 'MY', taskStatus, pagination, ...filters }` |
| `/workflow/v1/bpm-task` | MakeService.GetResource | `{ processInstanceId, taskId }` |
| `/workflow/v1/bpm-task` | MakeService.CreateResource | `{ processInstanceId, taskId, actionType, comment, recordPatch, targetNodeKey? }` |
| `/workflow/v1/bpm-timeline` | MakeService.ListResources | 一个实例或业务记录定位，加 pagination |

实例定位与业务记录定位二选一，不混传；业务记录定位的 appKey 由 Service 注入。任务详情/动作只带已声明 reference，不擅自追加 bpmKey、客户端 appKey 或另一个记录身份。服务端继续对实例和任务执行访问授权，不能因路径有 ID 就允许访问。

## 审批字段的 Meta 读取

字段基础信息统一通过 Meta `POST /meta/v1/entity` + `X-Make-Target: MakeService.GetResource`，body `{ appKey, key }`，其中 appKey 取部署配置、key 取已校验任务的 entityKey。使用 Meta 网关与现有登录/Trace 上下文，不让浏览器直连固定域名。解析成功信封后按 `data.key`、`data.appKey` 验证定位，从 `data.properties.fields` 归一化字段定义；详见 [实体接口](../../makedsl/references/MetaAPIDesign.md#entity) 和 [任务字段合同](task-detail.md#元数据读取合同)。

Lookup 关系调用 `POST /meta/v1/relation` + `MakeService.GetResource`、正文 `{ appKey, key: relationKey }`，校验 Make.Relation 与定位、from/to 和基数；目标字段同样由 Entity 提供。只在本次任务表单/当前候选编排内去重，不跨请求缓存授权和元数据。

启动配置可见字段若仅返回字符串 key，也按 [发起侧合同](initiation-contract.md) 对已核实对象读取一次 Entity 补齐；完整字段对象无需额外读取。Entity 返回全部自定义字段且不做字段权限裁剪；任务展示/编辑仍由当前 fieldPermission/actions、启动表单由 readable/editable 决定。任务附件校验共用此来源；不再读取 `/meta/v1/schema` 补审批字段，不把 Entity 结果覆盖普通权限 Schema。完整字段元数据不是业务记录数据的访问授权。

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
