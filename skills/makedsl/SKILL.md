---
name: makedsl
description: Use when designing or generating Make platform DSL YAML — defining apps, entities, fields, relations, views, or record schemas. Also triggered by requests like "建模", "建表", "加字段", "定义关联", or "生成 DSL". Does not deploy resources (use makecli), build frontend UI (makeui), implement Service/API code (make-app-service), handle auth (make-app-auth), runtime packaging (make-app-runtime), OCR integration (make-integration), or canvas-table behavior.
metadata:
  version: 0.2.0
---

# makedsl usage
Use this skill when you need to  design or generate dsl for make platform or make 开发平台.
make platform 从 kubernetes 和 ansible 中借鉴了设计思路, 业务的模型通过 DSL 建模定义, 
然后通过 DataAPI 来对数据进行 CRUD-LS. 
生成的 DSL(yaml) 文件应该通过 `makecli` 提交到 make platform (make 开发者平台)

## Runtime Boundary

- DSL YAML is a design and deployment input, not a required runtime file for a published App Service.
- Do not generate Service startup logic that hard-codes container paths such as `/dsl/00-app.yaml`.
- Published Service should load schema from Make remote schema APIs or environment-provided config. Local DSL files are acceptable for development, fixtures, tests, and `makecli apply`, but must not be the only source required for k8s startup.
- If a Service needs a fallback local schema for offline development, make it explicit and test both the remote-schema path and the fallback path.
- When frontend build or published App runtime needs remote schema, use Meta Service APIs from @references/MetaAPIDesign.md instead of reading local DSL files.

## Reference map

| Topic | Read |
| --- | --- |
| Make Meta API schema access | `references/MetaAPIDesign.md` |
| Make Data API and relation payloads | `references/DataAPIDesign.md` |
| Relation declarations | `references/RelationDesign.md` |
| Base field DSL and lookup fields | `references/FieldDesign.md` |
| User field design | `references/UserFieldDesign.md` |
| Department field design | `references/DepartmentFieldDesign.md` |
| File field design | `references/FileFieldDesign.md` |
| Entity data filter usage | `references/EntityDataFilterUsage.md` |

# DSL定义

## APP

逻辑概念上对应数据库的一个 database

### APP DSL

```yaml
key: <KEY> # 创建后不可更新, 只允许英文字符、数字、下划线, 长度 2-20
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.App
meta:
  version: SemanticVersion
properties:
  timezone: String? # 可选，如 "Asia/Shanghai"、"UTC"；若未指定，使用系统默认"Asia/Shanghai"
  description: String?
```

#### 约束条件

- 所有 App 的 `key` 创建后不可更新, 在一个 org 下面唯一。
- 所有 App 的 `key` 不能以下划线 (`_`) 开头，下划线开头是预留关键字。
- 所有 App 的 `name` 是用户可见的展示名称。

### App 例子

```yaml
key: MatrixProject
name: 烽火项目管理
type: Make.App
meta:
  version: 1.0.0
properties:
  description: 烽火项目管理演示项目
```

## Entity

逻辑概念上对应数据库 table 的一个 Table, 在底层实现是 ${App}.${Entity} 作为一个 TiDB 的 Table

### Entity DSL

```yaml
key: <KEY> # 仅英文字符、数字、下划线, 长度 2-20, 创建后不可更新
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Entity
app: <Make.App>
meta:
  version: SemanticVersion
properties:
  fields:
    - Make.Field
    - Make.Field
    - ...
```

#### 约束条件

- 所有 Entity 的 `key` 创建后不可更新, 在一个 App 下面唯一。
- 所有 Entity 的 `key` 不能以下划线 (`_`) 开头，下划线开头是预留关键字。
- 所有 Entity 的 `name` 是用户可见的展示名称。

### Entity 例子

#### 项目 Entity

```yaml
key: project
name: 项目
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: project_name
      name: 项目名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - key: project_description
      name: 项目描述
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
```

#### 任务 Entity

```yaml
key: task
name: 任务
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: task_name
      name: 任务名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - key: task_description
      name: 任务描述
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
    - key: task_status
      name: 任务状态
      type: Make.Field.SingleSelect
      meta:
        version: 1.0.0
      properties: null
```

## Relation | 关联

- Relation 是描述 Entity 之间关系的纯结构声明——谁和谁有关系、几对几。不涉及任何展示逻辑。（详见 @references/RelationDesign.md）
- 关联数据的展示通过 LookupField 实现（详见 @references/FieldDesign.md）。
- 关联数据写入时，需要在 Data API 的 `data.qfei_relation` 中显式传递关联对象。（详见： @references/DataAPIDesign.md）

## Field | 字段

逻辑概念上对应数据库 table 的一个 column, 一个 Entity 会包含多个 Field
详情请见 @references/FieldDesign.md

## Record | 记录

逻辑概念上对应数据库 table 的一个 row, 一个 Entity 会包含多个 Record

# DataAPI | 数据 CRUD-LS
 对数据的操作可以参考 @references/DataAPIDesign.md

# MetaAPI | 元数据与 Schema
 前端构建、运行时 schema 加载、实体/字段/关联元数据读取可以参考 @references/MetaAPIDesign.md
