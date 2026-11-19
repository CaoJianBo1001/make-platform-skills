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

# 字段默认值 | Default Value

## 声明与范围

`defaultValue` 是字段顶层可选属性，与 `properties`、`validations` 平级，直接承载与该字段 Record 写入值格式一致的固定值。默认值的类型由字段 `type` 决定，不增加 `type` / `value` 包装。

```yaml
key: priority
name: 优先级
type: Make.Field.SingleSelect
meta:
  version: 1.0.0
properties:
  options:
    - label: 中
      value: medium
defaultValue: medium
validations:
  isRequired: true
```

- 完整字段定义中省略 `defaultValue` 表示未配置默认值；`defaultValue: null` 也表示未配置，更新时可显式传 `null` 取消已有默认值。元数据局部更新中省略属性的处理仍遵循对应 MetaAPI 的更新约定。
- `0`、`""`、`[]` 是显式固定值，不能按未配置处理；是否允许为空取决于字段类型和校验规则。`null` 仅表示无默认值，不作为待写入的默认数据。
- 默认值不改变字段能力，也不取代 ID 编码、派生计算或系统字段的生成逻辑。

## 各字段类型的格式与校验

下表类型均使用 `Make.Field.` 前缀。所有非空默认值必须匹配表中类型；不隐式转换数字字符串、逗号分隔字符串、展示对象或其它类型。

| 字段类型 | `defaultValue` 格式及示例 | 校验规则 |
| --- | --- | --- |
| Text | 字符串，如 `"未命名"` | 遵循文本校验规则；长度不超过 200，且满足已配置的长度、字符、JSON 和正则约束。 |
| TextArea | 字符串，如 `"待补充任务描述"` | 遵循文本框校验规则；长度不超过 2000，且满足已配置的长度、字符、JSON 和正则约束。 |
| Number | JSON 数值，如 `18`、`12.5` | 满足 `properties.precision`、`isInt`、`isFloat`、`minimum`、`maximum`；禁止以字符串或布尔值代替数值，超出精度时拒绝，不自动舍入。 |
| SingleSelect | 单个字符串，如 `"medium"` | 必须是 `properties.options[].value` 中的存储值，不能使用 label 或数组。 |
| MultiSelect | 字符串数组，如 `["bug", "feature"]` | 每项必须是已声明的选项 value；不允许重复项、`null` 元素或逗号分隔字符串。 |
| Date | `yyyy-MM-dd` 字符串，如 `"2000-01-01"` | 必须是有效日历日期；YAML 中加引号。`properties.format` 用于展示，不改变默认值格式。 |
| DateTime | `yyyy-MM-dd HH:mm:ss` 字符串，如 `"2026-11-18 09:00:00"` | 必须是有效日期时间，按应用时区解释，应用未配置时区时使用 `Asia/Shanghai`；不接受时间戳或带时区后缀的其它格式。`properties.format` 仅影响展示。 |
| DateRange | 对象，如 `{begin: "2025-06-15", end: "2025-06-30"}` | 仅含 `begin`、`end`，两端均为有效的 `yyyy-MM-dd` 字符串且 `begin <= end`；默认区间必须在 `properties.begin/end` 允许的边界内。 |
| Percent | JSON 数值，如 `0`、`12.5` | 沿用 Record 写入的原始数值口径，满足 `properties.decimalPlaces`；不带 `%`，不自动乘除 100 或舍入。 |
| Currency | JSON 数值，如 `0`、`1000.5` | 满足 `properties.decimalPlaces`；不带货币符号、千分位，不因 `symbol` 或 `useGrouping` 改变值，不自动舍入。 |
| URL | URL 字符串，如 `"https://example.com"` | 必须是合法 URL，不能用展示对象代替字符串。 |
| SingleUser | 用户 ID 字符串，如 `"19035"` | 使用当前组织内有效的用户 ID；不能填写用户名、数字或响应中的用户对象数组。详见 @UserFieldDesign.md。 |
| MultiUser | 用户 ID 字符串数组，如 `["19035", "19036"]` | 每项为有效用户 ID，去重前即不得重复，不允许 `null` 元素；数量不超过 `properties.maxCount`，未配置时为 1000。 |
| SingleDepartment | 部门 ID 字符串，如 `"2226"` | 使用当前组织内有效的部门 ID；不能填写部门名、数字或响应中的部门对象数组。详见 @DepartmentFieldDesign.md。 |
| MultiDepartment | 部门 ID 字符串数组，如 `["2226", "2227"]` | 每项为有效部门 ID，去重前即不得重复，不允许 `null` 元素；数量不超过 `properties.maxCount`，未配置时为 1000。 |
| ID | 不支持非 `null` 默认值 | 编号由 `properties.rule` 生成。 |
| File | 本期不支持非 `null` 默认值 | 文件沿用上传及附件写入流程。 |
| Lookup / Rollup / Count / Formula | 不支持非 `null` 默认值 | 值由关联读取或派生计算得到。 |
| 系统字段、其它未列入支持范围的类型 | 不支持非 `null` 默认值 | 不得通过默认值覆盖系统维护或尚未定义的字段语义。 |

