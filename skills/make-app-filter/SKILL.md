---
name: make-app-filter
description: "Use when integrating, generating, refactoring, or reviewing Make App record-list filtering with @qfei-design/make-app-filter, CanvasTable header linkage, permission-aware Entity Preset save/load/echo, and Service filter.expression payloads. Triggered by 筛选, 高级筛选, 条件筛选, 表格/表头/列头/按字段筛选, 筛选保存/回显, CEL/DNF expressions, system variables, empty filters, field-type operators, DateRange/File/Lookup support, candidate values, URL echo, and tests. Uses make-app-permission for list-access policy. Does not own page shell/layout, CanvasTable rendering internals, Service route implementation, sorting, grouping, auth, runtime packaging, DSL modeling, Make CLI execution, or table cell editing."
metadata:
  version: 0.1.5
---

# make-app-filter

Use this skill for Make App filtering. Any Make project that uses filtering, advanced filters, condition builders, table filtering, or CanvasTable header "按该字段筛选" must deliver one integrated feature:

- package-backed toolbar advanced filter using `@qfei-design/make-app-filter`
- host-owned CanvasTable header filter UI/menu
- linkage from header "按该字段筛选" to the same package controller and toolbar panel
- Entity Preset advanced-filter save, load, hydration, and clear behavior
- Service `filter.expression` payload integration

Do not implement only advanced filter or only header filter in Make record-list pages. They must be done together or not done.

This skill owns the consumer-side package integration contract, advanced-filter behavior, field support, Entity Preset filter persistence, Service filter payload shape, host-owned header-linkage semantics, URL/deep-link filter echo, and filter-specific tests. It consumes list-access state from `make-app-permission`; it does not define permission policy. It does not own sorting (`make-app-sort`), grouping (`make-app-group`), page shell/layout (`makeui`), CanvasTable rendering internals or header menu API details (`canvas-table-integration`), Service route implementation (`make-app-service`), auth (`make-app-auth`), runtime packaging (`make-app-runtime`), DSL modeling (`makedsl`), or Make CLI execution (`makecli`).

## Quick start

1. Treat any Make record-list request containing "筛选", "高级筛选", "条件筛选", "表格筛选", "表头筛选", "列头筛选", or "按字段筛选" as the same integrated filtering requirement. Implement both the package-backed toolbar advanced filter and the host-owned CanvasTable header filter linkage.
2. Locate the host UI package, usually `apps/ui/package.json`. If no UI package exists, stop and report the missing host package.
3. Ensure `@qfei-design/make-app-filter@^1.0.0` is installed. If missing or older, install/upgrade with the host package manager.
4. Read package docs before designing code. Prefer installed package docs; if the host is working in the package repo, read source docs.
5. Import `@qfei-design/make-app-filter/styles.css` once in the host UI entry.
6. Use package APIs for filter core, panel, controller, adapter, validation, and CEL compile/parse. Do not copy or hand-write these capabilities in the host.
7. Keep host responsibilities outside the package: toolbar trigger, Popover/Drawer/Modal container, scroll sizing, applied state, candidate APIs, Service request adapter, and CanvasTable header filter UI/menu.
8. Wire header "按该字段筛选" to the same package controller/panel; do not create separate header-only state or a local filter implementation.
9. Align with the backend Record list filter contract: Service sends `filter: { expression }`, blank expressions mean no filter, and field support must match runtime metadata plus package public APIs. Submit `compileListFilter` output unchanged; never rewrite CEL/DNF in the host.
10. For entity object lists, establish the permission-aware `{ enabled, entityKey, generation }` context from `make-app-permission`. Only while enabled, load the current Entity Preset before the first records query, hydrate the saved filter through package public APIs, and keep toolbar search session-only.
11. On filter confirm, PATCH only the Preset `filter` dimension. After success, update applied state synchronously; let the records query react to applied state instead of reloading inside the persistence callback. Preserve the old applied filter and current draft on failure.
12. Preserve the required fixed three-region advanced-filter layout: top fixed header, scrollable condition body, and bottom fixed footer. Header/footer controls must remain visible while condition rows scroll.
13. Before finishing, verify tests or deterministic checks for package source usage, fixed panel layout, empty filter omission, search merge, Preset save/load/clear, draft confirm/discard, candidate sources, header linkage, package/backend field-support drift, and Service payload shape.

## Package pre-flight

If `@qfei-design/make-app-filter` is missing:

- `pnpm-lock.yaml` -> `pnpm add @qfei-design/make-app-filter@^1.0.0`
- `yarn.lock` -> `yarn add @qfei-design/make-app-filter@^1.0.0`
- `package-lock.json` -> `npm install @qfei-design/make-app-filter@^1.0.0`
- no lockfile -> default to `npm install @qfei-design/make-app-filter@^1.0.0`

