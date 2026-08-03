# makeui principles

## Contents

- [Role](#role)
- [Hard boundaries](#hard-boundaries)
- [Default Make App UI pattern](#default-make-app-ui-pattern)
- [Field metadata and identity](#field-metadata-and-identity)
- [Object-shell UI states](#object-shell-ui-states)
- [Decision order](#decision-order)
- [Dynamic object routes](#dynamic-object-routes)
- [Do not create views by default](#do-not-create-views-by-default)

## Role

`makeui` guides frontend UI generation for Make App pages. It should make layout, presentation, and interaction-placement decisions, not runtime, backend, auth, deployment, or business decisions.

## Hard boundaries

- Do not invent business fields, field meanings, API shapes, permission rules, approval states, persistence behavior, deployment rules, or runtime architecture.
- Do not add or modify authentication, login, logout behavior, token handling, cookies, OAuth, SSO, `/api/make/**`, gateway, domain, or session mechanics in `makeui`; route those tasks to `make-app-auth`. `makeui` only owns the visible current-user menu surface.
- Do not add or modify Service structure, Service config, Service port, Service build output, Docker/K8s, frontend build output, package scripts, Node runtime, or publish readiness rules in `makeui`.
- Do not decide where field metadata comes from. `makeui` consumes the host project's object/field metadata and renders the UI from it.
- Do not infer that a requested table needs pagination, cell editing, virtual loading, or custom renderers; table implementation belongs to `canvas-table-integration`.
- Make record tables and list tables must use `@qfei-design/canvas-table` through `canvas-table-integration`. If cell editing is needed, use `canvas-table-integration` for the editing design too.
- Do not add product capabilities that were not requested, especially pagination, views, advanced filters, grouping, sorting, column settings, import, or export.
- Use shadcn/ui as the default Make App component system for new generated UI.
- Do not silently mix shadcn/ui with an existing non-shadcn component system. If the user asks for replacement, migrate the touched UI surface to shadcn/ui; otherwise state the mismatch before component-library-specific edits.
- Do not skip the Make App shell for generated object-list UI. Start from the shell unless the project already has one.
- Do not silently downgrade `Date`, `User`, `Department`, `Select`, `File`, or `Lookup` Make fields to plain text inputs. Use type-appropriate UI controls or show an explicit unsupported-field UI fallback.
- Do not show attachment upload controls in create flows when upload requires a saved record identity. New records do not have a persisted id; omit file upload until edit/detail after persistence.

## Default Make App UI pattern

Use a focused object-management layout:

- global shell with top header and left navigation for generated Make App object-list UI
- list page as the main entry
- object navigation through dynamic React Router params
- create/edit/detail as right-side Drawer-style surfaces by default; use shadcn/ui `Sheet side="right"` and do not use bottom sheets unless explicitly requested
- create/edit/detail use the platform desktop two-column field grid by default; only wide fields such as `TextArea`, URL/link, file, lookup/relation, long text, attachments, or rich controls span the full row
- route pages only on explicit user request
- table area fills remaining content height

For generated object-list UI, the shell structure is:

1. left full-height sidebar for module/object navigation
2. right fixed header with selected object/module name on the left
3. current logged-in user on the header right as a strict 32px circular avatar plus plain display name; normalize current-context shapes such as `{ userId, avatar, name }` so avatar/name are used before any `userId` fallback; the dropdown containing `退出` appears only after the avatar/name trigger is clicked
4. local list toolbar below the header
5. canvas-table region filling the remaining height

Do not add pagination to generated object-list UI unless the user explicitly asks for it.

## Field metadata and identity

`makeui` may use normalized field metadata already provided by the host project or prepared by another skill. Keep the UI-facing contract small:

- entity/object key: route and selection identity
- entity/object name: navigation and page title text
- field key: UI field identity, table column key, form item key, and detail item key
- field name: label, column title, detail label, and menu text
- field type/group: control choice and layout span
- field UI properties: required marker, readonly/disabled state, placeholder, option labels, relation display metadata, and value display hints when available

Detail UI must consume the same normalized field metadata and a field-type display adapter. Do not render raw field values directly when the Make field type has a structured return shape, such as `DateRange`, user, department, file, or lookup.

If metadata is missing or inconsistent, report the UI dependency clearly. Do not implement API fetching, local DSL parsing, fake global users/departments, or business fallback data inside `makeui`.

## Object-shell UI states

Generated object pages must not fail into a blank visual surface. `makeui` only defines the UI states and placement, not the auth or data implementation.

The object shell should have visible states for:

- loading
- empty object list
- empty records for a valid object
- field metadata unavailable
- data error with retry action slot
- forbidden or permission-denied copy
- expired session / unauthenticated copy, delegated to `make-app-auth` for behavior
- route not found or object key not found
- render-error fallback through a route or object-shell ErrorBoundary

Keep the app shell visible when possible. A failed object view should render an inline alert/result/retry surface or a scoped error fallback, not unmount the whole page into blank white.

## Decision order

1. User's explicit request.
2. Existing project stack and UI conventions.
3. Make UI defaults in this skill.

If a detail is not requested and not present in the project, choose the simplest useful UI.

For a new project with no established component library, use shadcn/ui. Follow the shadcn/ui setup path in `component-usage.md`, add only the components needed by the generated screens, and handle missing high-level widgets through shadcn composition or project-local controlled adapters. Do not add another component suite as a shortcut for date ranges, uploads, remote selectors, transfer-style pickers, or tables.

## Dynamic object routes

Make apps can be generated from different object definitions. Do not create one hard-coded route component per object when a dynamic route can represent the object.

Prefer a dynamic object route such as:

```text
/objects/:objectKey
```

If the host project already uses another dynamic convention, follow that convention.

## Do not create views by default

Make currently has no confirmed view UI requirement in this skill. Do not create:

- view tabs
- view dropdowns
- saved views
- Kanban / split / chart view switchers
- "all records / my records" view concepts

Only add these when the user explicitly asks.
