# Component usage

## Contents

- [Selection strategy](#selection-strategy)
- [Default candidate mapping](#default-candidate-mapping)
- [Make field-metadata-driven components](#make-field-metadata-driven-components)
- [Make field properties contract](#make-field-properties-contract)
- [Host form controlled field contract](#host-form-controlled-field-contract)
- [Detail value display](#detail-value-display)
- [Table component rule](#table-component-rule)
- [Action hierarchy](#action-hierarchy)
- [Optional action policy](#optional-action-policy)

## Selection strategy

Use this priority:

1. User-specified component library.
2. Existing project component library.
3. New-project selection among Ant Design, Arco Design, and shadcn/ui when no library exists.

Do not add a new component library to an existing project unless the user asks.

Use this same rule for icons and styling tools.

For new projects, component-library selection is a blocking decision. Actively ask the user to choose one of these ordered options:

1. Ant Design (recommended/default)
2. Arco Design
3. shadcn/ui

Recommend Ant Design as the default option, but do not select it before the user has responded to the component-library choice. The user may either explicitly name Ant Design, Arco Design, or shadcn/ui, or delegate to the default/recommended option. Generic answers such as "default", "recommended", "you decide", "anything is fine", or "whatever" count as choosing Ant Design. Until the user gives one of those explicit or delegated choices, do not scaffold or edit component-library-specific UI code, imports, theme setup, icons, or package dependencies. If progress is still useful before the answer, produce only a component-library-neutral plan, file map, or pseudocode.

Do not mix Ant Design, Arco Design, and shadcn/ui in the same app unless the existing project already does so and the user asks to keep it.

When shadcn/ui is selected, treat it as a source-code component system, not a traditional prebuilt UI package. Follow the official Vite path for new or existing Vite projects:

- ensure Tailwind CSS is configured before generating shadcn/ui components
- ensure the `@/*` alias is configured in TypeScript and Vite
- run the shadcn CLI from `apps/ui` or pass the correct config path for the workspace
- add only the components actually needed by the generated UI
- keep generated shadcn/ui components under the host project's established component path, usually `src/components/ui`
- use `lucide-react` icons unless the project has another established icon system

## Default candidate mapping

When Ant Design is the selected component library:

- shell: `Layout`
- sidebar navigation: `Menu`
- global and page actions: `Button`
- search: `Input` with a search icon or search affordance
- optional filters: `Drawer`, `Popover`, or compact form controls
- create/edit/detail: `Drawer`
- route forms: `Form`
- read-only details: `Descriptions`, simple grids, or cards/panels
- feedback: `message`, `Alert`, `Result`, `Spin`, `Empty`
- avatar and user menu: `Avatar`, `Dropdown`

Use project-standard icons first. If using Ant Design, prefer `@ant-design/icons`.

When shadcn/ui is the selected component system:

- shell: CSS/Tailwind layout with project-local shell components
- sidebar navigation: project-local sidebar/menu components, or shadcn/ui navigation primitives when already added
- global and page actions: `Button`
- search: `Input` with a lucide search icon
- optional filters: `Popover`, `Sheet`, or compact form controls
- create/edit/detail: right-side `Sheet` with `side="right"` by default; do not use bottom Sheet for Make object CRUD unless explicitly requested
- route forms: `Form` with type-appropriate field controls
- read-only details: simple grids or project-local panels; avoid inventing nested card layouts
- feedback: `Alert`, `Skeleton`, toast/sonner, and explicit empty states when those components are installed
- avatar and user menu: `Avatar` and `DropdownMenu`

## Make field-metadata-driven components

Before generating Make forms or field editors, identify the host-provided object/field metadata shape used by the UI. `makeui` chooses controls and layout from that metadata; it does not define business APIs, Service contracts, local DSL loading, or persistence behavior. User/department candidate endpoints are the narrow exception: this file documents how selector UIs consume the host candidate source.

Form and field components should consume normalized UI field metadata, not raw backend objects. If raw metadata is still leaking into components, call out that another layer must normalize it before `makeui` can safely choose controls, required markers, readonly/disabled state, options, or lookup presentation.

If no field metadata exists, stop and call out the missing UI dependency instead of inventing static form controls.

For new Make POC projects, create or reuse a shared field type registry at `apps/ui/src/lib/make-field-types.ts` before implementing field-driven UI. The registry is the shared source for host-owned form controls, detail display, CanvasTable table display, and table cell editors; these consumers should resolve common `Make.Field.*` presentation behavior from the registry instead of carrying separate local mappings. The registry must preserve normalized `field.properties` and expose the properties needed by generated UI, including `format`, `precision`, `decimalPlaces`, `maxCount`, `begin`, `end`, `symbol`, and `useGrouping`. Advanced-filter controls resolve support and editor behavior through `make-app-filter` package APIs, not this registry.

Use type-appropriate controls:

| Make field group | Default control |
| --- | --- |
| `ID`, generated fields | read-only text |
| `Text`, `TextArea`, `URL` | text, textarea, or URL input |
| `Number`, `Currency`, `Percent` | numeric input with display formatting kept out of submit values; submit values are finite numbers or pure numeric strings |
| `Date`, `DateTime`, `DateRange` | date, date-time, or range picker |
| `SingleSelect`, `MultiSelect` | single or multiple select from schema options |
| `SingleUser`, `MultiUser` | searchable user selector using the host-provided candidate source |
| `SingleDepartment`, `MultiDepartment` | searchable department selector using the host-provided candidate source |
| `File` | create: omit when upload requires a saved record identity; edit: attachment component only with saved record identity; detail: attachment display |
| `Lookup` | read-only lookup display by default; association selector only when field metadata and host UI behavior explicitly support editing |

Do not silently degrade date, user, department, select, file, or lookup fields to a bare `Input`.

If a field type is unknown, prefer a read-only display or an explicit unsupported-field fallback. Do not pretend it is a plain text field unless the user confirms that downgrade.

File fields are mode-sensitive. If upload requires a persisted record identity, create forms must omit `Make.Field.File` controls. Render attachment upload/edit only after a record exists and the stable id is available. Detail views may display existing attachments.

## Make field properties contract

Generated Make UI must treat schema `field.properties` as behavior input, not passive documentation. Normalize the raw schema once at the metadata boundary and pass these properties through the shared field registry, form adapters, detail display adapter, CanvasTable handoff, and cell-editor handoff.

| Field type | Property | Required UI behavior |
| --- | --- | --- |
| `Make.Field.Date` | `format` | Use the schema format for DatePicker display, typed input parsing, detail text, and table handoff. If absent, use the host date default consistently instead of mixing formats per surface. |
| `Make.Field.DateTime` | `format` | Use the schema format for date-time picker display, parsing, detail text, and table handoff. Keep submit values in the backend-agreed date-time shape. |
| `Make.Field.DateRange` | `begin`, `end` | Treat `begin` and `end` as the selectable range. Date range controls must disable dates before `begin` or after `end`; with only one boundary present, apply a one-sided disabled-date rule. Submit a structured range such as `{ begin, end }`, not display text. |
| `Make.Field.Number` | `precision` | Configure numeric controls and display formatting from `precision`; validate or normalize decimal places before submit according to the host backend rule. Do not submit formatted display strings. |
| `Make.Field.Currency` | `symbol`, `decimalPlaces`, `useGrouping` | Use `symbol` and `decimalPlaces` in input formatter, detail display, and table display; `useGrouping` controls thousands separators when the host formatter supports it. Store and submit only finite numbers or pure numeric strings. |
| `Make.Field.Percent` | `decimalPlaces` | Use `decimalPlaces` for percent input/display precision and add `%` only in formatter/renderers. Do not multiply or divide values by 100 unless the host metadata or backend contract explicitly says so. |
| `Make.Field.File` | `maxCount` | Use `maxCount` as the attachment selection/upload limit. Disable or block extra choose, drag/drop, paste, and add actions after the limit; show the host validation/error state instead of silently dropping files. Default to the DSL default of `1` when the property is absent. |
| `Make.Field.MultiUser` | `maxCount` | Use `maxCount` as the maximum selected user count. Once reached, disable further candidate selection or prevent the next commit while preserving clear/remove actions. Default to the DSL default when absent. |
| `Make.Field.MultiDepartment` | `maxCount` | Use `maxCount` as the maximum selected department count. Once reached, disable further candidate selection or prevent the next commit while preserving clear/remove actions. Default to the DSL default when absent. |

For Ant Design, this usually maps to `DatePicker` / `RangePicker` `format` and `disabledDate`, `InputNumber` `precision` / formatter / parser, `Upload` or project attachment controls with `maxCount`, and multiple `Select` controls that block extra selections after `maxCount`. Other component libraries should implement equivalent controlled behavior.

Do not hide these rules inside business field-name checks. A field named `amount` is not enough to infer currency behavior; use `type: Make.Field.Currency` plus `field.properties.symbol` and `field.properties.decimalPlaces`.

## Host form controlled field contract

Host form controlled custom field components are mandatory for Make create/edit Drawer forms and route forms. Any reusable field adapter, remote selector, or field-type control rendered under the host form layer must accept the host form's controlled props and forward them to the interactive control that owns the input value:

- required controlled props: `value`, `onChange`, `onBlur`, `id`, `disabled`
- also preserve when provided: `name`, `ref`, `required`, validation status, `aria-invalid`, `aria-describedby`, and project-specific form item context
- normalize event shapes if needed, but call `onChange(nextValue)` with the submitted value shape every time the user commits text, selects an option, clears a value, uploads/removes a file, or confirms a picker
- call or forward `onBlur` so touched state, required validation, and submit-time validation behave the same as native/project controls

The form store and validation state must match the displayed selection. If `validateFields`, a resolver, or a submit handler reads an empty value while the control visually displays a selected user, department, lookup record, date, or option, the field adapter is broken. Display labels, avatars, option objects, and popup rows are presentation data; the form value remains the source of truth.

This contract applies to all type-specific field controls, especially `SingleUser` / `MultiUser`, `SingleDepartment` / `MultiDepartment`, `Lookup`, select, date, file, and custom relation selectors. For `SingleUser`, `SingleDepartment`, and `Lookup`, the selector may keep transient search text, popup open state, loading flags, and fetched candidate options in local state, but local state must not be the source of truth for selected values. Current selected options may be merged into the options list for display, yet the rendered selection must come from the host `value`, and every selection/clear must update the host form through `onChange`.

Component library choice does not require a different contract.

Ant Design, Arco, shadcn, or any existing project component library can be used for the visible control. Do not solve controlled-field bugs by forcing a project to use a specific form item or select component. The required behavior is the library-neutral adapter boundary between the host form layer and the field control.

Common failure pattern to reject:

```tsx
// Broken: the visual selector updates local state, but the host form value stays undefined.
function RemoteUserSelect() {
  const [selected, setSelected] = useState<UserOption | null>(null);
  return <HostSelect value={selected?.label} onChange={setSelected} />;
}
```

Use a controlled adapter instead:

```tsx
type RemoteUserSelectProps = {
  value?: string;
  onChange?: (nextUserId?: string) => void;
  onBlur?: () => void;
  id?: string;
  disabled?: boolean;
};

function RemoteUserSelect({
  value,
  onChange,
  onBlur,
  id,
  disabled,
}: RemoteUserSelectProps) {
  return (
    <HostSelect
      id={id}
      disabled={disabled}
      value={value}
      onChange={(nextUserId) => onChange?.(nextUserId)}
      onBlur={onBlur}
    />
  );
}
```

User and department selectors require a real host-provided candidate source. For generated Make App projects, use the platform default UI-Service candidate contract unless the host project already documents equivalent endpoints or Service/API routes:

- users: `GET /api/users?keyword=&page=&size=` -> `{ users, total }`
- departments: `GET /api/departments?keyword=&page=&size=` -> `{ departments, total }`
- user option identity: `userId`; label: `userName`; optional avatar: `avatar`
- department option identity: `departmentId`; label: `departmentName`; flatten department trees before presenting selector options
- UI sends `keyword`, `page`, and `size`; do not expose a UI-side sort control for these candidate pickers
- search uses the candidate endpoint instead of filtering stale local demo data

This candidate-source rule applies to every user or department selector UI. For surfaces owned by another skill, keep the same candidate-source contract and let that skill own the surface behavior:

- create/edit Drawer forms and route forms
- table cell editors and any canvas-table popup selector
- candidate selectors rendered inside the advanced-filter package panel and table-header filter flow
- reusable business selectors embedded in custom panels

Do not read user/department candidates from field schema `options`, `meta.options`, current table rows, static fixtures, or hardcoded demo data. Those sources may not represent the current org. Current record values may be merged into the selector options only so existing selections keep readable labels while `/api/users` or `/api/departments` is loading or returns no matching page.

If the host project uses different route names, keep the same behavior contract and normalize the response at the UI boundary. Do not call Make user/department backend services directly from `makeui` components when the host project requires a Service/API adapter or another owning transport layer.

When the candidate source is missing and the user confirms a placeholder, use a searchable selector shell that:

- displays the current value from the record
- leaves a clear integration point for the real candidate source
- avoids fake global demo candidates
- shows loading, empty, error, and retry states

For Ant Design, the default form-control mapping is:

- text: `Input`, long text: `Input.TextArea`
- number/currency/percent: `InputNumber`
- date/date-time/date-range: `DatePicker` / `DatePicker.RangePicker`
- select/user/department/lookup candidates: `Select` with `showSearch` and `mode="multiple"` for multi-value fields
- file: no create upload when a saved record identity is required; edit/detail attachment UI after persistence

Platform selector behavior:

- `SingleUser` / `SingleDepartment`: single `Select`; `MultiUser` / `MultiDepartment`: `Select` with `mode="multiple"`
- set `showSearch`, `allowClear`, and `optionFilterProp="label"`
- for user/department fields, use remote search: `filterOption={false}` and call the candidate search function from `onSearch`
- show loading while candidates load; show an error/disabled state such as `人员候选加载失败` or `部门候选加载失败` when the candidate API fails
- merge current record values into options before candidate results so existing selections still display readable labels while async options are empty
- submit user values as `userId`; submit department values as `departmentId`; keep labels only for display
- do not submit display labels, fake ids, or local demo candidates

Detail display for identity fields:

- `SingleUser` / `MultiUser`: read-only avatar/name display; use avatar when present and deterministic initials/color fallback otherwise
- `SingleDepartment` / `MultiDepartment`: read-only department tag/name display
- if the record contains only ids and no labels, resolve labels through normalized current record values or the host candidate source before display; do not show raw ids as the intended final UI unless no label source exists and the UI explicitly marks the dependency gap
- do not render detail identity fields as disabled text inputs

## Detail value display

Detail Drawer and route detail pages must use a normalized field-display adapter pattern. The adapter receives normalized field metadata plus the record value and returns a small display model such as `kind`, `text`, `labels`, `empty`, `href`, `attachments`, `users`, and `lookupReferences`. Detail components render that model; they do not call `String(value)`, `JSON.stringify(value)`, or read backend wrapper objects directly in JSX.

CanvasTable cell rendering still belongs to `canvas-table-integration`. Keep the detail display adapter compatible with the same field-type semantics, but do not implement canvas renderers in `makeui`.

Default detail display by Make field type:

| Make field type | Stable value shape | Detail display |
| --- | --- | --- |
| `Make.Field.ID`, `Make.Field.Text` | primitive or object with display keys | plain read-only text |
| `Make.Field.TextArea` | long text | full-row text, preserved line breaks, safe wrapping |
| `Make.Field.URL` | string or `{ href/url/value, label/name }` | safe clickable link when href is valid; otherwise text |
| `Make.Field.Number` | number or numeric string | formatted number |
| `Make.Field.Currency` | number or pure numeric string | formatted currency added by the frontend field-type display adapter, defaulting to the field/schema symbol or `￥` when absent |
| `Make.Field.Percent` | number or pure numeric string | formatted percent text with `%` added by the frontend field-type display adapter |
| `Make.Field.Date` | date-like value | `YYYY-MM-DD` or the host project date format |
| `Make.Field.DateTime` | date-time-like value | `YYYY-MM-DD HH:mm` or the host project date-time format |
| `Make.Field.DateRange` | `[begin, end]` or `{ begin, end }`, also accepting `start/from/to` aliases when the host already returns them | `YYYY-MM-DD 至 YYYY-MM-DD`; do not render raw JSON such as `{"begin":...,"end":...}` |
| `Make.Field.SingleSelect` | raw value or option object | option label from field metadata, displayed as text/tag |
| `Make.Field.MultiSelect` | array of raw values or option objects | labels/tags joined or wrapped in the project's detail tag style |
| `Make.Field.SingleUser`, `Make.Field.MultiUser` | user object or array, normally with `userId/userName` or `recordID/name` | read-only avatar/name list |
| `Make.Field.SingleDepartment`, `Make.Field.MultiDepartment` | department object/id or array, normally with `departmentId/departmentName` or `recordID/name` | read-only department name/tag list |
| `Make.Field.File` | URL string, file object, JSON string, or array | attachment thumbnails/file chips/links; do not flatten to raw filenames when richer metadata exists |
| `Make.Field.Lookup` | object/JSON wrapper, often `{ entity, field, data }` | extract labels/references from `data`; openable references are links, deleted references are muted/struck through when status is available |

Value extraction should be tolerant but deterministic:

- Number, Currency, and Percent backend/API values stay numeric: accept finite numbers or pure numeric strings only. Do not submit or persist display strings containing `￥`, `¥`, `%`, thousands separators, or unit text.
- Currency and Percent symbols are presentation. Add them only in detail/table renderers or input formatters after finite-number validation, never in the form store value or API payload.
- Use field properties when formatting detail values: `Number.precision`, `Currency.symbol`, `Currency.decimalPlaces`, `Currency.useGrouping`, `Percent.decimalPlaces`, `Date.format`, and `DateTime.format`. DateRange detail values display the record value's range while the field schema `begin` / `end` remains the selectable-boundary rule for edit controls.

- empty values display a muted `-`
- generic object label priority is `label`, `name`, `title`, `displayName`, then `value`
- select labels come from field metadata options before falling back to raw values
- user label priority is `name`, `userName`, `displayName`, then `label`; identity uses `recordID`, `userId`, or `id`
- department label priority is `name`, `departmentName`, `displayName`, then `label`; identity uses `recordID`, `departmentId`, or `id`
- file name priority is `name`, `fileName`, then filename from URL; file URL priority is string value, `url`, then `fileURL`
- lookup wrappers with `data` display extracted data labels; an empty `data` array displays `-`
- JSON-like strings may be parsed only as a compatibility fallback for known structured field types, but raw JSON must not be the intended visual output

Detail layout and overflow:

- common detail values occupy one grid column in the two-column layout
- `TextArea`, long text, URL/link-rich values, `File`, `Lookup`, relation/association values, attachment-heavy values, and rich custom values span the full row
- values wrap safely in detail views; do not force single-line ellipsis on every value
- use ellipsis only in constrained title/action areas or compact chips, and expose the full value through tooltip/title only when actual overflow occurs

## Table component rule

For Make record lists and related-data tables, do not use the table component from the selected UI library.

Always use:

- package: `@qfei-design/canvas-table`
- skill: `canvas-table-integration`

This applies to:

- table display
- row sequence numbers and row-head detail entry by default for every table unless the user explicitly opts out
- pagination or virtual loading layout around the table, only when explicitly requested
- row selection: default for writable Make record lists through
  `make-app-actions`; only when requested for non-Make or strictly read-only
  tables
- cell editing, when requested

The selected UI library can still provide surrounding controls such as buttons, inputs, drawers, popovers, forms, and feedback components.

Do not add pagination controls, page-size selectors, page state, page query params, total-count handling, or paginated data-fetch logic unless the user explicitly asks for pagination.

## Action hierarchy

- Primary action: create/new, save, submit, or the user's stated main action.
- Secondary actions: refresh, export, import, settings, cancel.
- Destructive actions: visually separated from primary actions.

Do not make every toolbar button primary.

## Optional action policy

Optional controls only appear when requested:

- pagination
- filter
- group
- sort
- column settings
- import
- export

If requested, place them according to `list-page-layout.md`.
