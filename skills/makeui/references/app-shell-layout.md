# App shell layout

## Contents

- [Structure](#structure)
- [Header](#header)
- [Current user menu](#current-user-menu)
- [Sidebar](#sidebar)
- [Content height chain](#content-height-chain)
- [Page content](#page-content)

## Structure

Use a fixed-height application shell. This is a hard layout rule for generated Make App shells and object-list pages:

- root shell: full viewport height
- top header: fixed height
- left sidebar: optional, collapsible, independently scrollable
- content region: fills the remaining width and height

The shell must prevent body-level and whole-page scrolling. Scrolling happens only inside the owning region: sidebar, table, drawer body, or route content area. Do not make `body`, the app root, the shell, or the object-list page the scroll container for normal list browsing.

For generated Make App UI, the application shell is mandatory. Start layout work from the shell, not from an isolated list page. Only skip shell generation when an existing project already provides a reusable shell and the task is explicitly to plug a page into that shell.

Default Make App shell:

- left full-height sidebar for app branding, section labels, modules, and Make object navigation
- right-side vertical workspace on a light neutral background
- fixed flat top header inside the workspace
- content region below the header
- no body-level or whole-page scroll

When no project-specific shell already exists, use the platform dense object-management shell as the default:

- sidebar width around 220px
- compact brand block at the top
- brand block may show app logo, app name, and app-level metadata such as object count
- navigation is grouped by module/category section labels
- object navigation items are single-line labels with an icon when available
- active object item uses a clear filled highlight
- workspace header is flat, compact, and only shows the current title plus global right-side current-user menu/actions
- content area starts with the local toolbar, then the table region
- sidebar background color follows the existing project theme or design system; do not default to a dark sidebar unless the project or user asks for it

## Header

Use the top header for global context and actions:

- left side: current object/module name, breadcrumb, or current module context
- right side: global actions such as settings, notifications, help, and the current-user menu

Keep the header visually stable and do not place page-specific bulk actions there unless the page has no local toolbar.

For object list pages, the header should show the selected object name on the left and current user avatar/name on the right. Do not replace this stable header with a large app-title band above the whole page.

Header titles are primary labels only by default:

- show the current object/module name
- do not render a subtitle, description, helper line, schema summary, or "overview" copy under the title unless the user explicitly asks
- keep page-specific actions such as refresh, create, filter, import, export, or batch actions out of the header when a local toolbar exists
- do not insert an additional object-summary title card below the header just to repeat the current title

## Current user menu

Generated Make App shells must expose the current logged-in user in the top header right when the host auth context provides user identity.

Default pattern:

- show only a 32px circular avatar followed by the current user's plain display name
- normalize the host auth/current-context response before rendering; a current-context response such as `{ userId, avatar, name }` must display `name` outside the avatar and use `avatar` as the avatar image
- for display text, prefer `name`, then `userName`, then `displayName`, then `label`; use `userId` only as identity and a last-resort fallback after no human-readable name exists
- for avatar image, prefer `avatar`, then `avatarUrl`, then `avatarURL`, then `photoURL`
- use the current user's real avatar image when the auth/user context provides one
- if no avatar image exists, render a fixed 32px circular fallback avatar with a deterministic random background color selected from a small, readable color palette by user id or display name, centered white text, and the last two characters of the display name; if the display name is shorter than two characters, use the whole display name
- the fallback background color must differ by user when possible, but remain stable for the same user across renders and reloads; do not use one fixed global fallback color for all users or a per-render `Math.random()` color that changes on refresh
- keep the display name outside the avatar; do not put the full name inside the avatar
- keep avatar dimensions fixed at `width: 32px`, `height: 32px`, `border-radius: 50%`, and do not let the name, menu state, or loading state resize it
- do not wrap the avatar/name in a Tag, Badge, pill, tinted capsule, card, or other chip-like background
- do not show a dropdown arrow, dropdown panel, or extra account actions before the user clicks
- clicking the avatar/name trigger opens a dropdown or popover below the header, aligned to the right edge of the trigger
- the dropdown must contain a visible `退出` action
- additional items such as clear cache, change password, language, or settings are optional only when the host project already has those actions or the user asks for them

Do not fabricate a fake user. If the host auth context has not loaded the current user's name yet, show a small loading/skeleton state or a neutral account placeholder until the real identity is available. Do not eagerly render `userId` as both avatar text and display name while `name`, `userName`, `displayName`, or avatar fields are still available in the same context payload.

`makeui` only owns the visual slot, menu item, and interaction surface. The `退出` action handler must come from the host auth integration defined by `make-app-auth`; do not construct logout URLs, clear cookies, or implement auth/session behavior in UI layout code.

## Sidebar

Use the sidebar for app modules or object navigation.

- Support collapse / expand when the app has enough navigation items to benefit from it.
- Keep navigation labels concise.
- Default sidebar navigation items are single-line primary labels only. Do not add per-object subtitles, descriptions, helper text, or second-line summaries by default.
- Object navigation items should link to a dynamic object route, for example `/objects/:objectKey`, instead of separate hard-coded pages per object.
- If navigation is long, scroll inside the sidebar only.
- Do not let sidebar overflow force page-level scrolling.
- Do not move long navigation scrolling to `body`, app root, shell, workspace, or list-page containers.

For a metadata-driven Make App, build navigation from modules or object groups when available. If no grouping exists, list objects directly. Object entries still use a dynamic route such as `/objects/:objectKey`.

If object descriptions exist in host-provided metadata, do not show them under each sidebar item by default. Use them only when the user asks for richer navigation, and prefer a tooltip or detail surface over making every item two lines.

Sidebar active-item alignment is a layout requirement:

- put nav items inside a padded sidebar content area, then let the item fill that content width
- keep active highlight left and right inset consistent; do not let the highlight touch one sidebar edge while leaving extra space on the other side
- avoid negative margins, absolute positioning, or hard-coded left offsets for active backgrounds
- use `box-sizing: border-box`, `width: 100%`, and `align-items: center` for clickable nav rows
- keep icon/text, active background, and hit area vertically centered in the same row height

## Content height chain

Every container between the shell and the working area should preserve height:

- `height: 100%` or viewport-height equivalent at the shell boundary
- `flex: 1`
- `min-height: 0`
- `min-width: 0`
- `overflow: hidden` on layout containers that should not scroll

Use this rule especially for list pages with table regions.

Missing any of these height-chain properties is a layout bug when it causes `body`, the app root, the shell, or the list page to scroll.

## Page content

The content region owns page-local layout:

- list pages: no page-level scroll; table scrolls
- sidebar navigation: no page-level scroll; sidebar nav area scrolls
- drawer forms/details: drawer body scrolls
- route forms/details: route content may scroll inside the content region
