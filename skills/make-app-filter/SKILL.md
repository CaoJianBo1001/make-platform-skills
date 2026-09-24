---
name: make-app-filter
description: "Use when generating, integrating, reviewing, or debugging Make App record-list keyword search through Service filter.expression or advanced/conditional/table/header filtering with @qfei-design/make-app-filter. Triggered by 列表搜索, 关键词搜索, 筛选, 高级筛选, 条件筛选, 表格/表头/列头/按字段筛选, CEL/DNF, field-type operators, candidate values, and filter Preset save/echo. In search-only mode, use the package compiler without a filter panel or Preset lifecycle. In advanced-filter mode, use the package panel, permission-aware Entity Preset, and desktop/tablet CanvasTable header linkage; phone uses the mobile panel layout. Consume make-app-permission list access. When make-app-actions is present, a successfully applied filter must clear its selection and invalidate pending work; drafts and failures preserve selection. Does not own page layout, CanvasTable internals, Service route implementation, sorting, grouping, auth, runtime, DSL, Make CLI, or table cell editing."
metadata:
  version: 0.1.18
---

# make-app-filter

Use this skill for Make App filtering. A keyword-search-only list that sends `filter.expression` uses the package compiler without enabling advanced filtering. Desktop/tablet lists that use advanced filters, condition builders, table filtering, or CanvasTable header "按该字段筛选" deliver one integrated feature:

- package-backed toolbar advanced filter using `@qfei-design/make-app-filter`
- host-owned CanvasTable header filter UI/menu
- linkage from header "按该字段筛选" to the same package controller and toolbar panel
- Entity Preset advanced-filter save, load, hydration, and clear behavior
- Service `filter.expression` payload integration

When advanced filtering is in scope, phones use the same package controller, Preset and Service `filter.expression`, but expose only the medium-sized filter trigger in the compact phone toolbar and `AdvancedFilterPanel layout="mobile"` in a mobile-safe host sheet. Do not mount the desktop Popover there. 手机顶部筛选不需要 CanvasTable 表头联动，也不得挂载隐藏 CanvasTable 来满足桌面合同。

On desktop/tablet, do not implement only advanced filter or only header filter in Make record-list pages. They must be done together or not done.

This skill owns the consumer-side package integration contract, advanced-filter behavior, field support, Entity Preset filter persistence, Service filter payload shape, host-owned header-linkage semantics, URL/deep-link filter echo, and filter-specific tests. It consumes list-access state from `make-app-permission`; it does not define permission policy. It does not own sorting (`make-app-sort`), grouping (`make-app-group`), page shell/layout (`makeui`), CanvasTable rendering internals or header menu API details (`canvas-table-integration`), Service route implementation (`make-app-service`), auth (`make-app-auth`), runtime packaging (`make-app-runtime`), DSL modeling (`makedsl`), or Make CLI execution (`makecli`).

## Capability modes

Choose the mode before following the workflow. Panel, controller, filter Preset and mobile-layout requirements below apply only to `advanced-filter` unless explicitly stated otherwise.

| Mode | Query | Filter Preset | UI and package gate |
| --- | --- | --- | --- |
| `search-only` | `compileListFilter({ fields, searchText })` | no filter Preset GET/PATCH or hydration | no controller, panel, or mobile layout gate; use the package core compiler |
| `advanced-filter` | `compileListFilter({ fields, searchText, advancedFilter })` | GET/hydrate before the first records query; PATCH the filter dimension only after confirmation | package controller and panel; phone requires public `layout="mobile"` |

`search-only` does not load or apply a saved advanced-filter expression behind an absent filter UI. If sorting or grouping independently requires a shared Entity Preset, its own coordinator may still load that Preset; this Skill does not consume its `filter` dimension until advanced filtering is enabled. Both modes still obey the list-access gate and send the package compiler result unchanged to Service.

## Quick start

