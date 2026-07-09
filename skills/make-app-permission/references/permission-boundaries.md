# Permission Boundaries

Use this reference before choosing scope, resource, permissionKey, or frontend data source.

## Required distinction

Separate these permission systems:

| Type | Used by | Scope | Permission keys |
| --- | --- | --- | --- |
| Platform/admin permission | make-console management pages | `make://<tenantId>` | `make.platform.*`, `meta.app.*` |
| Single-app permission | Generated Make App frontend/runtime | `make://<tenantId>/meta/app/<appKey>` | `data.record.*`, `*.*.*` |

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

## Schema vs permission

Use schema and principal permission together:

- `/api/make/app/schema` returns authorized objects and visible fields. Use it for menu/object visibility and visible field lists.
- `/api/make/app/principal/permission` returns operation permission and field editability. Use it for read/create/update/delete, cell edit, form editability, route guards, and refresh rechecks.
- Row-level conditions are backend-owned. Do not implement frontend `dataCondition` filtering.

Visible does not mean editable. A field returned by schema can still be readonly for create or update until `/principal/permission` says it is editable.

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
- Hiding buttons but still allowing action handlers or direct URL access.
- Loading lists/details before `data.record.read` is confirmed.
- Refreshing data before refreshing permissions.
