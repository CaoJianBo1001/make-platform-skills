# 当前任务详情与办理

## 字段、值与授权来源

`ApprovalTaskDetail` 必传 `scopeKey`、`reference: { processInstanceId, taskId }`、`provider: { loadDetail, submitAction }`、`components: { Button, TextArea }`、`renderField`、`validateFields`、`onActionSuccess`。可选 `renderLayout`、`history`、`renderFieldLabel`、`onRequestError`，均使用 `/detail` 导出的类型。

每次 `loadDetail`（包括办理前重读）先取得并校验当前任务、实例和 appKey，再调用 `/workflow/v1/bpm-node-form-metadata` 的 TASK 场景取得实例绑定版本的节点定义；两步都传递取消信号，并核验返回 entityKey/appKey 与当前任务及部署应用一致：

- `formData`、`fieldPermission`、`actions` 来自 `bpm-task / GetResource`；**当前节点授权**是唯一审批字段与动作依据。
- 字段名、类型、必填、选项、精度和附件限制，从节点元数据的 `data.fields` 按 `task.entityKey + fieldKey` 精确补齐，保留字段 properties/validations。组装包的 `fields: { key, label, required, fullWidth?, schema? }[]`；这里的 schema 是字段定义，不是调用 `/api/schema`，fields 也是宿主组合结果，不要求 Workflow 原本返回同名字段。
- 不使用普通 IAM 裁剪后的 Schema、普通 editFields 或 `bpm-start-config` 代替当前任务权限或补字段定义。节点元数据只提供定义，不扩大授权；仅把节点可见字段的定义和值交给包。授权自定义字段定义缺失/重复时报告具体对象和字段，不静默丢字段，也不回退 entity/Schema 或猜测类型。
- 只适配已知枚举：Workflow `field/none` → 包 `FIELDS/NONE`，`optional/required` → `OPTIONAL/REQUIRED`。`NONE` 的空 fields 可规范为省略；未知范围、重复字段、editable 不属于 visible 都应报错。缺省权限为无权限，缺省 actions 为无动作，不能理解为全部允许。
- 调用 `readApprovalTaskDetail` 校验，再用 `getApprovalTaskFields` 取得可见/可编辑字段；系统状态和锁字段永远不可写。无授权动作时只读展示，不能根据用户角色或流程状态自行添加按钮；宿主必须落实下述只读归一化，不能仅靠 actions 为空。

### 已完成任务与无动作任务的只读归一化

Workflow 已完成任务可能仍返回历史 `editPermission: { scope: "field", fields: [...] }`，这不授予当前编辑资格。已核验的包 0.2.11 中，`readApprovalTaskDetail` 仍不保留 `taskStatus`，字段是否可编辑取决于 editPermission；只传 `actions: []` 会去掉按钮，但不会自动去掉编辑控件。

宿主在每次 loadDetail 中先保留原任务 taskStatus，按上述合同组装并用 `readApprovalTaskDetail` 校验原权限/动作。校验通过后，仅 `taskStatus === "PENDING"` 且存在当前有效 actions 时保留编辑权限；其他情况将交给包的 `editPermission` 收紧为 `{ scope: "NONE" }`，actions 置空。保留 viewPermission、可见字段和值；不要在校验前覆盖历史权限而掩盖 editable 越过 visible 等非法响应。可复用 [只读策略参考适配器](../assets/task-detail-policy.mjs)，它接收包公开的 decoder，不复制包实现。

判断使用任务状态，不使用 processStatus、列表页签或绑定状态：一个已完成任务所属流程仍可能处于 IN_APPROVAL。只读控件不调用编辑候选或预上传；提交前重读也走同一适配器，旧草稿和旧动作不能继续办理。Service 仍独立校验最新 PENDING、动作及字段授权。

### 元数据读取合同