## 配置与写入校验

- 创建或更新字段定义时，校验默认值类型、字段支持范围及全部适用的 `properties` / `validations` 约束。配置非法时拒绝保存，并定位到相应字段的 `defaultValue` 或其元素、属性。
- 空字符串、空数组仅可用于允许该值类型的可选字段，并须符合其它已配置约束；`validations.isRequired: true` 时不得配置按该字段空值规则判定为空的默认值。必填字段可以不配置默认值，由调用方创建记录时提供。
- 修改字段类型、选项、精度、数量上限、日期边界或校验规则时，必须重新校验已有默认值；不兼容时拒绝该次元数据变更，需同时修正或取消默认值。
- 人员和部门固定 ID 在配置保存时校验存在性及组织归属；记录创建时再次校验有效性、组织归属和当前调用方的访问权限，不因已保存为默认值而免检。
- 服务端补齐后，对最终数据执行原有字段值和权限校验，再进入既有保存回调、字段转换和持久化流程；唯一性仍由数据库唯一索引兜底。默认值仅用于当前有效创建权限允许写入的字段，沿用既有 IAM / BPM 授权优先级，不扩大可写范围。
- 默认值参与 Entity 级唯一性约束。配置保存时不要求该固定值尚未使用；实际写入冲突时沿用 DataAPI 的 `409`，不自动生成替代值。
- 前端可预填固定值，但服务端必须统一处理所有进入同一 Record 创建链路的请求。默认数组、对象须为每条记录生成独立副本，不修改字段配置或调用方的原始提交对象。

## 生效时机

默认值只在创建 Record 时，对请求 `data` 中未出现字段 key 的字段补齐，不能通过值的真假或是否为空判断是否触发。

| 场景 | 行为 |
| --- | --- |
| 创建记录，未提交字段 key | 当前字段允许创建且配置了非 `null` 默认值时，在字段值校验前补齐。 |
| 创建记录，显式提交该字段为 `null`、`""`、`[]`、`0` 等 | 保留显式输入，不补默认值；按原有规则执行该次请求的校验。 |
| 更新记录，包括批量更新或将已有字段清空 | 不补默认值；未提交字段保持原值，已提交字段按原更新规则处理。 |
| 读取、筛选、排序、分组或聚合历史记录 | 不使用默认值替换历史空值，不产生隐式写入。 |
| 新增字段、修改或取消默认值 | 只影响之后创建的记录；不回填、不修改已有记录。 |
| 创建草稿 Record | 仍按字段 key 是否缺失补默认值；`isDraft=true` 仅按 DataAPI 约定跳过本次必填校验，不关闭默认值补齐。 |
| 更新草稿 Record | 不补默认值；草稿更新仍为局部更新。 |

例如，`priority` 配置 `defaultValue: medium` 且为必填字段时：普通创建提交 `{}` 会补入 `priority: medium`；提交 `{"priority":"high"}` 保留 `high`；提交 `{"priority":null}` 不补齐并触发必填校验。若该次创建为草稿，则空值按 DataAPI 的草稿规则处理，不改写为 `medium`。

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
