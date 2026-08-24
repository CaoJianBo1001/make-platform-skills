# UI and templates

## Default surface

For Make App pages, default to:

- a small floating launcher on the right side, vertically centered
- an assistant conversation panel anchored to the right side
- a visible broadcast/privacy notice when the host provides one
- compact prompt suggestions scoped to the current App/page
- current user name/avatar in user messages when the host provides them

`makeui` owns surrounding shell layout and responsive sizing. This Skill owns
assistant package props, transport, Artifact templates, and action behavior.

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
