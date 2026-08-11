# Entity Data Filter Usage

本文约束 makedsl / Make App 生成 `MakeService.ListResources` 请求时如何生成 `filter`。当前 Data API 统一使用 `Expression` 对象承载 CEL 表达式。

## 核心规则

- 仅列表查询支持 `filter`，包括 Record 列表以及受限的 User / Department 候选列表。
- Record 列表必须使用后端筛选，不要在前端拉全量数据后自行过滤。
- `filter` 必须是对象形态：`{ "expression": "<CEL>" }`。
- 省略 `filter`、传 `null`、省略 `filter.expression`、或 `filter.expression` 为空白字符串，均表示不筛选。
- 不要生成裸字符串、数组、旧对象 DSL，例如 `filter: "name.contains('x')"`、`filter: []`、`filter: [{...}]`、`filter: {}`。
- 表达式里的字段引用必须使用字段 key，且字段 key 必须是合法 CEL identifier；不要使用中文字段名、显示名、带连字符字段名、深层路径或反引号转义。

正确：

```json
{
  "appKey": "demo",
  "entityKey": "task",
  "fields": ["name", "status", "dueDate"],
  "filter": {
    "expression": "name.contains('项目') && status in ['todo', 'doing']"
  },
  "sort": [
    { "fieldKey": "dueDate", "order": "asc" }
  ],
  "pagination": {
    "page": 1,
    "size": 20
  }
}
```

错误：

```json
{
  "filter": [
    {
      "name": {
        "contains": "项目"
      }
    }
  ]
}
```

```json
{
  "filter": {}
}
```

## 逻辑组合

`filter.expression` 使用 CEL 的布尔表达式：

- `A && B` 表示同时满足。
- `A || B` 表示满足任一条件。
- 可以使用括号提升可读性。
- 当前解析形态是 DNF：外层 `||` 拆成多个筛选组，组内 `&&` 表示同时满足。
- 支持 `A || (B && C)`、`A && B`；不支持需要服务端自动分配律展开的 `(A || B) && C`。

示例：

```text
name.contains('项目') && status in ['todo', 'doing']
```

```text
name.contains('项目') || budget >= 100000
```

## 操作符和 CEL 写法

| CEL 写法 | 筛选语义 | 说明 |
| --- | --- | --- |
| `field.contains('x')` | `contains` | 文本包含 |
| `!field.contains('x')` | `doesNotContain` | 文本不包含 |
| `field == value` | `=` | 等于 |
| `field != value` | `!=` | 不等于 |
| `field > value` | `>` | 大于 / 晚于 |
| `field >= value` | `>=` | 大于等于 / 晚于或等于 |
| `field < value` | `<` | 小于 / 早于 |
| `field <= value` | `<=` | 小于等于 / 早于或等于 |
| `field in [a, b]` | `isAnyOf` | 单值字段是任一项 |
| `!(field in [a, b])` | `isNoneOf` | 单值字段不是任一项 |
| `['a'].exists(v, v in field)` | `hasAnyOf` | 多值字段包含任一项 |
| `['a', 'b'].all(v, v in field)` | `hasAllOf` | 多值字段包含全部 |
| `!['a'].exists(v, v in field)` | `hasNoneOf` | 多值字段不包含任一项 |
| `field.isWithin({"begin":"2026-04-01","end":"2026-04-30"})` | `isWithin` | 日期 / 日期时间在区间内 |
| `field.isNotWithin({"begin":"2026-04-01","end":"2026-04-30"})` | `isNotWithin` | 日期 / 日期时间不在区间内 |
| `field.containsDate('2026-04-15')` | `containsDate` | 日期区间包含某天 |
| `field.doesNotContainDate('2026-04-15')` | `doesNotContainDate` | 日期区间不包含某天 |
| `field.fullyContains({"begin":"2026-04-01","end":"2026-04-30"})` | `fullyContains` | 日期区间完整覆盖目标区间 |
| `field.isContainedBy({"begin":"2026-04-01","end":"2026-04-30"})` | `isContainedBy` | 日期区间被目标区间包含 |
| `field == null` | `isEmpty` | 为空 |
| `field != null` | `isNotEmpty` | 不为空 |
| `field == null || field == ''` | `isEmpty` | 文本为空 |
| `field != null && field != ''` | `isNotEmpty` | 文本不为空 |
| `field == null || size(field) == 0` | `isEmpty` | 数组为空 |
| `field != null && size(field) > 0` | `isNotEmpty` | 数组不为空 |

