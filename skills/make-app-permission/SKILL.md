---
name: make-app-permission
description: "Use when generating, refactoring, reviewing, or debugging Make App single-app permission enforcement: /principal/permission, App-scoped IAM matching, permission-aware Schema, entity/field/operation guards, or permission refresh. Triggered by 单应用权限, 权限范围, creatable, createFields, data.record.*, meta.entity.*, meta.field.*, route guards, or URL bypass. Use make-app-actions for selection and batch actions. Does not own platform-admin permissions, auth, generic Service APIs, UI layout, CanvasTable internals, DSL, deployment, or runtime packaging."
metadata:
  version: 0.2.9
---

# make-app-permission

Use this skill when a request creates, changes, reviews, or debugs Make App single-app permission enforcement. For a new App, add the full permission chain only when the user requests it or the repository has an explicit delivery baseline requiring it. Otherwise preserve the existing permission flow; do not add an IAM proxy, route guards, or permission audits solely because unrelated UI, Service, Schema, or runtime code is changing.

This skill owns permission semantics. Use `make-app-auth` for login/session, `make-app-service` for Service and Schema transport, `makeui` for rendering, `canvas-table-integration` for cell-editor mechanics, and `make-app-runtime` for packaging/runtime.

## Quick start

1. Inspect `apps/docs/api.md`, Service/UI schema adapters and types, principal-permission code, providers, router, object pages, create/edit forms, submit builders, refresh flow, and tests.
2. Read `references/permission-boundaries.md` before selecting scope, permissionKey, schema collection, or field access state.
3. Read `references/service-principal-permission.md` before changing `/principal/permission` or interpreting IAM `fieldAccess`.
4. Read `references/ui-permission-runtime.md` before changing route/action gates, create/read/update field sets, payload filtering, or refresh.
5. Read `references/system-field-contract.md` before implementing ID/audit create or edit capability.
6. Read `references/testing-and-audit.md` before implementation and before reporting completion.
7. Implement tests first, then the Service/schema boundary, permission pure model, route/action gates, field-set consumers, submit allowlists, and refresh invalidation.
8. Run host tests, the behavioral conformance suite, and `node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>`. Wire both permission checks into the host's default test, CI, or publish gate; a one-off local run is not a continuous gate.
9. When publishing or installing this Skill, run `check-installed-skill-sync.mjs` with explicit source and installed directories. Keep this local release check out of portable host CI.

## Required contract

- Expose `/api/make/app/principal/permission`; have Service call `/api/make/iam/v1/principal/permission` with App scope, `MakeService.GetResource`, and the established login context. Do not request tenant-root scope or upstream platform permission filters. Before strict normalization, classify rows with `references/permission-boundaries.md`: ignore only clearly unrelated rows, and fail closed for every selected or unclassifiable row.
- Match exact, wildcard, parent, App, entity, IAM namespace-wildcard App resources, and deny correctly. Use the most-specific allow field range; deny wins.
- Keep create, visibility, and editability as separate field-set decisions:
  - create form: `createFields ∩ meta.field.read fieldAccess(creatable|readonly|editable|partialMask|fullMask|*)`;
  - list/detail/filter: `fields ∩ meta.field.read fieldAccess(readable states)`;
  - edit/cell edit: visible `fields ∩ meta.field.update fieldAccess(editable|*)`.
- Keep entity navigation, table headers, and record data independent: `meta.entity.read` controls whether a Schema-present entity appears in navigation and can enter its object route; both the navigation and the dynamic route must reject the entity when this permission is absent. `meta.field.read` controls the authorized columns/table headers; `data.record.read` controls record/detail requests and rows only. When record read is denied or revoked but entity and fields are authorized, keep the navigation item and table shell with authorized headers, skip every record request, and render an explicit empty row set so cached values cannot remain visible.
- Preserve every access state returned for a field. Current IAM responses may use arrays such as `["creatable", "readonly"]` or scalar strings; normalize a supported scalar string to a one-element array and authorize a permission dimension when any state is allowed for that dimension. Never coerce an array with `String(value)` or template interpolation.
- Treat missing `createFields` as empty. Never fall back to `fields`, and do not consume `editableFields` for current edit behavior.
- Gate the create entry and submit with `data.record.create` only; derive create fields from the matched `meta.field.read` row and `createFields`. `meta.field.create` is not a platform permission point and must not be required, inferred, or emitted. The operation gate never grants field access or bypasses the create-field intersection. Gate update/delete/bulk-update independently with their own operation keys.
- Recompute the latest create/edit allowlist before submit and build payloads from it. Never spread the complete form store into a protected mutation.
- Exclude ID and system audit fields from create capability. Keep existing audit-field edit capability when the field is visible, update-authorized, and supported by the host editor.
- Keep create-only invisible fields available only in create mode. A `creatable` access state is not readable or editable.
- Add App/object/fixed-route guards; hiding menus or buttons is not authorization. Recheck handlers before reads and mutations.
- Refresh permission and permission-trimmed Schema in one access generation before data refresh. Invalidate stale permission, Schema, form, and record work; do not close a still-authorized create surface merely because read is revoked.
- Fail closed on permission or Schema failure. Leave row-level `dataCondition` enforcement to backend APIs.
- Add Service/schema, permission-model, route/page, payload, special-field, refresh, and negative audit tests.

## Reference map

| Task | Read |
| --- | --- |
| Platform vs App scope, create/read/update field surfaces, Schema collections, matching | `references/permission-boundaries.md` |
| Service endpoint, IAM request/response, `meta.field.read.fieldAccess` | `references/service-principal-permission.md` |
| Providers, helpers, routes, create/edit flow, payload, refresh, Lookup | `references/ui-permission-runtime.md` |
| Exact ID/audit create exclusions and edit compatibility | `references/system-field-contract.md` |
| Required tests, audit signals, completion blockers | `references/testing-and-audit.md` |
| Auth/session | Use `make-app-auth` |
| Schema/API transport and cache | Use `make-app-service` |
| Form/empty-state presentation | Use `makeui` |
| Table/cell-editor mechanics | Use `canvas-table-integration` |
| Selection, row precheck, batch actions | Use `make-app-actions` |
| Runtime gateway and packaging | Use `make-app-runtime` |

## Audit

```bash
node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>
```

Treat failures as blockers and warnings as review items. The audit is heuristic and never replaces runtime tests.
It rejects obvious `fieldAccess` state-array coercion through `String(...)`, text helpers, template interpolation, `.toString()`, or `.join()` when the coerced value affects normalization output or permission evaluation, including direct control-flow conditions. Diagnostic-only logging, comments, and string literals inside a named normalization helper must not fail the audit, regardless of whether the parameter uses a generic or `fieldAccess`-specific name. The executable behavior contract remains authoritative.

Also expose a thin host adapter and run the executable behavior contract:

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <host-adapter-module>
```

If the adapter is TypeScript, run the same command through the host's existing TypeScript runner. Do not add a runtime dependency only for this check. The adapter must delegate to the production permission helpers and create-capability guard; it must not reimplement them in the test.
Keep the audit and conformance runner project-local or install them through a versioned dependency before making them a host gate. Do not hardcode another workspace checkout or a developer home-directory Skill path into portable CI.

For local Skill install/release verification, compare the complete source and installed directories:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

The checker reports source-only, installed-only, and content-mismatch files. Pass an explicit install directory; do not embed a developer home path in the Skill or in host CI.
