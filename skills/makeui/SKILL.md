---
name: makeui
description: Use when designing, generating, refactoring, or reviewing Make App frontend UI and `apps/ui` React UI code. Triggered by makeui, UI, 界面, app shell, layout, component structure, responsive behavior, dynamic object routes, field-metadata rendering, list pages, create/edit/detail drawers, controlled form fields, user/department selectors, and UI states. Requires Make record tables to use `canvas-table-integration`, advanced filters to use `make-app-filter`, and generated Make App permission gates to use `make-app-permission`. Does not own auth, build/publish, Service runtime, business API design, permission logic, persistence, DSL, canvas-table internals, or filter package internals.
metadata:
  version: 0.3.46
---

# makeui

Use this skill for Make App frontend UI work in `apps/ui`. The default stack is React + Vite + React Router, but `makeui` only owns UI structure and presentation decisions.

`makeui` owns app shell layout, navigation layout, list-page layout, toolbar placement, current-user header menu placement, component-library usage, field-control presentation, create/edit/detail layout, user/department selector UI behavior, responsive behavior, visual states, and UI polish. It does not own authentication/login, frontend build or publish rules, Service runtime structure, business API/data contracts, permission logic, persistence, business modeling, domain mapping, `canvas-table` internals, or advanced-filter package internals. For generated Make Apps, pair this skill with `make-app-permission`; do not treat permission gates as optional UI polish.

## Quick start

1. Inspect the existing UI stack, routes, shell, component library, styling system, and page layout conventions.
2. Preserve the host project's data and auth behavior. Do not design login, tokens, business API routes, Service orchestration, deployment, or build output in this skill.
3. Use host-provided object/field metadata to render UI. Do not invent business fields or API contracts.
4. Use the dense object-management layout by default: left navigation, flat workspace header, local toolbar directly above the table, and no extra list-title card. Sidebar color follows the project theme.
5. Wrap object routes with visible UI states: loading, empty, error, forbidden, expired-session, not-found, retry, and render-error fallback.
6. Put the current logged-in user entry in the top header right: normalize the auth/current-context user first, including responses such as `{ userId, avatar, name }`; render a strict 32px circular avatar plus plain display name, using avatar image fields before fallback initials and using `name`/`userName`/`displayName` before any `userId` fallback. No tag, badge, pill background, or open menu is visible until the avatar/name trigger is clicked.
7. For a new Make POC UI, use the ExpensePoc-style componentized source tree by default: `src/pages`, `src/components`, `src/hooks`, `src/lib/service-api`, `src/router`, and `src/types`, with complex table/workflow components split into nested `config`, `editing`, `editors`, `hooks`, `renderers`, and `types` modules.
8. For a new Make POC UI, create a shared Make field type registry at `apps/ui/src/lib/make-field-types.ts` or the host project's established equivalent before implementing field-driven form, detail, table, filter, or editor behavior. The registry must cover all current `Make.Field.*` types and expose display group, render kind, default width, alignment, multiplicity, and control/display hints.
9. Use the ExpensePoc-style create/edit/detail layout by default: right Drawer, desktop two-column field grid, full-span rows only for wide fields, and one-column only on small screens or explicit user request.
10. Custom form field controls must be host-form controlled adapters: accept and forward `value/onChange/onBlur/id/disabled` from the host form layer, and make the form value seen by submit/validation match the displayed selection. This is UI-library neutral and does not require Ant Design, Arco, or shadcn.
11. Render detail values through a field-type display adapter. Do not display raw objects, arrays, or JSON wrapper text when the field type has a stable Make display shape.
12. For generated Make App UI, use `make-app-permission` for required permission gates: PermissionProvider placement, route guard, read/create/update/delete buttons, field editability, payload filtering, and refresh-time permission reload. `makeui` only decides how the resulting states render.
13. If filtering, advanced filtering, table filtering, or header filtering is requested or already present, route the integrated filtering behavior to `make-app-filter`; `makeui` only places the toolbar trigger area and preserves the table region needed by CanvasTable header linkage.
14. If Make record table cell editing is requested or already present, route the editor lifecycle, `customEdit`, borderless in-cell chrome, popup placement, and field-editor mapping to `canvas-table-integration` Track B. `makeui` may place the table host, but must not invent a one-off cell editor in a page component. Non-standard CanvasTable cell editors are a readiness blocker / 交付阻断; do not report the UI as ready, complete, or delivered.
15. Treat missing componentization as a readiness blocker for new Make POC UI and non-trivial UI changes. Before reporting ready or complete, verify that `App.tsx` and route/page files only orchestrate and that implementation logic is split into page, shell, feature components, hooks, `lib/service-api`, field display/config adapters, table host, toolbar, and Drawer modules.
16. Read only the needed reference files from the map below.

