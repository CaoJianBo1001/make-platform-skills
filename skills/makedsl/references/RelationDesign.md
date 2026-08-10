# 设计原则

Relation 与 LookupField 职责正交：

- **Relation**：纯结构声明——谁和谁有关系、几对几。不涉及任何展示逻辑。
- **LookupField**：通过 Relation 找到对端 Entity 的记录，取其字段值展示。所有展示逻辑在此。

系统根据 Relation 两侧的 cardinality 自动决定存储实现（FK 或中间表），DSL 层面 1:1、1:N、N:M 写法统一，实现细节不泄露到 Field 层。

# Relation DSL

```yaml
key: <KEY>
name: String # 必填, 用户可见的展示名称, 允许中英文数字下划线, 长度 2-20
type: Make.Relation
appKey: <Make.App>
meta:
  version: SemanticVersion
properties:
  from:
    entityKey: <ENTITY_KEY>
    cardinality: one | many
  to:
    entityKey: <ENTITY_KEY>
    cardinality: one | many
```

| cardinality 组合 | 含义 | 存储实现 |
|---|---|---|
| `one` / `one` | 一对一 | FK 放 to 侧 |
| `one` / `many` | 一对多 | FK 放 to 侧 |
| `many` / `many` | 多对多 | 自动建中间表 |

# 例子

## 一对一：用户 ↔ 档案

```yaml
# ===== Relation =====
key: user_has_profile
name: 用户档案关联
type: Make.Relation
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entityKey: user
    cardinality: one
  to:
    entityKey: profile
    cardinality: one

# ===== 用户 Entity =====
key: user
name: 用户
type: Make.Entity
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: full_name
      name: 姓名
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - key: profile_info
      name: 个人档案
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: user_has_profile
        targetFieldKey: bio
    - key: reputation_score
      name: 口碑评分
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: user_has_profile
        targetFieldKey: score
        # 显示 score 字段值，按 score 排序（默认排序字段）
    - key: profile_summary
      name: 档案摘要
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: user_has_profile
        targetFieldKey: bio
        sortByFieldKey: updated_at
        # 显示 bio 字段值，但按 updated_at 时间排序
        # 场景：想看对端最新更新的档案描述

# ===== 档案 Entity =====
key: profile
name: 档案
type: Make.Entity
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: bio
      name: 简介
      type: Make.Field.TextArea
      meta:
        version: 1.0.0
      properties: null
    - key: avatar
      name: 头像
      type: Make.Field.File
      meta:
        version: 1.0.0
      properties: null
    - key: score
      name: 评分
      type: Make.Field.Number
      meta:
        version: 1.0.0
      properties:
        precision: 1
    - key: updated_at
      name: 最后更新
      type: Make.Field.DateTime
      meta:
        version: 1.0.0
      properties:
        format: "yyyy-MM-dd HH:mm:ss"
```

> **1:1 关联要点：**
> - LookupField 对端永远只有一条记录
> - `sortByFieldKey` 仅在 1:1 关联时有效，指定排序字段（可与显示字段不同）
> - 若不指定 `sortByFieldKey`，默认按 `targetFieldKey` 排序

## 一对多：项目 ↔ 任务

```yaml
# ===== Relation =====
key: project_has_tasks
name: 项目任务关联
type: Make.Relation
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entityKey: project
    cardinality: one
  to:
    entityKey: task
    cardinality: many

# ===== 项目 Entity =====
key: project
name: 项目
type: Make.Entity
appKey: <Make.App>
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
    - key: project_tasks
      name: 项目任务
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: project_has_tasks
        targetFieldKey: task_name
    - key: task_status_overview
      name: 任务状态概览
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: project_has_tasks
        targetFieldKey: task_status

# ===== 任务 Entity =====
key: task
name: 任务
type: Make.Entity
appKey: <Make.App>
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
      properties:
        options:
          - label: "待开始"
            value: "todo"
          - label: "进行中"
            value: "in_progress"
          - label: "已完成"
            value: "done"
    - key: parent_project
      name: 所属项目
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: project_has_tasks
        targetFieldKey: project_name
```

> 项目侧 LookupField 对端 cardinality 为 `many`（任务）。
> 任务侧 LookupField 对端 cardinality 为 `one`（项目）。

## 多对多：学生 ↔ 课程

