# Data Service API 设计

## 能力

需要提供 DSL 的 CRUD-LS (Create, Read, Update, Delete, List, Status) 操作

## 术语说明

Entity 可以理解是一张 Table, Record 可以理解是一个 Row, 也就是 Entity 的一条实际记录

## 约束

- 如果两个`Entity`存在 `Relation` 关系，则在添加或更新数据时需要用 `data.qfei_relation` 传递参数。`Relation` 建模方式见 @RelationDesign.md
- `qfei_relation` 的数组项格式固定为 `{ "entityKey": "<关联 Entity key>", "id": "<关联 recordID>" }`
- 禁止在一个`Entity`中定义与另一个`Entity`语义相同的字段。
- 禁止通过自定义关联Id字段来描述两个`Entity`的关系，如果在一个`Entity`中需要展示另一个`Entity`的字段数据，则必须使用 `LookupField` 实现。规则详见 @FieldDesign.md
- 禁止通过前端实现 `Record` 数据列表过滤功能，必须使用后端接口 `MakeService.ListResources` 的 `filter.expression` 参数，详见：@EntityDataFilterUsage.md
- 人员、部门类型字段在写入时必须提交字符串类型 ID；单选字段写入字符串，多选字段写入字符串数组，例如 `"owner": "19035"`、`"members": ["19034", "19035"]`、`"ownerDepartment": "2226"`、`"relatedDepartments": ["2227", "2228"]`
- 在列表页编辑单列字段数据时必须使用 `批量更新一列数据` 接口

## JSON-RPC 接口

AI 使用 DataAPI
开放平台使用
多语言的 SDK

## 设计思路

- **HTTP 方法永远是 POST, 下载文件(FileField)是一个例外**
- **Action 不在路径里，在 `X-Make-Target` header 里面**

Action 不在路径里，在 `X-Make-Target` header 里面，可选 value 是:

```
MakeService.CreateResource
MakeService.GetResource
MakeService.UpdateResource
MakeService.DeleteResource
MakeService.StatusResource
MakeService.ListResources
```

Request Body 是 JSON  
**!!!注意有个例外的情况: 上传文件(`api/make/data/v1/file`)是`Content-Type: multipart/form-data`**  
Response Body 格式如下：  

单条数据 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data" : {} 
}
```

批量数据 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data" : [
     {}
  ]
}
```

分页查询 Response Body 格式

```json
{
  "code": 200,
  "msg": "xxx",
  "data": [{}],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 成功时 `code` 固定为 `200`
- `msg` 是示例性文案，不建议把具体文案当成强约束
- 分页查询会额外返回 `pagination`

## 接口

### 创建 Record 数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.CreateResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "data": {
    "name": "张三",
    "hobby": ["xxx", "yyy"],
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entityKey": "profile",
        "id": "123"
      }
    ]
  }
}
```

其中：

- `entityKey` 表示对端的 Entity key
- `id` 表示对端记录的 `recordID`

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data": {
    "recordID": "1"
  }
}
```

说明：

- `recordID` 固定是 string 类型

### 批量删除 Record

单个删除也用批量删除的接口来

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.DeleteResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "recordIDList": ["record_id_1", "record_id_2"]
}
```

Response Body

```json
{
  "code": 200,
  "msg": "delete record success",
  "data" : [
     {"recordID": "1", "code": 200, "msg": "delete success"},
     {"recordID": "2", "code": 400, "msg": "Permission denied"}
  ]
}
```

### 单条更新 Record 数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.UpdateResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "recordID": "1",
  "data": {
    "field_key_1": "张三",
    "field_key_2": 100,
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entityKey": "profile",
        "id": "123"
      }
    ]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "1"
  } 
}
```

### 批量更新一列数据

```
POST https://dev-make.qtech.cn/api/make/data/v1/field
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.UpdateResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "recordIDList": ["1", "2", "3"],
  "data": {
    "field_key_1": "张三",
    "field_key_2": 100,
    "date_field": "2026-02-24",
    "datetime_field": "2026-02-24 17:00:00",
    "qfei_relation": [
      {
        "entityKey": "profile",
        "id": "123"
      }
    ]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Update record success",
  "data" : {
    "recordID": "1"
  } 
}
```

### 获取单条 Record 数据

查询结果理解规则

- `recordID` 固定是 string 类型
- `data` 是单个 Record 对象，业务字段的 key 就是字段 key，不是固定 DTO
- `fields` 为空时默认返回全部字段；传了 `fields` 时只保证返回所选字段

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.GetResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "fields": [
    "orderNo",
    "projectName",
    "projectDescription",
    "projectContent",
    "website",
    "score",
    "budget",
    "completionRate",
    "startDate",
    "createdAt",
    "deliveryPeriod",
    "status",
    "tags",
    "owner",
    "members",
    "ownerDepartment",
    "relatedDepartments",
    "locationPath",
    "attachments"
  ],
  "recordID": "1"
}
```

