---
name: make-app-permission
description: "Use when generating, refactoring, reviewing, or debugging Make App single-app permission management and frontend permission enforcement. Triggered by 权限, 单应用权限, app 权限, /principal/permission, /api/make/app/principal/permission, 按钮权限, 菜单权限, 路由权限, 字段可见, 字段可编辑, read/create/update/delete, data.record.*, meta.field.*, route guard, refresh permission, or preventing URL permission bypass. Covers the default required permission chain for Make projects: Service proxy to Make IAM, app-scope permission payloads, schema-vs-permission separation, route/menu guards, operation buttons, field visibility/editability, cell edit, form field filtering, refresh reload, tests, and audit. Does not own platform-admin permissions, auth mechanics, generic Service APIs, UI layout, CanvasTable internals, DSL modeling, Make CLI deploy, or runtime packaging."
metadata:
  version: 0.1.2
---

# make-app-permission

Use this skill for Make App single-app permission enforcement. For generated or refactored Make projects, treat this as a default required capability unless the user explicitly says to skip permissions.

This skill owns the permission contract. Use `make-app-auth` for login/session, `make-app-service` for general Service layering, `makeui` for layout, `canvas-table-integration` for table editor mechanics, and `make-app-runtime` for packaging/runtime.

## Quick Start

1. Inspect `apps/docs/api.md`, `apps/service/src`, `apps/ui/src`, auth adapter, schema API, record API, router, shell, table pages, form pages, and related tests.
2. Read `references/permission-boundaries.md` before deciding permission scope, resource, or permissionKey.
3. Read `references/service-principal-permission.md` before adding or reviewing `/principal/permission` Service code.
4. Read `references/ui-permission-runtime.md` before adding or reviewing frontend permission state, route guards, buttons, field editability, or refresh behavior.
5. Read `references/console-permission-config-model.md` when the task touches make-console permission configuration, policy rules, fieldCondition, dataCondition, or operation permission keys.
6. Read `references/testing-and-audit.md` before reporting completion.
7. Add or verify Service permission proxy first, then frontend permission provider/model, then route guards, then page-level read/create/update/delete and field-edit gates.
8. Run the host project tests that cover changed Service/UI behavior and run this skill's audit script when a project tree is available.

## Required Contract

- Make projects must include single-app permission enforcement by default. Do not defer it as a follow-up unless the user explicitly opts out.
- Use `/api/make/app/principal/permission` as the published browser-facing Service endpoint for Service-fronted Apps. Legacy `/api/principal/permission` may exist only as compatibility.
- Have Service call Make IAM through make-gateway at `/api/make/iam/v1/principal/permission` with `X-Make-Target: MakeService.GetResource`.
- Send app scope by default: `make://<tenantId>/meta/app/<appKey>`. Do not default to tenant root scope and do not add a platform permission filter.
- Match IAM permission resources in both legacy App scope form `make://<tenantId>/meta/app/<appKey>` and current wildcard namespace form `make://<tenantId>/*/app/<appKey>`, including entity suffixes.
- Preserve the browser login context from UI to Service to make-gateway. Do not drop Cookie or trusted forwarded host/proto context.
- Use schema for authorized menus, objects, and structural field definitions after backend permission trimming. Field visibility is `meta.field.read`; field editability is `meta.field.update`.
- Add App/router guards. Hiding menus is not enough: direct URL access must not enter unauthorized Apps, objects, or fixed business routes.
- Gate list/detail data reads with `data.record.read`.
- Gate create/update/delete buttons with `data.record.create`, `data.record.update`, and `data.record.delete`.
- Do not use editable field count to decide create/edit button visibility. If `data.record.create` or `data.record.update` is allowed, show the matching entry even when every visible field is readonly.
- Gate field rendering with `meta.field.read`: invisible fields are not rendered in list, detail, filter, create form, edit form, or cell editor candidates.
- Gate field editing with `meta.field.update`: visible but non-editable fields render readonly/disabled in forms, have no cell editor, skip required validation, and are excluded from submit payloads.
- Filter form and custom-page payloads before submit so unauthorized fields are not sent.
- Refresh permissions before refreshing data or retrying page data. Close open workspaces when refreshed permissions revoke access.
- Fail closed when permission loading fails: no protected data request, no operation buttons, and visible forbidden/error state.
- Let backend handle row-level data conditions. Do not implement `dataCondition` filtering in frontend.
- Add tests for Service proxy, permission model, route bypass prevention, page gates, refresh behavior, and field payload filtering.

## Reference Map

| Task | Read |
| --- | --- |
| Platform vs single-app permission boundaries | `references/permission-boundaries.md` |
| Service endpoint, Make IAM payload, gateway path, headers, tenant resolution | `references/service-principal-permission.md` |
| Frontend provider/model, route guard, object pages, dictionaries/custom pages, refresh strategy | `references/ui-permission-runtime.md` |
| make-console role/group/policy/form permission configuration model | `references/console-permission-config-model.md` |
| Required tests and static audit | `references/testing-and-audit.md` |
| Login/session/auth.api behavior | Use `make-app-auth` |
| Generic Service API layering and docs | Use `make-app-service` |
| UI shell and visual layout | Use `makeui` |
| CanvasTable cell editor mechanics | Use `canvas-table-integration` |
| Runtime gateway origin, build, publish readiness | Use `make-app-runtime` |

## Audit

Run the audit when reviewing a project tree:

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

The audit is a contract check, not a replacement for tests. Treat failures as blockers and warnings as review items.
