---
name: make-app-permission
description: "Use when generating, refactoring, reviewing, or debugging Make App single-app permission enforcement: /principal/permission, App-scoped IAM matching, permission-aware Schema, entity/field/operation guards, or permission refresh. Triggered by 单应用权限, 权限范围, 字段可新建、可见、可编辑, creatable, createFields, data.record.*, fieldAccess, meta.entity.*, meta.field.*, route guards, or URL bypass. Use make-app-actions for selection and batch actions. Does not own platform-admin permissions, auth, generic Service APIs, UI layout, CanvasTable internals, DSL, deployment, or runtime packaging."
metadata:
  version: 0.4.5
---

# make-app-permission

Direct URL and runtime resource denial follow `references/scoped-route-feedback.md`: App guard outside shell, object/fixed-route guards inside shell. Replace the entire denied business content, not just table rows; keep authorized navigation and the global identity header. Require rendered-tree and zero-denied-request regression tests. React renders the verified package through `makeui/references/permission-feedback.md`; this Skill decides scope and access lifecycle, not component styling. Read `make-app-auth/references/access-help.md` for current-App personnel contacts without sending denied business requests.

Use this skill when a request creates, changes, reviews, or debugs Make App single-app permission enforcement. It must be enabled by default for every generated or refactored Make App. Do not omit the IAM proxy, route guards, permission-aware Schema, or permission audits merely because the request focuses on UI, Service, Schema, or runtime work.

This skill owns Make App consumption of configured permission results: navigation, routes, fields, actions, submit allowlists, refresh, and the App's Service boundary. Use `make-app-auth` for login/session, `make-app-service` for Service and Schema transport, `makeui` for rendering, `canvas-table-integration` for cell-editor mechanics, and `make-app-runtime` for packaging/runtime.

仅服务于 Make App。权限配置由 Console 负责，配置校验、策略评估和权限聚合由权限后端负责。本 Skill 使用当前 App 已返回的 data/meta 权限及权限过滤后的 Schema，指导应用展示和提交；不实现其他项目的管理能力，不在前端或 App Service 重建权限引擎，也不以后台配置问题扩大接入范围。

## Quick start

