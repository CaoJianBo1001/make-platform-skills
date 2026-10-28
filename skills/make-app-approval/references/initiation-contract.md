# 审批新建与首次发起合同

适用于业务对象的新建表单及首次发起编排。普通已有记录编辑继续使用宿主 IAM 和更新链路；任务节点编辑、退回后继续提交见 [任务详情](task-detail.md)，未提交记录恢复和撤回见 [记录生命周期](record-lifecycle.md)。

## 运行时分支

`bpmDefinitionKey?: string` 在 Schema 对象顶层，由 Meta 后端仅对有效且启用的配置返回。保留此属性；前端不再独立推算草稿、发布或启用状态，不向用户新增流程选择器。

| 已核实的上下文 | 新建字段 | 保存能力 |
| --- | --- | --- |
| Schema 成功返回，当前对象无有效 key | 普通 `createFields` / IAM 字段合同 | 普通保存，不调用 Workflow |
| 对象有 key，启动配置读取成功 | `bpm-start-config.fields` | 保存，以及新建并发起的合并提交 |
| Schema/配置加载中、读取失败或元数据无效 | 加载或错误态 | 暂停依赖配置的保存和发起，提供重试；不降级到普通字段 |

已有启用版本旁的新草稿不影响 Meta 返回的有效 key。流程以后启用不会自动提交旧记录；打开表单及保存/发起时重新核实当前配置，不能把首次生成时的快照写死。

## 字段来源、展示和提交

Service 归一化后的启动配置成功模型（不要求 Workflow 原始响应已包含完整字段对象）：

```ts
type BpmStartConfig<FieldSchema> = {
  processKey: string;
  processName: string;
  startNodeKey: string;
  startNodeName: string;
  fields: Array<{
    field: FieldSchema;
    readable: boolean;
    editable: boolean;
  }>;
};
```

