# MetaService API 设计

## 能力

前端构建和运行时 schema 加载只需要读取 Meta 服务中的 App、Entity、Field、Relation 元数据。

## 约束

- 如果是开放的 API，开放平台域名需要符合规范：https://dev-make.qtech.cn/api/make
- JSON-RPC 接口
- 开放平台使用多语言的 SDK

## 设计思路

- **HTTP 方法永远是 POST, 下载文件(FileField)是一个例外**
- **Action 不在路径里，在 `X-Make-Target` header 里面**

可选 value：
- `MakeService.GetResource`
- `MakeService.ListResources`

Request Body 是 JSON  
Response Body 格式如下：  

### 单条数据 Response

```json
{
  "code": 200,
  "msg": "xxx",
  "data": {}
}
```

### 批量数据 Response

```json
{
  "code": 200,
  "msg": "xxx",
  "data": {
    "records": [
      {}
    ],
    "total": 0
  }
}
```

## Entity

#### 获取单个 Entity 的字段基础定义

Entity 详情受当前主体权限影响，不能保证包含 BPM 节点独立授权的字段。BPM 源字段定义统一使用 bpm-node-form-metadata 的 START/TASK 场景，详见 [节点元数据接口](../../make-app-approval/references/workflow-api.md#审批节点字段元数据)。普通业务 UI 继续使用权限过滤的 Schema；元数据本身不授予记录值的读写权限。

通过 Service 的 Meta 请求适配器调用，沿用运行时网关、登录上下文与部署 appKey；不在浏览器硬编码下列示例地址。

```http
POST https://make.qtech.cn/api/make/meta/v1/entity
Content-Type: application/json
X-Make-Target: MakeService.GetResource
```

**Request Body**
```json
{
  "appKey": "<APP_KEY>",
  "key": "<ENTITY_KEY>"
}
```

请求字段是 `key`，不是 `entityKey`。成功响应为 `{ code: 200, msg, data: entity }`；校验 `data.key` 与 `data.appKey` 后读取 `data.properties.fields`。保留每个字段的 key/name/type/properties/validations，普通 CRUD 仍遵循 fields/createFields 与 IAM 合同。审批任务另走节点元数据，完整授权、缺失定义处理与附件校验见 [任务详情](../../make-app-approval/references/task-detail.md)。关系为独立元数据资源，不能把 Entity fields 当成完整关系集合。

审批启动配置若仅返回 field key，通过 bpm-node-form-metadata 的 START 场景补基础定义，授权和顺序仍取启动配置。完整字段对象仍需检查本次所需 Lookup 关系及目标 key/type；仅在字段、依赖和定位均校验通过后省略额外请求，具体见 [START 完整性判定](../../make-app-approval/references/lookup-metadata.md#start-何时可以省略额外请求)。普通 Schema 仍负责对象绑定判定与普通权限场景。

## Relation

普通业务元数据场景已知 relationKey 时，通过同一 Meta 网关 `POST /meta/v1/relation`，`X-Make-Target: MakeService.GetResource`，正文 `{ appKey, key: relationKey }` 读取单个关系。成功 data 为 Make.Relation，核验 key/appKey/type；`properties.from/to` 各含 entityKey/cardinality，目标基数取 one/many。再按普通场景需要读取目标 Entity 的目标字段定义，不从 Entity.fields 猜关系，也不把关系定义当作读取目标记录的授权。

BPM 的 START/TASK 不使用上述普通 Meta 补查流程：按 [节点 Lookup 依赖合同](../../make-app-approval/references/lookup-metadata.md)，从 bpm-node-form-metadata 的 data.relations 与 Lookup 目标 key/type 取得依赖。缺失时明确报错，不回退普通 relation/entity/Schema；所需目标记录继续走既有 IAM/Data 读取授权。

## Schema

#### 按 App 查询 Schema

> 获取指定 App 在 Meta 层按当前主体权限过滤的逻辑 Schema 聚合视图，不保证包含审批节点独立授权的字段。
>
> 返回当前可访问的 App、Entity、Relation 聚合结果，其中字段通过 `Entity.properties.fields` 返回；普通新建字段独立消费 `createFields`。审批任务字段基础信息使用 bpm-node-form-metadata 的 TASK 场景，不从普通 entity 或 Schema 补齐。
> `entities` 和 `relations` 的结构与上方定义保持一致。

字段的运行时 `capabilities` 用于选择查询能力：`groupable` 表示列表分组，`aggregable` 表示可用作[聚合统计](DataAPIDesign.md#聚合统计-record-数据)的 `group[].fieldKey` 维度，两者独立。Lookup 可以 `groupable=false`、`aggregable=true`，按关联记录 ID 聚合。

`aggregable` 不控制 `aggregates[].fieldKey` 的指标资格；指标按函数与字段类型校验，也不因该标志获得读取权限。旧版 Schema 缺少 `aggregable` 时表示能力未知，不等同于 `false`。保留 Schema 返回的能力信息，无需在 DSL 或聚合请求中提交这些派生标志。

```http
POST https://dev-make.qtech.cn/api/make/meta/v1/schema
```

**HEADER**
```
Authorization: <JWT Token>
Content-Type: application/json
X-Make-Target: MakeService.GetResource
```

**Request Body**
```json
{
  "appKey": "<APP_KEY>"
}
```

**Response Body**
```json
{
  "code": 200,
  "msg": "get app schema success",
  "data": {
    "app": {
      "key": "expense_management",
      "name": "报销管理",
      "type": "Make.App",
      "meta": {
        "version": "1.0.0",
        "appID": "xxxx",
        "createdAt": "2026-03-24T13:38:44Z"
      },
      "properties": {
        "description": "这是一个用于报销业务的系统"
      }
    },
    "entities": [
      {
        "key": "expense_report",
        "name": "报销单",
        "type": "Make.Entity",
        "appKey": "expense_management",
        "meta": {
          "version": "1.0.0"
        },
        "properties": {
          "fields": [
            {
              "key": "applicant",
              "name": "申请人",
              "type": "Make.Field.Text",
              "meta": {
                "version": "1.0.0"
              },
              "properties": {}
            },
            {
              "key": "department",
              "name": "部门",
              "type": "Make.Field.Text",
              "meta": {
                "version": "1.0.0"
              },
              "properties": {}
            },
            {
              "key": "total_amount",
              "name": "报销总额",
              "type": "Make.Field.Currency",
              "meta": {
                "version": "1.0.0"
              },
              "properties": {
                "symbol": "¥",
                "decimalPlaces": 2,
                "useGrouping": true
              }
            }
          ]
        }
      },
      {
        "key": "expense_invoice",
        "name": "发票",
        "type": "Make.Entity",
        "appKey": "expense_management",
        "meta": {
          "version": "1.0.0"
        },
        "properties": {
          "fields": [
            {
              "key": "invoice_no",
              "name": "发票号",
              "type": "Make.Field.Text",
              "meta": {
                "version": "1.0.0"
              },
              "properties": {}
            },
            {
              "key": "invoice_amount",
              "name": "发票金额",
              "type": "Make.Field.Currency",
              "meta": {
                "version": "1.0.0"
              },
              "properties": {
                "symbol": "¥",
                "decimalPlaces": 2,
                "useGrouping": true
              }
            }
          ]
        }
      }
    ],
    "relations": [
      {
        "key": "report_has_invoices",
        "name": "报销单发票关联",
        "type": "Make.Relation",
        "appKey": "expense_management",
        "meta": {
          "version": "1.0.0"
        },
        "properties": {
          "from": {
            "entityKey": "expense_report",
            "cardinality": "one"
          },
          "to": {
            "entityKey": "expense_invoice",
            "cardinality": "many"
          }
        }
      }
    ]
  }
}
```