Migrate any retired pre-1.0 package dependency to
`@qfei-design/make-app-filter@^1.0.0` and update public imports together. If an
unrelated advanced-filter package is already used, stop and ask before replacing
it. Do not fall back to a pre-1.0 release.

Required read procedure for installed `1.0.0+` packages:

1. `node_modules/@qfei-design/make-app-filter/package.ai.json`
2. Parse `package.ai.json.readOrder` and resolve every entry relative to `node_modules/@qfei-design/make-app-filter`.
3. Verify each referenced file exists in the installed package before relying on it.
4. Read the remaining entries in the declared order, skipping the already-read `package.ai.json` entry.

`package.ai.json.readOrder` is the source of truth. Do not hardcode `docs/`, `examples/`, or other package-internal documentation paths. When working directly in the package repo, resolve the same entries from the repository root. If the installed package is older than `1.0.0`, upgrade first instead of relying on older package docs or inferred internals.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Package install, imports, host/package boundary | `references/package-integration.md` |
| Filter IR, controller draft/confirm semantics, search merge, URL echo | `references/filter-model.md` |
| Runtime field capability, operator/value-editor APIs, and candidate values | `references/operator-matrix.md` |
| Host Popover/container, trigger, panel sizing, validation visuals | `references/ui-style.md` |
| CanvasTable header more menu and advanced filter linkage | `references/header-table-linkage.md` |
| Service filter contract and CEL expression payload | `references/service-translation.md` |
| Entity Preset filter load, hydration, save barrier, clear, stale requests | `references/preset-integration.md` |
| Tests, smoke checks, common regressions | `references/testing-and-pitfalls.md` |
| Backend Record filter contract, CEL subset, DateRange/File/Lookup/system variables | Use `makedsl`; read its EntityDataFilterUsage reference |
| Group path expression composition and record-groups `groupFilter` | Use `make-app-group`; reuse this Skill's DNF expression rules |
| Toolbar placement and surrounding page layout | Use `makeui` |
| CanvasTable `suffixRender` mechanics | Use `canvas-table-integration` |
| Service route implementation and adapter tests | Use `make-app-service` |

## Hard rules

- Do not create new Make advanced-filter implementations in host apps. No hand-written Filter IR helpers, operator matrix, validator, CEL compiler/parser, or advanced filter panel when the package provides it.
- Do not deliver filtering partially in Make record-list pages. If filtering is in scope, implement package-backed toolbar advanced filter, CanvasTable header filter UI, header-to-panel linkage, and Service expression payload together.
- New integrations must import package APIs from `@qfei-design/make-app-filter`, `@qfei-design/make-app-filter/react`, and optional `@qfei-design/make-app-filter/adapters/antd`.
- New integrations must import `@qfei-design/make-app-filter/styles.css` once. Host CSS may style the outer overlay/container, but must not fork package internals unless fixing a host-specific containment issue.
- New filter output uses `filter: { expression: string }`. If `compileListFilter` returns `undefined`, omit `filter`.
- `compileListFilter` is the only host-facing search/advanced-filter compiler. Send its result unchanged; do not parse, redistribute, or rewrite CEL/DNF in host code.
- The backend Record list handler reads only `filter.expression` from the `Expression` object and treats missing, `null`, or blank expressions as no filter.
- Do not send `filter: []`, `filter: {}`, `{ expression: "" }`, blank raw filter strings, or old object-array DSL.
- Do not filter Make record lists locally. List filtering goes through Service/backend filter APIs.
- Filter fields come from normalized runtime object/field metadata. Do not read `apps/dsl/**`, copied YAML, row samples, or hardcoded demo data as runtime filter metadata.
- A host field-type registry may help normalize shared runtime metadata, but it must not decide filter operators or value editors. Pass fields to the package and use its capability APIs as the filter source of truth.
- For Lookup filtering, resolve `relationKey`, the opposite Entity, and `targetFieldKey` from the complete runtime schema before passing field metadata to the package. Keep the source Lookup field key in Filter IR and CEL expressions; target field metadata only controls operators, values, and validation.
- User and department filter values are identities, not display names. Candidate sources come from the host contract owned by `makeui`/`make-app-service`; do not define transport routes in this Skill.
- Do not source user/department options from field schema `options`, current table rows, local arrays, or display labels. Current applied values may be merged only to keep labels visible while remote candidates load.
- Backend Record filters support DateRange, File, and Lookup semantics, but the UI may expose a field only when `@qfei-design/make-app-filter` public APIs support that field/operator combination. If backend docs and package capabilities differ, stop to upgrade/fix the package or report the mismatch; do not hand-write CEL or guess package internals.
- On every entity or permission-enabled context change, increment a monotonic request generation and reset the host panel state. Comparing only `entityKey` when a save settles is unsafe because an old `A -> B -> A` result or a result from before access revocation can look current.
- Use a committed-context reset such as a keyed wrapper plus layout-effect cleanup. Do not mutate request-generation, saving, or context refs during React render.
- If saved CEL is unsupported by the current package, keep its raw expression active in backend requests, keep the trigger visibly active, and show a compatibility warning until an explicit replacement or clear saves successfully.
- Unsupported package fields must be hidden from field selectors and header "按该字段筛选"; do not call `openWithField` for unknown fields, invalid field keys, or package-unsupported field/operator combinations.
- Header menu filtering is a host integration. It appends a draft condition through the package controller and opens the same toolbar filter panel. It must not submit immediately, reload records, or create a separate header-only state.
- Table scrolling, object switching, outside click, or unmount must close any header menu and restore the header suffix icon to hover-only state.
- Advanced filter panel layout is mandatory: every Make advanced filter must use the fixed three-region baseline with a fixed header, scrollable body, and fixed footer. A panel where add/confirm/clear actions scroll away with conditions is a readiness blocker and must not be reported as ready, complete, or delivered.
- Entity object-list filtering persists only the advanced-filter expression in the current user's Entity Preset. Load and hydrate Preset filter before the first records query.
- Preset writes are sparse. Saving filter sends only `{ filter }`, never a possibly stale `sort` or `group`.
- Save before apply. Preset save failure keeps the previous applied filter, open panel, and current draft; it must not reload records.
- Clear advanced filter with `filter: null`. Toolbar keyword search remains session-only and must not be persisted.
- When list access is disabled, block new schema/Preset GET, Preset PATCH, and records requests; invalidate in-flight results and close filter surfaces. Ignore stale Preset load/save responses after either `entityKey` or permission-enabled state changes.