- 当前 Workflow 可返回 `{ field: "字段key", readable, editable }`。可见字段定义或所需 Lookup 依赖不齐时，Service 用 `/workflow/v1/bpm-node-form-metadata` 的 START 场景（部署 appKey、启动配置 processKey）读取一次节点 fields/relations，按 key 补齐；核验 entityKey/processKey/nodeKey 与当前启动配置一致。不从普通 entity 或 Schema fields/createFields 补定义。旧完整字段对象格式继续兼容，但只有本次编排内字段定义、所需 Lookup 关系及目标 key/type 均完整且定位一致，才省略额外 START 请求，见 [完整性判定](lookup-metadata.md#start-何时可以省略额外请求)。字段对象完整而 relations 缺失时仍须读取 START；隐藏 key 不要求查到定义，也不因新接口含更多字段扩大授权。
- 交给 UI 的 `field` 包含完整字段定义，保留稳定 key、名称、类型、必填、校验、选项、精度、关联和文件属性。按启动配置顺序返回可见字段，复用宿主标准字段渲染器，不只支持文本或示例业务的几种类型。响应定位、类型或可见字段定义不完整时停止，保留原错误，不回退普通字段。
- `readable: true` 才展示；可见且 `editable: true`、宿主支持该字段的新建写入时才提供输入和提交能力。只读用详情展示，隐藏字段不注册、不提交；保存前按最新授权清理失效值。
- 审批新建的可见/可写字段**不与**普通 `createFields`、`fields` 或 IAM 字段集合求交。即使普通新建不包含某字段，只要启动配置授权且类型支持，也应在审批新建中正确展示和保存。不要将审批字段写回全局 Schema/权限缓存来放宽其他页面。
- 应用访问、对象可见与 `data.record.create` 仍需校验；关联候选目标权限、平台数据约束和最终后端写入校验继续保留。审批字段授权不等于通用 CRUD 授权。
- UI 与 Service 必须选择同一场景：Service 用权威 Schema 判定绑定，再读取启动配置并按需用 START 节点元数据补字段定义，按审批可写白名单验证普通值、关联值和附件。Schema 只承担绑定及普通权限场景，不能作为审批基础字段来源；不能相信 UI 传来的 `approvalMode`、字段授权或流程 key。
- 复用完整字段类型注册表。ID 的准确类型是 `Make.Field.ID`，系统 ID、系统流程状态和锁不成为可写输入；未知类型或缺失关键元数据明确报错，不能当文本、静默丢字段或伪造定义。
- 适配器可能取得标准 Schema 字段，也可能取得 Workflow 的 `fieldKey/fieldName/makeFieldType` 及类型专用属性。仅在 Service 边界依据已确认合同统一成宿主字段类型；保留原始 `selection.fieldSelections` 与规范化 `properties.options` 等选项及属性，不从中文名称猜类型。非法权限布尔值、`editable && !readable`、重复 key 或缺少类型应报告配置错误。
- 此前完整对象版的 `bpm-start-config` 样例中，字段定义位于 `fields[].field`；一份样例外层是 `data.fields`，另一份直接从 `fields` 开始。以宿主 Service 已确认的响应合同解析外层，不把任一样例的包装层假定为全部应用的固定协议。两份样例的 `type` 都是 `Make.Field.*` 字符串，`makeFieldType` 是 `NUMBER` 等枚举字符串。对此端点，优先采用已识别的 `Make.Field.*` 作为宿主标准类型，再依据该端点已确认的映射核对 `makeFieldType` 的一致性；映射不明或两者冲突时报告合同错误，不让其中一个值静默遮蔽另一个。以下为实际响应的精简摘录，省略了业务标识和无关属性：

```json
{
  "field": {
    "type": "Make.Field.Number",
    "makeFieldType": "NUMBER",
    "number": { "precision": 1 },
    "properties": { "precision": 1 }
  },
  "readable": true,
  "editable": true
}
```

- 样例中的多选字段同时有 `selection.fieldSelections` 与 `properties.options`；Lookup 有 `lookup.relationKey/targetFieldKey`，文件有 `file.maxCount`，金额有 `currency.decimalPlaces/symbol/useGrouping`，百分比有 `percent.decimalPlaces`。规范化应保留这些类型专属元数据和校验信息，不能只留下 `fieldKey`、名称及类型。新的 bpm-node-form-metadata 已实测返回数字 `type: 1` 和字符串 makeFieldType；按 [完整映射与转换样例](node-form-metadata.md) 处理，数字不能直接拼成 `Make.Field.*`。ID 对应 Make.Field.ID，encoding 原样保留。两类字段在同一 Service 转换边界核验类型与配置一致性；请求方式见 [节点元数据合同](workflow-api.md#审批节点字段元数据)。
- 两个保存动作均沿用必填和字段类型校验；不能用普通保存绕过必填。发起还需通过 Workflow 的资格、人员解析及流程可执行性检查。平台自动生成的 ID/审计字段不注册为待填写项；业务必填字段因不可编辑而缺值、且后台返回约束失败时，明确反馈配置问题，不代填、默认通过或暗中赋予编辑权。

### 文件与关联

复用宿主控件、值序列化和 Service 创建编排，审批改变的是源字段授权，不另造业务写入格式。

- File：使用已确认的不依赖 recordID 的预上传合同，完成上传后将后端认可的附件数组随创建数据保存。只有依赖已保存记录的旧上传接口时，先补合法的预上传合同，不为了上传先建一条空记录。支持原始 `File[]` 与已上传元数据同时回显；不得只按已有附件对象解析而丢掉新选文件。保存或发起失败后复用已确认上传结果，保留追加、移除、上限和预览行为。
- Lookup：新接口返回 relationKey/targetFieldKey/targetFieldType 和 data.relations，关系及最小目标描述见 [Lookup 边界](workflow-api.md#lookup-依赖边界)。候选与目标读权限沿用既有链路；提交稳定的字符串 ID 或 ID 数组，沿用宿主 `relations` 输入，Service 按当前审批源字段授权、基数和目标身份检查后构造后端关系数据。UI 不直接传原始 `qfei_relation`，不能为了审批绕过目标对象授权。
- 多个独立关系指向同一目标实体时，创建载荷的 `qfei_relation: [{ entityKey, id }]` 不能凭字段名区分关系；按 [Service 关系合同](../../make-app-service/references/service-api-contracts.md#lookup-relation-updates) 核对明确的后台映射。任务 recordPatch 可按 fieldKey 区分，不代表首次创建也支持同样的关系组合；没有已确认映射时不猜测或合并两次选择。
- 日期、数值、选项、人员、部门等使用业务字段原有格式。不要仅为审批引入第二套控件、精度或序列化规则。

## 保存与首次发起

桌面/平板按 [审批头部布局](../../makeui/references/drawer-layout.md#approval-header-placement) 放置按钮：左侧为全屏、模式标记与标题，右侧按“保存 → 保存并提交 → 关闭 X”排列，仅在符合下述条件时显示双按钮。保存成功后的恢复状态复用该操作区，不增加底部操作栏；按钮文案与可用性继续按本合同处理。

提供两个独立意图，按钮统一为“保存”“保存并提交”。新建保存并提交使用一次合并接口；已有记录编辑后提交才先更新原记录再发起。沿用宿主现有操作位置，桌面/手机一致；不将仅保存偷偷改为自动审批，也不根据“生成了我的审批导航”就展示提交按钮。

手机双按钮是普通单按钮保存栏的审批例外，具体宿主组合方式见 [手机表单控件](../../makeui/references/mobile-form-controls.md)。若已安装的 `MobileFormActionBar` 仅公开一个 `onSubmit`，不能向它传不存在的 secondary action API，也不能为满足单按钮规范删掉“保存”；使用该参考中明确允许的宿主双按钮组合，复用同一保存 Controller。

1. 重新检查当前对象、权限、配置及字段校验。选择“保存并提交”时，先按下节确认发起部门；取消选择时不创建、不更新、不发起，保留输入。
2. 完成必要附件预上传，复用原有字段序列化、关系转换与 Service 授权校验。新建“保存并提交”将最终创建载荷作为 `data` 交给 `/workflow/v1/bpm-process-submit`，只调用一次；不能先普通创建、再补发旧发起请求。
3. 仅保存仍使用原创建接口，不查询发起部门、不发起审批；审批新建所需的启动配置和字段校验仍执行。已有记录的发起及编辑后提交保留原 ID 和 `/workflow/v1/bpm-process`；不能对已有记录调用新建合并接口。
4. 合并提交成功后取得字符串 `recordId`，在宿主边界映射为 `recordID`，按服务端 `processStatus` 刷新列表、详情字段和标题。开始直达结束时使用真实终态，不能一律写成审批中；不要求普通 Data 读回成功后才承认提交成功。

发起前检查失败且尚未发送首次发起或新建合并提交请求时，可以在修正原因后重试检查；若处理的是已有记录，保留原 `recordID` 和已完成上传，不重复保存。新建合并提交失败不凭空生成“已保存”会话或恢复按钮。

结果沿用统一错误处理：上游 `code=200` 为成功，其他 code 保留并展示对应 `msg`；HTTP 200 不能掩盖业务失败。失败是否落库及其处理由后端负责，前端不实现删除回滚、不增加“核查流程”按钮。错误展示与再次创建资格分开：合并接口可能创建后发起失败，非 200 业务码或 HTTP 4xx 本身不保证未创建；落库结果未可靠确认时，保留原错误、表单和上传结果，阻止本会话再次创建，也不能切换到普通保存绕过。仅在按已确认合同核实未创建后才能重新创建；若确认已创建，复用原 ID 的已有记录链路。不能把业务错误改成网络错误或仅用通用“结果未知”覆盖原始 msg。

HTTP/网络异常继续由既有请求层处理；写请求超时、中断或成功响应缺少可靠记录 ID 时，不自动重发创建。该接口没有请求幂等标识，不自行添加未经支持的幂等参数。

| 结果 | 后续行为 |
| --- | --- |
| 写请求发出前的校验、部门查询/选择、附件预上传失败或取消 | 保留允许编辑的输入和已有上传结果，可修正后重试；创建/提交/发起请求均为零 |
| 新建合并接口返回非 200 业务码 | 展示后端错误；落库结果未确认时阻止再次创建，不补发旧接口、不虚构已保存 ID |
| 新建提交结果未知，尚无可靠 ID | 阻止盲目重复创建，沿用宿主结果未知处理 |
| 已有记录更新成功、首次发起失败 | 保留原 ID 和上传结果，按原有恢复链路仅重试尚未完成的发起阶段 |
| 发起请求已发送，结果未知或超时 | 沿用宿主核查方式，不自动重试；无法核实时保留待确认状态 |
| 发起成功或服务端返回复用结果 | 同步真实状态，不再次首次发起 |

同一保存会话拦截重复点击；前端互斥不能替代后端跨终端的原子校验和幂等。切换对象、用户、租户、应用或环境时取消/忽略旧读取结果。配置刷新不能丢失已经保存的 ID 或将结果未知状态重置为可再次创建。

发起前确认配置停用时刷新能力，仅保留当前仍有权的普通保存；若发起时发生配置冲突，报告真实错误，已有记录保留原 ID 并刷新，不自动改用另一流程。

已有记录的保护边界：首次发起只用于明确 `UNSUBMITTED`、未锁定且对象仍有有效 key 的记录；缺失/null/空状态不代表按审批配置创建，不能当作可发起。已有记录编辑页必须同时提供“保存”和“保存并提交”，更新原记录后使用原 ID；不切换到审批新建字段，不重新创建。详情页保留独立“发起审批”，不附加普通编辑权限、不先更新记录；表单内失败恢复只继续尚未完成的发起阶段。RETURNING 与终态规则见 [记录生命周期](record-lifecycle.md)。

## 发起部门

新建“保存并提交”、已有记录首次发起和编辑后发起共用一个部门选择链路；任务 `SUBMIT` 继续原实例，不重新选择发起部门。仅保存不触发这条查询。

- 取当前登录上下文的字符串 `userId`，通过宿主 Service 调用 `POST /data/v1/user`，Target 为 `MakeService.GetResource`，body 仅 `{ userId }`。不是 `ListResources` 人员候选，也不是全组织部门目录；不得使用业务表单“申请人”或“申请部门”代替。
- 成功 `data.departments` 为 `[{ departmentId: string, departmentName: string }]`。核对返回 userId、完整数组及字符串 ID，按 departmentId 去重；不沿用会丢弃 departments 的候选转换器，也不将其他个人资料暴露到选择器。
- 一个部门自动使用；多个部门显示“选择发起部门”单选弹窗和“请选择本次流程发起使用的部门。”，未选时禁用“确认”。选择确认后传 `starterDepartmentId`；取消、对象或登录身份切换不继续写入。复用宿主弹层、按钮与焦点管理，两端共享选择结果。
- 明确空数组时省略 starterDepartmentId，由 Workflow 校验无部门场景；查询失败或缺失 departments 不能当作空数组、单部门或任选第一个部门继续发起。

## UI → Service → Workflow

使用 [make-app-service](../../make-app-service/SKILL.md) 的现有请求、登录上下文、Trace、取消、错误及配置链路。浏览器只访问宿主 Service，不直连 Workflow，不接受浏览器覆盖部署 `appKey`。

以下是可复用的宿主接口形状；优先使用宿主已经声明的等价接口，并同步 `apps/docs/api.md`，不要并排新建同义路由。任务、撤回与历史的完整映射见 [接口合同](workflow-api.md)：

| 宿主接口 | 用途 |
| --- | --- |
| `GET /api/entities/:entityKey/bpm-start-config` | 新建启动字段；不传已有记录 ID 冒充新建 |
| `POST /api/entities/:entityKey/records` | 复用已有创建编排，按运行时选择普通/审批字段授权 |
| `POST /api/entities/:entityKey/bpm-files/:fieldKey` | 新建审批附件预上传，multipart 使用宿主已确认合同 |
| `POST /api/entities/:entityKey/bpm-submit` | `{ data, relations?, starterDepartmentId? }`，新建并发起；Service 验证并转换关系，注入权威 bpmKey |
| `GET /api/users/:userId` | 查询单人及所属部门，成功规范化为 `{ userId, userName, departments }`，可保留既有头像字段 |
| `POST /api/entities/:entityKey/records/:recordID/bpm-start` | `{ starterDepartmentId? }`，对已保存记录首次发起，兼容 `{}` |

Workflow 均为 `POST`，由 Service 设置 `X-Make-Target`：

| 资源 | Target | 请求体 |
| --- | --- | --- |
| `/workflow/v1/bpm-start-config` | `MakeService.GetResource` | `{ appKey, entityKey }` |
| `/workflow/v1/bpm-process-submit` | `MakeService.CreateResource` | `{ appKey, entityKey, bpmKey, data, starterDepartmentId? }` |
| `/workflow/v1/bpm-process` | `MakeService.CreateResource` | `{ appKey, entityKey, recordId, starterDepartmentId? }` |

部署上游为已配置的网关 origin + `/make` + 资源路径；本地预览为已有工具解析出的公网 origin + `/api/make` + 资源路径。不要硬编码环境域名或另加 Workflow 凭据。`recordID` 到 `recordId` 仅在适配边界改名，值始终为字符串。

合并提交的 bpmKey 取本次权威启动配置 processKey，data 使用原创建接口的最终载荷（含经 Service 转换的关系和已上传附件），不直接转发 UI 的 relations 包装。平台还支持可选 comment/variables；没有对应产品输入时省略，不新增控件或保留前缀 __bpm_ 的变量。

合并提交成功必须额外保留字符串 recordId。发起成功数据至少保留 `processInstanceId`、`processStatus`、`status`、`reused`；实例 `status` 与业务 `processStatus` 不混用，`START_FAILED` 不能当成功。Workflow 完整错误响应沿用 Service 的既有透传合同，UI 通过宿主错误适配展示安全消息和追踪信息。启动字段是规范化接口时应在 API 文档注明成功形状。

首次发起最终资格由 Workflow 校验，不额外附加普通创建/读取/编辑权限作为已经保存记录的发起前置条件；普通创建和更新仍各自执行原操作权限。只有创建权限、没有普通读取权限的用户不能因前端强制读回而无法处理刚保存的记录；结果未知的核查方式须遵守该权限边界。

新边界函数记录入口、失败和普通/审批分支、保存是否已确认等安全上下文；不记录表单内容、凭据或附件地址。纯字段转换及状态辅助函数不加日志。
