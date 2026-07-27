# editor component selection

Use this file when deciding which editor components to use in a host project.

## 1. Do not force one UI library

This skill does not require a specific UI library.

Do not introduce a new component library when the host project already has a stable editor/component system.

## 2. Selection priority

Choose editor components in this order:

1. existing business field components in the host project
2. existing UI component library already installed in the host project
3. native controls as a fallback

For Make schema-driven cell editing, this priority must produce concrete editor controls from the project / host component library, not a generic text-input fallback for every field:

| Field group | Preferred host component |
| --- | --- |
| Text / URL | Input / 文本输入框 |
| TextArea | TextArea / 多行输入框 |
| Number / Currency / Percent | InputNumber / NumberInput / 数字输入框 |
| Date / DateTime | DatePicker / 日期选择器 |
| DateRange | RangePicker / 日期区间选择器 |
| SingleSelect / MultiSelect | Select / 选择器, using schema options |
| SingleUser / MultiUser | existing user picker / people selector backed by host candidate APIs |
| SingleDepartment / MultiDepartment | existing department picker backed by host candidate APIs |
| File | existing upload / attachment manager |
| ID / Lookup | read-only by default unless the backend explicitly supports editing |

If the host project uses Ant Design, the platform baseline is Input for text, InputNumber with `variant="borderless"` and `controls={false}` for numbers, DatePicker or RangePicker with controlled `open`, and Select with controlled `open` and `getPopupContainer` pointing at the editor popup root. Other component libraries should use equivalent controls and behavior.

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