## Topic reference map

| Task / topic | Read |
| --- | --- |
| UI scope, boundaries, shell defaults, dynamic routes | `references/principles.md` |
| Component structure, module boundaries, page decomposition | `references/component-structure.md` |
| App shell, sidebar, top header, viewport height chain | `references/app-shell-layout.md` |
| Object list page, toolbar placement, default actions | `references/list-page-layout.md` |
| Create/edit/detail Drawer, stacked Drawers, mask close, header actions | `references/drawer-layout.md` |
| Route-based create/edit/detail pages or URL-addressable state | `references/page-route-layout.md` |
| Component library choice, field-type UI controls, detail value display | `references/component-usage.md` |
| Spacing, density, responsive layout, loading/empty/error states | `references/styling-and-responsive.md` |
| Make record table display or cell editing | Use `canvas-table-integration` |
| Advanced filter panel, condition builder, filter expression, header field filter | Use `make-app-filter` |
| Single-app permissions, route guard, operation buttons, field editability, refresh permission reload | Use `make-app-permission` |
| Authentication, login, logout handler, token, session behavior | Use `make-app-auth`; `makeui` only owns the current-user menu surface and placement |
| Build output, Service runtime, packaging, publish readiness | Use `make-app-runtime`; `makeui` does not own runtime contracts |

## Hard rules

### Scope boundary

- Do not add or modify authentication/login, token, OAuth, cookie, logout behavior, session mechanics, `/api/make/**`, domain, gateway, deployment, Docker/K8s, Node runtime, package-manager, build-output, or Service runtime rules in `makeui`.
- Do not define business API paths, Service contracts, data persistence, permission logic, approval flows, or environment mapping in `makeui`. The only allowed endpoint guidance here is the default user/department candidate-source behavior for UI selectors. Route names must yield to host project docs and the owning Service/API skill when the host documents a different transport.
- Generated Make App UI must not be reported complete without the required single-app permission gates from `make-app-permission`, unless the user explicitly opts out of permissions.
- If the task needs auth/login/logout/session behavior, use `make-app-auth`. If the task needs build output, Service runtime, packaging, or publish-readiness rules, use `make-app-runtime`.
- If the task needs 筛选, advanced filtering, table filtering, filter builders, `filter.expression`, or header "按该字段筛选", use `make-app-filter`. `makeui` must not implement or fork `@qfei-design/make-filter` logic, and must not ship a Make record-list filtering UI without the paired CanvasTable header linkage owned by `make-app-filter` plus `canvas-table-integration`.
- `makeui` may consume host-provided object/field metadata for UI rendering, but must not decide how that metadata is fetched, stored, authenticated, or deployed.

### UI metadata and states

- Generated UI consumes normalized, host-provided object/field metadata. Do not pass raw backend schema variants directly into table, form, detail, route, or shell components.
- New Make POC UI must centralize field type semantics in `apps/ui/src/lib/make-field-types.ts` or an equivalent shared registry. Form controls, detail display, CanvasTable column/render dispatch, filter value editors, and table cell editors must consume this registry instead of duplicating `Make.Field.*` string arrays or ad hoc switch statements in each module.
- `apps/dsl` is a modeling artifact, not a UI runtime dependency. Generated UI must not read `apps/dsl/**`, `/dsl/**`, or copied `*.yaml` files as its field source.
- If object/field metadata is missing or inconsistent, show a visible UI dependency/error state and report the missing dependency. Do not invent business API paths, parse local DSL, or create fake user/department/business fallback data in `makeui`.
- Schema, data, route, and render failures must resolve to visible object-shell states: loading, empty, error, forbidden, expired-session, retry, not-found, or render-error. Do not let exceptions become a blank page.

### Form field controlled contract

- This is the MakeUI 自定义表单字段控件受控 hard rule and readiness blocker: any custom field component used inside create/edit Drawer forms or route forms must be a host-form controlled adapter. It must accept and forward `value/onChange/onBlur/id/disabled` from the host form layer, plus `name`, `ref`, validation status, and accessibility props when the host form provides them.
- The displayed selection must be the same value that submit, save, resolver, or validation reads from the form store. If a user, department, lookup, select, date, file, or custom selector visually shows a choice but the host form value remains empty or stale, the UI is not ready for delivery.
- Custom selector components may keep transient search text, popup open state, and fetched option cache locally, but they must not keep the selected value only in internal state. `onChange` must write the normalized submit value back to the host form on every commit, and `onBlur` must propagate so required validation and touched state behave correctly.
- This rule is component-library neutral. Do not fix these bugs by requiring Ant Design, Arco, shadcn, or a specific `Form.Item`/`Select`; use the selected project component library or project-owned controls, but preserve the host form controlled contract.

### Component structure and modularization