## 字段类型矩阵

字段类型详情见 @FieldDesign.md。

| 字段类型 | 支持操作符 | CEL 示例 |
| --- | --- | --- |
| `Make.Field.ID` | `contains`、`doesNotContain`、`=`、`!=`、`isEmpty`、`isNotEmpty` | `orderNo == 'SO-2026-001'` |
| `Make.Field.Text` | `contains`、`doesNotContain`、`=`、`!=`、`isEmpty`、`isNotEmpty` | `projectName.contains('升级')` |
| `Make.Field.TextArea` | `contains`、`doesNotContain`、`=`、`!=`、`isEmpty`、`isNotEmpty` | `projectDescription.contains('FAQ')` |
| `Make.Field.URL` | `contains`、`doesNotContain`、`=`、`!=`、`isEmpty`、`isNotEmpty` | `website.contains('example.com')` |
| `Make.Field.SingleSelect` | `=`、`!=`、`isAnyOf`、`isNoneOf`、`isEmpty`、`isNotEmpty` | `status in ['todo', 'doing']` |
| `Make.Field.SingleUser` | `=`、`!=`、`isAnyOf`、`isNoneOf`、`isEmpty`、`isNotEmpty` | `owner == _currentUser`、`owner in _currentUserSubordinates` |
| `Make.Field.SingleDepartment` | `=`、`!=`、`isAnyOf`、`isNoneOf`、`isEmpty`、`isNotEmpty` | `ownerDepartment == _currentUserDepartment` |
| `Make.Field.MultiSelect` | `hasAnyOf`、`hasAllOf`、`hasNoneOf`、`=`、`isEmpty`、`isNotEmpty` | `['urgent'].exists(v, v in tags)`、`tags == ['urgent', 'external']` |
| `Make.Field.MultiUser` | `hasAnyOf`、`hasAllOf`、`hasNoneOf`、`=`、`isEmpty`、`isNotEmpty` | `[_currentUser].exists(v, v in members)` |
| `Make.Field.MultiDepartment` | `hasAnyOf`、`hasAllOf`、`hasNoneOf`、`=`、`isEmpty`、`isNotEmpty` | `[_currentUserDepartment].exists(v, v in relatedDepartments)` |
| `Make.Field.Number` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isEmpty`、`isNotEmpty` | `score >= 80` |
| `Make.Field.Currency` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isEmpty`、`isNotEmpty` | `budget >= 100000` |
| `Make.Field.Percent` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isEmpty`、`isNotEmpty` | `completionRate < 80` |
| `Make.Field.Date` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isWithin`、`isNotWithin`、`isEmpty`、`isNotEmpty` | `startDate >= '2026-04-01'`、`startDate.isWithin({"begin":"2026-04-01","end":"2026-04-30"})` |
| `Make.Field.DateTime` | `=`、`!=`、`>`、`>=`、`<`、`<=`、`isWithin`、`isNotWithin`、`isEmpty`、`isNotEmpty` | `createdAt >= '2026-04-22 09:00:00'` |
| `Make.Field.DateRange` | `containsDate`、`doesNotContainDate`、`fullyContains`、`isContainedBy`、`=`、`isEmpty`、`isNotEmpty` | `deliveryPeriod.containsDate('2026-04-15')` |
| `Make.Field.File` | `contains`、`doesNotContain`、`>`、`<`、`=`、`isEmpty`、`isNotEmpty` | `attachments.contains('proposal.pdf')`、`attachments > 2` |
| `Make.Field.Lookup` | 按 `targetFieldKey` 的字段类型决定；不支持目标字段也是 Lookup | `profileName.contains('张')`、`courseScore >= 60` |

## 系统变量

