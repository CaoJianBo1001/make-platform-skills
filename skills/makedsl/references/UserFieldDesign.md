# UserField

UserField 用于在业务 Record 中存储和关联组织内用户信息，常见场景包括负责人、协作人、审批人、参与成员。

UserField 的字段类型定义以 @FieldDesign.md 为准：

- `Make.Field.SingleUser`：单选用户。
- `Make.Field.MultiUser`：多选用户。

## User 字段的流程

1. 先创建 Entity，并在 Entity 中声明 SingleUserField 或 MultiUserField。
2. 用户填写字段时，客户端调用 @DataAPIDesign.md 中 `分页查询 User 数据`接口，作为用户选择器的候选项。
3. 用户选择后，客户端把候选接口返回的 `userId` 字符串写入 Record；单选写字符串 ID，多选写字符串 ID 数组。
4. 创建或更新 Record 时，服务端校验用户是否存在、是否属于当前组织、是否在当前访问者权限范围内。
5. 客户端获取 Record 时，UserField 返回 `userId`、`userName`、`avatar` 精简用户对象数组；单选用户通常只有一个元素。

## 例子

### 业务场景

我需要创建一个项目，项目包含 `projectName`、`owner`、`members`：

- `owner` 是单选用户字段，表示项目负责人。
- `members` 是多选用户字段，表示项目成员。

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

    - key: owner
      name: 项目负责人
      type: Make.Field.SingleUser
      meta:
        version: 1.0.0
      properties: null
      validations:
        isRequired: true

    - key: members
      name: 项目成员
      type: Make.Field.MultiUser
      meta:
        version: 1.0.0
      properties:
        maxCount: 20
      validations:
        isRequired: false
```

#### Step 2: 分页查询 User 数据

用户填写 `owner` 或 `members` 时，客户端通过 User 分页查询接口获取候选用户。

```
POST https://dev-make.qtech.cn/api/make/data/v1/user
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.ListResources
```

Request Body

`filter` 使用 `Expression` 对象，当前仅支持单个 `userName.contains('...')` 条件；不支持通过 `userId`、`email`、`mobile` 等其它字段过滤。当前候选查询不支持排序；即使传入 `sort`，服务端也会忽略。当前接口只返回 `userId`、`userName`、`avatar`。

```json
{
  "fields": ["userId", "userName", "avatar"],
  "filter": {
    "expression": "userName.contains('张')"
  },
  "pagination": { "page": 1, "size": 10 }
}
```

Record 列表按 UserField 筛选时，使用 `filter.expression` 直接引用业务字段 key；系统变量只作为右值使用。

```json
{
  "filter": {
    "expression": "owner == _currentUser"
  }
}
```

```json
{
  "filter": {
    "expression": "owner in _currentUserSubordinates || owner == _currentUserManagerLevel2"
  }
}
```

```json
{
  "filter": {
    "expression": "members.exists(v, v in _currentUserDepartmentMembers)"
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
      "userId": "19035",
      "userName": "张三",
      "avatar": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp"
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

用户选择候选项后，客户端将候选接口返回的 `userId` 字符串写入 Record。

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
    "owner": "19035",
    "members": ["19034", "19035"]
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

#### Step 4: 获取 Record 验证用户字段已关联

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
    "owner": [
      {
        "userId": "19035", //字符串形式的用户ID
        "userName": "张三", //用户名称
        "avatar": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp" //用户头像链接
      }
    ],
    "members": [
      {
        "userId": "19034",
        "userName": "李四",
        "avatar": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp"
      },
      {
        "userId": "19035",
        "userName": "张三",
        "avatar": "https://s1-imfile.feishucdn.com/static-resource/v1/v3_00te_eb78734a-931f-4184-823d-e53a7213500g~?image_size=noop&cut_type=&quality=&format=png&sticker_format=.webp"
      }
    ]
  }
}
```

## 约束

- SingleUserField 非必填时可以写入 `null` 或不提交该字段；必填时不能为 `null`。
- MultiUserField 非必填时可以写入 `[]` 或不提交该字段；必填时数组不能为空。
- MultiUserField 通过 `maxCount` 控制最多可选择的用户数量，默认值以 @FieldDesign.md 为准；元数据消费方必须保留 `maxCount`，供下游按同一数量上限处理多用户值。
- MultiUserField 中同一个用户 ID 不允许重复出现。
- DataAPIDesign.md 中的接口写入的用户 ID 必须是字符串类型，并且必须来自 User 分页查询接口返回的当前组织可见用户；候选查询响应 JSON 中的 `userId` 已是字符串。
- 禁止通过前端实现 User 数据过滤功能，必须使用后端接口`filter`参数实现。
- 分页查询 User 候选项时，`filter.expression` 仅支持 `userName.contains('...')`。
- Record 列表按 UserField 筛选时，可使用 `_currentUser`、`_currentUserSubordinates`、`_currentUserManager`、`_currentUserManagerLevel2`、`_currentUserManagerLevel3`、`_currentUserDepartmentMembers` 等系统变量。
- 用户不存在、已停用、不可见或不属于当前组织时，创建或更新 Record 应失败。
- UserField 不支持通过数字 ID、`userName` 或完整 User 对象作为唯一标识写入，避免重名造成歧义。
- 返回 UserField 时，服务端返回 `userId`、`userName`、`avatar` 精简字段；`userId` 是字符串形式的用户 ID，并根据访问者权限裁剪敏感信息。