```yaml
# ===== Relation =====
key: student_takes_course
name: 学生选课关联
type: Make.Relation
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  from:
    entityKey: student
    cardinality: many
  to:
    entityKey: course
    cardinality: many

# ===== 学生 Entity =====
key: student
name: 学生
type: Make.Entity
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: full_name
      name: 姓名
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - key: enrolled_courses
      name: 选修课程
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: student_takes_course
        targetFieldKey: course_name

# ===== 课程 Entity =====
key: course
name: 课程
type: Make.Entity
appKey: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: course_name
      name: 课程名称
      type: Make.Field.Text
      meta:
        version: 1.0.0
      properties: null
    - key: credits
      name: 学分
      type: Make.Field.Number
      meta:
        version: 1.0.0
      properties:
        precision: 0
    - key: enrolled_students
      name: 选课学生
      type: Make.Field.Lookup
      meta:
        version: 1.0.0
      properties:
        relationKey: student_takes_course
        targetFieldKey: full_name
```

> N:M 两侧 cardinality 都是 `many`。

# Relation 写入

Relation 决定结构，LookupField 决定展示；真正写入关联关系时，需要在 `CreateResource` / `UpdateResource` 的 `data.qfei_relation` 中显式传递对端记录。

- `qfei_relation` 是数组，即使当前只关联一条记录也使用数组包裹
- 数组项格式固定为 `{ "entityKey": "<对端 Entity key>", "id": "<对端 recordID>" }`
- `LookupField` 不参与写入，它只负责把关联对象的字段投影出来展示
- 具体接口字段见 @DataAPIDesign.md

**一对多：创建任务并关联到项目**

```json
{
  "appKey": "ProjectApp",
  "entityKey": "task",
  "data": {
    "task_name": "编写方案",
    "task_status": "todo",
    "qfei_relation": [
      {
        "entityKey": "project",
        "id": "123"
      }
    ]
  }
}
```

**多对多：更新学生并关联多门课程**

```json
{
  "appKey": "CourseApp",
  "entityKey": "student",
  "recordID": "123",
  "data": {
    "full_name": "张三",
    "qfei_relation": [
      {
        "entityKey": "course",
        "id": "123"
      },
      {
        "entityKey": "course",
        "id": "345"
      }
    ]
  }
}
```

# 数据库实现参考

## 一对一 / 一对多

FK 列放在 `to` 侧的实体表上，列名格式 `_rel_{relation_key}_id`：

```
┌──────────────┐         ┌──────────────────────────────────┐
│ project      │         │ task                             │
├──────────────┤         ├──────────────────────────────────┤
│ _id    (PK)  │←────────│ _rel_project_has_tasks_id  (FK)  │
│ project_name │         │ _id          (PK)                │
│ project_desc │         │ task_name                        │
└──────────────┘         │ task_description                 │
                         │ task_status                      │
                         └──────────────────────────────────┘
```

## 多对多

系统自动创建中间表，表名格式 `_jt_{app_key}_{relation_key}`：
Tips: jt 是 join table 的缩写
```
┌──────────────┐    ┌────────────────────────────┐    ┌──────────────┐
│ student      │    │ _jt_<app>_student_takes_course│ │ course       │
├──────────────┤    ├────────────────────────────┤    ├──────────────┤
│ _id    (PK)  │←───│ _from_id  (FK)             │    │ _id    (PK)  │
│ full_name    │    │ _to_id    (FK)─────────────┼───→│ course_name  │
└──────────────┘    └────────────────────────────┘    │ credits      │
                                                      └──────────────┘
```

## LookupField 查询

LookupField 不占物理列，查询时通过 JOIN 计算：

**一对多（项目侧 → 任务名称）：**

```sql
SELECT p.*, GROUP_CONCAT(t.task_name SEPARATOR ' | ') AS project_tasks
FROM project p
  LEFT JOIN task t ON t._rel_project_has_tasks_id = p._id
GROUP BY p._id;
```

**一对多（任务侧 → 项目名称）：**

```sql
SELECT t.*, p.project_name AS parent_project
FROM task t
  LEFT JOIN project p ON p._id = t._rel_project_has_tasks_id;
```

**多对多（学生侧 → 课程名称）：**

```sql
SELECT s.*, GROUP_CONCAT(c.course_name SEPARATOR ', ') AS enrolled_courses
FROM student s
  LEFT JOIN _jt_student_takes_course j ON j._from_id = s._id
  LEFT JOIN course c ON c._id = j._to_id
GROUP BY s._id;
```

**多对多（课程侧 → 学生姓名）：**

```sql
SELECT c.*, GROUP_CONCAT(s.full_name SEPARATOR ', ') AS enrolled_students
FROM course c
  LEFT JOIN _jt_student_takes_course j ON j._to_id = c._id
  LEFT JOIN student s ON s._id = j._from_id
GROUP BY c._id;
```
