# 约束条件

- 所有 Field 的 `key` 仅允许英文字符、数字、下划线，长度 2-20，创建后不可更新，在一个 Entity 下唯一。
- 所有 Field 的 `key` 不能以下划线(\_) 开头，下划线开头是预留关键字。
- 所有 Field 的 `name` 必填，作为用户可见的展示名称，允许中英文数字下划线，长度 2-20。

## 字段属性 properties 速查

`properties` 是字段类型的 schema 配置，由平台元数据下发给表单、表格、筛选、编辑器等消费方。生成 DSL 时必须按字段类型填写，下游元数据消费方不得丢弃这些属性。

| 字段类型 | properties | 语义 |
| --- | --- | --- |
| `Make.Field.Number` | `precision: Integer` | 最大允许小数位数，用于数字输入、展示和提交前校验。 |
| `Make.Field.Date` | `format: String` | 日期展示/输入格式，如 `yyyy-MM-dd`、`yyyy/MM/dd`。 |
| `Make.Field.DateTime` | `format: String` | 日期时间展示/输入格式，如 `yyyy-MM-dd HH:mm:ss`。 |
| `Make.Field.DateRange` | `begin: Date`, `end: Date` | 日期范围字段允许选择的边界；记录值仍使用结构化范围值。 |
| `Make.Field.Percent` | `decimalPlaces: Integer` | 百分比最大允许小数位数，用于输入、展示和提交前校验。 |
| `Make.Field.Currency` | `symbol: String`, `decimalPlaces: Integer`, `useGrouping: Boolean` | 金额符号、最大允许小数位数和分组展示规则。 |
| `Make.Field.File` | `maxCount: Integer` | 最大文件数量，默认值为 `1`。FileField 始终是数组语义。 |
| `Make.Field.MultiUser` | `maxCount: Integer` | 最大用户数量，默认值为 `1000`。 |
| `Make.Field.MultiDepartment` | `maxCount: Integer` | 最大部门数量，默认值为 `1000`。 |

### 数字类字段小数位契约

- `Make.Field.Number` 的 `precision` 表示记录值最大允许的小数位数。
- `Make.Field.Currency` 的 `decimalPlaces` 表示金额记录值最大允许的小数位数；`symbol` 和 `useGrouping` 只影响前端展示。
- `Make.Field.Percent` 的 `decimalPlaces` 表示百分比记录值最大允许的小数位数；百分号只由前端展示。标准数值尺度是直接百分数：记录值 `85.00` 表示 `85%`，Data API、提交值和筛选表达式都使用 `85.00` 这一尺度，前端不得隐式乘除 `100`。
- 这些属性是下游表单和单元格编辑器的输入约束，不只是展示提示。UI 必须在提交或 commit 之前校验小数位，不能等 Data API 拒绝后才暴露问题。
- 当 schema 未提供对应属性时，消费方只能使用宿主项目或后端契约已明确记录的默认值；没有明确默认值时不得自行猜测小数位或静默改写用户输入。

# 字段唯一性 | Uniqueness

唯一性统一在 Entity 级用 `properties.uniqueConstraints` 声明，支持联合唯一约束.
```
uniqueConstraints:
  - name: uniq_email          # 单字段唯一 (n=1): 邮箱全 Entity 唯一
    fields:
      - email
  - name: uniq_project_member # 复合唯一 (n≥2): 同一项目下同一成员只能出现一次
    fields:
      - project_id
      - member_id
```

## 支持唯一性约束的字段类型 | Whitelist

`uniqueConstraints.fields` 只能引用 `capabilities.supportsUniqueConstraint: true` 的字段类型，取值见各字段 DSL 的 `capabilities` 声明；未声明该能力的类型（如 Rollup / Formula / Relation）一律不支持。

# 字段能力 | Capabilities

`capabilities` 声明字段类型的固有能力，由平台按 `type` 统一给出。用户创建/更新字段时不可填写、不可自定义，因此只出现在各字段的 DSL 规范中，不出现在例子里。

- `groupable: Boolean` — 是否支持按该字段的值分组。仅平台当前稳定支持时为 `true`，灰度中或规划中的能力一律为 `false`。
- `sortable: Boolean` — 是否支持按该字段的值排序。
- `supportsUniqueConstraint: Boolean` — 是否可被 Entity 级 `properties.uniqueConstraints` 的 `fields` 引用。

# Regular Field | 常规字段