1. Treat any Make record-list request containing "筛选", "高级筛选", "条件筛选", "表格筛选", "表头筛选", "列头筛选", or "按字段筛选" as the same filtering requirement. Desktop/tablet implement both the package-backed toolbar advanced filter and CanvasTable header linkage. Phone uses the package-backed top filter entry without CanvasTable/header linkage.
2. Locate the host UI package, usually `apps/ui/package.json`. If no UI package exists, stop and report the missing host package.
3. Ensure `@qfei-design/make-app-filter@^1.0.0` is installed. If missing or older, install/upgrade with the host package manager. Only phone advanced filtering requires `AdvancedFilterPanelLayout` with `"mobile"` in the resolved package's public React declaration: released 1.0.0–1.0.3 lack this mobile layout. A search-only phone list needs the public core compiler but not this panel-layout gate. Upgrade through the host compatibility gate when needed; do not substitute the default/stacked panel or hand-write package internals.
4. Read package docs before designing code. Prefer installed package docs; if the host is working in the package repo, read source docs.
5. In advanced-filter mode, import `@qfei-design/make-app-filter/styles.css` once in the host UI entry; search-only compiler use does not need panel styles.
6. Both modes use the package core compiler. Advanced-filter mode additionally uses package panel, controller, adapter, validation, and CEL parse APIs. Do not copy or hand-write these capabilities in the host.
7. In advanced-filter mode, keep presentation-specific toolbar trigger, desktop Popover or phone mobile-safe sheet, scroll sizing, applied state, candidate APIs, Service request adapter, and desktop/tablet CanvasTable header filter UI/menu in the host. Phone sheet content must pass `layout="mobile"` to `AdvancedFilterPanel`. Search-only has no panel surface.
8. On desktop/tablet, wire header "按该字段筛选" to the same package controller/panel; do not create separate header-only state or a local filter implementation. Phone has no header entry.
9. Align with the backend Record list filter contract: Service sends `filter: { expression }`, blank expressions mean no filter, and field support must match runtime metadata plus package public APIs. Submit `compileListFilter` output unchanged; never rewrite CEL/DNF in the host.
10. For entity object lists, consume the list-access gate from `make-app-permission`. Only when advanced filtering is enabled and list access is allowed, load the current Entity Preset before the first records query and hydrate the saved filter through package public APIs using a permission-aware `{ enabled, entityKey, generation }` context. Search-only does not load or hydrate the filter Preset, and toolbar search remains session-only.
11. On filter confirm, PATCH only the Preset `filter` dimension. After success, update applied state synchronously; let the records query react to applied state instead of reloading inside the persistence callback. Preserve the old applied filter and current draft on failure.
12. When the writable list uses `make-app-actions`, hand off the successfully applied filter generation so actions clear selection and invalidate pending precheck/submit work before the new query is actionable. Draft edits, cancel, and save/apply failure preserve the current action selection.
13. In advanced-filter mode, preserve the required fixed three-region layout: top fixed header, scrollable condition body, and bottom fixed footer. Header/footer controls must remain visible while condition rows scroll.
14. Before finishing, verify package compilation, empty filter omission, Service payload shape and list-access behavior in both modes. For search-only, verify no filter Preset GET/PATCH, hydration, panel or mobile-layout gate. For advanced filtering, also verify fixed panel layout, search merge, Preset save/load/clear, draft confirm/discard, candidates, desktop/tablet header linkage, phone no-CanvasTable behavior, package/backend field-support drift and conditional action-selection invalidation.

## Package pre-flight

New Make Apps and Apps undergoing an explicit runtime migration use the `make-app-runtime` runtime contract: the workspace root declares `"packageManager": "pnpm@10.20.0"` plus `"engines": { "node": "22.20.0", "pnpm": "10.20.0" }`, and package operations run through `corepack pnpm`. For those Apps, install the dependency in the actual UI package, for example `corepack pnpm add @qfei-design/make-app-filter@^1.0.0` from its directory; a new App with no lockfile first needs the runtime declaration and a generated pnpm workspace.

Existing Make Apps retain their declared runtime during filter work. Before installing or upgrading, locate the UI package and workspace root, inspect `packageManager`, Node engines, React/React DOM peers, the existing lockfile, and the repository's established install/CI workflow. Use the matching existing manager and workspace target:

- `pnpm-lock.yaml` with a compatible pnpm declaration/workflow: use that project's declared pnpm version through Corepack to add `@qfei-design/make-app-filter@^1.0.0` to the UI package.
- `package-lock.json` with a compatible npm declaration/workflow: use the existing npm workspace install command targeting the UI package, or install from that package directory if the repository is not a workspace.
- `yarn.lock` with a compatible Yarn declaration/workflow: use the existing Yarn workspace add command targeting the UI package, or add from that package directory if the repository is not a workspace. Preserve the project's Yarn version and configuration.