## Default behavior

- Filtering is optional product capability. Generate it only when requested or already established by the project.
- Once filtering is in scope, default to the complete package-backed filtering baseline: toolbar `筛选` trigger, bottom-left popover, host-owned container, package `AdvancedFilterPanel`, package draft controller, fixed header/body/footer layout, `确认`, `清空所有`, active label `已筛选 N 个条件`, field-type controls, CanvasTable header menu `按该字段筛选`, header `openWithField(fieldKey)` linkage, and Service `filter.expression` payload.
- The advanced filter panel must keep its three regions explicit: header top fixed with left `筛选` and right `清空所有`, body middle containing only condition rows/groups and using the only vertical scroll, footer bottom fixed with left `+ 添加条件` and `+ 添加条件组` and right `确认`.
- The host keeps search text separate from advanced filter state. Compile both through `compileListFilter({ fields, searchText, advancedFilter })`.
- Clicking outside the popover or trigger-closing discards unconfirmed draft changes by calling the package controller reset flow.
- `清空所有` clears the draft and affects applied filters only after `确认`.
- Object/entity or permission-enabled context changes clear transient filter/search/panel/header state and invalidate old requests. Reload the Entity Preset only when access is enabled, then reset table object-level transient state.

## Collaboration rules

- With `makeui`: use `makeui` for toolbar placement, page shell, surrounding layout, and the canonical user/department candidate-source UI contract; this skill owns filter behavior and package integration.
- With `canvas-table-integration`: use that skill for CanvasTable `suffixRender` and header menu mechanics; this skill owns how the host "按该字段筛选" action talks to the package-backed advanced-filter controller.
- With `make-app-service`: this skill defines filter query and Preset filter semantics; Service route validation, adapter logging, and Make request details stay in service.
- With `make-app-sort`: filter and sort share one parent-owned Entity Preset coordinator and load lifecycle but update their dimensions independently. This skill does not define sorting UI or sort validation.
- With `make-app-group`: filter and group share expression syntax and Preset lifecycle but update dimensions independently. This skill owns global `filter.expression`; `make-app-group` owns transient path `groupFilter` composition and record-groups timing.
- With `make-app-permission`: consume the resolved list-access gate and include its enabled state in the Preset request generation. This skill does not define permission policy or permission endpoints.
- With `makedsl`: read `EntityDataFilterUsage.md` to confirm backend filter semantics such as DNF, system variables, DateRange/File/Lookup, empty filter handling, and error cases. Do not generate DSL from this skill.
