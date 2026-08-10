# DepartmentField

DepartmentField 用于在业务 Record 中存储和关联组织部门信息，常见场景包括所属部门、协作部门、审批部门、可见部门。

DepartmentField 的字段类型定义以 @FieldDesign.md 为准：

- `Make.Field.SingleDepartment`：单选部门。
- `Make.Field.MultiDepartment`：多选部门。

## Department 字段的流程

1. 先创建 Entity，并在 Entity 中声明 SingleDepartmentField 或 MultiDepartmentField。
2. 用户填写字段时，客户端调用 @DataAPIDesign.md 中 `分页查询 Department 数据`，作为部门选择器的候选项。
3. 用户选择后，客户端把候选接口返回的 `departmentId` 字符串写入 Record；单选写字符串 ID，多选写字符串 ID 数组。
4. 创建或更新 Record 时，服务端校验部门是否存在、是否属于当前组织、是否在当前访问者权限范围内。
5. 客户端获取 Record 时，DepartmentField 返回 `departmentId`、`departmentName` 精简部门对象数组；单选部门通常只有一个元素。

## 例子

### 业务场景

我需要创建一个项目，项目包含 `projectName`、`ownerDepartment`、`relatedDepartments`：

- `ownerDepartment` 是单选部门字段，表示项目所属部门。
- `relatedDepartments` 是多选部门字段，表示协作部门。

#### Step 1: 创建 Entity

需要创建一个 Project(项目) 的 Entity。

```yaml
key: project
name: 项目
type: Make.Entity
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: projectName
      name: 项目名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - key: ownerDepartment
      name: 项目所属部门
      type: Make.Field.SingleDepartment
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - key: relatedDepartments
      name: 协作部门
      type: Make.Field.MultiDepartment
      meta:
        version: 1.0.0
      properties:
        maxCount: 10
      validations:
        isRequired: false
```

#### Step 2: 分页查询 Department 数据

用户填写 `ownerDepartment` 或 `relatedDepartments` 时，客户端通过 Department 分页查询接口获取候选部门。

```
POST https://dev-make.qtech.cn/api/make/data/v1/department
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

`filter` 使用 `Expression` 对象，当前仅支持单个 `departmentName.contains('...')` 条件；不支持通过 `departmentId`、`memberCount`、`platform` 等其它字段过滤。当前候选查询不支持排序；即使传入 `sort`，服务端也会忽略。`leader` 有值时使用 `userId`、`userName`、`avatar` 结构。

```json
{
  "fields": ["departmentId", "departmentName", "memberCount", "platform", "leader"],
  "filter": {
    "expression": "departmentName.contains('产品研发')"
  },
  "pagination": { "page": 1, "size": 10 }
}
```

Record 列表按 DepartmentField 筛选时，使用 `filter.expression` 直接引用业务字段 key；系统变量只作为右值使用。

```json
{
  "filter": {
    "expression": "ownerDepartment == _currentUserDepartment"
  }
}
```

```json
{
  "filter": {
    "expression": "[_currentUserDepartment].exists(v, v in relatedDepartments)"
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "departmentId": "2226",
      "departmentName": "测试部门重复",
      "memberCount": 10,
      "platform": "1",
      "leader": null,
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

#### Step 3: 创建 Record

用户选择候选项后，客户端将候选接口返回的 `departmentId` 字符串写入 Record。

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
  "entityKey": "project",
  "data": {
    "projectName": "烽火项目管理",
    "ownerDepartment": "2226",
    "relatedDepartments": ["2227", "2228"]
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data": {
    "recordID": "rec_abc123"
  }
}
```

#### Step 4: 获取 Record 验证部门字段已关联

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
  "entityKey": "project",
  "recordID": "rec_abc123"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data": {
    "recordID": "rec_abc123",
    "projectName": "烽火项目管理",
    "ownerDepartment": [
      {
        "departmentId": "2226", //字符串形式的部门ID
        "departmentName": "测试部门重复" //部门名称
      }
    ],
    "relatedDepartments": [
      {
        "departmentId": "2227",
        "departmentName": "重复部门"
      },
      {
        "departmentId": "2228",
        "departmentName": "产品研发中心"
      }
    ]
  }
}
```

## 约束

- SingleDepartmentField 非必填时可以写入 `null` 或不提交该字段；必填时不能为 `null`。
- MultiDepartmentField 非必填时可以写入 `[]` 或不提交该字段；必填时数组不能为空。
- MultiDepartmentField 通过 `maxCount` 控制最多可选择的部门数量，默认值以 @FieldDesign.md 为准；元数据消费方必须保留 `maxCount`，供下游按同一数量上限处理多部门值。
- MultiDepartmentField 中同一个部门 ID 不允许重复出现。
- DataAPIDesign.md 中的接口写入的部门 ID 必须是字符串类型，并且必须来自 Department 分页查询接口返回的当前组织可见部门；候选查询响应 JSON 中的 `departmentId` 已是字符串。
- 禁止通过前端实现 Department 数据过滤功能，必须使用后端接口`filter`参数实现。
- 分页查询 Department 候选项时，`filter.expression` 仅支持 `departmentName.contains('...')`。
- Record 列表按 DepartmentField 筛选时，可用 `_currentUserDepartment` 表示当前用户主部门 departmentId。
- 部门不存在、已删除、不可见或不属于当前组织时，创建或更新 Record 应失败。
- DepartmentField 不支持通过数字 ID、`departmentName` 或完整 Department 对象作为唯一标识写入，避免重名造成歧义。
- 返回 DepartmentField 时，服务端返回 `departmentId`、`departmentName` 精简字段；`departmentId` 是字符串形式的部门 ID。
- Department 候选查询中的 `children` 只作为部门树快照返回，不作为组织架构变更来源；创建或更新 Record 时不提交完整子树。
