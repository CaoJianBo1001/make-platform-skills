# App shell layout

## Presentation priority

This reference defines the desktop/tablet shell unless a section explicitly says otherwise. On phones, `mobile-defaults.md` takes precedence: use the package-backed header, account drawer, bottom navigation, workbench, task pages, and local scrolling model instead of the desktop sidebar/header shell.

## Contents

- [Structure](#structure)
- [区域加载态](#区域加载态)
- [Global error outlet](#global-error-outlet)
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

## 区域加载态

本节适用于桌面、平板和手机。刷新、权限校验、Schema、路由或局部数据加载的阻塞提示，必须在**所属区域内水平和垂直居中**，不能把“正在核验访问权限…”或 Loading 文本直接渲染在左上角、边缘或工具栏旁。

- Shell 已挂载：权限与页面加载占据扣除侧栏、顶栏后的主内容区，不覆盖已授权的导航或头部。Shell 尚未挂载：启动 fallback 占据应用可用视口；不能让 Provider 的短文本撑出一个只有一行高的容器。
- 表格、Drawer、Tab、卡片或弹窗的局部加载：使用该区域实际可见的内容槽位，扣除仍保留的标题、工具栏和操作栏；不能使用整个浏览器视口居中，也不能漂移到其他面板。滚动后仍以可见槽位为准，不以长内容总高度的中点定位。
- 容器必须具有明确的可用高度：沿用 Shell 的高度链，flex/grid 子区使用可伸缩布局及 `min-height: 0`、`min-width: 0`；不能在高度未建立的父级下仅写 `height: 100%`，不能用任意固定像素高度或 `100vh` 替代局部剩余空间。替换内容时使用填满槽位的 grid/flex 居中；覆盖加载时，在可见槽位的 `position: relative` 容器内使用 `position: absolute; inset: 0; display: grid; place-items: center`。不强制所有实现都使用 absolute。
- 复用宿主组件库的 Spinner/Spin，加载图标和简短说明作为一组居中，使用主题字号、颜色和间距；不引入新的 UI 库，不使用 Toast 代替区域加载态。状态使用 `role="status"`，所属区域按状态设置 `aria-busy`；不要反复播报。加载期间继续遵守权限门禁，不为了保留布局提前挂载未授权业务内容。
- 按钮内的提交指示、输入框候选搜索和增量加载保留控件自身的局部反馈，不升级为整页遮罩。已有骨架屏可保留其内容结构；区域加载状态结束后移除占位或遮罩，失败与拒绝状态继续走原有错误/权限反馈合同，不能一直显示加载动画。

宿主验收：在真实浏览器延迟权限、Schema 和局部请求，覆盖首次刷新、Shell 前后、Drawer/Tab、滚动及窗口尺寸变化，至少验证桌面和手机。用 `getBoundingClientRect` 比较加载组中心与所属可见区域中心，两个方向误差均不超过 2 CSS px；同时确认不遮挡区域外导航/操作、不新增页面滚动，成功/失败后加载态消失。文档回归检查只证明规范与交接存在，不能替代上述布局验收。

## Global error outlet

When the App uses `make-app-observability`, mount its one global error outlet in the persistent app root, outside branches gated by permission, Schema, or router success; those branches may fail before the page Shell appears. At the `0.1.9+` visual baseline, desktop and phone `MakeAppErrorNoticeViewport` portal the queue to `document.body` after mount, so a fixed `100vh + overflow: hidden` Shell does not clip it. The package places the desktop queue as a top-center Toast at least `24px` from the top, and the phone queue above the viewport center. Let the package own viewport `position`, `inset`, `padding`, safe-area spacing, and long queue scrolling; remove old host positioning overrides and full-screen wrappers. The outlet state and mounted React tree remain reachable before route content appears. Page-local errors may use `MakeAppErrorNotice` without the global viewport.

Resource denial uses inline `MakeAppPermissionNotice` to replace the entire denied business content slot, not the Shell or only its table rows. See the scoped route states below.

The viewport defaults to `z-index: 2000`; if a host overlay can cover it, use the public `zIndex` prop to align layers. In a browser test of the real App Shell on desktop and phone, trigger a request error and check that the full title, description, Trace ID when present, close action, and copy action are visible and operable. Cover the fixed-height overflow Shell, an overlay, long content and a long queue that must scroll to its final card. Test initial permission loading failure before route content mounts as well as a page request failure; the global card must still appear in the first case. Error classification, safe text, and Trace ID propagation remain owned by `make-app-observability`; permission loading behavior remains owned by `make-app-permission`.

When a request error also blocks page content, put the retry action in the content region as a design-system button. Keep the retry button at the horizontal and vertical center of the content region, independent of the top Toast's size or position. Center the button itself, not just a surrounding error block that may shift it off-center. Use the existing component library's appropriate button; if the project has no component library, use its established styled button component. Do not add a new UI library only for retry. The global portal card carries the safe error and Trace ID; it has no retry slot. When that card already explains the failure, the page error state may contain only the centered retry button. Do not append a loose or browser-default button below the card or inside its viewport wrapper. Match the host's button size, spacing, focus, disabled, and pending states; the action must retry the failed operation and avoid duplicate requests while pending. Verify the page error state and top Toast together at desktop and phone widths.

Before the Shell mounts, place an available retry button in a persistent app root fallback and center it within that layer's usable area. This covers initial permission or Schema loading failure without waiting for a route content region. Keep the fallback outside the success branches, use the same project button component, and preserve the top Trace card as a separate global outlet.

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

The rules above are the desktop default. On phones, use the avatar-only top-left trigger and left account drawer defined in `mobile-defaults.md`; do not show the desktop avatar-plus-name trigger or restore the old object-navigation hamburger in that slot.

## Sidebar

Use the sidebar for app modules or object navigation.

- Support collapse / expand when the app has enough navigation items to benefit from it. The independent “我的审批” entry defined below must remain accessible when object/module groups collapse or the sidebar narrows.
- Keep navigation labels concise.
- Default sidebar navigation items are single-line primary labels only. Do not add per-object subtitles, descriptions, helper text, or second-line summaries by default.
- Object navigation items should link to a dynamic object route, for example `/objects/:objectKey`, instead of separate hard-coded pages per object.
- If navigation is long, scroll inside the sidebar only.
- Do not let sidebar overflow force page-level scrolling.
- Do not move long navigation scrolling to `body`, app root, shell, workspace, or list-page containers.

For a metadata-driven Make App, build navigation from modules or object groups when available. If no grouping exists, list objects directly. Object entries still use a dynamic route such as `/objects/:objectKey`.

When [make-app-approval](../../make-app-approval/SKILL.md) requires “我的审批”, render it as a top-level menu item immediately after all visible business objects/module groups in the same navigation list:

- Keep it outside all object/module groups, submenus, and collapsible or “more” containers. Grouping metadata must not turn it into a group child, and expanded-group state must not hide it.
- Use the same row spacing, navigation container, and sidebar scroll area as the preceding menu items. Do not add an approval-only divider, card, footer region, or large blank gap. “After the objects” describes menu order, not the bottom edge of the sidebar or viewport; do not use fixed/sticky positioning, `margin-top: auto`, or a flex spacer to push the item there.
- Collapsing object/module groups must not hide this sibling item. It moves naturally with the preceding menu content and remains after the business entries when objects are reordered or changed. A long navigation list scrolls together, including approval, which may leave the visible area; do not pin it in view. If the existing sidebar narrows to an icon rail, keep its clickable icon with an accessible name and label tooltip.
- Reuse the existing approval route and navigation identity. If it was nested under an object or placed in a fixed bottom region, move that entry after the business entries and remove its old placement, approval-only separator, and spacer instead of creating a duplicate.

This menu-order and shared-scroll rule applies to desktop/tablet sidebars, including the tablet navigation overlay when open. Phone navigation follows [mobile-defaults.md](mobile-defaults.md#底部导航与工作台): reserve one bottom Tab for the generated approval entry and use the remaining capacity for business objects, the optional AI assistant, and the workbench. Keep at most five items and reuse the same approval route and navigation key.

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

## Scoped route states

With an authorized App entry, retain the shell for direct URL object/fixed-page denial and replace only its content slot. Read `make-app-permission/references/scoped-route-feedback.md`. Do not use a full-viewport feedback overlay that hides navigation; keep the existing mobile navigation and independent global error outlet contract. No authorized object or fixed page permits full-page App denial.
