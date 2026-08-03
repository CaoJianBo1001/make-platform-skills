# Styling and responsive rules

## Styling strategy

Use this priority:

1. User-specified styling system.
2. Existing project styling system.
3. Less as a default candidate when no styling system exists.

Do not force Less if the project already uses CSS Modules, Tailwind, styled-components, or another convention.

## Layout stability

For app shells and list pages:

- forbid body-level and whole-page scrolling for generated shells and object-list pages
- keep the global shell fixed to viewport height
- preserve `flex: 1`
- use `min-height: 0` and `min-width: 0`
- put scrolling in the intended region only
- keep table wrappers and canvas hosts at `width: 100%` and `height: 100%`
- avoid fixed table widths/heights unless the user explicitly asks for a fixed-size embedded table

For list pages, the table region scrolls. For long side navigation, the sidebar navigation area scrolls. For drawers, the Drawer body scrolls. For route pages, the content region may scroll. The `body`, app root, shell, workspace, and list-page containers are not acceptable scroll containers for normal object-list browsing.

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
- flat workspace header and direct toolbar-to-table flow for object list pages

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
- use a subtle neutral Drawer body with lightweight white form panels when grouping helps readability
- keep panel styling restrained: thin neutral border, 6-8px radius, moderate padding, low shadow at most
- in percentage-based Drawers, prefer stable two-column grids such as `repeat(2, minmax(0, 1fr))` with `min-width: 0` children
- keep common fields in two columns on desktop; avoid one full-width row per field unless the user explicitly asks
- treat fixed minimum column widths as an overflow risk; use them only after checking the target Drawer width and breakpoint behavior
- align label typography, control height, border radius, and focus ring with existing project tokens or Ant Design defaults before adding custom values
- let `TextArea`, long text, URL/link, file, lookup/relation, description, attachment-heavy, and rich controls span full width when it improves readability
- omit file upload fields in create mode when upload needs a saved record identity; show attachment controls only after a persisted record exists
- header button density can be slightly more relaxed when a form needs it, but changes should stay scoped away from list and detail action styling

## Detail Drawer polish

- use compact horizontal label/value rows on desktop
- use a two-column detail grid for common fields
- make `TextArea`, long text, file, lookup/relation, URL/link-rich, and attachment-heavy values span full width
- prefer subtle row dividers over card-per-field layouts
- keep labels subdued and values readable with safe wrapping
- do not render detail content as an unstyled list or a form-like editable layout

## Responsive defaults

- sidebar may collapse or become an overlay on small screens
- Drawer width may become `100%` on small screens, but create/edit/detail surfaces still open from the right rather than becoming bottom sheets
- form grids collapse from two columns to one column
- toolbar actions may wrap, but create/new should remain easy to find
- table horizontal overflow belongs inside the table container

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
