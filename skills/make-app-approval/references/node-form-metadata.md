# 节点字段转换合同与可执行样例

本文件只负责 `bpm-node-form-metadata.data` 的字段规范化。请求场景、授权、错误透传及 Lookup 依赖见 [Workflow 合同](workflow-api.md#审批节点字段元数据)；字段值仍来自任务 `formData`，新建字段权限仍来自启动配置，不能用此处元数据推导读写权限。

## 来源与成功响应

- 新接口的请求和信封来自已确认的节点接口合同；字段配置与 Meta DTO 一致。以下 18 种映射采用已接入并验证的转换规则，完整列出本版本支持范围，不宣称后端永远只有这些枚举。范围外枚举及新的配置冲突语义须确认后再扩展，不猜测成文本。
- [脱敏夹具](../scripts/fixtures/node-form-metadata.json) 保存 dev 成功响应的结构保真裁剪：`request` 为 START 请求；`response` 保留成功信封、定位和 TEXT/CURRENCY/SINGLE_SELECT/ID/LOOKUP 字段。标识与业务值已替换，不含记录数据、人员或凭据，不作为完整生产响应存档。
- 行为验证的其他类型及异常输入是人工构造用例，明确区别于上述响应证据。TASK 用例模拟实例绑定的旧流程，不宣称这些模拟值来自真实任务。

成功结构为 `{ code: 200, msg, data: { appKey, entityKey, processKey, nodeKey, nodeName, fields, relations } }`。既有请求层先检查 HTTP 和业务码，按原合同透传失败，成功才将 `data` 交给转换器；不要把失败响应交给转换器后覆盖真实后端错误。

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

选项保持原数组顺序和每个对象的全部属性，包括 `id/label/value/isEnabled/sort` 及扩展键；不丢弃禁用选项、不重新排序、不把 value 改成 label。空选项数组合法，缺失选项或非字符串 label/value 报错。标准字段仅有 `properties.options` 可直接使用；同时存在 `selection.fieldSelections` 时两份必须一致。

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

[参考转换器](../assets/bpm-node-form-metadata.mjs) 是可复制到宿主 Service 的纯函数，仅依赖 Node 内置模块。优先复用宿主现有字段转换器并按本合同补齐，不在项目中并存两套转换路径。它不发请求、不执行授权、不缓存，也不包含后端错误代理。

导出 `normalizeBpmNodeFormMetadata(data, expected)`；`expected` 必须由 Service 的部署配置、已核验启动配置或已授权任务生成，不来自浏览器任意声明：

- START：`{ scene: 'START', appKey, entityKey, processKey, nodeKey: startConfig.startNodeKey }`，全部定位必须核对。
- TASK：`{ scene: 'TASK', appKey, entityKey }`。先通过原任务接口核验实例/任务 reference；任务若提供 processKey/nodeKey 则一起核对。不能以当前对象的新流程绑定替代历史任务定位。元数据响应未返回 taskId/processInstanceId，不虚构这两个响应属性作比较。

响应五个定位/名称字段必须非空，`fields` 必须为数组；空数组合法，重复 key、未知枚举、类型/别名/配置冲突、非法字段结构明确报错。本参考使用 `BPM_NODE_FORM_METADATA_INVALID`、502 和具体 `path`；这些是宿主本地解析错误，不是新增后端错误码。宿主可沿用等价错误类型并由验证桥接映射，不覆盖后端原错误。

纯转换器不会证明字段授权完整：START 还要按启动配置顺序选出 readable 字段；TASK 仍按本次 `fieldPermission/actions` 投影。授权可见 key 缺少定义时停止，不能把空 fields 当作成功显示全部普通字段。节点额外定义不自动展示或赋予编辑权限。

Lookup 配置和 `data.relations` 原样保留。使用 [Lookup 节点依赖](lookup-metadata.md) 的随包解析器校验选中字段所需关系及目标 key/type；不把辅助目标描述当作完整字段定义或节点授权。成功夹具已补入 2026-10-28 实测的同构关系，未伪造目标完整实体、选项或格式。BPM 不再回退普通 entity、relation 或 Schema。

## 行为验证与宿主适配

随包验证（Node 22+，无安装依赖、无网络请求）：

```bash
node skills/make-app-approval/scripts/verify-node-form-metadata.mjs
node scripts/test-bpm-node-form-metadata-behavior.mjs
```

第一条可在安装后通过 Skill 的绝对路径运行，验证实际参考转换器；第二条是仓库 CI 入口，并注入错误类型、丢失校验/能力/配置、跳过定位检查，证明验证器确实会失败。文档关键词检查仍由 `test-bpm-node-form-metadata-contract.mjs` 单独负责。

宿主可提供一个 ESM 文件，导出同签名 `normalizeBpmNodeFormMetadata`（允许异步），内部调用**宿主真实转换代码**；它仅桥接参数、返回值和等价错误，不复制转换实现或预先伪造期望结果。然后运行：

```bash
node skills/make-app-approval/scripts/verify-node-form-metadata.mjs /absolute/path/to/host-adapter.mjs
```

测试覆盖 18 种映射、数字 type、专用配置/原始属性/选项/校验/能力保留、合法空字段、标准字段、TASK 旧版本定位、冲突与非法结构。该验证只能证明纯转换合同；实际请求参数、登录上下文、Trace、取消、后端错误透传、缺失授权 key 和界面行为仍需宿主测试，不能据此宣称真实办理已验收。
