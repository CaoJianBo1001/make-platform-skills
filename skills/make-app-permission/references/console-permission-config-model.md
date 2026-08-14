# Console permission config model

Use this reference for make-console App permission configuration and for interpreting the policy expanded by IAM.

## Contents

- Ownership and policy shape
- Operations
- Independent field access
- Wildcards and exceptions
- System fields
- Data condition and runtime handoff

## Ownership and policy shape

make-console owns permission groups and policy editing unless the user explicitly requests in-App management UI. Business Apps consume `/principal/permission` and do not copy role/group management.

Policy statements contain `effect`, `permissionKeys`, entity/App resources, optional `dataCondition`, and `fieldCondition.fields`.

Representative independent fields:

```yaml
permissionKeys:
  - data.record.create
  - meta.field.read
  - meta.field.update
fieldCondition:
  fields:
    - fieldKey: create_only_field
      access: creatable
    - fieldKey: visible_field
      access: readonly
    - fieldKey: editable_field
      access: editable
```

## Operations

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Keep normal edit, delete, and batch update independent. `data.record.create` controls create entry/submit and also carries create-field access in the expanded principal permission response.

## Independent field access

Field access values include:

```text
hidden
readonly
editable
creatable
partialMask
fullMask
*
```

Console semantics:

- `creatable`: field is creatable only; it does not become readable/editable.
- `readonly`: visible only.
- `editable`: grants the `meta.field.update` edit dimension and is not creatable. Selecting 可编辑 does not automatically select or grant the visibility dimension.
- `*`: full field access in the permission dimensions generated for the statement.
- `hidden`: no field grant.
- masks: read/display semantics only.

可新建、可见、可编辑 are independent selections. Serializers must preserve multiple entries for the same field when needed.

Interpret an access value inside its expanded `permissionKey` row. On a `meta.field.read` row, `access: editable` is a readable state. This does not mean an editable selection may synthesize a read grant. A field present only in `meta.field.update` remains invisible and is therefore absent from list/detail/edit UI.

Only `creatable` / 仅可新建 must serialize with both `data.record.create` and `meta.field.read`; the latter is required for Schema metadata delivery, not runtime visibility.

For an allow statement, any `access: creatable` or `access: "*"` requires `data.record.create` in `permissionKeys`. A creatable-only selection correctly produces at least `data.record.create + meta.entity.read + meta.field.read`; runtime still interprets `creatable` as non-readable on the `meta.field.read` row. Do not derive create permission for deny statements, and do not reverse-generate creatable fields from a standalone record-create operation.

`access: editable` and `access: "*"` are different current formats. Never rewrite editable to wildcard during unrelated saves.

## Wildcards and exceptions

“全部字段权限” for a selected entity uses:

```yaml
fieldCondition:
  fields:
    - fieldKey: "*"
      access: "*"
```

This preserves future-field inheritance, subject to backend `createFields`/`fields` upper bounds and final write authorization.

A wildcard baseline plus named exceptions must round-trip without expansion:

```yaml
fields:
  - fieldKey: "*"
    access: "*"
  - fieldKey: secret
    access: hidden
```

These entries belong to the same allow statement/field range. Do not split `secret: hidden` into an `effect: deny` statement: runtime operation guards treat a matching deny as an operation denial, not merely a field exception.

If the visual editor cannot represent wildcard + named exceptions losslessly, keep the statement YAML-only. Do not materialize only the currently known fields, because future fields would lose inheritance.

An empty `fieldAccess` in expanded most-specific allow output means unrestricted for that permissionKey. Do not confuse it with missing `createFields`, which is an empty Schema upper bound.

## System fields

- Use `system-field-contract.md` as the exact source for ID types and system audit keys. Do not use fuzzy key matching.
- 可编辑 candidates keep the existing rule: exclude ID only. Audit fields retain existing edit capability unless the product/backend contract explicitly changes it.
- “全部字段权限” does not authorize creating fields omitted from backend `createFields`; server-side Schema/write enforcement remains mandatory.

Add regression tests for “audit not creatable but still editable”.

## Data condition and runtime handoff

`dataCondition.expression` is backend-owned row-level authorization. UI does not evaluate it.

The runtime consumes:

- IAM `data.record.create.fieldAccess` for create fields;
- IAM `meta.field.read.fieldAccess` and Schema `fields` for visibility;
- IAM `meta.field.update.fieldAccess` after visibility for editability;
- Schema `createFields` as the create upper bound;
- no current behavior from `editableFields`.
