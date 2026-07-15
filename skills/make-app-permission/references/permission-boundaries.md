# Permission Boundaries

Use this reference before choosing scope, resource, permissionKey, or frontend data source.

## Required distinction

Separate these permission systems:

| Type | Used by | Scope | Permission keys |
| --- | --- | --- | --- |
| Platform/admin permission | make-console management pages | `make://<tenantId>` | `make.platform.*`, `meta.app.*` |
| Single-app permission | Generated Make App frontend/runtime | `make://<tenantId>/meta/app/<appKey>` | `data.record.*`, `meta.field.*`, `*.*.*` |

Do not use platform/admin permission results to control business App buttons, routes, fields, or records.

## Platform/admin permission

Platform/admin permission controls make-console menus such as organization management, admin groups, permission query, and App management.

Typical keys:

```text
make.platform.org
make.platform.admin
make.platform.permission
make.platform.app
meta.app.read
meta.app.create
meta.app.delete
```

Typical resources:

```text
make://<tenantId>
make://<tenantId>/meta/app
```

Platform permission queries may use a fixed `permissionKey in [...]` filter for those keys. This pattern must not be copied into single-app frontend permission loading.

## Single-app permission

Single-app permission controls business objects, record operations, route access, and field editability inside one App.

App scope:

```text
make://<tenantId>/meta/app/<appKey>
```

Common resources:

```text
make://<tenantId>/meta/app/<appKey>
make://<tenantId>/meta/app/<appKey>/entity/<entityKey>
make://<tenantId>/meta/app/<appKey>/entity/*
make://<tenantId>/*/app/<appKey>
make://<tenantId>/*/app/<appKey>/entity/<entityKey>
make://<tenantId>/*/app/<appKey>/entity/*
*
```

The `*` segment in `make://<tenantId>/*/app/<appKey>` is an IAM namespace wildcard for the current App resource shape. Treat it as equivalent to the current App scope resource before matching entity suffixes. Do not treat it as tenant-wide platform permission.

Common operation keys:

```text
data.record.read
data.record.create
data.record.update
data.record.bulkUpdate
data.record.delete
data.record.*
*.*.*
```

Use `data.record.bulkUpdate` only when the page offers a real batch-edit workflow. Normal edit and cell edit use `data.record.update`.

Field permission keys:

```text
meta.field.read
meta.field.update
meta.field.*
```

Use field permissions separately from record operations:

- `data.record.*` controls record operation entries and handlers: read, create, edit/update, batch update, and delete.
- `meta.field.read` controls field visibility. A field without read permission is not rendered in lists, details, filters, create forms, edit forms, or cell editor candidates.
- `meta.field.update` controls field editability. A visible field without update permission is displayed readonly/disabled in forms, does not get a cell editor, skips required validation, and is excluded from submit payloads.
- Do not hide create/edit buttons because no field is editable. Button visibility is controlled only by the matching `data.record.*` operation.

## Schema vs permission

Use schema and principal permission together:

- `/api/make/app/schema` returns authorized objects and structural field definitions after backend permission trimming. Use it for menu/object candidates and as the upper bound of fields the UI may render.
- `/api/make/app/principal/permission` returns operation permission and field permission outcomes. Use it for `data.record.*` buttons/routes/handlers and `meta.field.*` visibility/editability checks.
- Row-level conditions are backend-owned. Do not implement frontend `dataCondition` filtering.

Field rules:

- Visible does not mean editable.
- Invisible means not rendered.
- Visible but not editable means rendered readonly/disabled and excluded from validation and submit payloads.
- Never treat a field as editable merely because `data.record.create` or `data.record.update` is allowed.

## Direct URL protection

Do not rely on menu hiding. A generated App must prevent URL bypass:

- If schema returns no authorized object and no authorized fixed page exists, render App forbidden instead of mounting business routes.
- For `/objects/:entityKey`, verify `entityKey` exists in schema before mounting the object page or loading records.
- For fixed routes, bind each route to an entityKey, permissionKey, or route-specific permission checker.
- For default redirects, redirect only to the first authorized object/page. If none exists, render App forbidden.

## Common mistakes

- Using `make://<tenantId>` scope for business App frontend permission.
- Adding a platform permission filter when loading App permissions.
- Treating schema visible fields as editable fields.
- Treating `data.record.update` or `data.record.create` as field edit permission.
- Hiding create/edit entries because no field is editable.
- Hiding buttons but still allowing action handlers or direct URL access.
- Loading lists/details before `data.record.read` is confirmed.
- Refreshing data before refreshing permissions.
