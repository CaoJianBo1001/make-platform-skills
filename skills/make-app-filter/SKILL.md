---
name: make-app-filter
description: "Use when integrating, generating, refactoring, or reviewing Make App record-list filtering with @qfei-design/make-filter, CanvasTable header linkage, and Service filter.expression payloads. Triggered by 筛选, 高级筛选, 条件筛选, 表格/表头/列头/按字段筛选, CEL/DNF expressions, system variables, empty filters, field-type operators, DateRange/File/Lookup support, candidate values, URL echo, and tests. Does not own page shell/layout, CanvasTable rendering internals, Service route implementation, auth, runtime packaging, DSL modeling, Make CLI execution, or table cell editing."
metadata:
  version: 0.1.0
---

# make-app-filter

Use this skill for Make App filtering. Any Make project that uses filtering, advanced filters, condition builders, table filtering, or CanvasTable header "按该字段筛选" must deliver one integrated feature:

- package-backed toolbar advanced filter using `@qfei-design/make-filter`
- host-owned CanvasTable header filter UI/menu
- linkage from header "按该字段筛选" to the same package controller and toolbar panel
- Service `filter.expression` payload integration

Do not implement only advanced filter or only header filter in Make record-list pages. They must be done together or not done.

This skill owns the consumer-side package integration contract, advanced-filter behavior, field support, Service filter payload shape, host-owned header-linkage semantics, URL/deep-link filter echo, and filter-specific tests. It does not own page shell/layout (`makeui`), CanvasTable rendering internals or header menu API details (`canvas-table-integration`), Service route implementation (`make-app-service`), auth (`make-app-auth`), runtime packaging (`make-app-runtime`), DSL modeling (`makedsl`), or Make CLI execution (`makecli`).

## Quick start

1. Treat any Make record-list request containing "筛选", "高级筛选", "条件筛选", "表格筛选", "表头筛选", "列头筛选", or "按字段筛选" as the same integrated filtering requirement. Implement both the package-backed toolbar advanced filter and the host-owned CanvasTable header filter linkage.
2. Locate the host UI package, usually `apps/ui/package.json`. If no UI package exists, stop and report the missing host package.
3. Ensure `@qfei-design/make-filter@^0.2.2` is installed. If missing or older, install/upgrade with the host package manager.
4. Read package docs before designing code. Prefer installed package docs; if the host is working in the package repo, read source docs.
5. Import `@qfei-design/make-filter/styles.css` once in the host UI entry.
6. Use package APIs for filter core, panel, controller, adapter, validation, and CEL compile/parse. Do not copy or hand-write these capabilities in the host.
7. Keep host responsibilities outside the package: toolbar trigger, Popover/Drawer/Modal container, scroll sizing, applied state, candidate APIs, Service request adapter, and CanvasTable header filter UI/menu.
8. Wire header "按该字段筛选" to the same package controller/panel; do not create separate header-only state or a local filter implementation.
9. Align with the backend Record list filter contract: Service sends `filter: { expression }`, blank expressions mean no filter, expressions must stay in the supported CEL/DNF subset, and field support must match runtime metadata plus package public APIs.
10. Preserve the BizFinancePoc fixed advanced-filter panel layout: top fixed header, scrollable condition body, and bottom fixed footer. Header/footer controls must remain visible while condition rows scroll.
11. Before finishing, verify tests or deterministic checks for package source usage, fixed panel layout, empty filter omission, search merge, draft confirm/discard, candidate sources, header linkage, package/backend field-support drift, and Service payload shape.

## Package pre-flight

If `@qfei-design/make-filter` is missing:

- `pnpm-lock.yaml` -> `pnpm add @qfei-design/make-filter@^0.2.2`
- `yarn.lock` -> `yarn add @qfei-design/make-filter@^0.2.2`
- `package-lock.json` -> `npm install @qfei-design/make-filter@^0.2.2`
- no lockfile -> default to `npm install @qfei-design/make-filter@^0.2.2`

If a different advanced-filter package name is already used, stop and ask before changing the dependency. If `@qfei-design/make-filter` is installed but older than `0.2.2`, upgrade before integrating.

Required read order for installed `0.2.2+` packages:

1. `node_modules/@qfei-design/make-filter/package.ai.json`
2. `node_modules/@qfei-design/make-filter/docs/agent-usage.md`
3. `node_modules/@qfei-design/make-filter/recipes.json`
4. `node_modules/@qfei-design/make-filter/capabilities.json`
5. `node_modules/@qfei-design/make-filter/PUBLIC_API.md`
6. `node_modules/@qfei-design/make-filter/README.md`
7. `node_modules/@qfei-design/make-filter/docs/api.md`

