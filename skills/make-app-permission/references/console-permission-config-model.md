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
        "permissionKeys": [
          "data.record.read",
          "data.record.update",
          "meta.field.read",
          "meta.field.update"
        ],
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

Record operation keys and field permission keys must both be present when a rule grants both record operations and field visibility/editability. `fieldCondition` constrains `meta.field.read/update`; it must not be interpreted as making `data.record.create/update` grant field permissions.

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
- `create`: new record entry and create submit operation.
- `update`: edit entry, edit route, cell edit commit operation, and update submit operation.
- `bulkUpdate`: batch edit only when the UI has batch-edit capability.
- `delete`: delete action.
- `data.record.*`: all record operations.
- `*.*.*`: full wildcard permission.

Field permission keys:

```text
meta.field.read
meta.field.update
meta.field.*
```

Frontend meanings:

- `meta.field.read`: field is visible/readable. Without it, do not render the field.
- `meta.field.update`: field is editable. Without it, visible fields render readonly/disabled, skip required validation, and are excluded from submit payloads.
- `editable` field configuration should produce both `meta.field.read` and `meta.field.update`; editable implies visible.
- Do not use `data.record.create` or `data.record.update` as field visibility or field editability permission.

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

- `editable` means visible and editable.
- `readonly` means visible but not editable.
- `hidden` means not rendered.
- `partialMask`, `fullMask`, missing field, or missing allow denies editing; render only if read visibility is allowed and the display layer supports masking.
- No fieldCondition on a field-permission allow statement means unrestricted fields for that field permission.
- A `*` field can express a default baseline.

Use `fieldCondition` with `meta.field.read/update` for field visibility and editability. Use schema as the structural field source. Do not infer editability from visible fields or from `data.record.*`.

## Data condition

`dataCondition.expression` expresses data range. The frontend must not evaluate it. Record APIs and backend authorization own row-level enforcement.

## Default/all-form permissions

A default full-access permission may use:

```text
resources: ["*"]
permissionKeys: ["*.*.*"]
fieldCondition.fields: [{ fieldKey: "*", access: "editable" }]
```

A default read-only permission must not use `*.*.*`. Use explicit read keys:

```text
resources: ["*"]
permissionKeys: ["data.record.read", "meta.field.read"]
fieldCondition.fields: [{ fieldKey: "*", access: "readonly" }]
```

Do not treat `*`, `make://<tenantId>/*/app/<appKey>`, or app-level resource as platform permission. In App scope, they are valid single-app permission matches.
