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

## Schema

#### 按 App 查询 Schema

> 获取指定 App 在 Meta 层的逻辑 Schema 聚合视图。  
> 返回 App 及其下全部 Entity、Relation 的聚合结果，其中字段通过 `Entity.properties.fields` 返回。  
> `entities` 和 `relations` 的结构与上方定义保持一致。

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