常规字段可以直接对字段进行写入。

## IDField | 编号字段

一般业务上用来生成唯一 ID, 支持 String 和 Integer 类型。

### IDField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.ID
meta:
  version: SemanticVersion
properties:
  rule:
    prefix: String # 编号前缀, 配置时可以为空
    suffix: String # 编号后缀, 配置时可以为空
    code: Integer # 编号数字, 自增, 配置时可以为空
    digit: Integer # 编号长度
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
```

> SemanticVersion 表示语义化, 具体可以查看 https://semver.org/
> 其中 version 的作用是用来解决后续可能代码的版本兼容性问题

### IDField 例子

```yaml
key: order
name: 订单号
type: Make.Field.ID
meta:
  version: 1.0.0
properties:
  rule:
    prefix: "China"
    suffix: null
    code: Integer # 编号数字, 自增, 配置时可以为空
    digit: 4
```

## TextField | 文本字段

单行文本字段。

### 约束

- `maxLength` 最大值为200

### TextField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Text
meta:
  version: SemanticVersion
properties: null
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: true # 大小写敏感, Tom 与 tom 视为不同值
validations:
  isRequired: Boolean
  isAlpha: Boolean
  isAlphaumeric: Boolean
  isJSON: Boolean
  minLength: Integer
  maxLength: Integer
  matchRegexp: /foo/
```

### TextField 例子

```yaml
key: full_name
name: 姓名
type: Make.Field.Text
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## TextAreaField | 文本框字段

多行文本字段。

### 约束

- `maxLength` 最大值为2000

### TextAreaField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.TextArea
meta:
  version: SemanticVersion
properties: null
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
  isAlpha: Boolean
  isAlphaumeric: Boolean
  isJSON: Boolean
  minLength: Integer
  maxLength: Integer
  matchRegexp: /foo/
```

### TextAreaField 例子

```yaml
key: task_description
name: 任务描述
type: Make.Field.TextArea
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## NumberField | 数字字段

表示数字, 支持整数, 小数等。

### 约束
- 如果是金额类型，禁止使用数字字段代替

### NumberField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Number
meta:
  version: SemanticVersion
properties:
  precision: Integer
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: true
validations:
  isRequired: Boolean
  isInt: Boolean
  isFloat: Boolean
  minimum: Number
  maximum: Number
```

### NumberField 例子

```yaml
key: age
name: 年龄
type: Make.Field.Number
meta:
  version: 1.0.0
properties:
  precision: 2
validations:
  isRequired: true
  minimum: 0
  maximum: 200
```

## SingleSelectField | 单选字段

从预定义的选项列表中选择一项。

### SingleSelectField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.SingleSelect
meta:
  version: SemanticVersion
properties:
  options:
    - label: String # 显示文本
      value: String # 存储值
capabilities:
  groupable: true
  sortable: true
  supportsUniqueConstraint: true
validations:
  isRequired: Boolean
```

### SingleSelectField 例子

```yaml
key: priority
name: 优先级
type: Make.Field.SingleSelect
meta:
  version: 1.0.0
properties:
  options:
    - label: "高"
      value: "high"
    - label: "中"
      value: "medium"
    - label: "低"
      value: "low"
validations:
  isRequired: true
```

## MultiSelectField | 多选字段

从预定义的选项列表中选择多项。

### MultiSelectField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.MultiSelect
meta:
  version: SemanticVersion
properties:
  options:
    - label: String
      value: String
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### MultiSelectField 例子

```yaml
key: tags
name: 标签
type: Make.Field.MultiSelect
meta:
  version: 1.0.0
properties:
  options:
    - label: "Bug"
      value: "bug"
    - label: "Feature"
      value: "feature"
    - label: "Enhancement"
      value: "enhancement"
validations:
  isRequired: true
```

## DateField | 日期字段

表示日期

### DateField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Date
meta:
  version: SemanticVersion
properties:
  format: String # yyyy-MM-dd | yyyy/MM/dd | yyyy-MM-dd | yyyy/M/dd | yyyy-M-dd
capabilities:
  groupable: true
  sortable: true
  supportsUniqueConstraint: true
validations:
  isRequired: Boolean
```

yyyy-MM-dd 类似格式 2023-01-01
yyyy/MM/dd 类似格式 2023/01/01
yyyy/M/dd 类似格式 2023/1/01

### DateField 例子

