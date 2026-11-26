# Styling and responsive rules

## Styling strategy

Use this priority:

1. User-specified styling system.
2. Existing project styling system.
3. Less as a default candidate when no styling system exists.

Do not force Less if the project already uses CSS Modules, Tailwind, styled-components, or another convention.

新项目先按 [页面设计基线与视觉验收](page-design-quality.md) 记录视觉来源、区域间距、内容密度和桌面／手机页面组合。所选方案明确的视觉值优先；本文件的圆角、间距及列数仅作对应值缺失时的回退。布局稳定性、字段／权限／受控值、独立手机 View 及公开弹层合同不随视觉选择取消。

## Layout stability

For app shells and list pages:

- forbid body-level and whole-page scrolling for generated shells and object-list pages
- keep the global shell fixed to viewport height
- preserve `flex: 1`
- use `min-height: 0` and `min-width: 0`
- put scrolling in the intended region only
- on desktop/tablet, keep table wrappers and canvas hosts at `width: 100%` and `height: 100%`; on phones, give the card-list region the remaining height and its own vertical scroll
- avoid fixed table widths/heights unless the user explicitly asks for a fixed-size embedded table

For desktop/tablet list pages, the table region scrolls. For phone list pages, the card-list region scrolls. For long side navigation, the sidebar navigation area scrolls. For drawers, the Drawer body scrolls. For route pages, the content region may scroll. The `body`, app root, shell, workspace, and list-page containers are not acceptable scroll containers for normal object-list browsing.

## Overlay stacking and clipping

Popup controls such as `Select`, `DatePicker`, `Popover`, and identity pickers
must use a portal or `getPopupContainer`-style hook when their owning Modal,
Drawer, panel, or scroll region contains an `overflow: hidden` / `overflow: auto`
clipping ancestor. Mount them outside that ancestor, then keep the popup in the
owning overlay's stacking context or assign a z-index above the owning surface
and mask. Never treat a larger z-index inside the clipped ancestor as a fix.

Verify the popup at the top, bottom, left, and right edges of the owning surface.
Its border, final option, and date panel must remain visible, and scrolling the
Modal/Drawer body must not clip or bury the popup.

Use the installed design system's overlay API rather than standardizing on an
AntD-specific prop. Also verify focus return, keyboard navigation, Escape
ordering, and outside-click handling; visual z-index success alone is not enough.

## Density and spacing

Make App pages are operational tools, not landing pages.

Prefer:

- compact toolbar controls
- stable grid/flex layouts
- clear alignment
- restrained spacing
- section titles for structure
- compact grouped sidebar navigation when no existing shell style exists; background color follows project theme tokens
- active sidebar items centered within the sidebar content gutter, with equal left/right inset
- flat workspace header and direct toolbar-to-table flow for desktop/tablet object lists; phones use their separately composed compact toolbar and card list

Avoid:

- oversized hero sections
- decorative cards around every group
- summary/title cards that repeat the current object title above a default list table
- nested cards inside cards
- one-off gradients or ornaments
- page sections that cause unnecessary vertical scrolling
- active navigation backgrounds that use negative margins or off-center hard-coded offsets
- list tables that render at content width while the page has unused horizontal space

## Form Drawer polish

- keep create/edit form Drawer styling scoped away from list and detail views
- use the active theme’s background and surface colors for the Drawer body and grouped panels. The default light theme can use white panels
- keep panel styling restrained and consume the selected plan; thin neutral border, 6-8px radius, moderate padding, and low shadow are only unconfigured fallbacks
- in percentage-based Drawers, default to stable two-column grids such as `repeat(2, minmax(0, 1fr))` with `min-width: 0` children when the owning content area has enough room
- keep common fields in two columns on desktop by default; narrow containers, long labels, or complex controls may use one column without an additional user instruction
- treat fixed minimum column widths as an overflow risk; use them only after checking the target Drawer width and breakpoint behavior
- align label typography, control height, border radius, and focus ring with the effective plan and selected component library's public tokens; use verified library defaults only for missing values
- let `TextArea`, long text, URL/link, file, lookup/relation, description, attachment-heavy, and rich controls span full width when it improves readability
- omit file upload fields in create mode when upload needs a saved record identity; show attachment controls only after a persisted record exists
- header button density can be slightly more relaxed when a form needs it, but changes should stay scoped away from list and detail action styling

## Detail Drawer polish

- use compact horizontal label/value rows on desktop
- use a two-column detail grid for common fields by default, adapting to one column when the actual content width or value complexity requires it
- make `TextArea`, long text, file, lookup/relation, URL/link-rich, and attachment-heavy values span full width
- prefer subtle row dividers over card-per-field layouts
- keep labels subdued and values readable with safe wrapping
- do not render detail content as an unstyled list or a form-like editable layout

## Responsive defaults

- use the container-width presentation model and package components in `mobile-defaults.md` for new Make Apps and mobile/responsive work
- phone record lists use cards rather than CanvasTable and do not reuse desktop toolbar/table fragments through CSS; standard phone toolbars omit group, sort, record selection and batch actions
- tablet navigation may become an overlay while preserving the desktop information architecture
- phone create/edit/detail surfaces use full-screen route task pages; desktop/tablet CRUD defaults to a right-side Drawer, with ordinary record detail following any explicit [MakeDesign surface choice](component-usage.md#makedesign-branch)
- On desktop/tablet, form grids may collapse from two columns to one when their owning Drawer becomes narrow; this is not the phone task-page field layout.
- On desktop/tablet, toolbar actions may wrap, but create/new should remain easy to find; the phone toolbar is separately composed in `mobile-defaults.md`.
- On desktop/tablet, table horizontal overflow belongs inside the table container; phone card lists must not inherit table overflow styles.

## States

Provide UI states without defining business logic:

- loading
- empty
- error
- forbidden / permission denied
- expired session / unauthenticated
- route or object not found
- render-error fallback
- saving
- disabled
- retry

State copy should be generic unless the user provides domain-specific wording.

For metadata-driven object pages, states belong around the object shell and content region, not only around individual controls. Keep a visible shell or scoped fallback when metadata, data, route, or render failures occur; do not let the UI become a blank white page.

## 控件禁用态与容器衔接

桌面／平板和手机的禁用控件均复用宿主组件库的语义化禁用底色、文字及交互状态，允许保留禁用底色，不强制透明或与可编辑态背景相同。按 token／公开配置的语义区分禁用外观与品牌强调，不直接用 primary／selected 等强调色表示禁用，也不因禁用 token 随主题变色就自行替换颜色。手机 [字段视觉骨架](mobile-form-controls.md#表单视觉骨架) 的行内编辑背景要求适用于可编辑态；禁用控件与只读详情分开，后者仍使用 display adapter。保留真实 disabled、不可写保护及可读对比度，不能只改颜色或单靠透明度禁用。宿主样式只作用于自有控件，公共包通过公开 API 接入，不覆盖其私有结构。

独立页复用表单时，检查页头、内容区与表单容器叠加后的实际 padding、背景及边框，消除与当前设计不符的意外色带、重复分隔线和空占位。留白、卡片及边框是否保留以宿主设计为准，不统一要求所有 App 顶部零留白或去除所有边框。用真实页面及编译样式验证两端，不能只验证样式类名。