Do not rewrite an existing App's `packageManager`, Node selection, workspace layout, or lockfile type merely to add filtering. Never generate a second lockfile. If the declaration, lockfile, CI workflow, Node/peer constraints, or target workspace conflict—or an existing App has no unambiguous install workflow—stop and report a compatibility blocker to `make-app-runtime`; do not silently migrate it or force `corepack pnpm` into an npm/Yarn project. The phone filter package upgrade follows the same gate.

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
| Keyword search through `filter.expression` without advanced filtering | `references/service-translation.md`; use the compiler-only path in `references/filter-model.md` |
| Package install, imports, host/package boundary | `references/package-integration.md` |
| Filter IR, controller draft/confirm semantics, search merge, URL echo | `references/filter-model.md` |
| Runtime field capability, operator/value-editor APIs, and candidate values | `references/operator-matrix.md` |
| Host Popover/container, trigger, panel sizing, validation visuals | `references/ui-style.md` |
| CanvasTable header more menu and advanced filter linkage | `references/header-table-linkage.md` |
| Service filter contract and CEL expression payload | `references/service-translation.md` |
| Advanced-filter Entity Preset load, hydration, save barrier, clear, stale requests | `references/preset-integration.md` |
| Tests, smoke checks, common regressions | `references/testing-and-pitfalls.md` |
| Backend Record filter contract, CEL subset, DateRange/File/Lookup/system variables | Use `makedsl`; read its EntityDataFilterUsage reference |
| Group path expression composition and record-groups `groupFilter` | Use `make-app-group`; reuse this Skill's DNF expression rules |
| Toolbar placement and surrounding page layout | Use `makeui` |
| CanvasTable `suffixRender` mechanics | Use `canvas-table-integration` |
| Service route implementation and adapter tests | Use `make-app-service` |
| Writable-list selection actions and applied-query invalidation | Use `make-app-actions` |

## Hard rules

- Do not create new Make advanced-filter implementations in host apps. No hand-written Filter IR helpers, operator matrix, validator, CEL compiler/parser, or advanced filter panel when the package provides it.
- Do not deliver advanced filtering partially. Both modes use the package compiler and Service expression payload; advanced-filter mode additionally uses the package controller. Desktop/tablet advanced filtering implements CanvasTable header UI and linkage. Phone advanced filtering uses only its top toolbar filter entry and mobile-safe panel; it does not require or render CanvasTable header linkage.
- Phone advanced filtering requires the public `"mobile"` panel layout in the installed React declaration, a host-owned mobile Sheet, and `AdvancedFilterPanel layout="mobile"`. A desktop Popover on a narrow viewport, `layout="default"`, or CSS-shrinking its condition rows is not mobile adaptation. Keep desktop/tablet Popover presentation unchanged. Search-only does not require the mobile panel layout.
- New integrations use the core API from `@qfei-design/make-app-filter`; advanced-filter integrations additionally use `@qfei-design/make-app-filter/react` and optional `@qfei-design/make-app-filter/adapters/antd`.
- Advanced-filter integrations import `@qfei-design/make-app-filter/styles.css` once. Search-only compiler use does not require panel styles. Host CSS may style the outer overlay/container, but must not fork package internals unless fixing a host-specific containment issue.
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
- In advanced-filter mode, on every entity or permission-enabled context change, increment a monotonic request generation and reset the host panel state. Comparing only `entityKey` when a save settles is unsafe because an old `A -> B -> A` result or a result from before access revocation can look current. Search-only still invalidates stale record-query responses without creating panel state.
- In advanced-filter mode, use a committed-context reset such as a keyed wrapper plus layout-effect cleanup. Do not mutate request-generation, saving, or context refs during React render.
- In advanced-filter mode, if saved CEL is unsupported by the current package, keep its raw expression active in backend requests, keep the trigger visibly active, and show a compatibility warning until an explicit replacement or clear saves successfully.
- In advanced-filter mode, unsupported package fields must be hidden from desktop/tablet and phone field selectors and from desktop/tablet header "按该字段筛选"; do not call `openWithField` for unknown fields, invalid field keys, or package-unsupported field/operator combinations.
- On desktop/tablet, Header menu filtering is a host integration. It appends a draft condition through the package controller and opens the same toolbar filter panel. It must not submit immediately, reload records, or create a separate header-only state; phone has no header menu.
- On desktop/tablet, Table scrolling, object switching, outside click, or unmount must close any header menu and restore the header suffix icon to hover-only state.
- Advanced filter panel layout is mandatory: every Make advanced filter must use the fixed three-region baseline with a fixed header, scrollable body, and fixed footer. A panel where add/confirm/clear actions scroll away with conditions is a readiness blocker and must not be reported as ready, complete, or delivered.
- Only when advanced filtering is enabled, persist its expression in the current user's Entity Preset and load and hydrate the Preset filter before the first records query. Search-only does not read, hydrate or write the filter Preset.
- Preset writes are sparse. Saving filter sends only `{ filter }`, never a possibly stale `sort` or `group`.
- Save before apply. Preset save failure keeps the previous applied filter, open panel, and current draft; it must not reload records.
- If `make-app-actions` is present, only a successfully applied filter generation
  clears its selection and invalidates pending action work. Draft edits, panel
  cancel, validation failure, Preset save failure, and failed list queries do not
  clear or redefine the current action selection.