统一使用 `POST /workflow/v1/bpm-node-form-metadata` + `MakeService.GetResource`，body `{ scene: "TASK", processInstanceId, taskId }`；不带 appKey/entityKey/processKey。参数、成功结构、类型转换与错误处理见 [节点元数据合同](workflow-api.md#审批节点字段元数据)。新建另用 START，不能把新建配置用到历史任务。

普通 entity/Schema 可能按字段权限裁剪，不能作为 BPM 源字段的补齐或失败回退来源。节点接口提供定义，bpm-task 提供值及权限；仅交付当前节点可见字段与必要辅助定义，不覆盖普通 Schema/权限缓存。系统流程状态与锁仍按 [状态展示](status-display.md) 处理。

已实现的宿主聚合接点是 `POST /api/bpm/tasks/form`，body 仅 `{ processInstanceId, taskId }`；经宿主既有路由前缀适配后访问。返回 `{ ...Workflow原信封, metadata }`，其中 data 保持任务原文，metadata 使用宿主 `MakeAppSchema` 结构表达 `{ appName, schema: { appKey }, entities, relations }`。复用该数据结构不代表调用 Schema 接口。UI 的 loadDetail 每次只调聚合接口一次，组合 data 与 metadata；不再并行请求旧 detail 和 `/api/schema`。原 `/tasks/detail` 直接代理保留给原始响应消费者，聚合返回形状须写入 API 文档。

聚合先校验 Workflow 任务访问结果及 appKey/taskId/processInstanceId，再读元数据；客户端不能覆盖 appKey/entityKey。已完成任务和没有 actions 的任务仍可只读查看。每次加载、刷新、办理前核查都重读，不跨请求缓存任务授权或节点元数据快照；只在单次编排内按 entityKey/relationKey 去重。关系直接使用节点响应并保留稳定顺序，自关联辅助目标仅由已返回 key/type 描述。取消信号传递到所有上游，身份/应用/环境/任务切换时丢弃旧响应；任一上游失败不回退普通 entity/Schema 获取源字段、不自动重试，保留已完成上游错误的 HTTP、Content-Type、正文和 Trace。

Lookup 从节点字段保留 relationKey/targetFieldKey/targetFieldType，从 `data.relations` 读取两端和基数；按 [Lookup 节点依赖](lookup-metadata.md) 生成局部最小目标描述，不补查普通 entity/relation/Schema。仅装配可见 Lookup 必需的关系与目标描述，自关联补充不扩展 view/editPermission。缺失或冲突时报错，不以元数据代替候选数据的读取权限。

### 任务 Lookup 候选

任务字段控件复用宿主关联选择器，但注入任务候选 provider，不沿用普通 CRUD 的源字段授权接口。`POST /api/bpm/tasks/lookup-options` 接收 `{ processInstanceId, taskId, fieldKey, keyword?, pagination: { page, size } }`，返回 `{ options, searchable, total }`。仅携带任务定位与当前字段，Service 从任务取得应用/对象，不接受客户端替换。

每次搜索/翻页先重读任务，确认 PENDING、有效动作、当前字段可见且可编辑，再读 TASK 节点元数据，并只解析当前字段的内嵌关系及目标 key/type；目标对象、显示字段和记录读取继续执行既有 IAM/Data 检查。权限撤销应在元数据和候选读取前拒绝，不能复用首次打开详情的授权。关键词变化也重新核查；一次搜索只解析当前 Lookup，无关可见字段关系失效不应阻断它。

单次搜索复用一次任务、节点元数据、权限和候选读取；自关联也不补查目标 Entity。避免为每次搜索加载整份任务表单及全部关系。UI provider 身份稳定，传递取消信号和当前 reference，保留真实 searchable、分页、名称回显与单/多选格式；无任务定位时报错，不回退普通候选。此规则不改变普通业务导航和 CRUD；审批新建使用 START 节点的同一依赖合同。

读取值与写入值分开。宿主适配已验证支持如下 Lookup 展示形状，保留 value/name/label 等已有名称及 isDeleted，不先压成 ID 再丢失回显信息：

```json
{ "entityKey": "related_object", "data": [{ "recordID": "9000000000000000001", "value": "已保存名称", "isDeleted": true }] }
```

这是宿主已支持的输入形状，不假定所有 Workflow 版本都会展开名称。编辑草稿和最终补丁仍是 ID/null/ID 数组；新选择的名称从已获授权的候选 options 保留。只读或已完成任务不调用要求 PENDING/editPermission 的候选接口；只返回 ID 且没有已知名称时，沿用宿主 ID 文本占位，不能伪造名称、转为空值或偷偷查目标记录。名称必须完整的产品场景需确认合法的只读解析合同后再接入；不得把可编辑候选接口放宽为名称解析器。已删除引用保留原展示信息，不提供可打开的有效记录链接。

## 字段适配与写入

`renderField` 接收 `field/id/value/readOnly/disabled/error/onChange`。复用宿主业务字段注册表、显示格式、人员/部门候选、关联选择及附件组件；始终受控，保留 id、焦点、候选名称和草稿。可见但不可编辑字段使用详情值，不渲染 disabled 输入框；可编辑字段直接展示控件，不做 hover 时挂载/卸载的切换。

| 类型 | 任务补丁合同 |
| --- | --- |
| 文本、日期、人员、部门等 | 复用业务字段序列化及空值合同；不要把组件事件对象直接发给 Workflow |
| SingleSelect / MultiSelect | 按 [统一选项值合同](../../makeui/references/component-usage.md#singleselect-read--form--submit) 复用宿主字段适配：单选读取 `[{label,value}]`，表单与补丁为 scalar value；多选补丁为 value 数组。只序列化实际改动字段，空值沿用已确认的宿主合同 |
| Number/Currency/Percent | 保留输入原文直到校验；按字段 Schema 和宿主已确认规则检查格式、范围、精度，0 有效；不静默舍入、将非法值改 0 或把示例 App 的非负限制推广到所有对象 |
| Lookup | `recordPatch[fieldKey]` 为单选 ID/null、多选字符串 ID 数组；不转换为普通 Data 编辑的 `relations` 或 `qfei_relation`。候选仍检查目标读取权限和关系基数 |
| File | 只提交变化字段的最终附件数组，保留已有文件元数据；新 File 先走任务授权预上传，再把结果一起交 Workflow |

可编辑未知类型或缺失 Lookup 关系定义是明确的接入错误，不能降级文本后提交。下载/图片预览复用宿主 Service 代理，保留存储 filePath、文件名和大小；不要把有权限的文件转换为浏览器直连 Make token 链接。

包对非 RETURN 动作仅调用可见、可编辑、必填字段的 `validateFields`，0/false 不是空。宿主还需校验实际修改的非必填数值等格式约束：字段旁展示错误，用 `ApprovalDetailButtonProps.actionType` 只阻止会保存字段的动作，保留包传来的 disabled/loading；RETURN 不因业务字段格式错误被禁用。provider 在序列化、预上传和发请求前再次验证已修改字段，不能只依赖按钮 disabled。

字段错误对齐所属输入值区，审批意见错误对齐意见框。控件内部错误已经位于输入区时，不再套一层包字段错误的缩进；复用宿主布局和留白，不把示例的固定 118px/10px 写成通用尺寸，也不通过宽泛后代选择器重复偏移所有错误。

## 动作矩阵

| actionType | 按钮 | 意见 | 字段保存 |
| --- | --- | --- | --- |
| APPROVE | 同意 | 选填 | 校验并发送当前授权修改 |
| REJECT | 拒绝 | 必填 | 校验并发送当前授权修改 |
| RETURN | 退回修改 | 必填 | `recordPatch: {}`，跳过业务字段校验、序列化和附件预上传 |
| SUBMIT | 继续提交 | 按该动作 commentPolicy | 校验并发送当前授权修改，继续原实例 |

意见最大 1024 字符。RETURN 目标必须来自该动作 `returnTargets` 的唯一一项，自动写入 `targetNodeKey`；缺失、多项或与显式传参不一致时阻止办理，不让用户自选，不默认取第一项。非 RETURN 不携带 targetNodeKey。SUBMIT 是退回后当前待办的继续办理，不是创建新记录或再调流程发起接口。

## 提交前核查与恢复

保留包的原状态机，不在宿主按钮中绕过它直接提交：

1. 点击动作后先重新 `loadDetail`，确认当前任务、字段元数据/权限、actions。
2. 字段或动作配置变化时更新详情、清空旧字段草稿及意见并停止本次提交，要求重新确认。可见服务端值变化时也停止；冲突字段草稿清除，未冲突草稿及意见保留。隐藏字段变化不制造可见字段冲突。
3. 通过当前动作的校验后才调用 `submitAction`。宿主可复用 `buildApprovalTaskAction` 对最新快照再次核对白名单；不能用这个纯函数替代包的提交前网络核查。
4. 动作通过 Workflow `bpm-task / CreateResource` 一次写入 `recordPatch` 并流转；不先普通 PATCH 业务记录，也不绕过审批锁补写 Lookup 或附件。
5. 响应校验同一 taskId、processInstanceId、actionType，非空 processStatus 和布尔 processEnded。根据真实结果刷新，不把 APPROVE 或“已完成”页签直接当作流程结束。

进行中互斥；失败不自动重发。通过 `onRequestError(error, {operation, message, resultUnknown})` 接入宿主统一错误/Trace 出口，仅提示一次。字段和意见错误留在控件旁并聚焦，不作为网络 Toast；首次加载无授权时保留重试，不显示伪造动作。动作请求失败后保留当前按钮、可编辑草稿和意见，再点击仍先核查；结果未知不宣称未执行。取消/切换范围导致的过期请求不弹错、不刷新新任务。成功后包锁定当前动作界面，宿主关闭详情并刷新列表/相关业务记录；刷新失败应提示“办理成功，刷新未完成”，不能重办同一动作。

## 任务附件

预上传接口以 processInstanceId、taskId、fieldKey 定位。Service 重取任务，校验当前应用/任务/实例、PENDING 任务、有效动作、该字段可见且可编辑，再按上述 TASK 节点元数据合同确认 File 类型及限制；不能使用 Schema 核验源字段、套普通记录更新权限，也不能让浏览器指定任意 entityKey/recordID。

预上传不带已有记录 ID，不立即增删业务记录附件；删除只改草稿最终数组。按任务+字段+原 File 复用已上传结果，失败重试不重复上传，未改附件不进入 recordPatch。支持原始 `File[]` 与上传后的元数据同时回显，部分成功时保存已取得结果；范围切换清理缓存。RETURN 即使有待上传 File，也必须上传零次、发送空补丁。

## 容器与历史

标题与紧随其后的状态 Tag 整体放在宿主左侧全屏控件之后。按 [流程状态标题合同](status-display.md#展示合同) 决定复用 `slots.title`，或在 detail 存在时通过公开 `slots.detail.processStatus` 生成宿主标题组；包文案不符时不得强制沿用旧标题。无 detail 的加载/失败态保留原 title，替换前后保留原标题语义及字号、字重，不拆出 Tag 放到右侧，也不额外生成第二个。

actions 整体放在右侧操作组、宿主唯一的关闭 X 左侧，保留包提供的动作顺序和授权；不把状态 Tag 混入操作组。按 [审批头部布局](../../makeui/references/drawer-layout.md#approval-header-placement) 处理对齐、长标题及全屏。content 包含申请信息、history、意见，footer 当前为空，不另造固定办理底栏或二次确认区。提供宿主 TextArea 的 id/required/maxLength/受控回调，保留包的字段标红和意见聚焦。

桌面/平板使用宿主 Drawer，支持全屏与遮罩关闭，加载/失败沿用同一容器；宽度遵守宿主或 `makeui`，不写死某示例项目比例。字段通过 fullWidth 和 renderFieldLabel 公开插槽处理整行及类型图标，优先使用包默认紧凑模板和宿主控件无边框模式，避免复制包 CSS。历史插槽使用 [历史合同](history.md)，不参与必填校验或授权判断。

## 手机任务详情

手机字段适配、同一控制器插槽、紧凑时间线、意见输入与固定表单底栏遵循 [移动端适配](mobile.md)，桌面继续本文既有合同。按已核验的公开插槽接入，不能复制 Controller 或绕过节点授权。