说明：

- `fields` 可选；为空时表示返回该对象的全部字段

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data": {
    "recordID": "1",
    "orderNo": "SO-2026-0001",
    "projectName": "智能客服升级",
    "projectDescription": "升级 FAQ 与工单联动能力",
    "projectContent": "<p>需要支持富文本说明</p>",
    "website": "https://example.com/projects/1",
    "score": 95.5,
    "budget": "1999.00",
    "completionRate": "85.00",
    "startDate": "2026-02-24",
    "createdAt": "2026-02-24 17:00:00",
    "deliveryPeriod": {
      "begin": "2026-02-24",
      "end": "2026-03-31"
    },
    "status": [
      {
        "label": "进行中",
        "value": "in_progress"
      }
    ],
    "tags": [
      {
        "label": "紧急",
        "value": "urgent"
      },
      {
        "label": "对外",
        "value": "external"
      }
    ],
    "owner": [
      {
        "userId": "101",
        "userName": "负责人A",
        "avatar": "https://example.com/avatar-a.png"
      }
    ],
    "members": [
      {
        "userId": "101",
        "userName": "负责人A",
        "avatar": "https://example.com/avatar-a.png"
      },
      {
        "userId": "102",
        "userName": "评审B",
        "avatar": "https://example.com/avatar-b.png"
      }
    ],
    "ownerDepartment": [
      {
        "departmentId": "201",
        "departmentName": "销售部"
      }
    ],
    "relatedDepartments": [
      {
        "departmentId": "201",
        "departmentName": "销售部"
      },
      {
        "departmentId": "202",
        "departmentName": "交付部"
      }
    ],
    "locationPath": [
      {
        "label": "中国",
        "value": "china"
      },
      {
        "label": "上海",
        "value": "shanghai"
      }
    ],
    "attachments": [
      {
        "fileName": "proposal.pdf",
        "filePath": "8/demo-app/project/proposal.pdf",
        "fileURL": "https://cdn.example.com/proposal.pdf",
        "fileSizeInBytes": 102400
      }
    ]
  }
}
```

说明：

- `msg` 是示例性文案，不建议依赖具体文本
- 上面的示例展示的是“稳定可依赖”的查询结果结构；如果字段类型不同，返回结构也会不同，详见：`常规字段类型返回结构示例` 和 `派生字段类型返回结构示例`

### 分页查询 Record 数据

分页结果理解规则

- `data` 是 Record 对象数组，每个元素的字段结构与 `GetResource.data` 一致
- 分页查询比单条查询多一个 `pagination`，其中 `page`、`size`、`total` 分别表示当前页、页大小、总条数
- `fields`、字段类型解释、选项类字段结构与单条查询完全一致
- `filter` 筛选参数使用参考 @EntityDataFilterUsage.md

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <MAKE_API_TOKEN>
  X-Make-Target: MakeService.ListResources
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "<ENTITY_KEY>",
  "fields": [
    "orderNo",
    "projectName",
    "projectDescription",
    "projectContent",
    "website",
    "score",
    "budget",
    "completionRate",
    "startDate",
    "createdAt",
    "deliveryPeriod",
    "status",
    "tags",
    "owner",
    "members",
    "ownerDepartment",
    "relatedDepartments",
    "locationPath",
    "attachments"
  ],
  "filter": {
    "expression": "projectName.contains('项目') && status in ['todo', 'doing']"
  },
  "sort": [
    { "fieldKey": "createdAt", "order": "desc" },
    { "fieldKey": "orderNo", "order": "asc" }
  ],
  "pagination": { "page": 1, "size": 10 }
}
```

说明：