- This is the MakeUI 组件化拆分 / 模块化 hard rule and readiness blocker: new generated Make POC UI and non-trivial generated/refactored `apps/ui` code must be split by responsibility instead of implemented as one page-sized component. Do not report the UI as ready, complete, or delivered until this split exists.
- For new Make POC UI projects, the default directory baseline is ExpensePoc-style: `apps/ui/src/pages` for route pages, `apps/ui/src/components` for shell and feature components, `apps/ui/src/hooks` for reusable state/data hooks, `apps/ui/src/lib/service-api` for UI-to-Service calls, `apps/ui/src/router` for route registration, and `apps/ui/src/types` for shared UI types. Complex table or workflow components must add nested modules such as `config`, `editing`, `editors`, `hooks`, `renderers`, and `types`.
- `App.tsx` must not own business implementation logic such as data fetching, schema normalization, table column construction, form/detail mapping, Drawer state machines, row action behavior, or field rendering. Keep it to providers, router mounting, and app-level shell composition.
- Route/page files only orchestrate layout, read route params, compose feature modules, and bridge minimal page state. Do not put data fetching, field metadata normalization, table column construction, form field mapping, Drawer state, row actions, and render details all in one route/page component.
- Split non-trivial UI into route pages, feature modules, reusable components, hooks, data/API adapters, and configuration builders. Follow the host project's existing folders first, such as `components`, `features`, `hooks`, `services`, `api`, `utils`, `adapters`, `pages`, or `routes`.
- A flat `apps/ui/src` tree or a single `App.tsx`/route file that owns shell, routing, data loading, table config, forms, drawers, row actions, and display adapters is a readiness defect for generated POC work. Split it before reporting the UI as complete.
- Do not create 单文件堆逻辑: if a page has multiple UI regions, reusable behavior, complex state, Make field adaptation, table configuration, or create/edit/detail surfaces, extract those responsibilities into named modules before finishing the change.
- Very small local edits may stay near the touched component, but they must not enlarge an existing monolithic file or mix unrelated responsibilities. This exception does not apply when the requested change is a new generated POC scaffold, an explicit modularization/refactor, or a change that adds multi-region object pages, table configuration, form/detail workflows, reusable Make field adaptation, or other mixed responsibilities. If a small unrelated edit touches a pre-existing monolithic file, avoid a broad split unless the edit worsens the mix; report the follow-up refactor instead.

### UI defaults

