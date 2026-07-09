# Console Permission Config Model

Use this reference when touching make-console single-app permission configuration or when interpreting what the frontend receives from IAM.

## Contents

- Backend configuration owner
- Permission group APIs
- Policy shape
- Operations
- Resources
- Field condition
- Data condition
- Default/all-form permissions

## Backend configuration owner

Assume make-console owns permission-group management unless the user explicitly asks to build permission management pages inside a business App.

Generated business Apps normally consume configured permissions through `/principal/permission`; they do not implement role/group management UI.

## Permission group APIs

make-console single-app permission management uses App-scoped group APIs:

```text
POST /console/v1/permissions/groups/list
POST /console/v1/permissions/groups/detail
POST /console/v1/permissions/groups/create
POST /console/v1/permissions/groups/copy
POST /console/v1/permissions/groups/delete
POST /console/v1/permissions/groups/config/check
POST /console/v1/permissions/groups/save
```

Common payload fields:

```text
appKey
key
name
rules
subjects.users[].userId
subjects.departments[].departmentId
```

Form/entity candidates come from Meta:

```text
GET/POST /meta/v1/entity
X-Make-Target: MakeService.ListResources
```

## Policy shape

Permission rules use `Make.IAM.Policy` style statements:

```json
{
  "key": "rule_key",
  "name": "权限规则1",
  "type": "Make.IAM.Policy",
  "meta": { "version": "1.0.0" },
  "properties": {
    "description": "",
    "statements": [
      {
        "key": "Statement1",
        "name": "媒体权限",
        "effect": "allow",
        "permissionKeys": ["data.record.read", "data.record.update"],
        "resources": ["make://<tenantId>/meta/app/<appKey>/entity/<entityKey>"],
        "dataCondition": { "expression": "" },
        "fieldCondition": {
          "fields": [
            { "fieldKey": "name", "access": "editable" },
            { "fieldKey": "status", "access": "readonly" }
          ]
        }
      }
    ]
  }
}
```

Unsupported legacy statement shapes should not be treated as allow in new UI.

## Operations

Known operation keys:

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Frontend meanings:

- `read`: list/detail/view data.
- `create`: new record and create-form field editability.
- `update`: edit, cell edit, update-form field editability.
- `bulkUpdate`: batch edit only when the UI has batch-edit capability.
- `delete`: delete action.
- `data.record.*`: all record operations.
- `*.*.*`: full wildcard permission.

## Resources

All forms wildcard:

```text
*
```

Entity resource:

```text
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
```

App resource:

```text
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/*/app/<appKey>
```

The frontend runtime must match app-level resources, IAM namespace-wildcard App resources, and wildcard resources, not only exact entity resources.

## Field condition

Field access values:

```text
hidden
readonly
editable
partialMask
fullMask
```

Frontend editability:

- `editable` allows editing.
- `readonly`, `hidden`, `partialMask`, `fullMask`, missing field, or missing allow denies editing.
- No fieldCondition on an allow statement means unrestricted fields for that operation.
- A `*` field can express a default baseline.

Use fieldCondition for editability. Use schema for visibility. Do not infer editability from visible fields.

## Data condition

`dataCondition.expression` expresses data range. The frontend must not evaluate it. Record APIs and backend authorization own row-level enforcement.

## Default/all-form permissions

A default full/read permission may use:

```text
resources: ["*"]
permissionKeys: ["*.*.*"]
fieldCondition.fields: [{ fieldKey: "*", access: "editable" | "readonly" }]
```

Do not treat `*`, `make://<tenantId>/*/app/<appKey>`, or app-level resource as platform permission. In App scope, they are valid single-app permission matches.