- `sort.fieldKey` 使用字段 key，不是字段名称
- `pagination.page` 从 `1` 开始
- 如果不传 `fields`，返回结果默认包含全部字段
- `filter` 使用 `Expression` 对象；省略、`null` 或 `filter.expression` 为空白表示不限筛选
- `filter.expression` 直接引用当前 Entity 的字段 key；字段不存在、字段类型不支持或表达式不在支持的 CEL 子集内时，服务端返回参数错误
- `Make.Field.Lookup` 字段可以出现在 Record 列表筛选中，表达式仍引用 Lookup 字段自身的 key，例如 `profileName.contains('张')`
- Lookup 筛选会根据字段配置中的 `relationKey` 和 `targetFieldKey` 找到对端 Entity 的目标字段，并按目标字段类型校验操作符和值格式；Lookup 的目标字段不能再是 Lookup 字段
- Lookup 筛选通过关联关系下推到 SQL：`FK` 和 `JOIN_TABLE` 关系都会编译为对目标表的 `EXISTS` 条件；同一个 `&&` 分组内、同一 relation 的多个 Lookup 条件要求命中同一条目标记录
- Lookup 字段的空值/非空值筛选判断的是已关联目标记录上的 `targetFieldKey` 值；没有关联记录时不会命中 `lookupField == null` 这类空值筛选

Response Body

```json
{
  "code": 200,
  "msg": "List records success",
  "data": [
    {
      "recordID": "1",
      "orderNo": "SO-2026-0001",
      "projectName": "智能客服升级",
      "projectDescription": "升级 FAQ 与工单联动能力",
      "projectContent": "<p>需要支持富文本说明</p>",
      "website": "https://example.com/projects/1",
      "score": 95.5,
      "budget": "1999.00",
      "completionRate": "85.00",
      "startDate": "2026-02-24",
      "createdAt": "2026-02-24 17:00:00",
      "deliveryPeriod": {
        "begin": "2026-02-24",
        "end": "2026-03-31"
      },
      "status": [
        {
          "label": "进行中",
          "value": "in_progress"
        }
      ],
      "tags": [
        {
          "label": "紧急",
          "value": "urgent"
        },
        {
          "label": "对外",
          "value": "external"
        }
      ],
      "owner": [
        {
          "userId": "101",
          "userName": "负责人A",
          "avatar": "https://example.com/avatar-a.png"
        }
      ],
      "members": [
        {
          "userId": "101",
          "userName": "负责人A",
          "avatar": "https://example.com/avatar-a.png"
        },
        {
          "userId": "102",
          "userName": "评审B",
          "avatar": "https://example.com/avatar-b.png"
        }
      ],
      "ownerDepartment": [
        {
          "departmentId": "201",
          "departmentName": "销售部"
        }
      ],
      "relatedDepartments": [
        {
          "departmentId": "201",
          "departmentName": "销售部"
        },
        {
          "departmentId": "202",
          "departmentName": "交付部"
        }
      ],
      "locationPath": [
        {
          "label": "中国",
          "value": "china"
        },
        {
          "label": "上海",
          "value": "shanghai"
        }
      ],
      "attachments": [
        {
          "fileName": "proposal.pdf",
          "filePath": "8/demo-app/project/proposal.pdf",
          "fileURL": "https://cdn.example.com/proposal.pdf",
          "fileSizeInBytes": 102400
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 分页查询中的每条元素结构与单条查询的 `data` 完全一致，只是顶层从对象变成数组，数组中的单条数据根据字段类型不同，返回结构也会不同，详见：`常规字段类型返回结构示例` 和 `派生字段类型返回结构示例`
- `pagination.total` 表示满足当前筛选条件的总记录数，而不是当前页记录数

### 聚合统计 Record 数据

对单个 Entity 做服务端聚合，支撑仪表盘、图表和 AI 分析。需要匹配记录的数量、求和、均值、去重计数或分组指标时优先使用本接口；列表折叠与逐层展开使用 Record 分组查询，需要明细时使用 Record 查询。

```http
POST https://dev-make.qtech.cn/api/make/data/v1/aggregate
Content-Type: application/json
X-Make-Target: MakeService.ListResources
```

复用既有 Make 请求的认证上下文和网关地址；示例字段需替换为实际 Schema 中的字段。

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "order",
  "group": [
    { "fieldKey": "status" },
    { "fieldKey": "orderDate", "granularity": "month", "alias": "month" }
  ],
  "aggregates": [
    { "aggregate": "count", "alias": "orderCount" },
    { "fieldKey": "amount", "aggregate": "sum", "alias": "totalAmount" }
  ],
  "filter": { "expression": "status != 'draft'" },
  "aggregateFilter": { "expression": "totalAmount > 10000" },
  "sort": [{ "alias": "totalAmount", "order": "desc" }],
  "pagination": { "page": 1, "size": 10 }
}
```