- Default object-list layout: left navigation, flat workspace header with title only, local toolbar, then `canvas-table`.
- Sidebar has a brand area, section labels, single-line object items, and a clear active state. Background color follows the project theme; do not default to dark.
- Sidebar active item highlight must be centered inside the sidebar content gutter, with consistent left/right inset and no overflow to the sidebar edge.
- Sidebar items and workspace header titles do not get subtitles, descriptions, helper lines, schema summaries, or overview copy unless the user asks.
- The top header right must show the current logged-in user in this strict style when the host auth context exposes user identity: normalize the host auth/current-context response before rendering. A current-context response such as `{ userId, avatar, name }` must display `name` outside the avatar and use `avatar` as the avatar image. For display text, prefer `name`, then `userName`, then `displayName`, then `label`; use `userId` only as identity and a last-resort fallback after no human-readable name exists. For avatar image, prefer `avatar`, then `avatarUrl`, then `avatarURL`, then `photoURL`. Render the current user avatar image first; if no avatar image exists, render one fixed 32px circular fallback avatar with a deterministic random background color derived from the user id or display name, centered white text, and the last two characters of the display name; then show the plain display name to the right. Do not use one fixed global fallback color for all users. Do not wrap the avatar/name in a Tag, Badge, pill, tinted capsule, card, or visible dropdown shell, and do not show a menu or extra account actions before click. Clicking the avatar/name trigger opens a right-aligned dropdown below the header with a visible `退出` action. `makeui` owns the placement, density, label, and popup surface; the action handler must come from the host auth integration defined by `make-app-auth`.
- The local toolbar sits above the table. Put search/filter/refresh on the left and create/new on the right. Do not put refresh in the global header, object title header, table header row, canvas-table header area, or column header area.
- Do not insert a summary/title card between the workspace header and table for default object lists.
- Do not add pagination, views, import/export, grouping, sorting, column settings, selection, or Kanban/split views unless requested.
- Make record tables must use `@qfei-design/canvas-table` via `canvas-table-integration`; do not replace them with UI-library tables.
- Make filtering must use `@qfei-design/make-filter` via `make-app-filter`; do not generate local filter model helpers, operator matrices, validators, CEL compiler/parser, or custom advanced-filter panels in `makeui`.
- If filtering is in scope, `makeui` only keeps toolbar placement: search/filter/refresh on the left. The filter trigger opens the host container for package `AdvancedFilterPanel`; package pre-flight, `styles.css`, BizFinancePoc fixed advanced-filter panel layout with header/body/footer, candidate sources, `compileListFilter`, Service `filter.expression`, CanvasTable header `按该字段筛选`, and `openWithField` linkage are owned by `make-app-filter` with CanvasTable mechanics from `canvas-table-integration`.
- Generated Make App shells and object-list pages must not create body-level or whole-page scrolling. Keep the root shell fixed to viewport height and put every overflow in the owning region: long sidebar navigation scrolls only inside the sidebar, table data scrolls only inside the CanvasTable/table region, Drawer content scrolls only inside the Drawer body, and route-page content scrolls only inside the content region. Do not let `body`, the app root, the shell, or the list page become the scroll container for normal object-list browsing.
- CanvasTable wrapper and host must fill the available content width and remaining height; use a flex height chain or accurate `calc()` fallback instead of fixed table dimensions.
- CanvasTable defaults to `showSN` sequence numbers and a hover-revealed row-head detail icon through `bodyRowHeadSuffixOptions`, unless the user explicitly says the table does not need it.
- CanvasTable cell editors are owned by `canvas-table-integration` Track B. New Make POC UI must not implement ad hoc input boxes inside table cells; field editors must reuse the host component library and keep CanvasTable's own active edit border as the only in-cell border. Any CanvasTable 单元格编辑 that does not satisfy Track B's mandatory standard is not ready for delivery.
- Create/edit/detail must use right-side Drawer-style surfaces for default Make object CRUD. Ant Design uses `Drawer placement="right"`; shadcn/ui uses `Sheet side="right"`. Width defaults to `60%` and may become `100%` on small screens, but the surface still opens from the right. Do not use bottom Drawer/Sheet, centered Modal/Dialog, or bottom sheet unless the user explicitly asks for that different surface.
- Create/edit/detail desktop layouts default to two columns. Do not render all fields as one full-width column on desktop unless the user explicitly asks or the viewport is too narrow.
- Create/edit fields default to a vertical-label two-column grid. Common fields occupy one column; wide fields such as `TextArea`, `URL`/link, `File`, `Lookup`/relation selectors, long text, and rich controls span the full row. Collapse to one column on small screens.
- Detail views default to a compact two-column label/value grid. Common fields occupy one column; long text, `TextArea`, `URL`/link-rich values, `File`, `Lookup`/relation values, attachment-heavy values, and rich content span the full row.
- Detail values must be normalized by Make field type before rendering. Date range objects such as `{ begin, end }` or arrays such as `[begin, end]` display as a formatted range, not raw JSON; select/user/department/file/lookup values use their type-specific read-only renderers. Empty values display a muted `-`.
- Detail Drawer/page titles should show the complete selected object or record title whenever space permits. Give the title area flexible width and use ellipsis only for true overflow; keep the full title available through a tooltip or accessible title. Do not create a tiny title slot that truncates otherwise displayable titles.
- Create/edit forms use type-appropriate controls. Date, select, user, department, file, and lookup fields must not silently degrade to plain text inputs. File upload is omitted in create mode when upload requires an existing record identity.
- Create/edit custom form field controls must follow the host-form controlled contract from `component-usage.md`: forward `value/onChange/onBlur/id/disabled`, keep visual selection and form store synchronized, and treat local-only selected state as a delivery blocker.
- User and department selector UI must consume host candidate APIs. Generated Make App UI-Service defaults are `GET /api/users?keyword=&page=&size=` and `GET /api/departments?keyword=&page=&size=`, normalized to selector options with `userId/userName` and `departmentId/departmentName`, unless the host project documents equivalent Service/API routes.
- Do not use field schema `options`, local demo arrays, row samples, hardcoded names, or stale client-only lists as the source of truth for user/department selectors. Current record values may be merged into options only to echo existing selections while the real candidate API is loading or temporarily empty. If the selector appears inside advanced filter or CanvasTable cell editing, implement the surface with `make-app-filter` or `canvas-table-integration` while preserving this candidate-source contract.
- Use dynamic object routes such as `/objects/:objectKey`. Do not generate one hard-coded route component per object.

## Out of scope

- Authentication, login, token, logout behavior, session mechanics, or SDK integration
- Frontend build output, package scripts, publishing, deployment, Docker, K8s, or runtime readiness
- Service structure, Service config, Service port, API proxy, or API orchestration
- Business fields or field meaning
- Query/save API design
- Validation rules tied to business policy
- Permission checks and approval flows
- Business data modeling or DSL changes
- `@qfei-design/canvas-table` implementation or cell-edit lifecycle
- `@qfei-design/make-filter` implementation, operator matrix, validator, CEL compiler/parser, or panel internals