系统变量只能作为右值使用，不能替代字段 key。标量变量用于 `field == _currentUser`、`field in [_currentUser]`；列表变量用于 `field in _currentUserSubordinates` 或 `members.exists(v, v in _currentUserDepartmentMembers)`。

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `_currentUser` | 当前调用者 userId | `owner == _currentUser` |
| `_currentOrg` | 当前组织 orgId | `orgId == _currentOrg` |
| `_today` | 按应用时区计算的当前日期，格式 `yyyy-MM-dd` | `dueDate < _today` |
| `_now` | 按应用时区计算的当前时间，格式 `yyyy-MM-dd HH:mm:ss` | `createdAt <= _now` |
| `_currentUserSubordinates` | 当前调用者的直接下属 userId 列表 | `owner in _currentUserSubordinates` |
| `_currentUserManager` | 当前调用者一级领导 userId | `owner == _currentUserManager` |
| `_currentUserManagerLevel2` | 当前调用者二级领导 userId | `owner == _currentUserManagerLevel2` |
| `_currentUserManagerLevel3` | 当前调用者三级领导 userId | `owner == _currentUserManagerLevel3` |
| `_currentUserDepartment` | 当前调用者主部门 departmentId | `ownerDepartment == _currentUserDepartment` |
| `_currentUserDepartmentMembers` | 当前调用者主部门成员 userId 列表 | `members.exists(v, v in _currentUserDepartmentMembers)` |

`_today` 支持天级偏移：`_today + duration("7d")`、`_today - duration("3d")`。`duration` 仅支持 `d` 天级单位，不支持 `h`、`m` 等非天级单位。

## 空值表达式

| 字段逻辑类型 | 为空 | 不为空 |
| --- | --- | --- |
| 文本、ID、URL | `field == null || field == ''` | `field != null && field != ''` |
| 数字、金额、百分比、日期、日期时间、单选、单用户、单部门 | `field == null` | `field != null` |
| 多选、多用户、多部门、文件 | `field == null || size(field) == 0` | `field != null && size(field) > 0` |
| 日期区间 | `field['begin'] == null || field['end'] == null` | `field['begin'] != null && field['end'] != null` |

说明：

- 单用户、单部门在响应展示上可能返回对象数组包装，但筛选逻辑值是单个 ID。
- 多用户、多部门的筛选逻辑值是 ID 数组。

## 日期区间字段

日期区间字段可以使用 `begin` / `end` 下标表达区间边界，也可以使用日期区间方法。

```text
deliveryPeriod['begin'] == '2026-04-01' && deliveryPeriod['end'] == '2026-04-30'
```

```text
deliveryPeriod.containsDate('2026-04-15')
```

```text
deliveryPeriod.fullyContains({"begin":"2026-04-01","end":"2026-04-30"})
```

日期区间下标条件必须同时包含 `begin` 和 `end`，且只能使用 `begin` / `end` 下标。

## Lookup 字段

Record 列表支持按 `Make.Field.Lookup` 字段筛选。表达式引用当前 Entity 上的 Lookup 字段 key，服务端会根据 Lookup 字段配置中的 `relationKey` 和 `targetFieldKey` 找到对端 Entity 的目标字段，并按目标字段类型复用操作符、值归一化和 SQL 生成规则。

```text
profileName.contains('张')
```

```text
courseScore >= 60
```

约束：

- 表达式只能写 Lookup 字段自身的 key，不支持 `profileName.name`、`profile.name`、`targetEntity.field` 等跨对象路径。
- Lookup 字段必须配置 `relationKey` 和 `targetFieldKey`；关联关系、目标 Entity、目标字段不存在时，服务端返回参数错误。
- Lookup 的目标字段类型不能是 `Make.Field.Lookup`，不支持 Lookup 嵌套 Lookup。
- 可用操作符取决于 `targetFieldKey` 的字段类型。例如目标字段是文本时支持 `contains`、`==`、`!=`、空值；目标字段是数字时支持比较操作符。
- 同一个 `&&` 分组内、同一 relation 的多个 Lookup 条件要求命中同一条目标记录。
- 不同 relation 的 Lookup 条件不会合并；不同 `||` 分组之间也不会合并。
- Lookup 的 `isEmpty` / `isNotEmpty` 判断目标记录上 `targetFieldKey` 的值是否为空；没有关联目标记录时，不会命中 `lookupField == null` 这种空值筛选。
- `LookupField.properties.filter` 是字段配置上的对端记录筛选条件；Record 列表的 `filter.expression` 是本次列表查询的业务筛选条件，两者不是同一个入参位置。

## 候选列表接口

User / Department 候选列表也使用 `Expression` 对象，但能力比 Record 列表更窄：

- User 候选列表仅支持单个 `userName.contains('...')`。
- Department 候选列表仅支持单个 `departmentName.contains('...')`。
- 请求体不包含 `appKey` / `entityKey`。