- Clear advanced filter with `filter: null`. Toolbar keyword search remains session-only and must not be persisted.
- When list access is disabled, block new schema and records requests and invalidate in-flight results. In advanced-filter mode, also block Preset GET/PATCH, close filter surfaces and ignore stale Preset load/save responses after either `entityKey` or permission-enabled state changes. Search-only has no filter Preset request or surface to close.

## Default behavior

- Advanced filtering UI is an optional product capability in every presentation mode. Generate its trigger and panel only when requested or already established by the project; enabling the standard phone View alone does not add them. A search-only list that sends `filter.expression` uses `compileListFilter({ fields, searchText })` without a filter trigger, panel, filter Preset GET/PATCH or hydration; omit `advancedFilter` rather than passing an explicit undefined value. When advanced filtering is in scope, adapt it on the phone as well as desktop/tablet rather than leaving a nonfunctional phone trigger.
- Once advanced filtering is in scope, use the package-backed controller, `AdvancedFilterPanel`, draft lifecycle, fixed header/body/footer, field controls and Service `filter.expression`. Desktop/tablet use the toolbar trigger, host popover and CanvasTable header `openWithField` linkage. 手机／phone uses the top toolbar 筛选 entry and package `layout="mobile"` in a host Sheet; it does not need CanvasTable、表头或 header linkage.
- On desktop/tablet, the advanced filter panel must keep its three regions explicit: header top fixed with left `筛选` and right `清空所有`, body middle containing only condition rows/groups and using the only vertical scroll, footer bottom fixed with left `+ 添加条件` and `+ 添加条件组` and right `确认`. On phone, retain the fixed three regions but use the package `layout="mobile"` defaults (`设置筛选条件` and `完成`) inside the host Sheet; do not force desktop labels or inline-row styling onto that mode.
- The host keeps search text separate from advanced filter state. Search-only compiles `compileListFilter({ fields, searchText })`; advanced-filter mode combines applied filter and search through `compileListFilter({ fields, searchText, advancedFilter })`.
- Closing the owning desktop/tablet Popover or phone Sheet without confirmation discards unconfirmed draft changes through the package controller reset flow.
- The clear action changes only the draft; it affects the applied filter only after the active mode's confirm action (`确认` on desktop/tablet, `完成` on phone) succeeds.
- Object/entity or permission-enabled context changes clear transient search state and invalidate old requests. In advanced-filter mode, also clear filter/panel state and reload the Entity Preset only when access is enabled; clear header state and reset desktop/tablet table object-level transient state when mounted. Phone has no header filter UI. Search-only does not reload the filter Preset.

## Collaboration rules

- With `makeui`: use `makeui` for the desktop/tablet toolbar and the separate phone top filter entry, page shell, surrounding layout, and candidate-source UI contract; this skill owns filter behavior and package integration.
- With `canvas-table-integration`: use that skill for CanvasTable `suffixRender` and header menu mechanics; this skill owns how the host "按该字段筛选" action talks to the package-backed advanced-filter controller.
- With `make-app-service`: this skill defines filter query and Preset filter semantics; Service route validation, adapter logging, and Make request details stay in service.
- With `make-app-sort`: when advanced filtering is enabled, filter and sort share one parent-owned Entity Preset coordinator and load lifecycle but update their dimensions independently. Search-only does not consume the Preset filter dimension. This skill does not define sorting UI or sort validation.
- With `make-app-group`: filter and group share expression syntax; when advanced filtering is enabled they share the Preset lifecycle but update dimensions independently. This skill owns global `filter.expression`; `make-app-group` owns transient path `groupFilter` composition and record-groups timing.
- With `make-app-permission`: consume the resolved list-access gate in both capability modes; advanced filtering also includes its enabled state in the Preset request generation. This skill does not define permission policy or permission endpoints.
- With `make-app-actions`: only for writable lists using the action workflow,
  hand off a successfully applied filter generation before the new query becomes
  actionable so actions clear selection and invalidate pending work. Draft and
  failure paths preserve selection; this Skill does not manipulate CanvasTable
  selection APIs directly.
- With `makedsl`: read `EntityDataFilterUsage.md` to confirm backend filter semantics such as DNF, system variables, DateRange/File/Lookup, empty filter handling, and error cases. Do not generate DSL from this skill.
