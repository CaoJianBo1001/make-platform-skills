# 节点字段转换合同与可执行样例

本文件只负责三个读取响应的 `data.formMetadata` 的字段规范化。请求场景、授权、错误透传及 Lookup 依赖见 [Workflow 合同](workflow-api.md#审批节点字段元数据)；字段值仍来自任务或实例详情的 `formData`，新建字段权限仍来自启动配置，不能用此处元数据推导读写权限。

## 来源与成功响应

- 三个读取响应结构和定位规则见 [Workflow 合同](workflow-api.md#审批节点字段元数据)。节点与字段范围跟随实例绑定 BPM 版本，配置读取当前 Meta。
- [脱敏夹具](../scripts/fixtures/form-metadata.json) 分别提供 bpm-start-config、重提任务 bpm-task 及无当前任务的已结束 bpm-process 响应和各自 formMetadata；只用于转换行为验证，不含真实业务记录数据、人员或凭据，不作为真实审批写入证明。
- 请求层先检查 HTTP 和业务 code，失败原样透传；成功仅把 data.formMetadata 交给转换器。缺失定义直接报错，不从外层 fields、普通 Meta 或旧接口补齐。

## 完整类型映射

字段 `key/name` 对应 `fieldKey/fieldName`；同时存在时必须一致。已观察到的数字 `type: 1` 不是控件类型，按 `makeFieldType` 解析；接口文档中省略 `type` 的 DTO 也按该枚举解析。标准 `Make.Field.*` 字符串必须在下表，若同时返回 `makeFieldType`，二者必须一致。数字、中文名称或未知字符串均不能猜成控件。

| makeFieldType | 宿主 type | 专用配置 → properties |
| --- | --- | --- |
| ID | Make.Field.ID | encoding 的全部键；含 type、encodings，编号不可当文本输入 |
| TEXT | Make.Field.Text | 保留已有 properties |
| TEXT_AREA | Make.Field.TextArea | 保留已有 properties |
| URL | Make.Field.URL | 保留已有 properties |
| NUMBER | Make.Field.Number | number 的全部键，如 precision |
| CURRENCY | Make.Field.Currency | currency 的全部键，如 decimalPlaces、symbol、useGrouping |
| PERCENT | Make.Field.Percent | percent 的全部键，如 decimalPlaces |
| DATE | Make.Field.Date | date 的全部键，如 format |
| DATE_TIME | Make.Field.DateTime | date 的全部键，如 format |
| DATE_RANGE | Make.Field.DateRange | date 的全部键，如 format、begin、end |
| SINGLE_SELECT | Make.Field.SingleSelect | selection.fieldSelections → properties.options |
| MULTI_SELECT | Make.Field.MultiSelect | selection.fieldSelections → properties.options |
| SINGLE_USER | Make.Field.SingleUser | person 的全部键，如 maxCount |
| MULTI_USER | Make.Field.MultiUser | person 的全部键，如 maxCount |
| SINGLE_DEPT | Make.Field.SingleDepartment | dept 的全部键，如 maxCount |
| MULTI_DEPT | Make.Field.MultiDepartment | dept 的全部键，如 maxCount |
| FILE | Make.Field.File | file 的全部键，如 maxCount |
| LOOKUP | Make.Field.Lookup | lookup 的全部键；relationKey、targetFieldKey，targetFieldType（依赖解析必须提供已确认的 Make.Field.* 类型） |

表内属性是示例，不能按这些键白名单重建对象：原始专用配置、`properties`、`validations`、`capabilities` 及扩展属性全部保留。专用配置合入 properties；同名键两处都存在且值不同则报错，不静默覆盖。不要凭空补必填、精度、默认值或编辑能力。配置完整性与值校验仍由宿主已确认的字段合同执行。

选项保持原数组顺序和每个对象的全部属性，包括 `id/label/value/isEnabled/sort` 及扩展键；不丢弃禁用选项、不重新排序、不把 value 改成 label。selection、fieldSelections 或 options 未配置时允许省略；空对象及空选项数组合法。显式提供的选项数组结构非法或 label/value 不是非空字符串时才报错。标准字段仅有 `properties.options` 可直接使用；同时存在 `selection.fieldSelections` 时两份必须一致。

## 规范化前后

夹具中金额字段的原始 DTO：

```json
{
  "fieldKey": "amount", "fieldName": "申请金额", "type": 1, "makeFieldType": "CURRENCY",
  "currency": { "decimalPlaces": 2, "symbol": "¥", "useGrouping": true },
  "validations": { "isRequired": true, "maximum": 999999999999.99 }
}
```

规范化结果：

```json
{
  "fieldKey": "amount", "fieldName": "申请金额", "type": "Make.Field.Currency", "makeFieldType": "CURRENCY",
  "currency": { "decimalPlaces": 2, "symbol": "¥", "useGrouping": true },
  "validations": { "isRequired": true, "maximum": 999999999999.99 },
  "key": "amount", "name": "申请金额",
  "properties": { "decimalPlaces": 2, "symbol": "¥", "useGrouping": true }
}
```

选项例：`selection.fieldSelections: [{ id: "option_1", label: "分类一", value: "category_one", isEnabled: true, sort: 100 }]` 保持原样，同时在 `properties.options` 提供同样的数组。转换只影响字段定义，不转换任务值或保存载荷。

## Service 接入与拒绝边界

[参考转换器](../assets/bpm-form-metadata.mjs) 是可复制到宿主 Service 的纯函数，仅依赖 Node 内置模块。优先复用宿主现有字段转换器并按本合同补齐，不在项目中并存两套转换路径。它不发请求、不执行授权、不缓存，也不包含后端错误代理。

导出 `normalizeBpmFormMetadata(data, expected)`，data 必须是本次读取响应的 formMetadata。expected 来自 Service 部署配置及已核验资源，不接受浏览器任意声明：

- 新建：`{ appKey, entityKey, processKey, nodeKey: startConfig.startNodeKey }`。
- 任务：`{ appKey, entityKey }`，有可信 bpmKey 时核对 processKey；实际节点使用 metadata.nodeKey，不能与 bpm_resubmit_ 任务 key 强行比较。
- 实例：`{ appKey, entityKey, processKey: instance.bpmKey }`；不要求 taskId。

响应五个定位/名称字段必须非空，`fields` 和 `relations` 必须为数组；空数组合法，重复 key、未知枚举、类型/别名/配置冲突、非法字段结构明确报错。本参考使用 `BPM_FORM_METADATA_INVALID`、502 和具体 `path`；这些是宿主本地解析错误，不是新增后端错误码。宿主可沿用等价错误类型并由验证桥接映射，不覆盖后端原错误。

纯转换器不会证明字段授权完整：START 还要按启动配置顺序选出 readable 字段；TASK 仍按本次 `fieldPermission/actions` 投影；实例按本次 viewPermission 投影且始终只读。授权可见 key 缺少定义时停止，不能把空 fields 当作成功显示全部普通字段。节点额外定义不自动展示或赋予编辑权限。

Lookup 配置和 `formMetadata.relations` 原样保留。使用 [Lookup 节点依赖](lookup-metadata.md) 的随包解析器校验选中字段所需关系及目标 key/type；不把辅助目标描述当作完整字段定义或节点授权。夹具保留同构关系，不伪造目标完整实体、选项或格式。BPM 不再回退普通 entity、relation 或 Schema。

## 行为验证与宿主适配

使用随 Skill 分发的验证器（Node 22+，无安装依赖、无网络请求）。先定位本次实际安装的 `make-app-approval` 目录，将下文 `<skill-dir>` 替换为该目录的绝对路径；保留引号以兼容路径中的空格。命令可从宿主工作目录运行：

```bash
node "<skill-dir>/scripts/verify-form-metadata.mjs"
```

验证器执行实际参考转换器及本地夹具。仓库级行为、故障注入、文档交接和安装布局回归由维护者按源仓库 README 单独执行，与宿主验证分别记录。

宿主可提供一个 ESM 文件，导出同签名 `normalizeBpmFormMetadata`（允许异步），内部调用**宿主真实转换代码**；它仅桥接参数、返回值和等价错误，不复制转换实现或预先伪造期望结果。然后运行：

```bash
node "<skill-dir>/scripts/verify-form-metadata.mjs" "/absolute/path/to/host-adapter.mjs"
```

测试覆盖 18 种映射、数字 type、专用配置/原始属性/选项/校验/能力保留、合法空字段、标准字段、绑定流程定位、冲突与非法结构。该验证只能证明纯转换合同；实际请求参数、登录上下文、Trace、取消、后端错误透传、缺失授权 key 和界面行为仍需宿主测试，不能据此宣称真实办理已验收。

类型专属配置可缺省或为空对象；不为缺省 selection 伪造选项。显式提供的 options/fieldSelections 必须为有效数组；缺省与非法结构区分。
