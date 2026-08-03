# editor component selection

Use this file when deciding which editor components to use in a host project.

## 1. Use shadcn/ui for generated Make UI

Generated Make UI uses shadcn/ui as the default component system. Existing
business field components may still be reused when they already satisfy the value,
popup, focus, and visual contracts below.

Do not introduce another component library to replace a missing shadcn/ui widget.
Compose shadcn/ui primitives or create a project-local controlled adapter.

## 2. Selection priority

Choose editor components in this order:

1. existing business field components in the host project
2. shadcn/ui primitives and official recipes
3. native controls wrapped in shadcn-compatible project-local adapters

For Make schema-driven cell editing, this priority must produce concrete editor controls, not a generic text-input fallback for every field:

| Field group | Preferred host component |
| --- | --- |
| Text / URL | shadcn/ui `Input` / 文本输入框 |
| TextArea | shadcn/ui `Textarea` / 多行输入框 |
| Number / Currency / Percent | shadcn/ui `Input` or local `NumberInput` / 数字输入框 with finite parser and hidden steppers when needed |
| Date / DateTime | shadcn/ui Date Picker composition using `Popover` + `Calendar`; DateTime uses a local time-aware adapter |
| DateRange | local date-range picker using `Popover` + `Calendar` range mode and `field.properties.begin/end` |
| SingleSelect | shadcn/ui `Select`, using schema options |
| MultiSelect | local controlled multi-select using `Popover` + `Command` and chips/badges |
| SingleUser / MultiUser | local people selector using `Popover` + `Command`, remote host candidate APIs, and current-value echo |
| SingleDepartment / MultiDepartment | local department selector using `Popover` + `Command`, remote host candidate APIs, and current-value echo |
| File | local `Attachment` display plus native input/dropzone upload manager through host data-source APIs |
| ID / Lookup | read-only by default unless the backend explicitly supports editing |

For shadcn/ui controls, preserve the CanvasTable cell-edit baseline: inline inputs are full-cell and borderless; popup controls use controlled open state; popup content portals to the editor popup root; and date, selector, identity, and attachment panels open immediately after edit activation.

## 3. What to inspect first

Before choosing components, inspect:

- `package.json`
- existing form/editor components
- existing upload/file picker components
- existing people/department selectors
- existing date pickers
- existing business wrappers around a UI library

## 4. Prefer business-field components for complex fields

Strongly prefer existing business components for:

- person
- department
- attachment
- relation-like selectors
- date widgets with business-specific formats or constraints

These fields often have business semantics that generic components do not capture.

## 5. Native controls are acceptable for simple fields

Native or near-native fallback is usually acceptable for:

- simple text
- simple numeric input
- very basic single-select

Do not over-engineer these if the project has no stronger requirements.

## 6. Keep visual consistency with the host project

The editor overlay should look like it belongs in the host project.

Avoid mixing unrelated visual systems unless the user explicitly wants a redesign.

## 7. Attachment-specific guidance

For attachment fields:

- prefer the project's existing upload/file management component
- do not build a pseudo uploader inside canvas render code
- keep upload and file management in DOM/editor space, not canvas shape space