```yaml
key: birthday
name: 生日
type: Make.Field.Date
meta:
  version: 1.0.0
properties:
  format: "yyyy-MM-dd"
validations:
  isRequired: true
```

## DateTimeField | 日期时间字段

表示时间

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.DateTime
meta:
  version: SemanticVersion
properties:
  format: String # yyyy-MM-dd HH:mm:ss | yyyy/MM/dd HH:mm:ss
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: true
validations:
  isRequired: Boolean
```

### DateTimeField 例子

```yaml
key: created_at
name: 创建时间
type: Make.Field.DateTime
meta:
  version: 1.0.0
properties:
  format: "yyyy-MM-dd HH:mm:ss"
validations:
  isRequired: true
```

yyyy-MM-dd HH:mm:ss 类似格式 2026-02-27 15:08:05

## DateRangeField | 日期范围字段

日期范围字段

### DateRangeField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.DateRange
meta:
  version: SemanticVersion
properties:
  begin: Date
  end: Date
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: true # 底层 begin/end 两列, 元组整体联合唯一
validations:
  isRequired: Boolean
```

### DateRangeField 例子

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.DateRange
meta:
  version: SemanticVersion
properties:
  begin: "2025-06-01"
  end: "2025-12-01"
validations:
  isRequired: true
```

## PercentField | 百分比字段

显示百分比

### PercentField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Percent
meta:
  version: SemanticVersion
properties:
  decimalPlaces: Integer
capabilities:
  groupable: true
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### PercentField 例子

```yaml
key: project_progress
name: 项目进度
type: Make.Field.Percent
meta:
  version: 1.0.0
properties:
  decimalPlaces: 2 # 表示2 个小数位数 12.00%
validations:
  isRequired: true
```

## CurrencyField | 金额字段

显示金额

### CurrencyField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Currency
meta:
  version: SemanticVersion
properties:
  symbol: String
  decimalPlaces: Integer
  useGrouping: Boolean # 1000 => 1,000
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### CurrencyField 例子

```yaml
key: project_progress
name: 项目进度
type: Make.Field.Currency
meta:
  version: 1.0.0
properties:
  symbol: "¥"
  decimalPlaces: 2 # 表示2 个小数位数 12.00
  useGrouping: false
validations:
  isRequired: true
```

## URLField | URL 字段

用来存储和跳转 URL 链接。

### URLField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.URL
meta:
  version: SemanticVersion
properties: null
capabilities:
  groupable: false
  sortable: false
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### URLField 例子

```yaml
key: company_website
name: 公司官网
type: Make.Field.URL
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## FileField | 文件字段

用来存储和管理文件。FileField 统一采用数组语义，通过 `maxCount` 控制文件数量上限。
上传、自动回填与下载流程详见 @FileFieldDesign.md

### FileField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.File
meta:
  version: SemanticVersion
properties:
  maxCount: Integer # 最大文件数量, 默认为 1
capabilities:
  groupable: false
  sortable: false
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
  mustBeImage: Bool
  mustBePDF: Bool
  mustBeTextFile: Bool
```

### FileField 例子

```yaml
key: project_docs
name: 项目文档
type: Make.Field.File
meta:
  version: 1.0.0
properties:
  maxCount: 5
validations:
  isRequired: true
  mustBePDF: true
```

## SingleUserField | 用户字段
存储和关联单选用户信息, 可以存储单个用户信息
详情请参考 @UserFieldDesign.md

### SingleUserField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.SingleUser
meta:
  version: SemanticVersion
properties: null
capabilities:
  groupable: true
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### SingleUserField 例子

```yaml
key: owner
name: 负责人
type: Make.Field.SingleUser
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## MultiUserField | 用户字段
存储和关联多选用户信息, 可以存储多个用户信息, 统一采用数组语义，通过 `maxCount` 控制用户数量上限
详情请参考 @UserFieldDesign.md

### MultiUserField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.MultiUser
meta:
  version: SemanticVersion
properties:
  maxCount: Integer # 最大用户数量, 默认为 1000
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### MultiUserField 例子

```yaml
key: assignees
name: 负责人
type: Make.Field.MultiUser
meta:
  version: 1.0.0
properties:
  maxCount: 1000
validations:
  isRequired: true
```

## SingleDepartmentField | 部门字段
存储和关联单选部门信息, 可以存储单个部门信息
详情请参考 @DepartmentFieldDesign.md

### SingleDepartmentField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.SingleDepartment
meta:
  version: SemanticVersion