```json
{
  "filter": {
    "expression": "userName.contains('张')"
  }
}
```

```json
{
  "filter": {
    "expression": "departmentName.contains('产品研发')"
  }
}
```

## 常见示例

### 文本包含

```json
{
  "filter": {
    "expression": "projectName.contains('升级')"
  }
}
```

### 单组 AND

```json
{
  "filter": {
    "expression": "projectName.contains('项目') && status in ['todo', 'doing']"
  }
}
```

### 多组 OR

```json
{
  "filter": {
    "expression": "projectName.contains('项目') || budget >= 100000"
  }
}
```

### 多值字段

```json
{
  "filter": {
    "expression": "['urgent', 'external'].all(v, v in tags)"
  }
}
```

### 用户/部门系统变量

```json
{
  "filter": {
    "expression": "owner == _currentUser || owner in _currentUserSubordinates"
  }
}
```

```json
{
  "filter": {
    "expression": "members.exists(v, v in _currentUserDepartmentMembers) && ownerDepartment == _currentUserDepartment"
  }
}
```

### 日期范围

```json
{
  "filter": {
    "expression": "dueDate.isWithin({\"begin\":\"2026-04-01\",\"end\":\"2026-04-30\"})"
  }
}
```

### 日期变量和天级偏移

```json
{
  "filter": {
    "expression": "deliveryDate <= _today + duration(\"7d\") && deliveryDate > _today"
  }
}
```

### Lookup 字段

```json
{
  "filter": {
    "expression": "profileName.contains('张') && profileAge >= 18"
  }
}
```

说明：如果 `profileName` 和 `profileAge` 来自同一个 relation，则同一个 `&&` 分组要求同一条关联目标记录同时满足姓名和年龄条件。

### 空值

```json
{
  "filter": {
    "expression": "attachments == null || size(attachments) == 0"
  }
}
```

## 错误场景速查

| 场景 | 当前行为 |
| --- | --- |
| `filter` 是裸字符串、数组或旧对象 DSL | 不应生成；部分入口可能兼容裸字符串为 `Expression`，生成侧不可依赖；数组或旧对象 DSL 为参数错误或反序列化失败 |
| `filter` 是 `{}` | 无有效表达式，不应生成；需要无筛选时请省略或传 `null` |
| 字段不在 Entity 元数据中 | 参数错误，字段不存在 |
| 字段 key 不是合法 CEL identifier | 表达式解析失败 |
| 表达式包含嵌套 OR，例如 `(A || B) && C` | 参数错误，暂不支持嵌套条件 |
| 操作符与字段类型不匹配 | 参数错误，字段类型与操作符不匹配 |
| 文本右值是数组或对象 | 参数错误，筛选值类型错误 |
| 数组操作符右值为空数组 | 参数错误，筛选值必须为非空数组 |
| 日期格式不符合严格格式 | 参数错误，日期格式错误或日期时间格式错误 |
| Lookup 字段缺少 `relationKey` / `targetFieldKey` | 参数错误 |
| Lookup 目标字段仍是 Lookup | 参数错误，字段类型暂不支持 |
| Lookup 表达式使用跨对象路径 | 表达式解析失败或字段不存在 |

## 生成准则

生成 `MakeService.ListResources` 查询时：

1. 需要筛选时，总是生成 `{ "filter": { "expression": "..." } }`。
2. 不需要筛选时，省略 `filter` 或传 `null`；不要生成 `{}`、`[]` 或空对象数组。
3. 需要 `AND` 时，用 `&&` 拼接条件。
4. 需要 `OR` 时，用 `||` 拼接外层条件；避免生成 `(A || B) && C`，必要时改写为 `(A && C) || (B && C)`。
5. 单值枚举、单用户、单部门的多候选匹配使用 `field in [...]`。
6. 多选、多用户、多部门使用 `exists` / `all` 模式。
7. 只使用字段 key，不使用字段展示名或响应里的 `label`。
8. 可以对 Lookup 字段生成筛选条件，但只能引用 Lookup 字段自身 key，并按目标字段类型选择操作符。
9. 系统变量只作为右值生成；标量变量用于等值或单元素列表，列表变量用于 `in` / `exists` 匹配。
10. 需要相对日期时只生成 `_today +/- duration("Nd")`，不要生成小时、分钟等非天级偏移。