1. Inspect `apps/docs/api.md`, Service/UI schema adapters and types, principal-permission code, providers, router, object pages, create/edit forms, submit builders, refresh flow, and tests.
2. Read `references/permission-boundaries.md` before selecting scope, permissionKey, schema collection, or field access state.
3. Read `references/service-principal-permission.md` before changing `/principal/permission` or interpreting IAM `fieldAccess`. Confirm only the response contract needed by this App; questions about Console configuration do not add App features or release prerequisites.
4. Read `references/ui-permission-runtime.md` before changing route/action gates, create/read/update field sets, payload filtering, or refresh.
5. Read `references/system-field-contract.md` before implementing ID/audit create or edit capability.
6. Read `references/testing-and-audit.md` before implementation and before reporting completion.
7. Implement tests first, then the Service/schema boundary, permission pure model, route/action gates, field-set consumers, submit allowlists, and refresh invalidation.
8. Run host tests, the behavioral conformance suite, and `node skills/make-app-permission/scripts/audit-make-app-permission.mjs <project-root>`. For nonstandard roots, helper names or create-call signatures use the [audit configuration](references/testing-and-audit.md#audit); do not force the host to match example names. `REVIEW_REQUIRED` is not PASS: retain the result and verify the identified production branches before a manual review conclusion. Wire permission checks into the host's default test, CI, or publish gate; a one-off local run is not a continuous gate.
9. When publishing or installing this Skill, run `check-installed-skill-sync.mjs` with explicit source and installed directories. When the release changes shared Make response/auth/permission guidance, publish the platform package, run `npx skills update qfeius/make-platform-skills`, then run the repository-wide `check-installed-make-platform-skills-sync.mjs` with explicit source and installed Skill roots. Keep these local release checks out of portable host CI.

## Make App permission contract

Read [permission-boundaries.md](references/permission-boundaries.md#platform-authority-and-response-formats) for the bundled Make App permission dictionary, response shapes and field defaults. Use `scripts/permission-registry.mjs` to check concrete names before changing examples, audit rules or test expectations. Existing generated code and a green fixture suite are not protocol evidence.

本 Skill 随包提供权限点清单、principal 响应、Schema 集合及字段规则，使用者无需访问内部设计文档。实际接口与本地合同不一致或语义未定义时，先提出具体疑问，不自行增加权限点或规则。Console 配置方式、配置合法性与权限后端聚合实现不属于本 Skill。

## Required contract

本节的 `createFields ∩ data.record.create 字段状态` 规则适用于普通新建。对象有有效 `bpmDefinitionKey` 时，先按 [make-app-approval](../make-app-approval/SKILL.md) 选择审批新建分支：UI 和 Service 均以启动配置授权字段为准，不再与普通 IAM 字段集合求交；应用、对象及新建操作权限仍保留。此例外不扩展到普通已有记录编辑，也不把“我的审批”固定导航作为业务对象菜单权限项。详细合同见 [审批新建字段](../make-app-approval/references/initiation-contract.md)。我的审批节点办理另按 [任务详情授权](../make-app-approval/references/task-detail.md) 使用当前任务 fieldPermission/actions，字段定义来自 bpm-node-form-metadata 的 TASK 场景，不从普通 entity/Schema 补字段、不套普通 update 字段或启动节点权限；Workflow 执行最终授权。节点元数据不写回普通 Schema/权限缓存。节点附件预上传重查任务授权，发起人撤回依据最新流程 starter；这些能力不放宽普通 CRUD。

- Expose `/api/make/app/principal/permission`; have Service call `/api/make/iam/v1/principal/permission` with App scope, `MakeService.GetResource`, and the established login context. This is a direct Make proxy: return every completed IAM response unchanged, including 2xx/4xx/5xx status, Content-Type, and body. Do not request tenant-root scope or upstream platform permission filters. Before strict normalization, classify rows with `references/permission-boundaries.md`: ignore only clearly unrelated rows, and fail closed for every selected or unclassifiable row.
- Current-context-based tenant resolution follows `make-app-auth/references/service-fronted-mode.md#current-context-consumption`. Only the actual App-scoped IAM response is the principal-permission result, not auth compatibility claims.
- The IAM wire success is `{code:200,data:{principal,scope,permissions}}`, unlike bare auth identity. Service preserves it; the UI request adapter checks code and unwraps data exactly once before permission normalization. Verify the production UI loader boundary as well as the DTO-only pure model; see `references/testing-and-audit.md`.
- Bind permission results to the current App, entity and operation. Consume the backend's resource/effect/fieldAccess results without adding client-side resource override or policy aggregation rules. Keep the existing UI → App Service → Make API call chain and let Make APIs perform final authorization.
- Keep create, visibility, and editability as separate field-set decisions:
  - create form: permission-filtered Schema `createFields`, `data.record.create` field access containing `creatable|*`, the independent operation gate, and host create capability;
  - list/detail/filter: `fields ∩ meta.field.read fieldAccess(readable states)`;
  - edit/cell edit: visible `fields ∩ editableFields` plus `data.record.update` and its editable field state; batch uses independent `data.record.bulkUpdate` field decisions.
- `meta.field.update` changes Schema structure and cannot grant business data editing. Business write keys must be selected from the documented record operations. Retain the real record keys and valid matching data wildcards. UI controls, submit whitelists, and Service writes must apply the same current field rule and independent record-operation gate.
- Keep entity, field and record authorization independent: `meta.entity.read` controls whether a Schema-present entity appears in navigation and can enter its object route; both the navigation and the dynamic route must reject the entity when this permission is absent. `meta.field.read` controls authorized columns/table headers when business content is rendered; `data.record.read` controls record/detail requests and values. Denied or revoked record read does not remove metadata-authorized navigation or rewrite field grants, but replaces the current record-reading business content as a whole with resource feedback. Unmount its title, toolbar, headers, data and dialogs, skip denied requests, and invalidate cached values and stale work. Do not preserve an empty table shell around the feedback.
- Principal fieldAccess uses arrays of the seven supported access values. Preserve all members; create requires `creatable|*`, edit requires `editable|*`, and metadata visibility has its own allowed members. Do not stringify arrays, take one member, or restore the obsolete state-priority rule. Only readonly/hidden/masked values without the relevant write capability cannot authorize writes. Schema and host capability still bound every field; see the response reference.
- Distinguish all-empty applicable field maps from a nonempty map lacking the requested field and wildcard. Never default a missing map property to `{}` or add editable access for an unlisted field. See `references/permission-boundaries.md` for matching, coexisting results and the principal-only empty-map default.
- Treat missing `createFields` as empty. Never fall back to `fields`, and preserve `editableFields` for ordinary update; do not use it to gate independent bulkUpdate.
- Gate ordinary create entry and submit with `data.record.create`; resolve its fields from permission-aware `createFields` and create-eligible state, not metadata operations. Approval create uses authorized 启动配置 fields from `make-app-approval`. `meta.field.create` exists but creates Schema fields, not business values. Keep update/delete/bulkUpdate operation keys independent.
- Recompute the latest create/edit allowlist before submit and build payloads from it. Never spread the complete form store into a protected mutation.
- Exclude ID and system audit fields from create capability. Keep existing audit-field edit capability when the field is visible, update-authorized, and supported by the host editor.
- Keep create-only invisible fields available only in create mode. `creatable` alone does not grant read or edit; evaluate any coexisting members independently.
- Add App/object/fixed-route guards; hiding menus or buttons is not authorization. Recheck handlers before reads and mutations.
- Refresh permission and permission-trimmed Schema in one access generation before data refresh. Invalidate stale permission, Schema, form, and record work. Record-read denial does not revoke an independent create route's permission; descendants of the replaced business content still unmount. Operation-only refusal preserves allowed inputs.
- Fail closed on permission or Schema failure. Leave row-level `dataCondition` enforcement to backend APIs.
- Permission and Schema request failures must retain the safe structured `kind/status/title/description/traceId` from the shared request adapter through Provider state to the error outlet. Use `make-app-observability` for request-error classification and card presentation; do not reduce these failures to a plain string or expose raw upstream errors. A denied permission result is still a forbidden state, not a fabricated request failure.
- Add Service/schema, permission-model, route/page, payload, special-field, refresh, and negative audit tests.

## Reference map

| Task | Read |
| --- | --- |
| Platform vs App scope, create/read/update field surfaces, Schema collections, matching | `references/permission-boundaries.md` |
| Service endpoint, IAM request/response and field-state consumption | `references/service-principal-permission.md` |
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

Treat failures as blockers and warnings as review items. Exit codes are 0 for PASS, 1 for failure and 2 for REVIEW_REQUIRED or invalid usage; distinguish the latter by the diagnostic. Do not mask nonzero exits or describe REVIEW_REQUIRED as an automated pass. The audit is heuristic and never replaces runtime tests.
It rejects obvious `fieldAccess` state-array coercion through `String(...)`, text helpers, template interpolation, `.toString()`, or `.join()` when the coerced value affects normalization output or permission evaluation, including direct control-flow conditions. Diagnostic-only logging, comments, and string literals inside a named normalization helper must not fail the audit, regardless of whether the parameter uses a generic or `fieldAccess`-specific name. The executable behavior contract remains authoritative.

Also expose a thin host adapter and run the executable behavior contract:

```bash
node skills/make-app-permission/scripts/permission-conformance-suite.mjs <host-adapter-module>
```

Also verify UI submit and Service rejection through production boundaries:

```bash
node skills/make-app-permission/scripts/write-permission-conformance-suite.mjs <host-write-adapter-module>
```

Use the write harness contract in `references/testing-and-audit.md`; a passing pure model cannot replace this check.

Also run the wire-response contract against a thin adapter to the production UI permission loader:

```bash
node skills/make-app-permission/scripts/principal-response-conformance-suite.mjs <host-loader-adapter-module>
```

This protects business-code validation, one-time unwrap, empty IAM grants and retained denial contacts; the existing pure-model suite does not exercise SDK response decoding. The adapter contract and host-gate instructions are in `references/testing-and-audit.md`.

If the adapter is TypeScript, run the same command through the host's existing TypeScript runner. Do not add a runtime dependency only for this check. The adapter must delegate to the production permission helpers and create-capability guard; it must not reimplement them in the test.
Keep the audit and conformance runner project-local or install them through a versioned dependency before making them a host gate. Do not hardcode another workspace checkout or a developer home-directory Skill path into portable CI.

For local Skill install/release verification, compare the complete source and installed directories:

```bash
node skills/make-app-permission/scripts/check-installed-skill-sync.mjs \
  skills/make-app-permission <installed-skill-dir>
```

The checker reports source-only, installed-only, and content-mismatch files. Pass an explicit install directory; do not embed a developer home path in the Skill or in host CI.

For a release that changes the shared Service/auth/permission contract, update the
installed platform package first, then verify all affected Make App Skills:

```bash
npx skills update qfeius/make-platform-skills
node scripts/check-installed-make-platform-skills-sync.mjs \
  skills <installed-skills-dir>
```

Run this only after the source revision has been published through the platform
Skill release flow. It is a local release verification, not portable host CI.