#### 维度与指标

- `group` 可省略或为 `[]`，表示全局聚合；最多 3 项。维度使用 Schema 的 `capabilities.aggregable`，与列表 `groupable` 独立，见 [Schema 字段能力](MetaAPIDesign.md#schema)。
- 分组元素为 `{fieldKey, granularity?, alias?}`，不含 `order`。`granularity` 仅用于 `Make.Field.Date`，支持 `day/week/month/quarter/year`；自然日/月/季/年桶分别形如 `2026-03-05`、`2026-03`、`2026-Q1`、`2026`。周桶为该周周一日期，例如 `2026-03-02`，跨年不拆周；日期桶的 `label=value`。
- `aggregates` 必填且为 1–10 项。指标 `alias` 必填；维度输出名默认 `fieldKey`，同字段不同日期粒度需用 `alias` 区分，全部输出列名不得重复。

| `aggregate` | `fieldKey` / 类型 |
| --- | --- |
| `count` | 不传 `fieldKey`，统计记录数 |
| `countDistinct` | 单值字段；不支持多值、File、RichText、Formula、Rollup、Count；Lookup 按关联记录 ID 去重 |
| `sum`、`avg` | Number、Currency、Percent |
| `min`、`max` | Number、Currency、Percent、Date、DateTime |

指标资格按函数与字段类型判断，不要求指标字段 `aggregable=true`。

#### 过滤、排序与分页

- `filter: {expression}` 在聚合前过滤原始记录（WHERE），使用现有 Record 筛选表达式；`aggregateFilter: {expression}` 在聚合后过滤分组（HAVING），只引用已声明的数值指标 alias。本接口不使用列表下钻的 `groupFilter`。
- `sort` 元素为 `{alias, order}` 或 `{fieldKey, order}`，引用本次输出列，`order` 为 `asc/desc`。省略时全部维度升序；服务端追加维度决胜排序。
- `pagination` 默认 `page=1,size=10`，每页最多 1000 组。`pagination.total` 是符合条件的分组数，不是记录数。需要完整图表时按 total 取完分组；Top N 场景只取所需页。全局 `avg/countDistinct` 优先直接请求对应指标；组合已有分组结果时按下方方案保留必要统计量与去重语义。

#### 响应与空值

```json
{
  "code": 200,
  "msg": "Aggregate records success",
  "data": [
    {
      "status": { "value": "completed", "label": "已完成" },
      "month": { "value": "2026-03", "label": "2026-03" },
      "orderCount": 128,
      "totalAmount": 125300.5
    }
  ],
  "pagination": { "page": 1, "size": 10, "total": 1 }
}
```

每行是一个分组，维度为 `{value,label}`；空值组保留 `value:null,label:"未填写"`。数值指标使用原始存储值计算，返回 JSON number，至多 4 位小数（HALF_EVEN），不套用 Record 的 Currency/Percent 展示换算；`count/countDistinct` 为整数，Date/DateTime 的 `min/max` 按字段格式返回字符串。

`countDistinct` 忽略 NULL；`sum/avg/min/max` 忽略 NULL，全部为空或无记录时返回 `null`；无记录时 `count/countDistinct` 为 0。展示或业务计算时保留这种区别。

#### Lookup 与错误处理

Lookup 始终引用当前 Entity 的字段 key：分组 `value` 是关联记录 ID，`label` 为 `targetFieldKey` 展示值（目标字段为空时回退 ID）；同名记录仍是不同组。过滤按 `targetFieldKey` 的类型和值处理，排序按 `sortByFieldKey`、未配置时按 `targetFieldKey`；不能把三个用途统一当作 ID 筛选或排序。

维度支持严格一对一 FK 两侧，或标准 one→many FK 的 TO/many 侧；无有效关联或目标记录已删除时进入空值组。聚合主体保持单个 Entity，不支持通过 `targetEntity.field` 对 many 侧目标集合求指标；这类需求通常改为对明细 Entity 聚合。

失败沿用 Make 的 `code/msg/data` 包装。参数错误可能在 `data.errors` 中提供 `{path,message,suggestion}`，据此修正对应参数后重试；保留原统计目标与筛选口径。权限或执行错误按原错误反馈，不当作 0 或完整结果。

#### 不能直接表达时的方案选择

保持业务口径，优先下推可表达的计算，再选择实现简单、读取成本合理的精确方案。接口是通用计算基础，允许应用补充业务计算。

| 情况 | 方案与例子 |
| --- | --- |
| 换一个等价查询即可表达 | 例如每个订单的明细金额合计：对明细 Entity 聚合，按其订单 Lookup 分组 |
| 少量汇总结果足够 | 同比/环比先取得两个业务周期的汇总并对齐后计算；占比先取同口径分组金额及全局金额，再由 Service 计算 |
| 必须逐条计算且范围合理 | 例如中位数、连续活跃天数：按必要时间范围、筛选及字段读取完整所需明细，在 Service 精确计算；临时分析也可由 Agent 处理 CLI 查询结果 |
| 数据量大、查询频繁，组合或明细计算仍不经济 | 给出专用后端查询、派生字段或定期统计表的具体建议，说明新增维护工作和可接受的数据刷新延迟 |

结合已有分页 `total`、预计传输量和查询频率判断成本；无需固定记录数门槛或每次额外发起 count。聚合、记录读取可以混合使用，仅补取计算所缺的数据；具体数据规模较小时也可直接采用更简单的明细方案。

在接口上限内尽量合并同一 Entity、同一筛选下的兼容指标，按维度批量分组，减少逐个客户或部门查询。

组合时保持原统计范围、权限与 NULL 口径：全局平均值优先直接查询，由分组汇总计算时使用同口径的和与非空计数；去重数不能在集合可能重叠时直接相加；独立的二维汇总不能还原四维联合分布。

可以按原口径完成的常规组合直接推进；采用近似或改变口径前明确说明。涉及新增字段、统计表或专用接口时，先给出实现及维护成本建议。参数、认证或权限失败按原错误处理，不能据此认定需求超出聚合能力。

权威契约：[AgenticDSL Data API 聚合统计](https://git.qtech.cn/make/AgenticDSL/-/blob/main/Design/DataAPIDesign.md#聚合统计-record-数据)。

### 分页查询 User 数据

用于查询当前组织内可见的用户候选项，常用于 `Make.Field.SingleUser` 和 `Make.Field.MultiUser` 字段填写前的用户选择器。

```
POST https://dev-make.qtech.cn/api/make/data/v1/user
HEADER
  Authorization: Bearer <MAKE_API_TOKEN>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

```json
{
  "fields": ["userId", "userName", "avatar"],
  "filter": {
    "expression": "userName.contains('张')"
  },
  "sort": [
    { "fieldKey": "userName", "order": "asc" }
  ],
  "pagination": { "page": 1, "size": 10 }
}
```

说明：

- Request Body 仅包含 `fields`、`filter`、`sort`、`pagination`，不包含 `appKey` / `entityKey`
- `fields` 可选；为空时返回当前接口可产出的全部字段
- `filter` 可选；省略、传 `null` 或 `filter.expression` 为空白表示不筛选
- `filter` 必须是 `Expression` 对象，仅支持单个 `userName.contains('...')` 条件
- 不要生成裸字符串；服务端对裸字符串的兼容行为不可依赖。数组、旧对象 DSL、非字符串右值均为非法参数
- 当前接口不支持排序；即使传入 `sort`，服务端也会忽略并保持下游返回顺序
- `pagination.page` 从 `1` 开始；不传 `pagination` 时默认 `page=1`、`size=10`

Response Body

```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "userId": "19035",
      "userName": "张三",
      "avatar": "https://example.com/avatar-a.png"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 当前接口返回 `userId`、`userName`、`avatar`；
- `userId` 在响应 JSON 中是字符串；写入 UserField 时继续提交该用户 ID 字符串
- 请求了未知字段时，服务端会忽略该字段，只返回当前结果中存在的字段

### 分页查询 Department 数据

用于查询当前组织内可见的部门候选项，常用于 `Make.Field.SingleDepartment` 和 `Make.Field.MultiDepartment` 字段填写前的部门选择器。

```
POST https://dev-make.qtech.cn/api/make/data/v1/department
HEADER
  Authorization: Bearer <MAKE_API_TOKEN>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

```json
{
  "fields": ["departmentId", "departmentName", "memberCount", "platform", "leader"],
  "filter": {
    "expression": "departmentName.contains('产品研发')"
  },
  "sort": [
    { "fieldKey": "departmentName", "order": "asc" }
  ],
  "pagination": { "page": 1, "size": 10 }
}
```

说明：

- Request Body 仅包含 `fields`、`filter`、`sort`、`pagination`，不包含 `appKey` / `entityKey`
- `fields` 可选；为空时返回当前接口可产出的全部字段
- `filter` 可选；省略、传 `null` 或 `filter.expression` 为空白表示不筛选
- `filter` 必须是 `Expression` 对象，仅支持单个 `departmentName.contains('...')` 条件
- 不要生成裸字符串；服务端对裸字符串的兼容行为不可依赖。数组、旧对象 DSL、非字符串右值均为非法参数
- 当前接口不支持排序；即使传入 `sort`，服务端也会忽略并保持下游返回顺序
- `pagination.page` 从 `1` 开始；不传 `pagination` 时默认 `page=1`、`size=10`
- `leader` 仅在 `fields` 为空或显式包含 `leader` 时返回；未显式请求 `leader` 时不会触发负责人补齐查询

Response Body

```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "departmentId": "2226",
      "departmentName": "产品研发中心",
      "memberCount": 10,
      "platform": "1",
      "leader": {
        "userId": "9001",
        "userName": "负责人A",
        "avatar": "https://example.com/avatar-a.png"
      },
      "children": []
    }
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 100
  }
}
```

说明：

- 当前接口返回 `departmentId`、`departmentName`、`memberCount`、`platform`、`leader` 和 `children`；
- `departmentId` 在响应 JSON 中是字符串；写入 DepartmentField 时继续提交该部门 ID 字符串
- `leader` 无负责人或未查询到负责人时返回 `null`；未请求 `leader` 字段时不返回 `leader` 键；有负责人时返回 `userId`、`userName`、`avatar`
- 当前接口返回平铺部门列表；`children` 始终是数组，当前示例为 `[]`
- 请求了未知字段时，服务端会忽略该字段；`children` 作为兼容字段仍会随部门记录返回


### 上传文件

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  X-Make-Target: MakeService.CreateResource
  Content-Type: multipart/form-data
```

