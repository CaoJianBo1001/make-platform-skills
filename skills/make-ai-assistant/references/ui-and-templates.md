# UI and templates

## Default surface

For Make App pages, default to:

- a small floating launcher on the right side, vertically centered
- an assistant conversation panel anchored to the right side
- a focusable `privacyNotice` help Tooltip beside the current context when the
  host provides non-blank text
- a title-side read-only status and a context subtitle that fall back to the
  current App when the host omits one
- compact prompt suggestions scoped to the current App/page
- current user name/avatar in user messages when the host provides them

`makeui` owns surrounding shell layout, placement, and external container
constraints. This Skill owns assistant package props, package visual behavior,
transport, Artifact templates, and action behavior.

## Package visual ownership and responsive behavior

Use the package's public visual contract before adding host CSS.

- Apply `theme?: MakeAiTheme` to `MakeAiAssistant`, `AssistantPanel`, or
  `ArtifactRenderer` when the assistant must follow the host brand. `primary` is
  required; use `onPrimary` when the primary color is light. The package writes
  local `--make-ai-theme-*` variables only and does not change host global theme
  values. Preserve semantic success, warning, and error colors.
- `headerHeight` and `privacyNotice` belong only to `MakeAiAssistant` and
  `AssistantPanel`; `ArtifactRenderer` has no package header. Use
  `headerHeight` or `--make-ai-header-height` for header height. Pass
  `privacyNotice` as text; the package supplies hover/focus Tooltip placement,
  keyboard reachability, and overflow protection. Do not render a duplicate
  privacy banner or manage its overlay outside the package.
- For the default `MakeAiAssistant` surface, use `maxDrawerWidth` to cap desktop
  width. The package starts at 432px, allows left-edge pointer/keyboard resize,
  clamps the maximum to the viewport and minimum, and uses full width without a
  resize handle at viewport widths of 560px or less. `maxDrawerWidth` is not an
  `AssistantPanel` prop.
- Prefer documented namespace variables such as `--make-ai-drawer-width`,
  `--make-ai-drawer-resize-line`, `--make-ai-panel-gutter-wide`,
  `--make-ai-launcher-top`, `--make-ai-launcher-right`, and
  `--make-ai-launcher-mobile-right` for required overrides. Do not target
  internal class names, copy styles, or replace package container queries with
  page-viewport breakpoints.
- Panel content and platform Artifacts react to their own container width. Wide
  surfaces expand content and tables while prose retains a readable line length;
  narrow Markdown tables retain horizontal scrolling. Preserve this behavior in
  an embedded container by giving the panel a real available width rather than a
  fixed page-width assumption.
- `MakeAiAssistant` keeps an opened `AssistantPanel` mounted while closed so an
  active answer continues. Reopening restores the user's previous scroll intent;
  do not unmount it or cancel the run merely because the drawer closed.

## Context-aware display mapping

Use Artifact semantics to choose the display:

| Result shape | Artifact kind | Default display |
| --- | --- | --- |
| one headline value | `metric` | large value card with optional delta |
| several overview indicators | `comparison` | compact metric grid |
| time or ordered series | `trend` | small chart or trend bars |
| ordered Top N, contribution, completion, progress | `ranking` | ordered list with bars or progress values |
| business rows users can inspect | `record-list` | compact record list/table with actions |
| explanation, empty state, risk, success, warning | `notice` | tone-aware message panel |

`comparison` is the default choice for overview/概况/指标 groups that compare
several values at the same level.

Do not force every answer into a table. In a narrow assistant panel, a concise
summary plus two or three focused Artifacts is usually clearer than one large
Markdown block.

## Custom template registry

Use the package registry for custom templates:

- package-level reusable templates belong in `@qfei-design/make-ai-assistant`
- host-specific one-off templates may live in the host only when they are not
  useful for the platform package
- each template declares allowed `kinds`
- `canRender` narrows the data shape
- `priority` resolves ties
- `presentation.template` may request a template id, but the registry remains
  the whitelist
- custom roots or Fragments that need host theming apply
  `renderContext.themeStyle`; package templates receive the same theme without a
  wrapper element

Custom template selection must remain deterministic and safe. Server data cannot
load a new template or override CSS/JS.

## Recommended platform templates

Start with generic templates before adding domain-specific ones:

- `platform.metric.default`
- `platform.comparison.default`
- `platform.trend.default`
- `platform.ranking.default`
- `platform.record-list.default`
- `platform.notice.default`
- `platform.progress-list.default` when ordered completion/progress rows are
  common across Apps

Only add a new package template when it is reusable across multiple Make Apps.
If a template depends on one host's field names or business vocabulary, keep it
out of the platform package.

## Actions

`record-list` rows and other Artifacts may emit actions. The host handles:

- `open-record`: open the detail surface for `entityKey` and `recordId`
- `open-list`: navigate to or filter a list view
- `navigate`: route within the App or platform
- `invoke`: call a host-supported operation

Before executing, the host rechecks permission and validates the target shape.
The package must not execute raw URLs or hidden backend commands.

## Empty and fallback states

- If the transport is unavailable, show a retryable connection state.
- If no Agent is configured, show a clear unavailable state.
- If Artifact validation fails, keep the text response and log safe diagnostics.
- If a custom template cannot render, fall back to the default template for the
  same kind or to a safe notice.
- If the user scrolls away during streaming, do not force-scroll unless the
  package already defines that behavior.
- Show process steps only while the corresponding assistant turn is generating;
  do not preserve internal processing text after completion, failure, or history
  restore. Keep safe retryable connection/service/unknown failures distinct and
  never surface raw upstream diagnostics.