properties: null
capabilities:
  groupable: true
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### SingleDepartmentField 例子

```yaml
key: department
name: 所属部门
type: Make.Field.SingleDepartment
meta:
  version: 1.0.0
properties: null
validations:
  isRequired: true
```

## MultiDepartmentField | 部门字段
存储和关联多选部门信息, 可以存储多个部门信息, 统一采用数组语义，通过 `maxCount` 控制部门数量上限
详情请参考 @DepartmentFieldDesign.md

### MultiDepartmentField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.MultiDepartment
meta:
  version: SemanticVersion
properties:
  maxCount: Integer # 最大部门数量, 默认为 1000
capabilities:
  groupable: false
  sortable: true
  supportsUniqueConstraint: false
validations:
  isRequired: Boolean
```

### MultiDepartmentField 例子

```yaml
key: departments
name: 协作部门
type: Make.Field.MultiDepartment
meta:
  version: 1.0.0
properties:
  maxCount: 1000
validations:
  isRequired: true
```

# Derived Field | 派生字段

Derived Field 表示该字段是从其它的字段的值派生而来的

## LookupField | 查找字段

LookupField 通过 Relation 找到对端记录，再读取对端字段作为展示值。

### 约束

- 禁止在一个`Entity`中定义与另一个`Entity`语义相同的字段。
- 禁止通过自定义关联Id字段来描述两个`Entity`的关系，如果在一个`Entity`中需要展示另一个`Entity`的字段数据，则必须使用 `LookupField` 实现。
- `LookupField` 只负责展示，不负责写入关系。
- 关联关系写入时使用 `CreateResource` / `UpdateResource` 的 `data.qfei_relation`。接口示例见 @DataAPIDesign.md

### LookupField DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Field.Lookup
meta:
  version: SemanticVersion
properties:
  relationKey: Make.Relation
  targetFieldKey: FieldKey # 对端 Entity 上要查找的字段 key
  sortByFieldKey: FieldKey? # 可选, 如果为空的话, 通过 targetFieldKey 排序, 只支持 1:1 关联
  filter: Expression # 可选，Lookup 对端记录筛选条件，使用统一 Expression 对象承载 CEL 表达式
capabilities:
  groupable: true # 运行时仅严格 1:1 + FK 且目标字段 groupable=true 时可分组
  sortable: true  # 运行时仅严格 1:1 + FK 且目标字段 sortable=true 时可排序
  supportsUniqueConstraint: false
```

Lookup 的 `groupable` / `sortable` 表示字段类型具备相应能力，实际请求还必须同时满足：`fromCardinality=one`、`toCardinality=one`、`storageType=FK`，并由目标字段的 capability 决定是否可用。一对多、多对一、多对多、`JOIN_TABLE` 均不支持；目标字段仍为 Lookup 时不支持递归分组或排序。

### LookupField 例子

```yaml
key: task_status_overview
name: 任务状态概览
type: Make.Field.Lookup
meta:
  version: SemanticVersion
properties:
  relationKey: project_task_relation
  # 拿对面哪个字段？ -> 拿 Task 的 '任务状态'
  targetFieldKey: task_status
  filter:
    expression: status == 'doing'
```

### Validation | 数据校验

```
validations:
  isRequired: Boolean
  isAlpha: Boolean
```

说明: 多个规则之间是 and 的关系, 比如下面的逻辑 表示这个字段必须是必填的而且只能是英文字母

```
validations:
  isRequired: true
  isAlpha: true
```

| 规则名称                | 说明                     |
| ----------------------- | ------------------------ |
| `isRequired:Boolean`    | 必须是必填               |
| `isAlpha:Boolean`       | 必须是字母               |
| `isAlphaumeric:Boolean` | 必须是字母或数字         |
| `isInt:Boolean`         | 必须是整形               |
| `isFloat:Boolean`       | 必须是浮点形             |
| `minLength:Integer`     | 最小长度                 |
| `maxLength:Integer`     | 最大长度                 |
| `maximum:Number`        | 最大值                   |
| `minimum:Number`        | 最小值                   |
| `isJSON:Boolean`        | 是否是合法的 JSON 字符串 |
| `matchRegexp:/foo/`     | 必须命中某个正则         |
| `mustBeImage:Boolean`    | 必须是图片文件           |
| `mustBePDF:Boolean`      | 必须是 PDF 文件          |
| `mustBeTextFile:Boolean` | 必须是文本文件           |