Request Body (multipart/form-data)

```
--boundary
Content-Disposition: form-data; name="meta"
Content-Type: application/json

{
  "appKey": "MatrixProject",
  "entityKey": "project_docs",
  "recordID": "1",
  "fieldKey": "invoice"
}
--boundary
Content-Disposition: form-data; name="file"; filename="发票.pdf"
Content-Type: application/pdf
<binary>
--boundary--
```

Response Body

```json
{
  "code": 200,
  "msg": "upload file success",
  "data": {
    "recordID": "1",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1048576,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

### 获取文件信息(包含文件下载地址)

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.GetResource
```

Request Body

```json
{
  "appKey": "MatrixProject",
  "entityKey": "project_docs",
  "recordID": "1",
  "fieldKey": "invoice"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "get file success",
  "data": {
    "recordID": "1",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1048576,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

### 删除文件
!!! 注意在实现的时候, 不要删除tos 的文件, 直接情况 fileURL 即可.

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.DeleteResource
```

Request Body

```json
{
  "appKey": "MatrixProject",
  "entityKey": "project_docs",
  "recordID": "1",
  "fieldKey": "invoice",
  "fileName": "89beb655c86b3794f72faf5fed8392ef97a7db93.md"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "delete file success",
  "data": {}
}
```

## 单条记录与列表读取的选型规则

