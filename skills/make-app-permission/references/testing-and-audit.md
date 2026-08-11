# Testing and Audit

Use this reference before reporting Make App permission work complete.

## Required Service tests

Cover the Service permission proxy:

- `GET /api/make/app/principal/permission` returns a stable Service envelope.
- Service calls Make IAM at `/api/make/iam/v1/principal/permission`.
- `X-Make-Target: MakeService.GetResource` is sent.
- Default body is `{ scope: "make://<tenantId>/meta/app/<appKey>" }`.
- Default body has no platform permission filter.
- Explicit permissionKeys produce a safe `permissionKey in [...]` filter only when requested.
- Cookie or established request auth context is forwarded.
- `X-Forwarded-Host` is derived from inbound Host, not blindly trusted from client input.
- `X-Forwarded-Proto` is added according to runtime rules.
- Tenant ID resolves from env, request header, or auth current-context fallback.
- IAM HTTP and business-code failures map to non-secret Service errors.
- Local preview and published gateway scopes do not mix.

## Required UI model tests

Cover permission matching:

- exact entity resource allow
- app-level resource allow
- IAM namespace-wildcard App resource allow, such as `make://<tenantId>/*/app/<appKey>`
- IAM namespace-wildcard entity resource allow, such as `make://<tenantId>/*/app/<appKey>/entity/<entityKey>`
- `*` resource allow
- entity wildcard resource allow
- parent resource fallback
- deny wins over allow
- exact permissionKey
- `data.record.*`
- `meta.field.*`
- `*.*.*`
- three-part wildcard
- `data.record.create/update` allows operation entries but does not grant field visibility or editability
- `meta.field.read` allows field visibility
- missing `meta.field.read` hides the field
- `meta.field.update` allows field editability
- visible field without `meta.field.update` is readonly/disabled
- field-permission allow without fieldCondition means unrestricted fields for that field permission
- explicit `editable` allows editing and implies visibility
- `readonly`, `hidden`, `partialMask`, `fullMask`, and missing fields deny editing
- field wildcard `*` baseline

## Required route/page tests

Cover route bypass prevention:

- No authorized App entry renders App forbidden and does not mount business pages.
- Direct `/objects/:entityKey` for an entity missing from schema renders forbidden/not-found and does not load data.
- Fixed business route without bound permission is not reachable in generated code.
- Default route redirects only to an authorized object/page.

Cover object behavior:

- No `data.record.read` means no list load and no detail load.
- No create means no create entry and create handler refuses submit.
- No update means no edit entry and cell edit refuses commit.
- No delete means no delete entry and delete handler refuses action.
- Create entry is visible with `data.record.create` even when no field is editable.
- Edit entry is visible with `data.record.update` or matching wildcard even when no field is editable.
- Batch edit remains independent from single edit and may be hidden when no batch-editable field remains; use `make-app-actions` for that action rule.
- Fields without `meta.field.read` do not render.
- Visible fields without `meta.field.update` render readonly/disabled, skip required validation, and do not submit.
- Edit form and cell edit use `meta.field.update` editable fields.
- Submit payload filters unauthorized fields.
- Permission API failure fails closed.

Cover refresh behavior:

- Refresh calls `refreshPermissions()` before data refresh.
- Refresh uses returned access, not stale state.
- Read revoke closes detail/forms and stops data load.
- Create/update revoke closes matching forms.
- Field edit revoke blocks subsequent submit/cell edit.

## Audit script

Run:

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

Use `--help` for options.

The audit checks static contract signals only. It can find missing providers, route guards, Service proxy paths, wrong IAM path, missing operation constants, direct create/single-edit coupling to editable-field counts, missing field-edit checks, and missing refresh calls. Batch-edit field availability is a valid `make-app-actions` rule and must not be reported as single-edit coupling. The audit cannot prove full runtime correctness.

Treat audit failures as blockers. Treat warnings as review items that require either code changes or explicit reasoning in the final response.

## Completion rule

Do not report permission work complete until:

- Service tests pass or the user accepts why they cannot run.
- UI model and page behavior tests pass or the user accepts why they cannot run.
- Audit passes, or every warning/failure is explained and intentionally out of scope.
- The final answer states what was verified.