When working directly in the package repo, use the same root-relative paths. If the installed package is older than `0.2.2`, upgrade first instead of relying on older package docs or inferred internals.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| Package install, imports, host/package boundary | `references/package-integration.md` |
| Filter IR, controller draft/confirm semantics, search merge, URL echo | `references/filter-model.md` |
| Make field type to operator/value-editor matrix and candidate values | `references/operator-matrix.md` |
| Host Popover/container, trigger, panel sizing, validation visuals | `references/ui-style.md` |
| CanvasTable header more menu and advanced filter linkage | `references/header-table-linkage.md` |
| Service filter contract and CEL expression payload | `references/service-translation.md` |
| Tests, smoke checks, common regressions | `references/testing-and-pitfalls.md` |
| Backend Record filter contract, CEL subset, DateRange/File/Lookup/system variables | Use `makedsl`; read its EntityDataFilterUsage reference |
| Toolbar placement and surrounding page layout | Use `makeui` |
| CanvasTable `suffixRender` mechanics | Use `canvas-table-integration` |
| Service route implementation and adapter tests | Use `make-app-service` |

## Hard rules

- Do not create new Make advanced-filter implementations in host apps. No hand-written Filter IR helpers, operator matrix, validator, CEL compiler/parser, or advanced filter panel when the package provides it.
- Do not deliver filtering partially in Make record-list pages. If filtering is in scope, implement package-backed toolbar advanced filter, CanvasTable header filter UI, header-to-panel linkage, and Service expression payload together.
- New integrations must import package APIs from `@qfei-design/make-filter`, `@qfei-design/make-filter/react`, and optional `@qfei-design/make-filter/adapters/antd`.
- New integrations must import `@qfei-design/make-filter/styles.css` once. Host CSS may style the outer overlay/container, but must not fork package internals unless fixing a host-specific containment issue.
- New filter output uses `filter: { expression: string }`. If `compileListFilter` returns `undefined`, omit `filter`.
- The backend Record list handler reads only `filter.expression` from the `Expression` object and treats missing, `null`, or blank expressions as no filter.
- Do not send `filter: []`, `filter: {}`, `{ expression: "" }`, blank raw filter strings, or old object-array DSL.
- Do not filter Make record lists locally. List filtering goes through Service/backend filter APIs.
- Filter fields come from normalized runtime object/field metadata. Do not read `apps/dsl/**`, copied YAML, row samples, or hardcoded demo data as runtime filter metadata.
- User and department filter values are identities, not display names. Candidate sources must use host UI-Service routes such as `/api/users` and `/api/departments` or documented equivalents.
- Do not source user/department options from field schema `options`, current table rows, local arrays, or display labels. Current applied values may be merged only to keep labels visible while remote candidates load.
- Backend Record filters support DateRange, File, and Lookup semantics, but the UI may expose a field only when `@qfei-design/make-filter` public APIs support that field/operator combination. If backend docs and package capabilities differ, stop to upgrade/fix the package or report the mismatch; do not hand-write CEL or guess package internals.
- Unsupported package fields must be hidden from field selectors and header "按该字段筛选"; do not call `openWithField` for unknown fields, invalid field keys, or package-unsupported field/operator combinations.
- Header menu filtering is a host integration. It appends a draft condition through the package controller and opens the same toolbar filter panel. It must not submit immediately, reload records, or create a separate header-only state.
- Table scrolling, object switching, outside click, or unmount must close any header menu and restore the header suffix icon to hover-only state.
- Advanced filter panel layout is mandatory: every Make advanced filter must use the BizFinancePoc three-region baseline with a fixed header, scrollable body, and fixed footer. A panel where add/confirm/clear actions scroll away with conditions is a readiness blocker and must not be reported as ready, complete, or delivered.

## Default behavior

- Filtering is optional product capability. Generate it only when requested or already established by the project.
- Once filtering is in scope, default to the complete BizFinancePoc package baseline: toolbar `筛选` trigger, bottom-left popover, host-owned container, package `AdvancedFilterPanel`, package draft controller, fixed header/body/footer layout, `确认`, `清空所有`, active label `已筛选 N 个条件`, field-type controls, CanvasTable header menu `按该字段筛选`, header `openWithField(fieldKey)` linkage, and Service `filter.expression` payload.
- The advanced filter panel must keep its three regions explicit: header top fixed with left `筛选` and right `清空所有`, body middle containing only condition rows/groups and using the only vertical scroll, footer bottom fixed with left `+ 添加条件` and `+ 添加条件组` and right `确认`.
- The host keeps search text separate from advanced filter state. Compile both through `compileListFilter({ fields, searchText, advancedFilter })`.
- Clicking outside the popover or trigger-closing discards unconfirmed draft changes by calling the package controller reset flow.
- `清空所有` clears the draft and affects applied filters only after `确认`.
- Object/entity switch clears applied advanced filter, search state, popover state, header menu state, and table object-level transient state.

## Collaboration rules

- With `makeui`: use `makeui` for toolbar placement, page shell, and surrounding layout; this skill owns filter behavior and package integration.
- With `canvas-table-integration`: use that skill for CanvasTable `suffixRender` and header menu mechanics; this skill owns how the host "按该字段筛选" action talks to the package-backed advanced-filter controller.
- With `make-app-service`: this skill defines filter query shape; Service route validation, adapter logging, and Make request details stay in service.
- With `makedsl`: read `EntityDataFilterUsage.md` to confirm backend filter semantics such as DNF, system variables, DateRange/File/Lookup, empty filter handling, and error cases. Do not generate DSL from this skill.