在 Make Data API 中，单条读取与列表读取必须严格区分。

### 单条记录读取
当以下条件成立时，必须使用 `MakeService.GetResource`：
- 已知目标实体
- 已知目标 `recordID`
- 目标是获取一条记录本身，而不是一个集合

禁止使用以下实现方式替代：
- 先调用 `MakeService.ListResources`
- 再在返回结果中按 `recordID` 过滤目标记录

### 列表读取
只有在以下场景中，才应使用 `MakeService.ListResources`：
- 需要返回多条记录
- 需要分页、搜索、筛选、排序
- 尚未知道具体 `recordID`
- 需要读取某个主记录下的关联集合

### 详情接口规则
实现详情接口时，必须遵循以下拆分：
- 主对象本体：使用 `GetResource(recordID)`
- 关联对象集合：按需单独查询并聚合
- 不允许通过扫描主对象整表来获取详情页本体数据

### 优先级
如果代码里尚未封装单条读取方法：
- 优先新增 `GetResource` 封装
- 不要因为“目前只有列表封装”就退回到整表扫描方案


## 常规字段类型返回结构示例

| 字段类型            | 返回结构示例                                                                                                                                                 | agent 使用提示                                                         |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `Make.Field.ID`            | `"SO-2026-0001"`                                                                                                                                       | 按 string 理解，不要当作数值自增主键                                             |
| `Make.Field.Text`          | `"智能客服升级"`                                                                                                                                             | 单行文本                                                               |
| `Make.Field.TextArea`     | `"升级 FAQ 与工单联动能力"`                                                                                                                                     | 多行文本，仍按 string 处理                                                  |
| `Make.Field.URL`           | `"https://example.com/projects/1"`                                                                                                                     | URL 字符串                                                            |
| `Make.Field.Number`        | `95.5`                                                                                                                                                 | 按 number 处理                                                        |
| `Make.Field.Currency`      | `"1999.00"`                                                                                                                                            | 前后端交互保持数字或纯数字字符串；货币符号由前端按字段类型展示                                 |
| `Make.Field.Percent`       | `"85.00"`                                                                                                                                              | 前后端交互和筛选均使用直接百分数尺度；`85.00` 表示 `85%`，`%` 由前端按字段类型展示，不隐式乘除 `100` |
| `Make.Field.Date`          | `"2026-02-24"`                                                                                                                                         | 按 string 理解                                                        |
| `Make.Field.DateTime`     | `"2026-02-24 17:00:00"`                                                                                                                                | 按 string 理解                                                        |
| `Make.Field.DateRange`    | `{"begin":"2026-02-24","end":"2026-03-31"}`                                                                                                            | 固定对象结构                                                             |
| `Make.Field.SingleSelect` | `[{"label":"进行中","value":"in_progress"}]`                                                                                                              | 单选也返回数组，通常只有一个元素，label只负责展示                                        |
| `Make.Field.MultiSelect`  | `[{"label":"紧急","value":"urgent"},{"label":"对外","value":"external"}]`                                                                                  | 多选返回数组                                                             |
| `Make.Field.SingleUser` | `[{"userId":"101","userName":"负责人A","avatar":"https://example.com/avatar-a.png"}]` | 单选用户也返回数组，通常只有一个元素；`userId` 是字符串形式的用户 ID，`userName` 是用户名称，`avatar` 是用户头像链接 |
| `Make.Field.MultiUser` | `[{"userId":"101","userName":"负责人A","avatar":"https://example.com/avatar-a.png"},{"userId":"102","userName":"评审B","avatar":"https://example.com/avatar-b.png"}]` | 多选用户返回用户对象数组；                                                      |
| `Make.Field.SingleDepartment` | `[{"departmentId":"201","departmentName":"销售部"}]` | 单选部门也返回数组，通常只有一个元素；`departmentId` 是字符串形式的部门 ID，`departmentName` 是部门名称                  |
| `Make.Field.MultiDepartment` | `[{"departmentId":"201","departmentName":"销售部"},{"departmentId":"202","departmentName":"交付部"}]` | 多选部门返回部门对象数组；                                                     |
| `Make.Field.File`          | `[{"fileName":"proposal.pdf","filePath":"8/demo-app/project/proposal.pdf","fileURL":"https://cdn.example.com/proposal.pdf","fileSizeInBytes":102400}]` | 文件字段返回附件数组                                                         |

## 派生字段类型返回结构示例

### Make.Field.Lookup | 查找字段

```json
{
  "<lookupFieldKey>": {
    "entityKey": "<目标 Entity key>",
    "fieldKey": "<目标字段 key>",
    "data": [
      {
        "recordID": "<关联记录ID，字符串>",
        "isDeleted": false,
        "value": "<按目标字段类型格式化后的值>"
      }
    ]
  }
}
```

说明：
- `isDeleted` 表示此条关联数据是否已经被删除
- `data[*].value` 返回的数据结构参考 `常规字段类型返回结构示例`
- Record 列表可以按 Lookup 字段筛选，但筛选表达式必须使用 Lookup 字段 key，不支持 `lookupField.targetField`、`targetEntity.field` 或其它跨对象路径写法
- Lookup 字段的筛选操作符由 `targetFieldKey` 对应的目标字段类型决定，例如目标字段是文本时可使用 `contains` / `==`，目标字段是数字时可使用 `>` / `>=`
- Lookup 字段只负责展示和筛选当前记录，不负责写入关系；关系写入仍通过 `data.qfei_relation`
